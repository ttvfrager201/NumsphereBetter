// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-requested-with",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "false",
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
    const {
      country = "US",
      areaCode,
      limit = 20,
      offset = 0,
    } = await req.json();

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!twilioAccountSid || !twilioAuthToken) {
      return new Response(
        JSON.stringify({ error: "Twilio credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build Twilio API URL for available phone numbers
    let url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/${country}/Local.json?Limit=${limit}`;

    if (areaCode) {
      url += `&AreaCode=${areaCode}`;
    }

    // Note: Twilio doesn't support offset-based pagination for available numbers
    // We'll fetch more numbers and handle pagination on the client side
    if (offset > 0 && !areaCode) {
      // For refresh requests without area code, we can try different parameters
      // to get different sets of numbers
      url += `&Contains=${Math.floor(Math.random() * 10)}`;
    }

    // Make request to Twilio API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twilio API error:", errorText);

      // Check if it's an invalid area code error
      if (response.status === 400 && errorText.includes("area code")) {
        return new Response(
          JSON.stringify({
            numbers: [],
            success: true,
            message: "Invalid area code",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to fetch available numbers" }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        numbers: data.available_phone_numbers || [],
        success: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching Twilio numbers:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
