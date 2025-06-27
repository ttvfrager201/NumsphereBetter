import { corsHeaders } from "@shared/cors.ts";
import {
  verifyStripeWebhook,
  createSupabaseClient,
} from "@shared/stripe-helpers.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Verify webhook signature first (security)
    const body = await req.text();
    const event = verifyStripeWebhook(req, body);

    console.log(`Processing webhook: ${event.type}`);

    // Handle only essential events
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSuccess(event.data.object);
        break;

      default:
        console.log(`Ignored event: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error.message);
    return new Response(JSON.stringify({ error: "Webhook failed" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Handle subscription creation/updates
async function handleSubscriptionChange(subscription: any) {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;

  if (!userId || !planId) {
    console.error("Missing user_id or plan_id in metadata", {
      userId,
      planId,
      metadata: subscription.metadata,
    });
    return;
  }

  const supabase = createSupabaseClient();

  try {
    console.log(
      `Processing subscription change for user ${userId}, plan ${planId}, status ${subscription.status}`,
    );

    // Update user payment status with timestamp
    const { error: userError } = await supabase
      .from("users")
      .update({
        has_completed_payment: subscription.status === "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (userError) {
      console.error("Error updating user payment status:", userError);
      throw userError;
    }

    // Update subscription record with better conflict handling
    const { error: subError } = await supabase
      .from("user_subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_id: planId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer,
          status: subscription.status,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: false,
        },
      );

    if (subError) {
      console.error("Error updating subscription:", subError);
      throw subError;
    }

    console.log(
      `Successfully updated subscription for user ${userId} to status ${subscription.status}`,
    );
  } catch (error) {
    console.error("Database update failed:", error);
    throw error;
  }
}

// Handle subscription cancellation
async function handleSubscriptionCanceled(subscription: any) {
  const supabase = createSupabaseClient();

  try {
    console.log(
      `Processing subscription cancellation for subscription ${subscription.id}`,
    );

    // Find user by subscription ID
    const { data, error: fetchError } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_id")
      .eq("stripe_subscription_id", subscription.id)
      .single();

    if (fetchError) {
      console.error("Error finding subscription:", fetchError);
      throw fetchError;
    }

    if (data?.user_id) {
      console.log(`Canceling subscription for user ${data.user_id}`);

      // Mark payment as incomplete with timestamp
      const { error: userError } = await supabase
        .from("users")
        .update({
          has_completed_payment: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.user_id);

      if (userError) {
        console.error("Error updating user payment status:", userError);
        throw userError;
      }

      // Update subscription status
      const { error: subError } = await supabase
        .from("user_subscriptions")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);

      if (subError) {
        console.error("Error updating subscription status:", subError);
        throw subError;
      }

      console.log(
        `Successfully canceled subscription for user ${data.user_id}`,
      );
    } else {
      console.log("No user found for subscription", subscription.id);
    }
  } catch (error) {
    console.error("Cancellation update failed:", error);
    throw error;
  }
}

// Handle successful payments
async function handlePaymentSuccess(invoice: any) {
  if (!invoice.subscription) {
    console.log(
      "No subscription found in invoice, skipping payment success handling",
    );
    return;
  }

  const supabase = createSupabaseClient();

  try {
    console.log(
      `Processing payment success for subscription ${invoice.subscription}`,
    );

    // Find user by subscription ID
    const { data, error: fetchError } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_id")
      .eq("stripe_subscription_id", invoice.subscription)
      .single();

    if (fetchError) {
      console.error("Error finding subscription for payment:", fetchError);
      throw fetchError;
    }

    if (data?.user_id) {
      console.log(`Confirming payment for user ${data.user_id}`);

      // Ensure payment status is active with timestamp
      const { error: userError } = await supabase
        .from("users")
        .update({
          has_completed_payment: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.user_id);

      if (userError) {
        console.error("Error updating user payment status:", userError);
        throw userError;
      }

      // Update subscription status
      const { error: subError } = await supabase
        .from("user_subscriptions")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", invoice.subscription);

      if (subError) {
        console.error("Error updating subscription status:", subError);
        throw subError;
      }

      console.log(`Successfully confirmed payment for user ${data.user_id}`);
    } else {
      console.log("No user found for subscription", invoice.subscription);
    }
  } catch (error) {
    console.error("Payment confirmation failed:", error);
    throw error;
  }
}
