import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, newPlanId } = await req.json();

    if (!userId || !newPlanId) {
      return new Response(
        JSON.stringify({ error: "Missing userId or newPlanId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing environment variables" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's current subscription
    const { data: subscription, error: dbError } = await supabase
      .from("user_subscriptions")
      .select("stripe_subscription_id, plan_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (dbError || !subscription?.stripe_subscription_id) {
      return new Response(
        JSON.stringify({ error: "No active subscription found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get the current subscription from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id,
    );

    if (!stripeSubscription.items.data[0]) {
      return new Response(
        JSON.stringify({ error: "No subscription items found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Plan price mapping
    const planPriceMap: Record<string, string> = {
      starter: "price_1RcsXnB6b7vINOBHFKemTArF", // $10/month
      business: "price_1RdKsrB6b7vINOBHH5zkVavh", // $29/month
      enterprise: "price_1RdKtCB6b7vINOBHAJNJibdz", // $99/month
    };

    const newPriceId = planPriceMap[newPlanId as keyof typeof planPriceMap];
    if (!newPriceId) {
      return new Response(JSON.stringify({ error: "Invalid plan ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(
      `Changing plan from ${subscription.plan_id} to ${newPlanId} for next billing cycle`,
    );

    // Schedule plan change for next billing cycle with no immediate charge
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: "none", // No immediate charge
        billing_cycle_anchor: "unchanged", // Keep current billing cycle
        metadata: {
          ...stripeSubscription.metadata,
          old_plan_id: subscription.plan_id,
          new_plan_id: newPlanId,
          plan_change_scheduled: "true",
          scheduled_for_next_cycle: "true",
        },
      },
    );

    // Update the database to reflect the scheduled plan change
    const { error: dbUpdateError } = await supabase
      .from("user_subscriptions")
      .update({
        scheduled_plan_change: newPlanId,
        plan_change_date: new Date(
          updatedSubscription.current_period_end * 1000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("status", "active");

    console.log("Plan change scheduled successfully:", {
      subscriptionId: updatedSubscription.id,
      oldPlan: subscription.plan_id,
      newPlan: newPlanId,
      nextBillingDate: new Date(
        updatedSubscription.current_period_end * 1000,
      ).toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Plan change scheduled successfully! Your ${newPlanId} plan will be active on ${new Date(updatedSubscription.current_period_end * 1000).toLocaleDateString()}. You'll continue to enjoy your current ${subscription.plan_id} plan until then.`,
        nextBillingDate: new Date(
          updatedSubscription.current_period_end * 1000,
        ).toISOString(),
        oldPlan: subscription.plan_id,
        newPlan: newPlanId,
        scheduledChange: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error changing subscription plan:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to change subscription plan",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
