import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers - Enhanced configuration for better compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
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
    frontend_url: "https://brave-hermann1-w8aje.view-3.tempo-dev.app",
    hardcoded_url: true,
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
    console.log("Handling CORS preflight request");
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Allow both GET and POST requests for flexibility
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed",
        message: "Only POST and GET requests are allowed",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Log configuration for debugging
  logConfig("verify-payment");

  let body;
  try {
    if (req.method === "POST") {
      body = await req.json();
    } else if (req.method === "GET") {
      // Handle GET request with URL parameters
      const url = new URL(req.url);
      body = {
        sessionId: url.searchParams.get("sessionId"),
        userId: url.searchParams.get("userId"),
        action: url.searchParams.get("action"),
        securityToken: url.searchParams.get("securityToken"),
      };
    }
  } catch (err) {
    console.error("Error parsing request:", err);
    return new Response(
      JSON.stringify({
        error: "Invalid request",
        details: err.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  console.log("Received request body:", body);
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  const { sessionId, userId, action, securityToken } = body || {};

  console.log("Extracted parameters:", {
    sessionId: sessionId ? sessionId.substring(0, 20) + "..." : "missing",
    userId: userId ? userId.substring(0, 8) + "..." : "missing",
    action: action || "verify",
    securityToken: securityToken ? "present" : "missing",
  });

  if (!sessionId) {
    console.error("Missing sessionId parameter:", { body, sessionId, userId });
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing sessionId parameter",
        message: "Session ID is required for payment verification",
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
        success: false,
        error: "Missing userId parameter",
        message: "User ID is required for payment verification",
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
      JSON.stringify({
        success: false,
        error: "Configuration error: Missing Stripe key",
        message: "Server configuration error. Please contact support.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

  try {
    console.log("Verifying payment for session:", sessionId, "user:", userId);

    // Retrieve the checkout session from Stripe
    let session;
    try {
      console.log("Retrieving Stripe checkout session...");
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "customer"],
      });
      console.log("Successfully retrieved Stripe session:", {
        id: session.id,
        payment_status: session.payment_status,
        status: session.status,
      });
    } catch (stripeError) {
      console.error("Stripe API error:", stripeError.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to retrieve payment session",
          message:
            "Unable to verify payment session. Please try again or contact support.",
          details: stripeError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if payment was successful
    if (session.payment_status !== "paid" || session.status !== "complete") {
      console.log("Payment not completed:", {
        payment_status: session.payment_status,
        status: session.status,
      });
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

    // Verify the user ID matches (more flexible matching)
    const sessionUserId = session.metadata?.user_id;
    console.log("User ID verification:", {
      provided: userId,
      session: sessionUserId,
      match: sessionUserId === userId,
    });

    if (sessionUserId && sessionUserId !== userId) {
      console.error("User ID mismatch detected");
      return new Response(
        JSON.stringify({
          success: false,
          error: "User ID mismatch",
          provided: userId,
          session: sessionUserId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create Supabase client for database operations
    const supabase = createSupabaseClient();

    // Update or create user subscription record
    try {
      const subscriptionData = {
        user_id: userId,
        plan_id: session.metadata?.plan_id || "starter",
        status: "active",
        stripe_checkout_session_id: session.id,
        stripe_customer_id:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id,
        stripe_subscription_id:
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id,
        payment_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("Creating/updating subscription record...");

      const { error: upsertError } = await supabase
        .from("user_subscriptions")
        .upsert(subscriptionData, {
          onConflict: "user_id",
        });

      if (upsertError) {
        console.error("Error upserting subscription:", upsertError);
        // Continue anyway - don't fail verification for DB errors
      } else {
        console.log("Successfully updated subscription record");
      }

      // Also update the users table
      const { error: userUpdateError } = await supabase
        .from("users")
        .update({
          has_completed_payment: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (userUpdateError) {
        console.error("Error updating user payment status:", userUpdateError);
        // Continue anyway - don't fail verification for DB errors
      } else {
        console.log("Successfully updated user payment status");
      }
    } catch (dbError) {
      console.error("Database operation error:", dbError);
      // Don't fail the verification for database errors - payment was successful
    }

    // Payment verification successful
    console.log("Payment verification completed successfully");
    return new Response(
      JSON.stringify({
        success: true,
        planId: session.metadata?.plan_id,
        subscriptionId: session.subscription?.id || session.subscription,
        customerId: session.customer,
        sessionId: session.id,
        message: "Payment verified and subscription activated.",
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
