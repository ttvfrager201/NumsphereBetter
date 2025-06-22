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
    const planPriceMap: Record<string, string> = {
      starter: "price_1RcsajB6b7vINOBH3AdUv05j",
      business: "price_1RctJ5B6b7vINOBHvuYvAHES",
      enterprise: "price_1RctJQB6b7vINOBHp3CpujGn",
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
    if (!picaSecret) {
      console.error("PICA_SECRET_KEY not found in environment");
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
      "x-pica-connection-key":
        "live::stripe::default::06f4b8063c8b435f99ca398191265ea2|4c119ea8-ec05-41e7-9507-50aeb24ff1ab",
      "x-pica-action-id": "conn_mod_def::GCmLNSLWawg::Pj6pgAmnQhuqMPzB8fquRg",
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
