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
      twilio_numbers: {
        Row: {
          id: string;
          user_id: string | null;
          phone_number: string;
          twilio_sid: string;
          friendly_name: string | null;
          minutes_allocated: number | null;
          minutes_used: number | null;
          plan_id: string;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          phone_number: string;
          twilio_sid: string;
          friendly_name?: string | null;
          minutes_allocated?: number | null;
          minutes_used?: number | null;
          plan_id: string;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          phone_number?: string;
          twilio_sid?: string;
          friendly_name?: string | null;
          minutes_allocated?: number | null;
          minutes_used?: number | null;
          plan_id?: string;
          status?: string | null;
          created_at?: string | null;
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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid")?.toString();
    const callStatus = formData.get("CallStatus")?.toString();
    const callDuration = formData.get("CallDuration")?.toString();
    const from = formData.get("From")?.toString();
    const to = formData.get("To")?.toString();
    const direction = formData.get("Direction")?.toString();

    console.log(`[twilio-status-webhook] Call status update:`, {
      callSid,
      callStatus,
      callDuration,
      from,
      to,
      direction,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Find the Twilio number
    const { data: twilioNumber } = await supabase
      .from("twilio_numbers")
      .select("*")
      .eq("phone_number", direction === "inbound" ? to : from)
      .eq("status", "active")
      .single();

    if (!twilioNumber) {
      console.error(`[twilio-status-webhook] No active number found`);
      return new Response("OK", {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Update minutes used if call is completed
    if (callStatus === "completed" && callDuration) {
      const durationMinutes = Math.ceil(parseInt(callDuration) / 60);

      const { error: updateError } = await supabase
        .from("twilio_numbers")
        .update({
          minutes_used: (twilioNumber.minutes_used || 0) + durationMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", twilioNumber.id);

      if (updateError) {
        console.error(
          `[twilio-status-webhook] Error updating minutes:`,
          updateError,
        );
      } else {
        console.log(
          `[twilio-status-webhook] Updated minutes for ${twilioNumber.phone_number}: +${durationMinutes} minutes`,
        );
      }
    }

    // You can store call logs in a separate table here
    console.log(
      `[twilio-status-webhook] Processed status update for call ${callSid}`,
    );

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error(`[twilio-status-webhook] Error:`, error);

    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
