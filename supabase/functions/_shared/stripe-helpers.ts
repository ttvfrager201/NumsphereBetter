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

  try {
    return stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }
}

export async function updateUserPaymentStatus(
  userId: string,
  planId: string,
  subscriptionId: string,
  customerId: string,
  status: string = "active",
) {
  const supabase = createSupabaseClient();

  try {
    // Update user payment status
    const { error: userError } = await supabase
      .from("users")
      .update({ has_completed_payment: status === "active" })
      .eq("id", userId);

    if (userError) {
      console.error("Error updating user payment status:", userError);
      throw userError;
    }

    // Update or insert subscription
    const { error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .upsert(
        {
          user_id: userId,
          plan_id: planId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          status: status,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

    if (subscriptionError) {
      console.error("Error updating subscription:", subscriptionError);
      throw subscriptionError;
    }

    console.log(
      `Successfully updated payment status for user ${userId} to ${status}`,
    );
  } catch (error) {
    console.error("Error in updateUserPaymentStatus:", error);
    throw error;
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
