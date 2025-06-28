import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers - All restrictions removed
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true",
};

// Database types
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
        Insert: {
          created_at?: string | null;
          id?: string;
          plan_id: string;
          status?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          plan_id?: string;
          status?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Configuration utilities
function logConfig(context: string): void {
  console.log(`[${context}] Configuration:`, {
    supabase_url: Deno.env.get("SUPABASE_URL"),
    frontend_url: Deno.env.get("FRONTEND_URL"),
    vite_app_url: Deno.env.get("VITE_APP_URL"),
    deployment_url: Deno.env.get("DEPLOYMENT_URL"),
  });
}

function createSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Log configuration for debugging
  logConfig("verify-payment");

  let body;
  try {
    body = await req.json();
  } catch (err) {
    console.error("Error parsing request body:", err);
    return new Response(
      JSON.stringify({
        error: "Invalid JSON in request body",
        details: err.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  console.log("Received request body:", body);

  const { sessionId, userId, action, securityToken } = body || {};

  if (!sessionId) {
    console.error("Missing sessionId parameter:", { body, sessionId, userId });
    return new Response(
      JSON.stringify({
        error: "Missing sessionId parameter",
        received: {
          sessionId,
          userId,
          action,
          securityToken: securityToken ? "present" : "missing",
        },
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!userId) {
    console.error("Missing userId parameter:", { body, sessionId, userId });
    return new Response(
      JSON.stringify({
        error: "Missing userId parameter",
        received: {
          sessionId,
          userId,
          action,
          securityToken: securityToken ? "present" : "missing",
        },
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Log security token for debugging (in production, you might want to validate this)
  if (securityToken) {
    console.log(
      "Security token received:",
      securityToken.substring(0, 8) + "...",
    );
  }

  // Handle automatic refund requests
  if (action === "refund_failed_payment") {
    return await handleAutomaticRefund(sessionId, userId);
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

// Handle automatic refunds for failed payment verification
async function handleAutomaticRefund(sessionId: string, userId: string) {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    return new Response(JSON.stringify({ error: "Configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
  const supabase = createSupabaseClient();

  try {
    console.log(
      `[refund] Processing automatic refund for session ${sessionId}, user ${userId}`,
    );

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found", refund_initiated: false }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if payment was actually made
    if (session.payment_status === "paid" && session.payment_intent) {
      try {
        // Get the payment intent to find the charge
        const paymentIntent = await stripe.paymentIntents.retrieve(
          session.payment_intent as string,
        );

        if (paymentIntent.charges?.data?.[0]?.id) {
          const chargeId = paymentIntent.charges.data[0].id;

          // Create refund
          const refund = await stripe.refunds.create({
            charge: chargeId,
            reason: "requested_by_customer",
            metadata: {
              user_id: userId,
              session_id: sessionId,
              auto_refund: "payment_verification_failed",
              processed_at: new Date().toISOString(),
            },
          });

          console.log(`[refund] Refund created successfully:`, {
            refund_id: refund.id,
            amount: refund.amount,
            status: refund.status,
            charge_id: chargeId,
          });

          // Log the refund in database
          await supabase.from("payment_security_log").insert({
            user_id: userId,
            event_type: "automatic_refund_verification_failed",
            payload: {
              refund_id: refund.id,
              session_id: sessionId,
              charge_id: chargeId,
              amount: refund.amount,
              reason: "payment_verification_failed",
            },
            status: "completed",
            created_at: new Date().toISOString(),
          });

          return new Response(
            JSON.stringify({
              refund_initiated: true,
              refund_id: refund.id,
              amount: refund.amount,
              status: refund.status,
              message: "Automatic refund processed successfully",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      } catch (refundError) {
        console.error(`[refund] Error processing refund:`, refundError);

        // Log refund failure
        await supabase.from("payment_security_log").insert({
          user_id: userId,
          event_type: "refund_failed",
          payload: {
            session_id: sessionId,
            error: refundError.message,
            payment_intent: session.payment_intent,
          },
          status: "failed",
          error_message: refundError.message,
          created_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({
            refund_initiated: false,
            error: "Refund processing failed",
            details: refundError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // No payment to refund
    return new Response(
      JSON.stringify({
        refund_initiated: false,
        message: "No payment found to refund",
        payment_status: session.payment_status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error(`[refund] Error in automatic refund process:`, error);

    return new Response(
      JSON.stringify({
        refund_initiated: false,
        error: "Automatic refund failed",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
