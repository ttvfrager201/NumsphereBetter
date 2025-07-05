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

// Function to update usage from call logs
async function updateUsageFromCallLogs(userId: string, supabase: any) {
  try {
    // Get current subscription to check limits
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("plan_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    const planLimits = {
      starter: 500,
      business: 2000,
      enterprise: -1, // unlimited
    };

    const minuteLimit =
      planLimits[subscription?.plan_id as keyof typeof planLimits] || 500;

    // Calculate total usage from call logs for current billing period
    const currentDate = new Date();
    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );

    const { data: callLogs, error: logsError } = await supabase
      .from("call_logs")
      .select("call_duration, call_minutes")
      .eq("user_id", userId)
      .gte("created_at", firstDayOfMonth.toISOString());

    if (logsError) {
      console.error(
        `[updateUsageFromCallLogs] Error fetching call logs:`,
        logsError,
      );
      return;
    }

    // Calculate total usage in seconds and minutes
    const totalSeconds =
      callLogs?.reduce((sum, log) => sum + (log.call_duration || 0), 0) || 0;
    const totalMinutes =
      callLogs?.reduce((sum, log) => sum + (log.call_minutes || 0), 0) || 0;

    // Update all user's Twilio numbers with aggregated usage
    const { error: updateError } = await supabase
      .from("twilio_numbers")
      .update({
        minutes_used: totalMinutes,
        seconds_used: totalSeconds, // Store exact seconds if column exists
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error(
        `[updateUsageFromCallLogs] Error updating usage:`,
        updateError,
      );
    } else {
      console.log(
        `[updateUsageFromCallLogs] Updated usage for user ${userId}: ${totalSeconds}s (${totalMinutes} billing minutes)`,
      );

      // Check if user is approaching or has exceeded their limit
      if (minuteLimit !== -1) {
        const usagePercentage = (totalMinutes / minuteLimit) * 100;

        if (usagePercentage >= 90) {
          console.warn(
            `[updateUsageFromCallLogs] User ${userId} is at ${usagePercentage.toFixed(1)}% of their minute limit`,
          );
          // TODO: Send notification to user about approaching limit
        }

        if (totalMinutes >= minuteLimit) {
          console.warn(
            `[updateUsageFromCallLogs] User ${userId} has exceeded their minute limit`,
          );
          // TODO: Send notification to user about exceeded limit
        }
      }
    }
  } catch (error) {
    console.error(`[updateUsageFromCallLogs] Error:`, error);
  }
}

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

    // Log call details to call_logs table for exact usage tracking
    if (callStatus === "completed" && callDuration) {
      const durationSeconds = parseInt(callDuration);
      const timestamp = new Date().toISOString();

      // Insert call log with exact seconds
      const { error: logError } = await supabase.from("call_logs").insert({
        call_sid: callSid,
        user_id: twilioNumber.user_id,
        twilio_number_id: twilioNumber.id,
        from_number: from,
        to_number: to,
        direction: direction === "inbound" ? "inbound" : "outbound",
        call_status: callStatus,
        call_duration: durationSeconds, // Store exact seconds
        call_minutes: Math.ceil(durationSeconds / 60), // Billing minutes
        started_at: timestamp,
        ended_at: timestamp,
        created_at: timestamp,
      });

      if (logError) {
        console.error(`[handle-call-status] Error logging call:`, logError);
      } else {
        console.log(`[handle-call-status] Call logged successfully:`, {
          callSid,
          durationSeconds,
          billingMinutes: Math.ceil(durationSeconds / 60),
        });
      }

      // Update aggregated usage based on call logs
      await updateUsageFromCallLogs(twilioNumber.user_id, supabase);

      // Log call completion
      console.log(`[handle-call-status] Call completed:`, {
        callSid,
        from,
        to,
        duration: `${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, "0")}`,
        exactSeconds: durationSeconds,
        billingMinutes: Math.ceil(durationSeconds / 60),
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
