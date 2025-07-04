// CORS headers - All restrictions removed
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true",
};

interface TwilioCallLog {
  sid: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  duration: string;
  start_time: string;
  end_time: string;
  price?: string;
  price_unit?: string;
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
    console.log("=== Call Logs Function Started ===");
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);

    const body = await req.json();
    const { phoneNumber, limit = 100, userId } = body;

    console.log("Call logs request:", {
      phoneNumber,
      limit,
      userId,
      hasPhoneNumber: !!phoneNumber,
      hasUserId: !!userId,
    });

    // Import Supabase client
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");

    console.log("Supabase config check:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlLength: supabaseUrl?.length || 0,
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
          details: "Missing Supabase configuration",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    console.log("Twilio credentials check:", {
      hasSid: !!twilioAccountSid,
      hasToken: !!twilioAuthToken,
      sidLength: twilioAccountSid?.length || 0,
      tokenLength: twilioAuthToken?.length || 0,
    });

    // Get user's subscribed phone numbers first
    let userPhoneNumbers = [];
    if (userId) {
      console.log("Fetching user's subscribed phone numbers for user:", userId);

      try {
        const { data: twilioNumbers, error: numbersError } = await supabase
          .from("twilio_numbers")
          .select("phone_number, friendly_name")
          .eq("user_id", userId)
          .eq("status", "active");

        if (!numbersError && twilioNumbers) {
          userPhoneNumbers = twilioNumbers.map((n) => n.phone_number);
          console.log("User's subscribed phone numbers:", userPhoneNumbers);
        } else {
          console.error("Error fetching user phone numbers:", numbersError);
        }
      } catch (error) {
        console.error("Error querying user phone numbers:", error);
      }
    }

    // First, try to get call logs from database if userId is provided
    if (userId) {
      console.log("Fetching call logs from database for user:", userId);

      try {
        let query = supabase
          .from("call_logs")
          .select(
            `
            *,
            twilio_numbers (
              phone_number,
              friendly_name
            )
          `,
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit);

        // Filter by specific phone number if provided, otherwise filter by user's subscribed numbers
        if (phoneNumber) {
          query = query.or(
            `from_number.eq.${phoneNumber},to_number.eq.${phoneNumber}`,
          );
        } else if (userPhoneNumbers.length > 0) {
          // Filter to show only calls involving user's subscribed numbers
          const phoneFilters = userPhoneNumbers
            .map((num) => `from_number.eq.${num},to_number.eq.${num}`)
            .join(",");
          query = query.or(phoneFilters);
        }

        const { data: dbCallLogs, error: dbError } = await query;

        console.log("Database query result:", {
          hasData: !!dbCallLogs,
          dataLength: dbCallLogs?.length || 0,
          error: dbError,
          filteredByNumbers: userPhoneNumbers,
        });

        if (!dbError && dbCallLogs && dbCallLogs.length > 0) {
          console.log("Returning database call logs:", dbCallLogs.length);
          return new Response(
            JSON.stringify({
              calls: dbCallLogs.map((log) => ({
                sid: log.call_sid,
                from: log.from_number,
                to: log.to_number,
                direction: log.direction,
                status: log.call_status,
                duration: log.call_duration?.toString() || "0",
                exact_seconds: log.call_duration || 0,
                billing_minutes: log.call_minutes || 0,
                start_time: log.started_at || log.created_at,
                end_time: log.ended_at,
              })),
              success: true,
              total: dbCallLogs.length,
              source: "database",
              filtered_by_user_numbers: userPhoneNumbers,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      } catch (dbError) {
        console.error("Database query error:", dbError);
      }
    }

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("Missing Twilio credentials:", {
        TWILIO_ACCOUNT_SID: !!twilioAccountSid,
        TWILIO_AUTH_TOKEN: !!twilioAuthToken,
      });

      // Return sample data when Twilio credentials are not configured
      // Use user's first subscribed number or default if none
      const subscriberNumber =
        userPhoneNumbers.length > 0
          ? userPhoneNumbers[0]
          : phoneNumber || "+15559876543";

      const sampleCalls = [
        {
          sid: "CA1234567890abcdef1234567890abcdef",
          from: "+15551234567",
          to: subscriberNumber,
          direction: "inbound",
          status: "completed",
          duration: "45",
          start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(
            Date.now() - 2 * 60 * 60 * 1000 + 45000,
          ).toISOString(),
        },
        {
          sid: "CA2234567890abcdef1234567890abcdef",
          from: subscriberNumber,
          to: "+15551111111",
          direction: "outbound",
          status: "completed",
          duration: "120",
          start_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(
            Date.now() - 4 * 60 * 60 * 1000 + 120000,
          ).toISOString(),
        },
        {
          sid: "CA3234567890abcdef1234567890abcdef",
          from: "+15552222222",
          to: subscriberNumber,
          direction: "inbound",
          status: "no-answer",
          duration: "0",
          start_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        },
      ];

      console.log("Returning sample data due to missing Twilio credentials");
      return new Response(
        JSON.stringify({
          calls: sampleCalls,
          success: true,
          total: sampleCalls.length,
          demo_mode: true,
          message:
            "Demo data - Configure Twilio credentials to see real call logs",
          filtered_by_user_numbers: userPhoneNumbers,
          subscriber_number: subscriberNumber,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build Twilio API URL for call logs
    let url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json?PageSize=${limit}`;

    // Determine which phone numbers to filter by
    const numbersToFilter = phoneNumber ? [phoneNumber] : userPhoneNumbers;

    if (numbersToFilter.length > 0) {
      console.log("Filtering Twilio calls by numbers:", numbersToFilter);

      // Get both inbound and outbound calls for all user's numbers
      const fetchPromises = [];

      for (const number of numbersToFilter) {
        const inboundUrl = `${url}&To=${encodeURIComponent(number)}`;
        const outboundUrl = `${url}&From=${encodeURIComponent(number)}`;

        fetchPromises.push(
          fetch(inboundUrl, {
            method: "GET",
            headers: {
              Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }),
          fetch(outboundUrl, {
            method: "GET",
            headers: {
              Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }),
        );
      }

      const responses = await Promise.all(fetchPromises);

      // Check for any failed responses
      const failedResponses = responses.filter((response) => !response.ok);
      if (failedResponses.length > 0) {
        console.error("Some Twilio API requests failed:", {
          failedCount: failedResponses.length,
          totalRequests: responses.length,
        });

        // If all requests failed, return error
        if (failedResponses.length === responses.length) {
          return new Response(
            JSON.stringify({
              error: "Failed to fetch call logs from Twilio",
              details: "All API requests failed",
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      // Process successful responses
      const allCalls = [];
      let processedResponses = 0;

      for (const response of responses) {
        if (response.ok) {
          try {
            const data = await response.json();
            if (data.calls) {
              allCalls.push(...data.calls);
            }
            processedResponses++;
          } catch (jsonError) {
            console.error("Error parsing Twilio response JSON:", jsonError);
          }
        }
      }

      console.log("Twilio API responses processed:", {
        totalCalls: allCalls.length,
        processedResponses,
        totalRequests: responses.length,
        numbersFiltered: numbersToFilter,
      });
      const uniqueCalls = allCalls.filter(
        (call, index, self) =>
          index === self.findIndex((c) => c.sid === call.sid),
      );

      // Sort by date (newest first) and limit
      const sortedCalls = uniqueCalls
        .sort(
          (a, b) =>
            new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
        )
        .slice(0, limit);

      console.log("Processed calls:", {
        totalCalls: allCalls.length,
        uniqueCalls: uniqueCalls.length,
        sortedCalls: sortedCalls.length,
        phoneNumber,
      });

      return new Response(
        JSON.stringify({
          calls: sortedCalls,
          success: true,
          total: sortedCalls.length,
          filtered_by: phoneNumber || "user_subscribed_numbers",
          filtered_by_user_numbers: userPhoneNumbers,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      // No phone numbers to filter by - return empty result
      console.log("No phone numbers to filter by, returning empty result");
      return new Response(
        JSON.stringify({
          calls: [],
          success: true,
          total: 0,
          message: "No subscribed phone numbers found for this user",
          filtered_by_user_numbers: userPhoneNumbers,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Error fetching Twilio call logs:", error);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
