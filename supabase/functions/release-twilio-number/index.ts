import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { numberId, phoneNumber, userId } = await req.json();

    if (!numberId || !phoneNumber || !userId) {
      throw new Error("Missing required parameters");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the number belongs to the user
    const { data: numberData, error: numberError } = await supabase
      .from("twilio_numbers")
      .select("*")
      .eq("id", numberId)
      .eq("user_id", userId)
      .single();

    if (numberError || !numberData) {
      throw new Error("Phone number not found or does not belong to user");
    }

    // Initialize Twilio client
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error("Twilio credentials not configured");
    }

    // Release the number from Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${numberData.twilio_sid}.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("Twilio release error:", errorText);
      throw new Error(`Failed to release number from Twilio: ${errorText}`);
    }

    // Remove the number from our database
    const { error: deleteError } = await supabase
      .from("twilio_numbers")
      .delete()
      .eq("id", numberId)
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Database deletion error:", deleteError);
      throw new Error("Failed to remove number from database");
    }

    // Log the release for audit purposes
    await supabase.from("number_audit_log").insert({
      user_id: userId,
      phone_number: phoneNumber,
      action: "released",
      details: {
        number_id: numberId,
        twilio_sid: numberData.twilio_sid,
        released_at: new Date().toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Phone number released successfully",
        phoneNumber: phoneNumber,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Release number error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to release phone number",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
