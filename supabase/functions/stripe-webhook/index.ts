import { corsHeaders } from "@shared/cors.ts";
import {
  verifyStripeWebhook,
  createSupabaseClient,
} from "@shared/stripe-helpers.ts";
import {
  validateEnvironment,
  logSecurityEvent,
  detectSuspiciousActivity,
  webhookRateLimiter,
} from "@shared/security.ts";

// Store processed events to prevent duplicate processing with better memory management
const processedEvents = new Map<
  string,
  { timestamp: number; attempts: number }
>();
const CLEANUP_INTERVAL = 1000 * 60 * 30; // 30 minutes
const MAX_EVENT_AGE = 1000 * 60 * 60 * 12; // 12 hours
const MAX_RETRY_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 1000 * 60 * 5; // 5 minutes
const MAX_EVENTS_PER_WINDOW = 100;

// Enhanced cleanup with memory limits
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [eventId, data] of processedEvents.entries()) {
    if (now - data.timestamp > MAX_EVENT_AGE) {
      processedEvents.delete(eventId);
      cleanedCount++;
    }
  }

  // Force cleanup if map gets too large
  if (processedEvents.size > 10000) {
    const entries = Array.from(processedEvents.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 5000);
    processedEvents.clear();
    entries.forEach(([id, data]) => processedEvents.set(id, data));
  }

  if (cleanedCount > 0) {
    console.log(
      `[webhook-cleanup] Cleaned ${cleanedCount} old events, ${processedEvents.size} remaining`,
    );
  }
}, CLEANUP_INTERVAL);

// Rate limiting for webhook requests
const requestCounts = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const clientData = requestCounts.get(clientIp);

  if (!clientData || now - clientData.windowStart > RATE_LIMIT_WINDOW) {
    requestCounts.set(clientIp, { count: 1, windowStart: now });
    return true;
  }

  if (clientData.count >= MAX_EVENTS_PER_WINDOW) {
    return false;
  }

  clientData.count++;
  return true;
}

Deno.serve(async (req) => {
  // Validate environment on startup
  const envValidation = validateEnvironment();
  if (!envValidation.valid) {
    console.error(
      "[webhook] Missing required environment variables:",
      envValidation.missing,
    );
    return new Response(
      JSON.stringify({ error: "Service configuration error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

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
  const requestId = crypto.randomUUID();
  const clientIp =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "";

  // Enhanced rate limiting
  if (!webhookRateLimiter.isAllowed(clientIp)) {
    logSecurityEvent(
      "webhook_rate_limit_exceeded",
      {
        ip: clientIp,
        userAgent,
        requestId,
      },
      "medium",
    );

    console.warn(
      `[webhook] [${requestId}] Rate limit exceeded for IP: ${clientIp}`,
    );
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retry_after: 60,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      },
    );
  }

  let event;
  let body: string;

  try {
    // Get request body
    body = await req.text();

    // Detect suspicious activity
    const suspiciousCheck = detectSuspiciousActivity({
      ip: clientIp,
      userAgent,
      path: new URL(req.url).pathname,
      method: req.method,
      body: body.substring(0, 1000), // Only check first 1KB for performance
    });

    if (suspiciousCheck.suspicious) {
      logSecurityEvent(
        "suspicious_webhook_request",
        {
          ip: clientIp,
          userAgent,
          reasons: suspiciousCheck.reasons,
          requestId,
        },
        "high",
      );

      console.warn(
        `[webhook] [${requestId}] Suspicious request detected:`,
        suspiciousCheck.reasons,
      );
      return new Response(JSON.stringify({ error: "Request rejected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify webhook signature first (security)
    event = verifyStripeWebhook(req, body);

    // Enhanced idempotency check with retry logic
    const eventData = processedEvents.get(event.id);
    if (eventData) {
      if (eventData.attempts >= MAX_RETRY_ATTEMPTS) {
        console.log(
          `[${requestId}] Event ${event.id} already processed ${eventData.attempts} times, skipping`,
        );
        return new Response(
          JSON.stringify({
            received: true,
            status: "already_processed",
            attempts: eventData.attempts,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      // Allow retry for failed events
      eventData.attempts++;
      console.log(
        `[${requestId}] Retrying event ${event.id}, attempt ${eventData.attempts}`,
      );
    } else {
      // Mark event as being processed
      processedEvents.set(event.id, { timestamp: Date.now(), attempts: 1 });
    }

    console.log(
      `[${new Date().toISOString()}] [${requestId}] Processing webhook: ${event.type} (${event.id})`,
    );

    // Log webhook event to database
    const supabase = createSupabaseClient();
    await supabase
      .from("webhook_events_log")
      .insert({
        event_id: event.id,
        event_type: event.type,
        source: "stripe",
        status: "processing",
        payload: event.data,
        created_at: new Date().toISOString(),
      })
      .catch((err) => {
        console.warn(
          `[${requestId}] Failed to log webhook event:`,
          err.message,
        );
      });

    // Handle comprehensive set of events for professional SaaS
    switch (event.type) {
      // Critical subscription events
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(
          event.data.object,
          event.type,
          requestId,
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object, requestId);
        break;

      // Payment events
      case "invoice.payment_succeeded":
        await handlePaymentSuccess(event.data.object, requestId);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object, requestId);
        break;

      case "invoice.payment_action_required":
        await handlePaymentActionRequired(event.data.object, requestId);
        break;

      // Subscription lifecycle events
      case "customer.subscription.trial_will_end":
        await handleTrialWillEnd(event.data.object, requestId);
        break;

      case "invoice.upcoming":
        await handleUpcomingInvoice(event.data.object, requestId);
        break;

      case "customer.subscription.paused":
        await handleSubscriptionPaused(event.data.object, requestId);
        break;

      case "customer.subscription.resumed":
        await handleSubscriptionResumed(event.data.object, requestId);
        break;

      // Security events
      case "radar.early_fraud_warning.created":
        await handleFraudWarning(event.data.object, requestId);
        break;

      case "customer.subscription.pending_update_applied":
      case "customer.subscription.pending_update_expired":
        await handleSubscriptionPendingUpdate(
          event.data.object,
          event.type,
          requestId,
        );
        break;

      default:
        console.log(
          `[${new Date().toISOString()}] Ignored event: ${event.type}`,
        );
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] [${requestId}] Successfully processed ${event.type} in ${processingTime}ms`,
    );

    // Mark as successfully processed
    const eventRecord = processedEvents.get(event.id);
    if (eventRecord) {
      eventRecord.timestamp = Date.now();
    }

    // Update webhook event log
    await supabase
      .from("webhook_events_log")
      .update({
        status: "completed",
        processing_time_ms: processingTime,
        updated_at: new Date().toISOString(),
      })
      .eq("event_id", event.id)
      .catch((err) => {
        console.warn(
          `[${requestId}] Failed to update webhook event log:`,
          err.message,
        );
      });

    return new Response(
      JSON.stringify({
        received: true,
        event_type: event.type,
        processing_time_ms: processingTime,
        request_id: requestId,
        event_id: event.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(
      `[${new Date().toISOString()}] [${requestId}] Webhook error after ${processingTime}ms:`,
      {
        error: error.message,
        stack: error.stack,
        event_id: event?.id,
        event_type: event?.type,
        request_id: requestId,
        client_ip: clientIp,
      },
    );

    // Log security event for webhook failures
    logSecurityEvent(
      "webhook_processing_failed",
      {
        eventId: event?.id,
        eventType: event?.type,
        error: error.message,
        ip: clientIp,
        userAgent,
        requestId,
      },
      "medium",
    );

    // Update webhook event log with failure
    if (event?.id) {
      const supabase = createSupabaseClient();
      await supabase
        .from("webhook_events_log")
        .update({
          status: "failed",
          error_message: error.message,
          processing_time_ms: processingTime,
          updated_at: new Date().toISOString(),
        })
        .eq("event_id", event.id)
        .catch((err) => {
          console.warn(
            `[${requestId}] Failed to update webhook event log:`,
            err.message,
          );
        });
    }

    // Don't remove from processed events on failure - let retry logic handle it
    // This prevents infinite retries of the same failing event

    return new Response(
      JSON.stringify({
        error: "Webhook processing failed",
        event_id: event?.id,
        processing_time_ms: processingTime,
        request_id: requestId,
        retry_after: 300, // Suggest 5 minute retry delay
      }),
      {
        status: 500, // Use 500 for server errors, 400 for client errors
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "300",
        },
      },
    );
  }
});

// Handle subscription creation/updates with enhanced security
async function handleSubscriptionChange(
  subscription: any,
  eventType: string,
  requestId: string,
) {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;

  // Enhanced validation
  if (!userId || !planId) {
    console.error(
      `[${eventType}] [${requestId}] Missing user_id or plan_id in metadata`,
      {
        userId,
        planId,
        metadata: subscription.metadata,
        subscription_id: subscription.id,
      },
    );
    throw new Error("Missing required metadata");
  }

  // Validate UUID format for user_id
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error(
      `[${eventType}] [${requestId}] Invalid user_id format: ${userId}`,
    );
    throw new Error("Invalid user_id format");
  }

  // Validate plan_id
  const validPlans = ["starter", "business", "enterprise"];
  if (!validPlans.includes(planId)) {
    console.error(`[${eventType}] [${requestId}] Invalid plan_id: ${planId}`);
    throw new Error("Invalid plan_id");
  }

  const supabase = createSupabaseClient();
  const isActive = subscription.status === "active";
  const timestamp = new Date().toISOString();

  try {
    console.log(
      `[${eventType}] [${requestId}] Processing subscription change for user ${userId}, plan ${planId}, status ${subscription.status}`,
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
async function handleSubscriptionCanceled(
  subscription: any,
  requestId: string,
) {
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
async function handlePaymentSuccess(invoice: any, requestId: string) {
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
async function handlePaymentFailed(invoice: any, requestId: string) {
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
async function handleTrialWillEnd(subscription: any, requestId: string) {
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
async function handleUpcomingInvoice(invoice: any, requestId: string) {
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
async function handleSubscriptionPaused(subscription: any, requestId: string) {
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
async function handleSubscriptionResumed(subscription: any, requestId: string) {
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

// Handle payment action required
async function handlePaymentActionRequired(invoice: any, requestId: string) {
  if (!invoice.subscription) {
    console.log(
      `[payment_action_required] [${requestId}] No subscription found in invoice ${invoice.id}`,
    );
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
        `[payment_action_required] [${requestId}] Payment action required for user ${data.user_id}`,
      );
      await sendSubscriptionNotification(
        data.user_id,
        "payment_action_required",
        data.plan_id,
        requestId,
      );
    }
  } catch (error) {
    console.error(`[payment_action_required] [${requestId}] Error:`, error);
  }
}

// Handle fraud warnings
async function handleFraudWarning(warning: any, requestId: string) {
  console.warn(`[fraud_warning] [${requestId}] Fraud warning received:`, {
    id: warning.id,
    charge: warning.charge,
    fraud_type: warning.fraud_type,
  });

  // TODO: Implement fraud handling logic
  // - Suspend user account
  // - Send alert to admin
  // - Log security event
}

// Handle subscription pending updates
async function handleSubscriptionPendingUpdate(
  subscription: any,
  eventType: string,
  requestId: string,
) {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;

  if (!userId) return;

  try {
    console.log(
      `[${eventType}] [${requestId}] Pending update for user ${userId}`,
    );
    await sendSubscriptionNotification(
      userId,
      eventType.replace("customer.subscription.", ""),
      planId,
      requestId,
    );
  } catch (error) {
    console.error(`[${eventType}] [${requestId}] Error:`, error);
  }
}

// Enhanced notification system with security logging
async function sendSubscriptionNotification(
  userId: string,
  eventType: string,
  planId: string,
  requestId: string,
) {
  try {
    console.log(
      `[notification] [${requestId}] ${eventType} notification for user ${userId} on ${planId} plan`,
    );

    // Log security-relevant events
    const securityEvents = [
      "subscription_canceled",
      "payment_failed",
      "payment_action_required",
      "fraud_warning",
    ];

    if (securityEvents.includes(eventType)) {
      console.warn(
        `[security] [${requestId}] Security event: ${eventType} for user ${userId}`,
      );
      // TODO: Send to security monitoring system
    }

    // TODO: Implement comprehensive notification system
    // - Email notifications via SendGrid/Resend
    // - In-app notifications
    // - SMS for critical events
    // - Webhook notifications to customer systems
    // - Slack/Discord notifications for admin events
  } catch (error) {
    console.error(
      `[notification] [${requestId}] Error sending ${eventType} notification:`,
      error,
    );
  }
}
