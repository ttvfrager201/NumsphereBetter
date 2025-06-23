/*
 * STRIPE + PICA SETUP GUIDE:
 *
 * 1. Get your Stripe API keys:
 *    - Go to https://dashboard.stripe.com/apikeys
 *    - Copy your Secret Key (starts with sk_)
 *
 * 2. Set up Pica connection:
 *    - Go to https://app.picaos.com
 *    - Create a new Stripe connection
 *    - Copy the connection key and action ID
 *
 * 3. Set environment variables in Supabase:
 *    - PICA_SECRET_KEY: Your Pica secret key
 *    - PICA_CONNECTION_KEY: Your Pica connection key
 *    - PICA_ACTION_ID: Your Pica action ID
 *
 * 4. Create Stripe products and prices:
 *    - Go to https://dashboard.stripe.com/products
 *    - Create products for each plan (starter, business, enterprise)
 *    - Copy the price IDs and update the planPriceMap below
 *
 * 5. Test the integration:
 *    - Use Stripe test mode first
 *    - Test with card number 4242424242424242
 */

import { corsHeaders } from "@shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
      status: 200,
    });
  }

  try {
    const { planId, userId, userEmail } = await req.json();

    console.log("Received request:", { planId, userId, userEmail });

    if (!planId || !userId || !userEmail) {
      console.error("Missing required parameters:", {
        planId,
        userId,
        userEmail,
      });
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Map plan IDs to Stripe Price IDs
    // TODO: Replace these with your actual Stripe Price IDs from your dashboard
    const planPriceMap: Record<string, string> = {
      starter: "price_1RcsajB6b7vINOBH3AdUv05j", // Replace with your starter plan price ID
      business: "price_1RctJ5B6b7vINOBHvuYvAHES", // Replace with your business plan price ID
      enterprise: "price_1RctJQB6b7vINOBHp3CpujGn", // Replace with your enterprise plan price ID
    };

    const priceId = planPriceMap[planId];
    if (!priceId) {
      console.error("Invalid plan ID:", planId);
      return new Response(JSON.stringify({ error: "Invalid plan ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log("Using price ID:", priceId);

    // Get environment variables
    const picaSecret = Deno.env.get("PICA_SECRET_KEY");
    const picaConnectionKey = Deno.env.get("PICA_CONNECTION_KEY");
    const picaActionId = Deno.env.get("PICA_ACTION_ID");

    if (!picaSecret) {
      console.error("PICA_SECRET_KEY not found in environment");
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!picaConnectionKey) {
      console.error("PICA_CONNECTION_KEY not found in environment");
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!picaActionId) {
      console.error("PICA_ACTION_ID not found in environment");
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Create Stripe checkout session using the Pica API
    const url = "https://api.picaos.com/v1/passthrough/v1/checkout/sessions";
    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-pica-secret": picaSecret,
      "x-pica-connection-key": picaConnectionKey,
      "x-pica-action-id": picaActionId,
    };

    const origin =
      req.headers.get("origin") ||
      "https://eloquent-colden2-jmaha.view-3.tempo-dev.app";

    const params = new URLSearchParams();
    params.append("automatic_tax[enabled]", "true");
    params.append("mode", "subscription");
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
    params.append(
      "success_url",
      `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    );
    params.append("cancel_url", `${origin}/plan-selection`);
    params.append("customer_email", userEmail);
    params.append("payment_method_types[0]", "card");
    params.append("metadata[user_id]", userId);
    params.append("metadata[plan_id]", planId);

    console.log("Making request to Pica API with params:", params.toString());

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: params,
    });

    console.log("Pica API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Pica API error response:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return new Response(
        JSON.stringify({
          error: "Failed to create checkout session",
          details: `API returned ${response.status}: ${errorText}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    const checkoutSession = await response.json();
    console.log("Checkout session created successfully:", {
      id: checkoutSession.id,
      url: checkoutSession.url ? "URL present" : "URL missing",
    });

    if (!checkoutSession.url) {
      console.error("No checkout URL in response:", checkoutSession);
      return new Response(
        JSON.stringify({ error: "No checkout URL received from Stripe" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    return new Response(
      JSON.stringify({
        url: checkoutSession.url,
        sessionId: checkoutSession.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Unexpected error in checkout session creation:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
