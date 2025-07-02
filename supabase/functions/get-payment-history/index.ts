import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

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

interface PaymentHistoryRequest {
  userId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId }: PaymentHistoryRequest = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client with error handling
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({
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

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.log("Stripe secret key not configured");
      return new Response(
        JSON.stringify({
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

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
    });

    // Get user's Stripe customer ID from user_subscriptions table with error handling
    let subscriptionData;
    try {
      const { data, error: subscriptionError } = await supabase
        .from("user_subscriptions")
        .select("stripe_customer_id, stripe_subscription_id, plan_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (subscriptionError) {
        console.log("No active subscription found for user:", userId);
        return new Response(
          JSON.stringify({
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

      subscriptionData = data;
    } catch (dbError) {
      console.error("Database error:", dbError);
      return new Response(
        JSON.stringify({
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

    if (!subscriptionData?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
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
      // Fetch payment intents from Stripe with error handling
      let paymentIntents;
      let invoices;

      try {
        paymentIntents = await stripe.paymentIntents.list({
          customer: customerId,
          limit: 50,
        });
      } catch (piError) {
        console.log("Error fetching payment intents:", piError.message);
        paymentIntents = { data: [] };
      }

      try {
        // Fetch invoices from Stripe for subscription payments
        invoices = await stripe.invoices.list({
          customer: customerId,
          limit: 50,
        });
      } catch (invoiceError) {
        console.log("Error fetching invoices:", invoiceError.message);
        invoices = { data: [] };
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

      // Add invoice payments
      for (const invoice of invoices.data) {
        if (
          invoice.status === "paid" ||
          invoice.status === "open" ||
          invoice.status === "uncollectible"
        ) {
          const createdDate = new Date(invoice.created * 1000);
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
          };
        } catch (subError) {
          // Silently handle subscription fetch errors to reduce console noise
        }
      }

      // Create customer portal session for subscription management
      let customerPortalUrl = null;
      try {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${req.headers.get("origin") || "https://app.numsphere.com"}/dashboard`,
        });
        customerPortalUrl = portalSession.url;
      } catch (portalError) {
        console.log("Error creating customer portal:", portalError.message);
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
      console.log("Stripe API error:", stripeError.message);
      // Return empty array if Stripe API fails
      return new Response(
        JSON.stringify({
          payments: [],
          customerPortalUrl: null,
          subscription: null,
          error: "Unable to fetch payment data at this time",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Error fetching payment history:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
