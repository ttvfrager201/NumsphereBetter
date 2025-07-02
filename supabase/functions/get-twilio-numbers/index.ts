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
      sidPrefix: twilioAccountSid?.substring(0, 6) || "none",
    });

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error(
        "Missing Twilio credentials - Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables",
      );
      return new Response(
        JSON.stringify({
          error:
            "Twilio service not configured. Please contact support to set up Twilio credentials.",
          code: "TWILIO_CONFIG_ERROR",
          details:
            "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate Twilio Account SID format
    if (!twilioAccountSid.startsWith("AC") || twilioAccountSid.length !== 34) {
      console.error("Invalid Twilio Account SID format");
      return new Response(
        JSON.stringify({
          error: "Invalid Twilio configuration. Please contact support.",
          code: "TWILIO_CONFIG_ERROR",
          details: "Twilio Account SID format is invalid",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build Twilio API URL for available phone numbers
    let url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/${country.toUpperCase()}/Local.json?Limit=${limit}`;
    let searchStrategy = "default";

    // Add area code filter if provided - this is the primary and ONLY filter when specified
    if (areaCode && areaCode.trim() !== "") {
      const cleanAreaCode = areaCode.trim();

      // Primary strategy: Use AreaCode parameter for exact area code matching
      url += `&AreaCode=${cleanAreaCode}`;
      searchStrategy = "area_code_exact";

      console.log(
        `[get-twilio-numbers] Strategy: ${searchStrategy}, filtering by area code: ${cleanAreaCode}`,
      );
      console.log(
        `[get-twilio-numbers] Full URL (masked): ${url.replace(twilioAccountSid, "***")}`,
      );
    } else {
      // Only add other filters when NO area code is specified
      if (offset > 0) {
        // For pagination without area code, we can use different strategies
        const strategies = [
          `&Contains=1`,
          `&Contains=2`,
          `&Contains=3`,
          `&Contains=4`,
          `&Contains=5`,
        ];
        const strategyIndex = Math.floor(offset / 30) % strategies.length;
        url += strategies[strategyIndex];
        searchStrategy = `pagination_${strategyIndex}`;
      }
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
        if (
          errorText.includes("area code") ||
          errorText.includes("AreaCode") ||
          errorText.includes("Invalid AreaCode")
        ) {
          console.log(
            `[get-twilio-numbers] No numbers found for area code ${areaCode}`,
          );
          return new Response(
            JSON.stringify({
              numbers: [],
              success: true,
              message: `No numbers available for area code ${areaCode}. Try a different area code.`,
              code: "NO_NUMBERS_FOUND",
              searchedAreaCode: areaCode,
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

      // Log first few numbers for debugging area code filtering
      if (areaCode && data.available_phone_numbers?.length > 0) {
        console.log(
          `[get-twilio-numbers] First 3 numbers returned for area code ${areaCode}:`,
        );
        data.available_phone_numbers
          .slice(0, 3)
          .forEach((num: any, index: number) => {
            console.log(
              `  ${index + 1}. ${num.phone_number} (${num.locality}, ${num.region})`,
            );
          });
      }
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

    // Validate that returned numbers match the requested area code
    let finalNumbers = numbers;
    if (areaCode && numbers.length > 0) {
      const matchingNumbers = numbers.filter((num: any) => {
        const phoneAreaCode = num.phone_number
          .replace(/\D/g, "")
          .substring(1, 4);
        return phoneAreaCode === areaCode;
      });

      console.log(
        `[get-twilio-numbers] Area code validation: requested=${areaCode}, total_returned=${numbers.length}, matching=${matchingNumbers.length}`,
      );

      if (matchingNumbers.length === 0 && numbers.length > 0) {
        console.warn(
          `[get-twilio-numbers] WARNING: Twilio returned ${numbers.length} numbers but none match area code ${areaCode}`,
        );
        // Log the area codes that were actually returned
        const returnedAreaCodes = numbers.slice(0, 5).map((num: any) => {
          const phoneAreaCode = num.phone_number
            .replace(/\D/g, "")
            .substring(1, 4);
          return `${num.phone_number} (${phoneAreaCode})`;
        });
        console.log(
          `[get-twilio-numbers] Actually returned area codes:`,
          returnedAreaCodes,
        );

        // Return empty array since none match the requested area code
        finalNumbers = [];
      } else if (matchingNumbers.length > 0) {
        // Use only the matching numbers
        finalNumbers = matchingNumbers;
        console.log(
          `[get-twilio-numbers] Using ${matchingNumbers.length} numbers that match area code ${areaCode}`,
        );
      }
    } else if (areaCode && numbers.length === 0) {
      console.log(
        `[get-twilio-numbers] No numbers returned for area code ${areaCode}`,
      );
    }

    const responseMessage =
      finalNumbers.length > 0
        ? `Found ${finalNumbers.length} available numbers${areaCode ? ` for area code ${areaCode}` : ""}`
        : areaCode
          ? `No numbers available for area code ${areaCode}. Try a different area code.`
          : "No numbers available for the specified criteria";

    console.log(
      `[get-twilio-numbers] Returning ${finalNumbers.length} numbers to client`,
    );

    return new Response(
      JSON.stringify({
        numbers: finalNumbers,
        success: true,
        total: finalNumbers.length,
        country: country,
        areaCode: areaCode || null,
        message: responseMessage,
        searchedAreaCode: areaCode || null,
        searchStrategy: searchStrategy,
        debug: {
          originalCount: numbers.length,
          filteredCount: finalNumbers.length,
          requestedAreaCode: areaCode,
        },
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
