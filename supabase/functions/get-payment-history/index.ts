import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
          cancel_at_period_end: boolean | null;
          canceled_at: string | null;
          created_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          last_payment_date: string | null;
          plan_id: string;
          status: string | null;
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          trial_end: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          cancel_at_period_end?: boolean | null;
          canceled_at?: string | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          last_payment_date?: string | null;
          plan_id: string;
          status?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_end?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          cancel_at_period_end?: boolean | null;
          canceled_at?: string | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          last_payment_date?: string | null;
          plan_id?: string;
          status?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_end?: string | null;
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

interface PaymentHistoryRequest {
  userId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Add request body validation with better error handling
    let requestBody;
    try {
      const bodyText = await req.text();
      if (!bodyText || bodyText.trim() === "") {
        throw new Error("Empty request body");
      }
      requestBody = JSON.parse(bodyText);
    } catch (parseError) {
      console.error("Request body parsing error:", parseError);
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          details: "Request body must be valid JSON with userId field",
          payments: [],
          customerPortalUrl: null,
          subscription: null,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { userId }: PaymentHistoryRequest = requestBody;

    if (!userId) {
      return new Response(
        JSON.stringify({
          error: "User ID is required",
          payments: [],
          customerPortalUrl: null,
          subscription: null,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Initialize Supabase client with error handling
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({
          error: "Service configuration error",
          payments: [],
          customerPortalUrl: null,
          subscription: null,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("Stripe secret key not configured");
      return new Response(
        JSON.stringify({
          error: "Payment service not configured",
          payments: [],
          customerPortalUrl: null,
          subscription: null,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Get user's Stripe customer ID from user_subscriptions table with error handling
    let subscriptionData;
    try {
      const { data, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .select(
          "stripe_customer_id, stripe_subscription_id, plan_id, current_period_start, current_period_end, cancel_at_period_end, trial_end",
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (subscriptionError && subscriptionError.code !== "PGRST116") {
        console.error(
          "Database error fetching subscription:",
          subscriptionError,
        );
        return new Response(
          JSON.stringify({
            error: "Database error",
            payments: [],
            customerPortalUrl: null,
            subscription: null,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      subscriptionData = data;

      // If no active subscription, still try to get historical data
      if (!subscriptionData) {
        console.log("No active subscription found for user:", userId);
        // Try to get any subscription data for this user
        const { data: anySubData } = await supabase
          .from("user_subscriptions")
          .select(
            "stripe_customer_id, stripe_subscription_id, plan_id, current_period_start, current_period_end, cancel_at_period_end, trial_end",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        subscriptionData = anySubData;
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({
          error: "Database connection error",
          payments: [],
          customerPortalUrl: null,
          subscription: null,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!subscriptionData?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          message: "No payment history available",
          payments: [],
          customerPortalUrl: null,
          subscription: null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const customerId = subscriptionData.stripe_customer_id;

    try {
      // Fetch payment intents from Stripe with enhanced error handling
      let paymentIntents = { data: [] };
      let invoices = { data: [] };

      // Retry logic for Stripe API calls
      const retryStripeCall = async (
        apiCall: () => Promise<any>,
        callName: string,
        maxRetries = 3,
      ) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await apiCall();
          } catch (error: any) {
            console.error(
              `${callName} attempt ${attempt} failed:`,
              error.message,
            );
            if (attempt === maxRetries) {
              throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
      };

      try {
        paymentIntents = await retryStripeCall(
          () =>
            stripe.paymentIntents.list({
              customer: customerId,
              limit: 50,
            }),
          "Payment Intents fetch",
        );
      } catch (piError: any) {
        console.error(
          "Failed to fetch payment intents after retries:",
          piError.message,
        );
      }

      try {
        invoices = await retryStripeCall(
          () =>
            stripe.invoices.list({
              customer: customerId,
              limit: 50,
            }),
          "Invoices fetch",
        );
      } catch (invoiceError: any) {
        console.error(
          "Failed to fetch invoices after retries:",
          invoiceError.message,
        );
      }

      // Combine and format payment data
      const payments = [];

      // Add payment intents
      for (const pi of paymentIntents.data) {
        const createdDate = new Date(pi.created * 1000);
        payments.push({
          id: pi.id,
          amount: pi.amount,
          currency: pi.currency,
          status: pi.status,
          created: createdDate.toISOString(),
          created_timestamp: pi.created,
          date: createdDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          time: createdDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short",
          }),
          description: pi.description || "Payment",
          type: "payment_intent",
          payment_method: pi.payment_method_types?.[0] || "card",
          receipt_url: pi.charges?.data?.[0]?.receipt_url || null,
        });
      }

      // Add invoice payments with enhanced details
      for (const invoice of invoices.data) {
        if (
          invoice.status === "paid" ||
          invoice.status === "open" ||
          invoice.status === "uncollectible"
        ) {
          const createdDate = new Date(invoice.created * 1000);

          // Get customer billing details for PDF
          let customerAddress = null;
          try {
            if (invoice.customer_address) {
              customerAddress = {
                line1: invoice.customer_address.line1,
                line2: invoice.customer_address.line2,
                city: invoice.customer_address.city,
                state: invoice.customer_address.state,
                postal_code: invoice.customer_address.postal_code,
                country: invoice.customer_address.country,
              };
            } else {
              // Fallback to customer object address
              const customer = await stripe.customers.retrieve(customerId);
              if (customer && !customer.deleted && customer.address) {
                customerAddress = {
                  line1: customer.address.line1,
                  line2: customer.address.line2,
                  city: customer.address.city,
                  state: customer.address.state,
                  postal_code: customer.address.postal_code,
                  country: customer.address.country,
                };
              }
            }
          } catch (addressError) {
            console.log(
              "Could not fetch customer address:",
              addressError.message,
            );
          }

          payments.push({
            id: invoice.id,
            amount: invoice.amount_paid || invoice.amount_due,
            currency: invoice.currency,
            status:
              invoice.status === "paid"
                ? "succeeded"
                : invoice.status === "open"
                  ? "pending"
                  : "failed",
            created: createdDate.toISOString(),
            created_timestamp: invoice.created,
            date: createdDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            time: createdDate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZoneName: "short",
            }),
            description:
              invoice.description ||
              `Invoice ${invoice.number}` ||
              "Subscription Payment",
            type: "invoice",
            payment_method: "card",
            receipt_url:
              invoice.invoice_pdf || invoice.hosted_invoice_url || null,
            invoice_number: invoice.number,
            customer_address: customerAddress,
            subtotal: invoice.subtotal,
            tax: invoice.tax,
            total: invoice.total,
            period_start: invoice.period_start
              ? new Date(invoice.period_start * 1000).toISOString()
              : null,
            period_end: invoice.period_end
              ? new Date(invoice.period_end * 1000).toISOString()
              : null,
          });
        }
      }

      // Sort by creation date (newest first)
      payments.sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
      );

      // Get subscription details from Stripe
      let subscriptionDetails = null;
      if (subscriptionData?.stripe_subscription_id) {
        try {
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionData.stripe_subscription_id,
          );
          // Get product details for better naming
          let productName = `${subscriptionData.plan_id.charAt(0).toUpperCase() + subscriptionData.plan_id.slice(1)} Plan`;

          if (subscription.items.data[0]?.price?.product) {
            try {
              const product = await stripe.products.retrieve(
                subscription.items.data[0].price.product as string,
              );
              productName = product.name || productName;
            } catch (productError) {
              // Silently handle product fetch errors to reduce console noise
            }
          }

          subscriptionDetails = {
            name: subscription.items.data[0]?.price?.nickname || productName,
            amount: subscription.items.data[0]?.price?.unit_amount || 0,
            currency: subscription.items.data[0]?.price?.currency || "usd",
            interval:
              subscription.items.data[0]?.price?.recurring?.interval || "month",
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            current_period_start: subscription.current_period_start,
            cancel_at_period_end: subscription.cancel_at_period_end,
            trial_end: subscription.trial_end,
            plan_id: subscriptionData.plan_id,
          };
        } catch (subError) {
          // Silently handle subscription fetch errors to reduce console noise
        }
      }

      // Create customer portal session for subscription management
      let customerPortalUrl = null;
      try {
        const origin =
          req.headers.get("origin") ||
          req.headers.get("referer") ||
          "https://app.numsphere.com";
        const returnUrl =
          origin.includes("localhost") ||
          origin.includes("127.0.0.1") ||
          origin.includes("tempo-dev.app")
            ? `${origin}/dashboard`
            : "https://app.numsphere.com/dashboard";

        const portalSession = await retryStripeCall(
          () =>
            stripe.billingPortal.sessions.create({
              customer: customerId,
              return_url: returnUrl,
            }),
          "Customer Portal creation",
        );
        customerPortalUrl = portalSession.url;
      } catch (portalError: any) {
        console.error("Error creating customer portal:", portalError.message);
      }

      return new Response(
        JSON.stringify({
          payments: payments.slice(0, 20), // Limit to 20 most recent
          customerPortalUrl,
          subscription: subscriptionDetails,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (stripeError) {
      console.error("Stripe API error:", stripeError);
      // Return error response for Stripe API failures
      return new Response(
        JSON.stringify({
          error: "Payment service temporarily unavailable",
          payments: [],
          customerPortalUrl: null,
          subscription: null,
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Unexpected error fetching payment history:", error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred",
        payments: [],
        customerPortalUrl: null,
        subscription: null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
