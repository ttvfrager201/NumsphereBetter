import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Database } from "./database.types.ts";

export function createStripeClient(): Stripe {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }
  return new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
}

export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

export function verifyStripeWebhook(
  request: Request,
  body: string,
): Stripe.Event {
  const stripe = createStripeClient();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET environment variable");
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    throw new Error("Missing stripe-signature header");
  }

  // Enhanced validation
  if (body.length > 1024 * 1024) {
    // 1MB limit
    throw new Error("Webhook payload too large");
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
      300,
    ); // 5 minute tolerance

    // Additional validation
    if (!event.id || !event.type || !event.created) {
      throw new Error("Invalid webhook event structure");
    }

    // Check event age (reject events older than 1 hour)
    const eventAge = Date.now() / 1000 - event.created;
    if (eventAge > 3600) {
      throw new Error(`Webhook event too old: ${eventAge}s`);
    }

    return event;
  } catch (err) {
    console.error("Webhook signature verification failed:", {
      error: err.message,
      signature: signature.substring(0, 20) + "...", // Log partial signature for debugging
      bodyLength: body.length,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }
}

export async function updateUserPaymentStatus(
  userId: string,
  planId: string,
  subscriptionId: string,
  customerId: string,
  status: string = "active",
  requestId?: string,
) {
  const supabase = createSupabaseClient();
  const logPrefix = requestId ? `[${requestId}]` : "";

  // Input validation
  if (!userId || !planId || !subscriptionId || !customerId) {
    throw new Error("Missing required parameters for payment status update");
  }

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    throw new Error("Invalid user ID format");
  }

  // Validate plan ID
  const validPlans = ["starter", "business", "enterprise"];
  if (!validPlans.includes(planId)) {
    throw new Error("Invalid plan ID");
  }

  // Validate status
  const validStatuses = [
    "active",
    "canceled",
    "past_due",
    "unpaid",
    "paused",
    "trialing",
  ];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid subscription status");
  }

  try {
    const timestamp = new Date().toISOString();

    // Use transaction-like approach with retry logic
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Update user payment status
        const { error: userError } = await supabase
          .from("users")
          .update({
            has_completed_payment: status === "active",
            updated_at: timestamp,
          })
          .eq("id", userId);

        if (userError) {
          console.error(
            `${logPrefix} Error updating user payment status:`,
            userError,
          );
          throw userError;
        }

        // Update or insert subscription with enhanced data
        const { error: subscriptionError } = await supabase
          .from("user_subscriptions")
          .upsert(
            {
              user_id: userId,
              plan_id: planId,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
              status: status,
              last_updated_by: "stripe_webhook",
              updated_at: timestamp,
            },
            {
              onConflict: "user_id",
              ignoreDuplicates: false,
            },
          );

        if (subscriptionError) {
          console.error(
            `${logPrefix} Error updating subscription:`,
            subscriptionError,
          );
          throw subscriptionError;
        }

        console.log(
          `${logPrefix} Successfully updated payment status for user ${userId} to ${status}`,
        );

        return { success: true };
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }

        console.warn(
          `${logPrefix} Retry ${retryCount} for payment status update:`,
          error.message,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }
  } catch (error) {
    console.error(`${logPrefix} Error in updateUserPaymentStatus:`, {
      error: error.message,
      userId,
      planId,
      subscriptionId,
      customerId,
      status,
    });
    throw error;
  }
}

export async function getUserSubscriptionStatus(userId: string) {
  const supabase = createSupabaseClient();

  try {
    const { data: user } = await supabase
      .from("users")
      .select("has_completed_payment")
      .eq("id", userId)
      .single();

    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    return {
      hasCompletedPayment: user?.has_completed_payment || false,
      subscription: subscription || null,
    };
  } catch (error) {
    console.error("Error getting user subscription status:", error);
    return {
      hasCompletedPayment: false,
      subscription: null,
    };
  }
}

export function getPlanIdFromPriceId(priceId: string): string | null {
  const pricePlanMap: Record<string, string> = {
    price_1RcsXnB6b7vINOBHFKemTArF: "starter",
    price_1RdKsrB6b7vINOBHH5zkVavh: "business",
    price_1RdKtCB6b7vINOBHAJNJibdz: "enterprise",
  };

  return pricePlanMap[priceId] || null;
}
