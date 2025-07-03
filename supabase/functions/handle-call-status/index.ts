import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
};

// Database types
type Database = {
  public: {
    Tables: {
      twilio_numbers: {
        Row: {
          id: string;
          user_id: string | null;
          phone_number: string;
          minutes_used: number | null;
          minutes_allocated: number | null;
          updated_at: string | null;
        };
        Update: {
          minutes_used?: number | null;
          updated_at?: string | null;
        };
      };
      user_subscriptions: {
        Row: {
          user_id: string | null;
          plan_id: string;
          status: string | null;
        };
      };
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

    console.log(`[handle-call-status] Call status update:`, {
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
      console.error(`[handle-call-status] No active number found`);
      return new Response("OK", {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Update minutes used if call is completed
    if (callStatus === "completed" && callDuration) {
      const durationSeconds = parseInt(callDuration);
      const durationMinutes = Math.ceil(durationSeconds / 60);

      // Get current subscription to check limits
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("plan_id")
        .eq("user_id", twilioNumber.user_id)
        .eq("status", "active")
        .single();

      const planLimits = {
        starter: 500,
        business: 2000,
        enterprise: -1, // unlimited
      };

      const minuteLimit =
        planLimits[subscription?.plan_id as keyof typeof planLimits] || 500;
      const currentMinutesUsed = twilioNumber.minutes_used || 0;
      const newMinutesUsed = currentMinutesUsed + durationMinutes;

      // Update minutes used
      const { error: updateError } = await supabase
        .from("twilio_numbers")
        .update({
          minutes_used: newMinutesUsed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", twilioNumber.id);

      if (updateError) {
        console.error(
          `[handle-call-status] Error updating minutes:`,
          updateError,
        );
      } else {
        console.log(
          `[handle-call-status] Updated minutes for ${twilioNumber.phone_number}: +${durationMinutes} minutes (${newMinutesUsed}/${minuteLimit === -1 ? "∞" : minuteLimit})`,
        );

        // Check if user is approaching or has exceeded their limit
        if (minuteLimit !== -1) {
          const usagePercentage = (newMinutesUsed / minuteLimit) * 100;

          if (usagePercentage >= 90) {
            console.warn(
              `[handle-call-status] User ${twilioNumber.user_id} is at ${usagePercentage.toFixed(1)}% of their minute limit`,
            );
            // TODO: Send notification to user about approaching limit
          }

          if (newMinutesUsed >= minuteLimit) {
            console.warn(
              `[handle-call-status] User ${twilioNumber.user_id} has exceeded their minute limit`,
            );
            // TODO: Send notification to user about exceeded limit
          }
        }
      }

      // Log call details for analytics (you can create a call_logs table for this)
      console.log(`[handle-call-status] Call completed:`, {
        callSid,
        from,
        to,
        duration: `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, "0")}`,
        minutes: durationMinutes,
        userId: twilioNumber.user_id,
        phoneNumber: twilioNumber.phone_number,
      });
    }

    return new Response("OK", {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error(`[handle-call-status] Error:`, error);

    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
