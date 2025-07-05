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
      // Convert seconds to fractional minutes for accurate billing
      const durationMinutes = durationSeconds / 60;

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

      // Update minutes used (store as fractional minutes)
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
          `[handle-call-status] Updated minutes for ${twilioNumber.phone_number}: +${durationMinutes.toFixed(2)} minutes (${newMinutesUsed.toFixed(2)}/${minuteLimit === -1 ? "∞" : minuteLimit}) - ${durationSeconds} seconds`,
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

      // Log call details for analytics with accurate duration tracking
      console.log(`[handle-call-status] Call completed:`, {
        callSid,
        from,
        to,
        durationSeconds: durationSeconds,
        durationFormatted: `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, "0")}`,
        minutesUsed: durationMinutes.toFixed(2),
        userId: twilioNumber.user_id,
        phoneNumber: twilioNumber.phone_number,
      });

      // Store call log in database for detailed tracking
      try {
        await supabase.from("call_logs").insert({
          call_sid: callSid,
          from_number: from || "",
          to_number: to || "",
          direction: direction || "unknown",
          call_status: callStatus,
          call_duration: durationSeconds,
          call_minutes: durationMinutes,
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          user_id: twilioNumber.user_id,
          twilio_number_id: twilioNumber.id,
        });
        console.log(`[handle-call-status] Call log stored successfully`);
      } catch (logError) {
        console.error(`[handle-call-status] Error storing call log:`, logError);
      }
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
