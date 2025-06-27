import Stripe from "https://esm.sh/stripe@14.21.0";

import { corsHeaders } from "@shared/cors.ts";
import { createSupabaseClient } from "@shared/stripe-helpers.ts";

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

  const { sessionId, userId } = body;

  if (!sessionId || !userId) {
    console.error("Missing parameters:", { sessionId, userId });
    return new Response(
      JSON.stringify({ error: "Missing required parameters" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
    console.log("Verifying payment for session:", sessionId, "user:", userId);

    // Retrieve the checkout session from Stripe with retry logic
    let session;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["subscription"],
        });
        break;
      } catch (stripeError) {
        retryCount++;
        console.error(
          `Stripe API error (attempt ${retryCount}):`,
          stripeError.message,
        );

        if (retryCount >= maxRetries) {
          throw new Error(
            `Failed to retrieve session after ${maxRetries} attempts: ${stripeError.message}`,
          );
        }

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }

    console.log("Retrieved Stripe session:", {
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      metadata: session.metadata,
    });

    // Check if payment was successful
    if (session.payment_status !== "paid" || session.status !== "complete") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment not completed",
          payment_status: session.payment_status,
          status: session.status,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify the user ID matches
    if (session.metadata?.user_id !== userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "User ID mismatch",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verification only - webhook handles all database updates
    // This function just confirms the payment was successful
    return new Response(
      JSON.stringify({
        success: true,
        planId: session.metadata?.plan_id,
        subscriptionId: session.subscription?.id || session.subscription,
        customerId: session.customer,
        sessionId: session.id,
        message:
          "Payment verified. Subscription status will be updated via webhook.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Stripe session verification error:", {
      message: err.message,
      stack: err.stack,
      sessionId,
      userId,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to verify payment session",
        details: err.message,
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
