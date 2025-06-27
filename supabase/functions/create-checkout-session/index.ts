import Stripe from "https://esm.sh/stripe@14.21.0";

// CORS headers - All restrictions removed
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
};

// Configuration utilities
function getFrontendBaseUrl(): string {
  // Use the hardcoded URL for your Tempo deployment
  const baseUrl = "https://festive-archimedes4-plpw3.view-3.tempo-dev.app";
  console.log("Using frontend base URL:", baseUrl);
  return baseUrl;
}

function logConfig(context: string): void {
  console.log(`[${context}] Configuration:`, {
    supabase_url: Deno.env.get("SUPABASE_URL"),
    frontend_url: Deno.env.get("FRONTEND_URL"),
    vite_app_url: Deno.env.get("VITE_APP_URL"),
    deployment_url: Deno.env.get("DEPLOYMENT_URL"),
    frontend_base_url: getFrontendBaseUrl(),
  });
}

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

  const { planId, userId, userEmail } = body;

  if (!planId || !userId || !userEmail) {
    console.error("Missing parameters:", { planId, userId, userEmail });
    return new Response(
      JSON.stringify({
        error: "Missing required parameters",
        details: `planId: ${!!planId}, userId: ${!!userId}, userEmail: ${!!userEmail}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const planPriceMap: Record<string, string> = {
    starter: "price_1RcsXnB6b7vINOBHFKemTArF",
    business: "price_1RdKsrB6b7vINOBHH5zkVavh",
    enterprise: "price_1RdKtCB6b7vINOBHAJNJibdz",
  };

  const priceId = planPriceMap[planId as keyof typeof planPriceMap];
  if (!priceId) {
    console.error("Invalid planId:", planId);
    return new Response(JSON.stringify({ error: "Invalid plan ID" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    console.error("Missing Stripe secret key in environment");
    return new Response(
      JSON.stringify({ error: "Configuration error: Missing Stripe key" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

  try {
    const frontendUrl = getFrontendBaseUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/success`,
      cancel_url: `${frontendUrl}/plan-selection`,
      customer_email: userEmail,
      metadata: {
        user_id: userId,
        plan_id: planId,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan_id: planId,
        },
      },
      automatic_tax: { enabled: false },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      phone_number_collection: {
        enabled: true,
      },
    });

    console.log("Checkout session created successfully:", {
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });

    return new Response(
      JSON.stringify({
        url: checkoutSession.url,
        sessionId: checkoutSession.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Stripe checkout session error:", err.message, err.stack);
    return new Response(
      JSON.stringify({
        error: "Failed to create checkout session",
        details: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
