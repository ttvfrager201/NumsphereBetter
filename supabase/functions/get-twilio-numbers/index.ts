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

  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let requestBody;
  try {
    // Handle both JSON string and parsed object
    const rawBody = await req.text();
    console.log("Raw request body:", rawBody);

    if (!rawBody || rawBody.trim() === "") {
      // Default values if no body provided
      requestBody = {
        country: "US",
        limit: 20,
        offset: 0,
      };
    } else {
      try {
        requestBody = JSON.parse(rawBody);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        return new Response(
          JSON.stringify({
            error: "Invalid JSON in request body",
            details: parseError.message,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }
  } catch (error) {
    console.error("Error reading request body:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to read request body",
        details: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // Extract and validate parameters with defaults
    const {
      country = "US",
      areaCode,
      limit = 20,
      offset = 0,
    } = requestBody || {};

    console.log("Parsed parameters:", { country, areaCode, limit, offset });

    // Validate parameters
    if (typeof country !== "string" || country.length !== 2) {
      return new Response(
        JSON.stringify({
          error:
            "Invalid country code. Must be 2-letter country code (e.g., 'US')",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (
      areaCode &&
      (typeof areaCode !== "string" || !/^\d{3}$/.test(areaCode))
    ) {
      return new Response(
        JSON.stringify({
          error: "Invalid area code. Must be 3 digits (e.g., '415')",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (typeof limit !== "number" || limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({
          error: "Invalid limit. Must be a number between 1 and 100",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    console.log("Twilio credentials check:", {
      hasSid: !!twilioAccountSid,
      hasToken: !!twilioAuthToken,
      sidLength: twilioAccountSid?.length || 0,
    });

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("Missing Twilio credentials");
      return new Response(
        JSON.stringify({
          error: "Twilio service not configured. Please contact support.",
          code: "TWILIO_CONFIG_ERROR",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build Twilio API URL for available phone numbers
    let url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/${country.toUpperCase()}/Local.json?Limit=${limit}`;

    // Add area code filter if provided
    if (areaCode && areaCode.trim() !== "") {
      url += `&AreaCode=${areaCode.trim()}`;
    }

    // For pagination/refresh, add variety to get different numbers
    if (offset > 0 && (!areaCode || areaCode.trim() === "")) {
      const randomDigit = Math.floor(Math.random() * 10);
      url += `&Contains=${randomDigit}`;
    }

    console.log("Twilio API URL:", url.replace(twilioAccountSid, "***"));

    // Make request to Twilio API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          Accept: "application/json",
          "User-Agent": "NumSphere/1.0",
        },
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error("Fetch error:", fetchError);

      if (fetchError.name === "AbortError") {
        return new Response(
          JSON.stringify({
            error: "Request timeout. Twilio API is taking too long to respond.",
            code: "TIMEOUT_ERROR",
          }),
          {
            status: 504,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: "Failed to connect to Twilio API",
          code: "CONNECTION_ERROR",
          details: fetchError.message,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    clearTimeout(timeoutId);

    console.log("Twilio API response status:", response.status);

    // Handle Twilio API response
    if (!response.ok) {
      let errorText;
      try {
        errorText = await response.text();
        console.error("Twilio API error response:", errorText);
      } catch (e) {
        errorText = "Unable to read error response";
      }

      // Handle specific Twilio errors
      if (response.status === 400) {
        if (errorText.includes("area code") || errorText.includes("AreaCode")) {
          return new Response(
            JSON.stringify({
              numbers: [],
              success: true,
              message: `No numbers available for area code ${areaCode}`,
              code: "INVALID_AREA_CODE",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        if (errorText.includes("country") || errorText.includes("Country")) {
          return new Response(
            JSON.stringify({
              error: `Invalid country code: ${country}`,
              code: "INVALID_COUNTRY",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      if (response.status === 401) {
        return new Response(
          JSON.stringify({
            error: "Twilio authentication failed. Please contact support.",
            code: "TWILIO_AUTH_ERROR",
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Please try again in a moment.",
            code: "RATE_LIMIT_ERROR",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          error: "Twilio API error",
          code: "TWILIO_API_ERROR",
          status: response.status,
          details: errorText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse successful response
    let data;
    try {
      data = await response.json();
      console.log(
        "Twilio API success, found numbers:",
        data.available_phone_numbers?.length || 0,
      );
    } catch (parseError) {
      console.error("Error parsing Twilio response:", parseError);
      return new Response(
        JSON.stringify({
          error: "Invalid response from Twilio API",
          code: "PARSE_ERROR",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Return successful response
    const numbers = data.available_phone_numbers || [];
    return new Response(
      JSON.stringify({
        numbers: numbers,
        success: true,
        total: numbers.length,
        country: country,
        areaCode: areaCode || null,
        message:
          numbers.length > 0
            ? `Found ${numbers.length} available numbers`
            : "No numbers available for the specified criteria",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error in get-twilio-numbers:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        details: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
