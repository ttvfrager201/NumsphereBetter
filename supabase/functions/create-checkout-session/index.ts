import Stripe from "https://esm.sh/stripe@14.21.0";

// CORS headers - All restrictions removed
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
};

// Configuration utilities
async function getFrontendBaseUrl(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/app_settings?select=frontend_url&key=eq.frontend_base_url`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0 && data[0].frontend_url) {
        console.log("Using database frontend URL:", data[0].frontend_url);
        return data[0].frontend_url;
      }
    }

    // Fallback to environment variable or default
    const fallbackUrl =
      Deno.env.get("FRONTEND_URL") ||
      "https://mystifying-torvalds4-r9r87.view-3.tempo-dev.app";
    console.log("Using fallback frontend URL:", fallbackUrl);
    return fallbackUrl;
  } catch (error) {
    console.error("Error fetching frontend URL from database:", error);
    const fallbackUrl =
      Deno.env.get("FRONTEND_URL") ||
      "https://mystifying-torvalds4-r9r87.view-3.tempo-dev.app";
    console.log("Using fallback frontend URL due to error:", fallbackUrl);
    return fallbackUrl;
  }
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
    const frontendUrl = await getFrontendBaseUrl();

    // Generate enhanced security tokens
    const securityToken = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();
    const timestamp = Date.now().toString();
    const expiryTime = Date.now() + 15 * 60 * 1000; // 15 minutes

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/success?session_id={CHECKOUT_SESSION_ID}&security_token=${securityToken}&session_token=${sessionToken}&redirect_to_dashboard=true`,
      cancel_url: `${frontendUrl}/plan-selection?cancelled=true&reason=user_cancelled`,
      customer_email: userEmail,
      metadata: {
        user_id: userId,
        plan_id: planId,
        security_token: securityToken,
        session_token: sessionToken,
        created_timestamp: timestamp,
        expiry_time: expiryTime.toString(),
        frontend_url: frontendUrl,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan_id: planId,
          security_token: securityToken,
          session_token: sessionToken,
          created_timestamp: timestamp,
        },
      },
      automatic_tax: { enabled: false },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      phone_number_collection: {
        enabled: true,
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes expiry
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
