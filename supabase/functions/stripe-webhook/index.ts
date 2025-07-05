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
      users: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          has_completed_payment: boolean | null;
          id: string;
          image: string | null;
          name: string | null;
          token_identifier: string;
          updated_at: string | null;
          user_id: string | null;
          requires_otp_verification: boolean | null;
          last_otp_verification: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          has_completed_payment?: boolean | null;
          id: string;
          image?: string | null;
          name?: string | null;
          token_identifier: string;
          updated_at?: string | null;
          user_id?: string | null;
          requires_otp_verification?: boolean | null;
          last_otp_verification?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          has_completed_payment?: boolean | null;
          id?: string;
          image?: string | null;
          name?: string | null;
          token_identifier?: string;
          updated_at?: string | null;
          user_id?: string | null;
          requires_otp_verification?: boolean | null;
          last_otp_verification?: string | null;
        };
        Relationships: [];
      };
      webhook_events_log: {
        Row: {
          id: string;
          event_id: string;
          event_type: string;
          source: string;
          status: string;
          payload: Json;
          error_message: string | null;
          processing_time_ms: number | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          event_type: string;
          source: string;
          status: string;
          payload: Json;
          error_message?: string | null;
          processing_time_ms?: number | null;
          created_at: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          event_type?: string;
          source?: string;
          status?: string;
          payload?: Json;
          error_message?: string | null;
          processing_time_ms?: number | null;
          created_at?: string;
          updated_at?: string | null;
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

// Stripe helpers
function createStripeClient(): Stripe {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable");
  }
  return new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
}

function createSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

function verifyStripeWebhook(request: Request, body: string): Stripe.Event {
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

// Security utilities
function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ];

  const missing = required.filter((key) => !Deno.env.get(key));

  return {
    valid: missing.length === 0,
    missing,
  };
}

function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: "low" | "medium" | "high" | "critical" = "medium",
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    severity,
    details: {
      ...details,
      // Remove sensitive data
      password: details.password ? "[REDACTED]" : undefined,
      token: details.token ? "[REDACTED]" : undefined,
      secret: details.secret ? "[REDACTED]" : undefined,
    },
    source: "numsphere-security",
  };

  if (severity === "critical" || severity === "high") {
    console.error("[SECURITY]", JSON.stringify(logEntry));
  } else {
    console.warn("[SECURITY]", JSON.stringify(logEntry));
  }
}

function detectSuspiciousActivity(request: {
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  body?: any;
}): { suspicious: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check for common attack patterns
  const suspiciousPatterns = [
    /union.*select/i,
    /script.*alert/i,
    /<script/i,
    /javascript:/i,
    /eval\(/i,
    /document\.cookie/i,
    /\.\.\/\.\.\/\.\./,
    /etc\/passwd/i,
    /cmd\.exe/i,
    /powershell/i,
  ];

  const checkString = JSON.stringify(request.body || "") + (request.path || "");

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      reasons.push(`Suspicious pattern detected: ${pattern.source}`);
    }
  }

  // Check user agent
  if (request.userAgent) {
    const suspiciousAgents = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /burp/i,
      /scanner/i,
      /bot.*attack/i,
    ];

    for (const agent of suspiciousAgents) {
      if (agent.test(request.userAgent)) {
        reasons.push(`Suspicious user agent: ${request.userAgent}`);
      }
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

// Rate limiting implementation
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetTime) {
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

// Export singleton rate limiter instances
const webhookRateLimiter = new RateLimiter(50, 60000); // 50 requests per minute

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

      // Handle checkout session completion failures
      case "checkout.session.expired":
        await handleCheckoutSessionExpired(event.data.object, requestId);
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

// Handle subscription creation/updates with enhanced security and proration
async function handleSubscriptionChange(
  subscription: any,
  eventType: string,
  requestId: string,
) {
  const userId = subscription.metadata?.user_id;
  const planId = subscription.metadata?.plan_id;
  const oldPlanId = subscription.metadata?.old_plan_id;
  const isUpgrade = subscription.metadata?.is_upgrade === "true";
  const prorationAmount = subscription.metadata?.proration_amount
    ? parseInt(subscription.metadata.proration_amount)
    : 0;
  const nextBillingCycle = subscription.metadata?.next_billing_cycle === "true";

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
      {
        oldPlanId,
        isUpgrade,
        prorationAmount,
      },
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

    // For plan changes scheduled for next billing cycle, don't update immediately
    let subscriptionUpdate;
    if (nextBillingCycle && eventType === "customer.subscription.updated") {
      // Schedule plan change for next billing cycle - don't update plan_id yet
      subscriptionUpdate = supabase.from("user_subscriptions").upsert(
        {
          user_id: userId,
          plan_id: oldPlanId || planId, // Keep current plan until next cycle
          pending_plan_id: planId, // Store pending plan change
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
          proration_amount: prorationAmount,
          updated_at: timestamp,
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: false,
        },
      );
    } else {
      // Regular subscription update or new subscription
      subscriptionUpdate = supabase.from("user_subscriptions").upsert(
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
          proration_amount: prorationAmount,
          updated_at: timestamp,
        },
        {
          onConflict: "user_id",
          ignoreDuplicates: false,
        },
      );
    }

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
        old_plan_id: oldPlanId,
        subscription_id: subscription.id,
        customer_id: subscription.customer,
        cancel_at_period_end: subscription.cancel_at_period_end,
        proration_amount: prorationAmount,
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
    } else if (
      eventType === "customer.subscription.updated" &&
      oldPlanId &&
      oldPlanId !== planId
    ) {
      await sendSubscriptionNotification(
        userId,
        isUpgrade ? "plan_upgraded" : "plan_downgraded",
        planId,
        requestId,
        {
          oldPlan: oldPlanId,
          newPlan: planId,
          prorationAmount: prorationAmount / 100, // Convert cents to dollars
        },
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

// Handle payment failures with automatic refunds
async function handlePaymentFailed(invoice: any, requestId: string) {
  if (!invoice.subscription) {
    console.log(
      `[payment_failed] No subscription found in invoice ${invoice.id}`,
    );
    return;
  }

  const supabase = createSupabaseClient();
  const stripe = createStripeClient();
  const timestamp = new Date().toISOString();

  try {
    console.log(
      `[payment_failed] Processing payment failure for subscription ${invoice.subscription}`,
    );

    const { data, error: fetchError } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_id, stripe_customer_id")
      .eq("stripe_subscription_id", invoice.subscription)
      .single();

    if (fetchError) {
      console.error(`[payment_failed] Error finding subscription:`, fetchError);
      return;
    }

    if (data?.user_id) {
      console.log(
        `[payment_failed] Processing automatic refund for user ${data.user_id}`,
      );

      // Enhanced automatic refund logic with better error handling
      try {
        if (invoice.charge && invoice.amount_paid > 0) {
          console.log(
            `[payment_failed] Initiating refund for charge ${invoice.charge}`,
          );

          const refund = await stripe.refunds.create({
            charge: invoice.charge,
            amount: invoice.amount_paid,
            reason: "requested_by_customer",
            metadata: {
              user_id: data.user_id,
              subscription_id: invoice.subscription,
              auto_refund: "payment_failed",
              processed_at: timestamp,
            },
          });

          console.log(`[payment_failed] Refund created successfully:`, {
            refund_id: refund.id,
            amount: refund.amount,
            status: refund.status,
          });

          // Log the refund in database
          await supabase.from("payment_security_log").insert({
            user_id: data.user_id,
            event_type: "automatic_refund",
            payload: {
              refund_id: refund.id,
              original_charge: invoice.charge,
              amount: refund.amount,
              reason: "payment_failed",
            },
            status: "completed",
            created_at: timestamp,
          });
        } else {
          console.log(
            `[payment_failed] No charge found to refund for invoice ${invoice.id}`,
          );
        }
      } catch (refundError) {
        console.error(`[payment_failed] Refund failed:`, refundError);

        // Log refund failure
        await supabase.from("payment_security_log").insert({
          user_id: data.user_id,
          event_type: "refund_failed",
          payload: {
            error: refundError.message,
            charge: invoice.charge,
            amount: invoice.amount_paid,
          },
          status: "failed",
          error_message: refundError.message,
          created_at: timestamp,
        });
      }

      // Update subscription status to failed
      await supabase
        .from("user_subscriptions")
        .update({
          status: "payment_failed",
          updated_at: timestamp,
        })
        .eq("stripe_subscription_id", invoice.subscription);

      // Send payment failure notification
      await sendSubscriptionNotification(
        data.user_id,
        "payment_failed_with_refund",
        data.plan_id,
        requestId,
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

// Enhanced notification system with email confirmations
async function sendSubscriptionNotification(
  userId: string,
  eventType: string,
  planId: string,
  requestId: string = crypto.randomUUID(),
  extraData: any = {},
) {
  try {
    console.log(
      `[notification] [${requestId}] ${eventType} notification for user ${userId} on ${planId} plan`,
    );

    // Get user email and plan details
    const supabase = createSupabaseClient();
    const { data: userData } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (!userData?.email) {
      console.warn(`[notification] No email found for user ${userId}`);
      return;
    }

    // Plan details for email
    const planDetails = {
      starter: {
        name: "Starter",
        price: "$10",
        features: "1 Virtual Phone Number, 500 Minutes/Month",
      },
      business: {
        name: "Business",
        price: "$29",
        features: "5 Virtual Phone Numbers, 2,000 Minutes/Month",
      },
      enterprise: {
        name: "Enterprise",
        price: "$99",
        features: "Unlimited Phone Numbers & Minutes",
      },
    };

    const plan = planDetails[planId as keyof typeof planDetails] || {
      name: planId,
      price: "N/A",
      features: "N/A",
    };

    // Send email based on event type
    await sendEmail(
      userData.email,
      userData.full_name,
      eventType,
      plan,
      requestId,
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
    }
  } catch (error) {
    console.error(
      `[notification] [${requestId}] Error sending ${eventType} notification:`,
      error,
    );
  }
}

// Email sending function
async function sendEmail(
  email: string,
  fullName: string,
  eventType: string,
  plan: any,
  requestId: string,
) {
  try {
    const name = fullName || email.split("@")[0];
    let subject = "";
    let htmlContent = "";

    const baseStyle = `
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .plan-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
      </style>
    `;

    switch (eventType) {
      case "subscription_created":
      case "payment_succeeded":
        subject = `🎉 Welcome to NumSphere ${plan.name} Plan!`;
        htmlContent = `
          ${baseStyle}
          <div class="container">
            <div class="header">
              <h1>🎉 Payment Successful!</h1>
              <p>Welcome to NumSphere, ${name}!</p>
            </div>
            <div class="content">
              <h2>Your subscription is now active</h2>
              <p>Thank you for choosing NumSphere! Your payment has been processed successfully.</p>
              
              <div class="plan-details">
                <h3>📋 Plan Details</h3>
                <p><strong>Plan:</strong> ${plan.name}</p>
                <p><strong>Price:</strong> ${plan.price}/month</p>
                <p><strong>Features:</strong> ${plan.features}</p>
              </div>
              
              <p>You can now access your dashboard and start setting up your virtual phone numbers!</p>
              
              <a href="https://mystifying-torvalds4-r9r87.view-3.tempo-dev.app/dashboard" class="button">
                Access Dashboard
              </a>
              
              <h3>🚀 Next Steps:</h3>
              <ul>
                <li>Choose your first virtual phone number</li>
                <li>Set up call flows</li>
                <li>Configure voicemail settings</li>
              </ul>
            </div>
            <div class="footer">
              <p>Need help? Contact us at support@numsphere.com</p>
              <p>NumSphere - Your Virtual Phone Solution</p>
            </div>
          </div>
        `;
        break;

      case "plan_upgraded":
      case "plan_downgraded":
        const isUpgrade = eventType === "plan_upgraded";
        const oldPlanName = extraData.oldPlan
          ? extraData.oldPlan.charAt(0).toUpperCase() +
            extraData.oldPlan.slice(1)
          : "Previous";
        const prorationText =
          extraData.prorationAmount > 0
            ? `You were charged ${extraData.prorationAmount.toFixed(2)} for the prorated difference.`
            : extraData.prorationAmount < 0
              ? `You received a credit of ${Math.abs(extraData.prorationAmount).toFixed(2)} for the unused portion.`
              : "No additional charges were applied.";

        subject = `📈 Plan ${isUpgrade ? "Upgraded" : "Changed"} - Welcome to ${plan.name}!`;
        htmlContent = `
          ${baseStyle}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, ${isUpgrade ? "#10b981 0%, #059669 100%" : "#3b82f6 0%, #1d4ed8 100%"});">
              <h1>📈 Plan ${isUpgrade ? "Upgraded" : "Changed"}!</h1>
              <p>Your plan has been successfully updated</p>
            </div>
            <div class="content">
              <h2>Plan Change Successful</h2>
              <p>Hi ${name},</p>
              <p>Your plan has been successfully changed from ${oldPlanName} to ${plan.name}.</p>
              
              <div class="plan-details">
                <h3>📋 New Plan Details</h3>
                <p><strong>Plan:</strong> ${plan.name}</p>
                <p><strong>Price:</strong> ${plan.price}/month</p>
                <p><strong>Features:</strong> ${plan.features}</p>
                <br>
                <h4>💰 Billing Information</h4>
                <p>${prorationText}</p>
              </div>
              
              <p>Your new plan features are now active and ready to use!</p>
              
              <a href="https://mystifying-torvalds4-r9r87.view-3.tempo-dev.app/dashboard" class="button">
                Access Dashboard
              </a>
            </div>
            <div class="footer">
              <p>Questions about your plan change? Contact support@numsphere.com</p>
            </div>
          </div>
        `;
        break;

      case "payment_failed_with_refund":
        subject = `⚠️ Payment Failed - Automatic Refund Processed`;
        htmlContent = `
          ${baseStyle}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);">
              <h1>⚠️ Payment Issue</h1>
              <p>We encountered a problem with your payment</p>
            </div>
            <div class="content">
              <h2>Automatic Refund Processed</h2>
              <p>Hi ${name},</p>
              <p>We're sorry, but there was an issue processing your payment for the ${plan.name} plan (${plan.price}/month).</p>
              
              <div class="plan-details">
                <h3>🔄 What we've done:</h3>
                <ul>
                  <li>Automatically processed a full refund</li>
                  <li>No charges will appear on your statement</li>
                  <li>Your account remains secure</li>
                </ul>
              </div>
              
              <p>You can try subscribing again with a different payment method.</p>
              
              <a href="https://mystifying-torvalds4-r9r87.view-3.tempo-dev.app/plan-selection" class="button">
                Try Again
              </a>
            </div>
            <div class="footer">
              <p>Questions? Contact support@numsphere.com</p>
            </div>
          </div>
        `;
        break;

      case "subscription_canceled":
        subject = `📋 Subscription Canceled - Access Until Period End`;
        htmlContent = `
          ${baseStyle}
          <div class="container">
            <div class="header" style="background: linear-gradient(135deg, #ffa726 0%, #ff7043 100%);">
              <h1>📋 Subscription Canceled</h1>
              <p>Your subscription has been canceled</p>
            </div>
            <div class="content">
              <h2>We're sorry to see you go, ${name}</h2>
              <p>Your ${plan.name} plan subscription has been canceled as requested.</p>
              
              <div class="plan-details">
                <h3>📅 Important Information:</h3>
                <ul>
                  <li>You'll retain access until the end of your current billing period</li>
                  <li>No future charges will be made</li>
                  <li>Your data will be preserved for 30 days</li>
                </ul>
              </div>
              
              <p>You can reactivate your subscription anytime before your access expires.</p>
              
              <a href="https://mystifying-torvalds4-r9r87.view-3.tempo-dev.app/plan-selection" class="button">
                Reactivate Subscription
              </a>
            </div>
            <div class="footer">
              <p>We'd love your feedback: support@numsphere.com</p>
            </div>
          </div>
        `;
        break;

      default:
        console.log(`[email] No email template for event: ${eventType}`);
        return;
    }

    // Log email sending (in production, integrate with email service like Resend/SendGrid)
    console.log(`[email] [${requestId}] Sending email to ${email}:`, {
      subject,
      eventType,
      planName: plan.name,
      planPrice: plan.price,
    });

    // TODO: Replace with actual email service integration
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'NumSphere <noreply@numsphere.com>',
    //   to: email,
    //   subject: subject,
    //   html: htmlContent
    // });
  } catch (error) {
    console.error(`[email] [${requestId}] Error sending email:`, error);
  }
}

// Handle checkout session completion failures
async function handleCheckoutSessionExpired(session: any, requestId: string) {
  const supabase = createSupabaseClient();
  const stripe = createStripeClient();
  const timestamp = new Date().toISOString();

  try {
    console.log(`[checkout_expired] Processing expired session ${session.id}`);

    // Check if payment was made before expiration
    if (session.payment_status === "paid" && session.payment_intent) {
      const userId = session.metadata?.user_id;

      if (userId) {
        console.log(
          `[checkout_expired] Processing automatic refund for expired paid session`,
        );

        try {
          // Get the payment intent to find the charge
          const paymentIntent = await stripe.paymentIntents.retrieve(
            session.payment_intent as string,
          );

          if (paymentIntent.charges?.data?.[0]?.id) {
            const chargeId = paymentIntent.charges.data[0].id;

            // Create refund for expired session
            const refund = await stripe.refunds.create({
              charge: chargeId,
              reason: "requested_by_customer",
              metadata: {
                user_id: userId,
                session_id: session.id,
                auto_refund: "checkout_session_expired",
                processed_at: timestamp,
              },
            });

            console.log(
              `[checkout_expired] Refund created for expired session:`,
              {
                refund_id: refund.id,
                amount: refund.amount,
                status: refund.status,
              },
            );

            // Log the refund
            await supabase.from("payment_security_log").insert({
              user_id: userId,
              event_type: "automatic_refund_session_expired",
              payload: {
                refund_id: refund.id,
                session_id: session.id,
                charge_id: chargeId,
                amount: refund.amount,
                reason: "checkout_session_expired",
              },
              status: "completed",
              created_at: timestamp,
            });
          }
        } catch (refundError) {
          console.error(`[checkout_expired] Refund failed:`, refundError);

          // Log refund failure
          await supabase.from("payment_security_log").insert({
            user_id: userId,
            event_type: "refund_failed_session_expired",
            payload: {
              session_id: session.id,
              error: refundError.message,
              payment_intent: session.payment_intent,
            },
            status: "failed",
            error_message: refundError.message,
            created_at: timestamp,
          });
        }
      }
    }
  } catch (error) {
    console.error(`[checkout_expired] Error handling expired session:`, error);
  }
}
