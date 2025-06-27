import Stripe from "https://esm.sh/stripe@14.21.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Configuration utilities
function getFrontendBaseUrl(): string {
  return "https://boring-banach8-97srj.view-3.tempo-dev.app";
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
  // Log configuration for debugging
  logConfig("create-checkout-session");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
      status: 200,
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

  // Updated price IDs - make sure these match your Stripe dashboard
  const planPriceMap: Record<string, string> = {
    starter: "price_1RcsXnB6b7vINOBHFKemTArF",
    business: "price_1RdKsrB6b7vINOBHH5zkVavh",
    enterprise: "price_1RdKtCB6b7vINOBHAJNJibdz",
  };

  console.log(
    "Creating checkout session for plan:",
    planId,
    "with price:",
    planPriceMap[planId as keyof typeof planPriceMap],
  );

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
    // Get the frontend base URL
    const frontendUrl = getFrontendBaseUrl();

    console.log(`[create-checkout-session] Using frontend URL: ${frontendUrl}`);
    console.log(
      `[create-checkout-session] Creating checkout session for plan: ${planId}, user: ${userId}`,
    );
    console.log(`[create-checkout-session] Price ID: ${priceId}`);
    console.log(`[create-checkout-session] Customer email: ${userEmail}`);
    console.log(
      `[create-checkout-session] Success URL: ${frontendUrl}/success`,
    );
    console.log(
      `[create-checkout-session] Cancel URL: ${frontendUrl}/plan-selection`,
    );

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

    console.log("Checkout session created successfully:", checkoutSession.id);

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
    console.error("Stripe checkout session error:", err.message);
    return new Response(
      JSON.stringify({ error: "Failed to create checkout session" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
