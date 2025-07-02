import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

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
    console.log("[create-customer-portal] Function started");

    let requestBody;
    try {
      requestBody = await req.json();
      console.log("[create-customer-portal] Request body parsed:", {
        userId: requestBody?.userId ? "present" : "missing",
      });
    } catch (parseError) {
      console.error("[create-customer-portal] JSON parse error:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { userId } = requestBody;

    if (!userId) {
      console.error("[create-customer-portal] Missing userId");
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");

    console.log("[create-customer-portal] Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseServiceKey: !!supabaseServiceKey,
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[create-customer-portal] Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Service configuration error - Supabase" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    console.log("[create-customer-portal] Stripe key check:", {
      hasStripeKey: !!stripeSecretKey,
      keyLength: stripeSecretKey?.length || 0,
    });

    if (!stripeSecretKey) {
      console.error("[create-customer-portal] Missing Stripe configuration");
      return new Response(
        JSON.stringify({ error: "Payment service not configured - Stripe" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Get user's Stripe customer ID
    console.log(
      "[create-customer-portal] Fetching subscription data for user:",
      userId,
    );

    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .not("stripe_customer_id", "is", null)
      .maybeSingle();

    console.log("[create-customer-portal] Subscription query result:", {
      hasData: !!subscriptionData,
      hasCustomerId: !!subscriptionData?.stripe_customer_id,
      error: subscriptionError?.message || null,
    });

    if (subscriptionError && subscriptionError.code !== "PGRST116") {
      console.error(
        "[create-customer-portal] Database error:",
        subscriptionError,
      );
      return new Response(
        JSON.stringify({
          error: "Database error",
          details: subscriptionError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!subscriptionData?.stripe_customer_id) {
      console.log(
        "[create-customer-portal] No customer ID found for user:",
        userId,
      );
      return new Response(
        JSON.stringify({
          error: "No customer found",
          message:
            "You need to complete a payment first to access the billing portal",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create customer portal session with proper return URL
    const origin = req.headers.get("origin") || req.headers.get("referer");
    let returnUrl =
      "https://priceless-hertz7-neblc.view-3.tempo-dev.app/dashboard";

    // Use the origin if it's available and looks like a valid URL
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (
          originUrl.hostname.includes("tempo-dev.app") ||
          originUrl.hostname.includes("localhost") ||
          originUrl.hostname.includes("127.0.0.1") ||
          originUrl.hostname.includes("priceless-hertz7-neblc")
        ) {
          returnUrl = `${origin}/dashboard`;
        }
      } catch (e) {
        console.log(
          "[create-customer-portal] Invalid origin URL, using default:",
          e.message,
        );
      }
    }

    console.log(`[create-customer-portal] Using return URL: ${returnUrl}`);
    console.log(
      `[create-customer-portal] Creating portal session for customer: ${subscriptionData.stripe_customer_id}`,
    );

    let portalSession;
    try {
      portalSession = await stripe.billingPortal.sessions.create({
        customer: subscriptionData.stripe_customer_id,
        return_url: returnUrl,
      });
      console.log(
        "[create-customer-portal] Portal session created successfully",
      );
    } catch (stripeError) {
      console.error("[create-customer-portal] Stripe error:", stripeError);
      return new Response(
        JSON.stringify({
          error: "Failed to create billing portal session",
          details: stripeError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ url: portalSession.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[create-customer-portal] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to create customer portal",
        details: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
