import { corsHeaders } from "@shared/cors.ts";
import {
  verifyStripeWebhook,
  updateUserPaymentStatus,
  getPlanIdFromPriceId,
  createSupabaseClient,
} from "@shared/stripe-helpers.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.text();
    const event = verifyStripeWebhook(req, body);

    console.log(`Processing Stripe webhook event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("Checkout session completed:", session.id);

        // Get user ID from metadata
        const userId = session.metadata?.user_id;
        if (!userId) {
          console.error("No user_id in session metadata");
          return new Response(
            JSON.stringify({ error: "Missing user_id in metadata" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // For subscription mode, we'll handle this in customer.subscription.created
        if (session.mode === "subscription") {
          console.log(
            "Subscription checkout completed, waiting for subscription.created event",
          );
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        console.log(`Subscription ${event.type}:`, subscription.id);

        // Get user ID from subscription metadata
        const userId = subscription.metadata?.user_id;
        const planId = subscription.metadata?.plan_id;

        if (!userId || !planId) {
          console.error("Missing user_id or plan_id in subscription metadata");
          break;
        }

        const customerId = subscription.customer as string;
        const status = subscription.status;

        console.log(
          `Updating subscription for user ${userId} to status ${status}`,
        );

        try {
          await updateUserPaymentStatus(
            userId,
            planId,
            subscription.id,
            customerId,
            status,
          );
          console.log(`Successfully updated payment status for user ${userId}`);
        } catch (error) {
          console.error(
            `Failed to update payment status for user ${userId}:`,
            error,
          );
        }

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        console.log("Invoice payment succeeded:", invoice.id);

        // Handle successful recurring payments
        if (invoice.subscription) {
          const subscriptionId = invoice.subscription as string;
          console.log(`Payment succeeded for subscription: ${subscriptionId}`);

          // Find user by subscription ID and update status to active
          try {
            const supabase = createSupabaseClient();
            const { data: subscription, error } = await supabase
              .from("user_subscriptions")
              .select("user_id, plan_id, stripe_customer_id")
              .eq("stripe_subscription_id", subscriptionId)
              .single();

            if (error || !subscription) {
              console.error("Could not find subscription:", error);
              break;
            }

            await updateUserPaymentStatus(
              subscription.user_id!,
              subscription.plan_id,
              subscriptionId,
              subscription.stripe_customer_id!,
              "active",
            );
          } catch (error) {
            console.error("Error processing payment success:", error);
          }
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        console.log("Invoice payment failed:", invoice.id);

        // Handle failed payments - might want to update subscription status
        if (invoice.subscription) {
          const subscriptionId = invoice.subscription as string;
          console.log(`Payment failed for subscription: ${subscriptionId}`);
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log("Subscription deleted:", subscription.id);

        // Update user payment status to false and subscription status to canceled
        try {
          const supabase = createSupabaseClient();
          const { data: subscriptionData, error } = await supabase
            .from("user_subscriptions")
            .select("user_id, plan_id, stripe_customer_id")
            .eq("stripe_subscription_id", subscription.id)
            .single();

          if (error || !subscriptionData) {
            console.error("Could not find subscription:", error);
            break;
          }

          await updateUserPaymentStatus(
            subscriptionData.user_id!,
            subscriptionData.plan_id,
            subscription.id,
            subscriptionData.stripe_customer_id!,
            "canceled",
          );
        } catch (error) {
          console.error("Error processing subscription deletion:", error);
        }

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({
        error: "Webhook processing failed",
        details: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
