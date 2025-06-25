import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "@shared/cors.ts";
import { Database } from "@shared/database.types.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { phoneNumber, userId, planId } = await req.json();

    if (!phoneNumber || !userId || !planId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
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
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Define minutes allocation based on plan
    const planMinutes: Record<string, number> = {
      starter: 500,
      business: 2000,
      enterprise: 10000, // Unlimited represented as high number
    };

    const minutesAllocated = planMinutes[planId] || 500;

    // Purchase the number from Twilio
    const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;

    const formData = new URLSearchParams();
    formData.append("PhoneNumber", phoneNumber);
    formData.append("FriendlyName", `NumSphere - ${planId} Plan`);

    const twilioResponse = await fetch(purchaseUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!twilioResponse.ok) {
      const errorText = await twilioResponse.text();
      console.error("Twilio purchase error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to purchase phone number" }),
        {
          status: twilioResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const twilioData = await twilioResponse.json();

    // Store the purchased number in our database
    const { data: numberData, error: dbError } = await supabase
      .from("twilio_numbers")
      .insert({
        user_id: userId,
        phone_number: phoneNumber,
        twilio_sid: twilioData.sid,
        friendly_name: twilioData.friendly_name,
        minutes_allocated: minutesAllocated,
        minutes_used: 0,
        plan_id: planId,
        status: "active",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      // Try to release the Twilio number if database insert failed
      try {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${twilioData.sid}.json`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            },
          },
        );
      } catch (releaseError) {
        console.error(
          "Failed to release Twilio number after DB error:",
          releaseError,
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to store number information" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        number: numberData,
        twilioSid: twilioData.sid,
        minutesAllocated,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error purchasing Twilio number:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
