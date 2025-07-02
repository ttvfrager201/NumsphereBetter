// CORS headers - All restrictions removed
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true",
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
    // Add request body validation
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("Invalid JSON in request body:", parseError);
      return new Response(
        JSON.stringify({
          error: "Invalid request format",
          numbers: [],
          success: false,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { country = "US", areaCode, limit = 20, offset = 0 } = requestBody;

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

    // Handle pagination by varying search parameters
    if (offset > 0) {
      // For subsequent requests, vary the search to get different numbers
      const searchVariations = [
        `&Contains=${Math.floor(Math.random() * 10)}`,
        `&NearNumber=${areaCode ? `+1${areaCode}5551234` : "+15551234567"}`,
        `&InRegion=${["CA", "NY", "TX", "FL", "IL"][Math.floor(Math.random() * 5)]}`,
      ];
      const variation = searchVariations[offset % searchVariations.length];
      if (!areaCode || !url.includes("AreaCode")) {
        url += variation;
      }
    }

    // Make request to Twilio API with retry logic
    let response;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
        break;
      } catch (fetchError) {
        retryCount++;
        console.error(`Twilio API attempt ${retryCount} failed:`, fetchError);

        if (retryCount >= maxRetries) {
          return new Response(
            JSON.stringify({
              error: "Failed to connect to Twilio service",
              numbers: [],
              success: false,
            }),
            {
              status: 503,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
      }
    }

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
