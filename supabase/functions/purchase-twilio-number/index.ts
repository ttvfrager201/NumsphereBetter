import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "@shared/cors.ts";
import { Database } from "@shared/database.types.ts";

// Rate limiting for number purchases
const purchaseAttempts = new Map<
  string,
  { count: number; lastAttempt: number }
>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ATTEMPTS_PER_WINDOW = 3;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let requestData;

  try {
    requestData = await req.json();
    const { phoneNumber, userId, planId } = requestData;

    // Validate required parameters
    if (!phoneNumber || !userId || !planId) {
      console.error("[purchase-twilio-number] Missing required parameters:", {
        phoneNumber: !!phoneNumber,
        userId: !!userId,
        planId: !!planId,
      });
      return new Response(
        JSON.stringify({
          error: "Missing required parameters",
          details: "phoneNumber, userId, and planId are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Rate limiting check
    const now = Date.now();
    const userKey = `${userId}-${phoneNumber}`;
    const attempts = purchaseAttempts.get(userKey);

    if (attempts) {
      if (now - attempts.lastAttempt < RATE_LIMIT_WINDOW) {
        if (attempts.count >= MAX_ATTEMPTS_PER_WINDOW) {
          console.warn(
            `[purchase-twilio-number] Rate limit exceeded for user ${userId}`,
          );
          return new Response(
            JSON.stringify({
              error: "Too many purchase attempts",
              details: "Please wait a minute before trying again",
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        attempts.count++;
      } else {
        attempts.count = 1;
        attempts.lastAttempt = now;
      }
    } else {
      purchaseAttempts.set(userKey, { count: 1, lastAttempt: now });
    }

    // Validate phone number format
    const phoneRegex = /^\+?1?[2-9]\d{2}[2-9]\d{2}\d{4}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\D/g, ""))) {
      return new Response(
        JSON.stringify({
          error: "Invalid phone number format",
          details: "Please provide a valid US phone number",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error(
        "[purchase-twilio-number] Twilio credentials not configured",
      );
      return new Response(
        JSON.stringify({
          error: "Service configuration error",
          details: "Twilio integration is not properly configured",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    console.log(
      `[purchase-twilio-number] Starting purchase process for user ${userId}, number ${phoneNumber}, plan ${planId}`,
    );

    // Check if user already has this number
    const { data: existingNumber } = await supabase
      .from("twilio_numbers")
      .select("id")
      .eq("user_id", userId)
      .eq("phone_number", phoneNumber)
      .single();

    if (existingNumber) {
      return new Response(
        JSON.stringify({
          error: "Number already owned",
          details: "You already own this phone number",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify user has active subscription
    const { data: subscription, error: subError } = await supabase
      .from("user_subscriptions")
      .select("plan_id, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (subError || !subscription) {
      console.error(
        `[purchase-twilio-number] No active subscription found for user ${userId}:`,
        subError,
      );
      return new Response(
        JSON.stringify({
          error: "No active subscription",
          details: "You need an active subscription to purchase phone numbers",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Define comprehensive plan limits
    const planLimits: Record<string, { minutes: number; maxNumbers: number }> =
      {
        starter: { minutes: 500, maxNumbers: 1 },
        business: { minutes: 2000, maxNumbers: 5 },
        enterprise: { minutes: 10000, maxNumbers: 25 },
      };

    const planLimit = planLimits[planId] || planLimits.starter;
    const minutesAllocated = planLimit.minutes;

    // Check if user has reached their number limit
    const { count: currentNumberCount } = await supabase
      .from("twilio_numbers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "active");

    if (currentNumberCount && currentNumberCount >= planLimit.maxNumbers) {
      return new Response(
        JSON.stringify({
          error: "Number limit reached",
          details: `Your ${planId} plan allows up to ${planLimit.maxNumbers} phone numbers. Please upgrade your plan or remove an existing number.`,
          currentCount: currentNumberCount,
          maxAllowed: planLimit.maxNumbers,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Purchase the number from Twilio with enhanced error handling
    const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;

    const formData = new URLSearchParams();
    formData.append("PhoneNumber", phoneNumber);
    formData.append(
      "FriendlyName",
      `NumSphere - ${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
    );
    // Use Supabase URL for webhook endpoints
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const baseWebhookUrl = `${supabaseUrl}/functions/v1`;

    formData.append("VoiceUrl", `${baseWebhookUrl}/twilio-voice-webhook`);
    formData.append("SmsUrl", `${baseWebhookUrl}/twilio-sms-webhook`);
    formData.append(
      "StatusCallback",
      `${baseWebhookUrl}/twilio-status-webhook`,
    );

    console.log(
      `[purchase-twilio-number] Attempting to purchase ${phoneNumber} from Twilio`,
    );

    let twilioResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        twilioResponse = await fetch(purchaseUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData,
        });
        break;
      } catch (fetchError) {
        retryCount++;
        console.error(
          `[purchase-twilio-number] Twilio API attempt ${retryCount} failed:`,
          fetchError,
        );

        if (retryCount >= maxRetries) {
          throw new Error(
            `Failed to connect to Twilio after ${maxRetries} attempts`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error(
        `[purchase-twilio-number] Twilio purchase error (${twilioResponse.status}):`,
        errorText,
      );

      let errorMessage = "Failed to purchase phone number";
      let errorDetails = "Please try a different number or contact support";

      // Parse Twilio error for better user experience
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          if (errorData.message.includes("not available")) {
            errorMessage = "Number not available";
            errorDetails =
              "This phone number is no longer available. Please select a different number.";
          } else if (errorData.message.includes("invalid")) {
            errorMessage = "Invalid phone number";
            errorDetails = "The selected phone number format is invalid.";
          } else if (errorData.message.includes("insufficient")) {
            errorMessage = "Insufficient funds";
            errorDetails =
              "There was an issue with the payment method. Please contact support.";
          }
        }
      } catch (parseError) {
        // Use default error messages
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: errorDetails,
          twilioError: errorText,
        }),
        {
          status: twilioResponse.status === 400 ? 400 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const twilioData = await twilioResponse.json();
    console.log(
      `[purchase-twilio-number] Successfully purchased ${phoneNumber} from Twilio:`,
      {
        sid: twilioData.sid,
        friendly_name: twilioData.friendly_name,
      },
    );

    // Store the purchased number in our database with comprehensive data
    const timestamp = new Date().toISOString();
    const { data: numberData, error: dbError } = await supabase
      .from("twilio_numbers")
      .insert({
        user_id: userId,
        phone_number: phoneNumber,
        twilio_sid: twilioData.sid,
        friendly_name:
          twilioData.friendly_name ||
          `NumSphere ${planId.charAt(0).toUpperCase() + planId.slice(1)} Number`,
        minutes_allocated: minutesAllocated,
        minutes_used: 0,
        plan_id: planId,
        status: "active",
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select()
      .single();

    if (dbError) {
      console.error(
        `[purchase-twilio-number] Database error storing number:`,
        dbError,
      );

      // Critical: Try to release the Twilio number if database insert failed
      console.log(
        `[purchase-twilio-number] Attempting to release Twilio number ${twilioData.sid} due to database error`,
      );
      try {
        const releaseResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${twilioData.sid}.json`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            },
          },
        );

        if (releaseResponse.ok) {
          console.log(
            `[purchase-twilio-number] Successfully released Twilio number ${twilioData.sid}`,
          );
        } else {
          const releaseError = await releaseResponse.text();
          console.error(
            `[purchase-twilio-number] Failed to release Twilio number:`,
            releaseError,
          );
        }
      } catch (releaseError) {
        console.error(
          `[purchase-twilio-number] Exception while releasing Twilio number:`,
          releaseError,
        );
      }

      return new Response(
        JSON.stringify({
          error: "Failed to save number information",
          details:
            "The number was purchased but could not be saved to your account. Please contact support.",
          twilioSid: twilioData.sid,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Clear rate limiting on successful purchase
    purchaseAttempts.delete(userKey);

    const processingTime = Date.now() - startTime;
    console.log(
      `[purchase-twilio-number] Successfully completed purchase in ${processingTime}ms:`,
      {
        user_id: userId,
        phone_number: phoneNumber,
        plan_id: planId,
        twilio_sid: twilioData.sid,
        minutes_allocated: minutesAllocated,
      },
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Phone number successfully purchased and configured",
        number: {
          ...numberData,
          formatted_number: formatPhoneNumber(phoneNumber),
        },
        twilioSid: twilioData.sid,
        minutesAllocated,
        planId,
        processingTimeMs: processingTime,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[purchase-twilio-number] Error after ${processingTime}ms:`, {
      error: error.message,
      stack: error.stack,
      requestData: requestData || "Failed to parse request",
    });

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details:
          "An unexpected error occurred while processing your request. Please try again or contact support.",
        processingTimeMs: processingTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

// Helper function to format phone numbers consistently
function formatPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const number = cleaned.slice(1);
    return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
  } else if (cleaned.length === 10) {
    return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phoneNumber;
}
