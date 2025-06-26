import { corsHeaders } from "@shared/cors.ts";
import { Database } from "@shared/database.types.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Get user's Stripe customer ID
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (userError || !userData?.stripe_customer_id) {
      console.log("No Stripe customer ID found for user:", userId);
      return new Response(JSON.stringify({ payments: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mock payment history for demonstration
    // In a real implementation, you would fetch from Stripe API
    const mockPayments = [
      {
        id: "pi_1234567890",
        amount: 2999,
        currency: "usd",
        status: "succeeded",
        created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Pro Plan - Monthly",
      },
      {
        id: "pi_0987654321",
        amount: 2999,
        currency: "usd",
        status: "succeeded",
        created: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Pro Plan - Monthly",
      },
      {
        id: "pi_1122334455",
        amount: 2999,
        currency: "usd",
        status: "failed",
        created: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Pro Plan - Monthly",
      },
    ];

    return new Response(JSON.stringify({ payments: mockPayments }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
