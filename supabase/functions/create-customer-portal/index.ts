import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers - Enhanced for better compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
};

// Database types
type Database = {
  public: {
    Tables: {
      user_subscriptions: {
        Row: {
          created_at: string | null;
          id: string;
          plan_id: string;
          status: string | null;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
      };
    };
  };
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    console.error("Invalid JSON input:", err.message);
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize environment variables
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
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Get user's Stripe customer ID from user_subscriptions table
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (subscriptionError || !subscriptionData?.stripe_customer_id) {
      console.log("No subscription data found for user:", userId);
      return new Response(
        JSON.stringify({
          error: "No active subscription found",
          message:
            "You need an active subscription to access the billing portal",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const customerId = subscriptionData.stripe_customer_id;

    // Get the origin from request headers or use the project URL
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
      "https://epic-lehmann4-8kltr.view-3.tempo-dev.app";

    console.log("Creating customer portal for customer:", customerId);
    console.log("Return URL:", `${origin}/dashboard`);

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard`,
    });

    console.log("Customer portal created successfully:", portalSession.url);

    return new Response(
      JSON.stringify({
        success: true,
        customerPortalUrl: portalSession.url,
        message: "Customer portal session created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error creating customer portal:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to create customer portal",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
