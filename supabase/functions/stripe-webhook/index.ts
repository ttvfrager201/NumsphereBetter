import { corsHeaders } from "@shared/cors.ts";
import {
  verifyStripeWebhook,
  createSupabaseClient,
} from "@shared/stripe-helpers.ts";

// Store processed events to prevent duplicate processing
const processedEvents = new Map<string, number>();
const CLEANUP_INTERVAL = 1000 * 60 * 60; // 1 hour
const MAX_EVENT_AGE = 1000 * 60 * 60 * 24; // 24 hours

// Cleanup old processed events periodically
setInterval(() => {
  const now = Date.now();
  for (const [eventId, timestamp] of processedEvents.entries()) {
    if (now - timestamp > MAX_EVENT_AGE) {
      processedEvents.delete(eventId);
    }
  }
}, CLEANUP_INTERVAL);

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  let event;

  try {
    // Verify webhook signature first (security)
    const body = await req.text();
    event = verifyStripeWebhook(req, body);

    // Idempotency check - prevent duplicate processing
    if (processedEvents.has(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`);
      return new Response(
        JSON.stringify({ received: true, status: "already_processed" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[${new Date().toISOString()}] Processing webhook: ${event.type} (${event.id})`,
    );

    // Mark event as being processed
    processedEvents.set(event.id, Date.now());

    // Handle comprehensive set of events for professional SaaS
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object, event.type);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSuccess(event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event.data.object);
        break;

      case "invoice.upcoming":
        await handleUpcomingInvoice(event.data.object);
        break;

      case "customer.subscription.paused":
        await handleSubscriptionPaused(event.data.object);
        break;

      case "customer.subscription.resumed":
        await handleSubscriptionResumed(event.data.object);
        break;

      default:
        console.log(
          `[${new Date().toISOString()}] Ignored event: ${event.type}`,
        );
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] Successfully processed ${event.type} in ${processingTime}ms`,
    );

    return new Response(
      JSON.stringify({
        received: true,
        event_type: event.type,
        processing_time_ms: processingTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(
      `[${new Date().toISOString()}] Webhook error after ${processingTime}ms:`,
      {
        error: error.message,
        stack: error.stack,
        event_id: event?.id,
        event_type: event?.type,
      },
    );

    // Remove from processed events if processing failed
    if (event?.id) {
      processedEvents.delete(event.id);
    }

    return new Response(
      JSON.stringify({
        error: "Webhook processing failed",
        event_id: event?.id,
        processing_time_ms: processingTime,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// Handle subscription creation/updates
async function handleSubscriptionChange(subscription: any, eventType: string) {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;

  if (!userId || !planId) {
    console.error(`[${eventType}] Missing user_id or plan_id in metadata`, {
      userId,
      planId,
      metadata: subscription.metadata,
      subscription_id: subscription.id,
    });
    throw new Error("Missing required metadata");
  }

  const supabase = createSupabaseClient();
  const isActive = subscription.status === "active";
  const timestamp = new Date().toISOString();

  try {
    console.log(
      `[${eventType}] Processing subscription change for user ${userId}, plan ${planId}, status ${subscription.status}`,
    );

    // Start transaction-like operations
    const updates = [];

    // Update user payment status with timestamp
    const userUpdate = supabase
      .from("users")
      .update({
        has_completed_payment: isActive,
        updated_at: timestamp,
      })
      .eq("id", userId);

    updates.push(userUpdate);

    // Update subscription record with comprehensive data
    const subscriptionUpdate = supabase.from("user_subscriptions").upsert(
      {
        user_id: userId,
        plan_id: planId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer,
        status: subscription.status,
        current_period_start: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000).toISOString()
          : null,
        trial_end: subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null,
        updated_at: timestamp,
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: false,
      },
    );

    updates.push(subscriptionUpdate);

    // Execute all updates
    const results = await Promise.allSettled(updates);

    // Check for errors
    const userResult = results[0];
    const subResult = results[1];

    if (userResult.status === "rejected") {
      console.error(
        `[${eventType}] Error updating user payment status:`,
        userResult.reason,
      );
      throw new Error(`User update failed: ${userResult.reason.message}`);
    }

    if (subResult.status === "rejected") {
      console.error(
        `[${eventType}] Error updating subscription:`,
        subResult.reason,
      );
      throw new Error(
        `Subscription update failed: ${subResult.reason.message}`,
      );
    }

    // Log successful update with detailed info
    console.log(
      `[${eventType}] Successfully updated subscription for user ${userId}:`,
      {
        status: subscription.status,
        plan_id: planId,
        subscription_id: subscription.id,
        customer_id: subscription.customer,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      },
    );

    // Send notification for important status changes
    if (eventType === "customer.subscription.created") {
      await sendSubscriptionNotification(
        userId,
        "subscription_created",
        planId,
      );
    } else if (subscription.cancel_at_period_end) {
      await sendSubscriptionNotification(
        userId,
        "subscription_will_cancel",
        planId,
      );
    }
  } catch (error) {
    console.error(`[${eventType}] Database update failed for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      subscription_id: subscription.id,
      user_id: userId,
      plan_id: planId,
    });
    throw error;
  }
}

// Handle subscription cancellation
async function handleSubscriptionCanceled(subscription: any) {
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();

  try {
    console.log(
      `[subscription.deleted] Processing subscription cancellation for subscription ${subscription.id}`,
    );

    // Find user by subscription ID with retry logic
    let data, fetchError;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      const result = await supabase
        .from("user_subscriptions")
        .select("user_id, plan_id")
        .eq("stripe_subscription_id", subscription.id)
        .single();

      data = result.data;
      fetchError = result.error;

      if (!fetchError) break;

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(
          `[subscription.deleted] Retry ${retryCount} for finding subscription ${subscription.id}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }

    if (fetchError) {
      console.error(
        `[subscription.deleted] Error finding subscription after ${maxRetries} attempts:`,
        fetchError,
      );
      throw fetchError;
    }

    if (data?.user_id) {
      console.log(
        `[subscription.deleted] Canceling subscription for user ${data.user_id}`,
      );

      // Parallel updates for better performance
      const updates = [
        // Mark payment as incomplete with timestamp
        supabase
          .from("users")
          .update({
            has_completed_payment: false,
            updated_at: timestamp,
          })
          .eq("id", data.user_id),

        // Update subscription status with cancellation details
        supabase
          .from("user_subscriptions")
          .update({
            status: "canceled",
            canceled_at: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000).toISOString()
              : timestamp,
            updated_at: timestamp,
          })
          .eq("stripe_subscription_id", subscription.id),
      ];

      const results = await Promise.allSettled(updates);

      // Check results
      const userResult = results[0];
      const subResult = results[1];

      if (userResult.status === "rejected") {
        console.error(
          `[subscription.deleted] Error updating user payment status:`,
          userResult.reason,
        );
        throw new Error(`User update failed: ${userResult.reason.message}`);
      }

      if (subResult.status === "rejected") {
        console.error(
          `[subscription.deleted] Error updating subscription status:`,
          subResult.reason,
        );
        throw new Error(
          `Subscription update failed: ${subResult.reason.message}`,
        );
      }

      console.log(
        `[subscription.deleted] Successfully canceled subscription for user ${data.user_id}`,
        {
          subscription_id: subscription.id,
          plan_id: data.plan_id,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : timestamp,
        },
      );

      // Send cancellation notification
      await sendSubscriptionNotification(
        data.user_id,
        "subscription_canceled",
        data.plan_id,
      );
    } else {
      console.log(
        `[subscription.deleted] No user found for subscription ${subscription.id}`,
      );
    }
  } catch (error) {
    console.error(`[subscription.deleted] Cancellation update failed:`, {
      error: error.message,
      stack: error.stack,
      subscription_id: subscription.id,
    });
    throw error;
  }
}

// Handle successful payments
async function handlePaymentSuccess(invoice: any) {
  if (!invoice.subscription) {
    console.log(
      `[payment_succeeded] No subscription found in invoice ${invoice.id}, skipping payment success handling`,
    );
    return;
  }

  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();

  try {
    console.log(
      `[payment_succeeded] Processing payment success for subscription ${invoice.subscription}, amount: ${invoice.amount_paid / 100} ${invoice.currency}`,
    );

    // Find user by subscription ID with retry
    let data, fetchError;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      const result = await supabase
        .from("user_subscriptions")
        .select("user_id, plan_id")
        .eq("stripe_subscription_id", invoice.subscription)
        .single();

      data = result.data;
      fetchError = result.error;

      if (!fetchError) break;

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(
          `[payment_succeeded] Retry ${retryCount} for finding subscription ${invoice.subscription}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }

    if (fetchError) {
      console.error(
        `[payment_succeeded] Error finding subscription for payment after ${maxRetries} attempts:`,
        fetchError,
      );
      throw fetchError;
    }

    if (data?.user_id) {
      console.log(
        `[payment_succeeded] Confirming payment for user ${data.user_id}`,
      );

      // Parallel updates for better performance
      const updates = [
        // Ensure payment status is active with timestamp
        supabase
          .from("users")
          .update({
            has_completed_payment: true,
            updated_at: timestamp,
          })
          .eq("id", data.user_id),

        // Update subscription status and payment info
        supabase
          .from("user_subscriptions")
          .update({
            status: "active",
            last_payment_date: timestamp,
            updated_at: timestamp,
          })
          .eq("stripe_subscription_id", invoice.subscription),
      ];

      const results = await Promise.allSettled(updates);

      // Check results
      const userResult = results[0];
      const subResult = results[1];

      if (userResult.status === "rejected") {
        console.error(
          `[payment_succeeded] Error updating user payment status:`,
          userResult.reason,
        );
        throw new Error(`User update failed: ${userResult.reason.message}`);
      }

      if (subResult.status === "rejected") {
        console.error(
          `[payment_succeeded] Error updating subscription status:`,
          subResult.reason,
        );
        throw new Error(
          `Subscription update failed: ${subResult.reason.message}`,
        );
      }

      console.log(
        `[payment_succeeded] Successfully confirmed payment for user ${data.user_id}`,
        {
          invoice_id: invoice.id,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          subscription_id: invoice.subscription,
          plan_id: data.plan_id,
        },
      );

      // Send payment success notification
      await sendSubscriptionNotification(
        data.user_id,
        "payment_succeeded",
        data.plan_id,
      );
    } else {
      console.log(
        `[payment_succeeded] No user found for subscription ${invoice.subscription}`,
      );
    }
  } catch (error) {
    console.error(`[payment_succeeded] Payment confirmation failed:`, {
      error: error.message,
      stack: error.stack,
      invoice_id: invoice.id,
      subscription_id: invoice.subscription,
    });
    throw error;
  }
}

// Handle payment failures
async function handlePaymentFailed(invoice: any) {
  if (!invoice.subscription) {
    console.log(
      `[payment_failed] No subscription found in invoice ${invoice.id}`,
    );
    return;
  }

  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();

  try {
    console.log(
      `[payment_failed] Processing payment failure for subscription ${invoice.subscription}`,
    );

    const { data, error: fetchError } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_id")
      .eq("stripe_subscription_id", invoice.subscription)
      .single();

    if (fetchError) {
      console.error(`[payment_failed] Error finding subscription:`, fetchError);
      return;
    }

    if (data?.user_id) {
      console.log(
        `[payment_failed] Recording payment failure for user ${data.user_id}`,
      );

      // Send payment failure notification
      await sendSubscriptionNotification(
        data.user_id,
        "payment_failed",
        data.plan_id,
      );
    }
  } catch (error) {
    console.error(`[payment_failed] Error handling payment failure:`, error);
  }
}

// Handle trial ending soon
async function handleTrialWillEnd(subscription: any) {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;

  if (!userId || !planId) {
    console.log(
      `[trial_will_end] Missing metadata for subscription ${subscription.id}`,
    );
    return;
  }

  try {
    console.log(`[trial_will_end] Trial ending soon for user ${userId}`);
    await sendSubscriptionNotification(userId, "trial_will_end", planId);
  } catch (error) {
    console.error(`[trial_will_end] Error handling trial will end:`, error);
  }
}

// Handle upcoming invoice
async function handleUpcomingInvoice(invoice: any) {
  if (!invoice.subscription) {
    return;
  }

  const supabase = createSupabaseClient();

  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_id")
      .eq("stripe_subscription_id", invoice.subscription)
      .single();

    if (data?.user_id) {
      console.log(
        `[invoice_upcoming] Upcoming invoice for user ${data.user_id}`,
      );
      await sendSubscriptionNotification(
        data.user_id,
        "invoice_upcoming",
        data.plan_id,
      );
    }
  } catch (error) {
    console.error(`[invoice_upcoming] Error handling upcoming invoice:`, error);
  }
}

// Handle subscription paused
async function handleSubscriptionPaused(subscription: any) {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;

  if (!userId) return;

  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();

  try {
    await supabase
      .from("user_subscriptions")
      .update({
        status: "paused",
        updated_at: timestamp,
      })
      .eq("stripe_subscription_id", subscription.id);

    console.log(`[subscription_paused] Subscription paused for user ${userId}`);
    await sendSubscriptionNotification(userId, "subscription_paused", planId);
  } catch (error) {
    console.error(
      `[subscription_paused] Error handling subscription pause:`,
      error,
    );
  }
}

// Handle subscription resumed
async function handleSubscriptionResumed(subscription: any) {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;

  if (!userId) return;

  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();

  try {
    await supabase
      .from("user_subscriptions")
      .update({
        status: "active",
        updated_at: timestamp,
      })
      .eq("stripe_subscription_id", subscription.id);

    console.log(
      `[subscription_resumed] Subscription resumed for user ${userId}`,
    );
    await sendSubscriptionNotification(userId, "subscription_resumed", planId);
  } catch (error) {
    console.error(
      `[subscription_resumed] Error handling subscription resume:`,
      error,
    );
  }
}

// Send subscription notifications (placeholder for future email/notification system)
async function sendSubscriptionNotification(
  userId: string,
  eventType: string,
  planId: string,
) {
  try {
    console.log(
      `[notification] ${eventType} notification for user ${userId} on ${planId} plan`,
    );
    // TODO: Implement email notifications, in-app notifications, etc.
    // This could integrate with services like SendGrid, Resend, or your notification system
  } catch (error) {
    console.error(
      `[notification] Error sending ${eventType} notification:`,
      error,
    );
  }
}
