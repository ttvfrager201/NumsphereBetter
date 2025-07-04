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
    const body = await req.json();
    const { phoneNumber, limit = 100 } = body;

    console.log("Call logs request:", {
      phoneNumber,
      limit,
      hasPhoneNumber: !!phoneNumber,
    });

    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    console.log("Twilio credentials check:", {
      hasSid: !!twilioAccountSid,
      hasToken: !!twilioAuthToken,
      sidLength: twilioAccountSid?.length || 0,
      tokenLength: twilioAuthToken?.length || 0,
    });

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("Missing Twilio credentials:", {
        TWILIO_ACCOUNT_SID: !!twilioAccountSid,
        TWILIO_AUTH_TOKEN: !!twilioAuthToken,
      });

      // Return sample data when Twilio credentials are not configured
      const sampleCalls = [
        {
          sid: "CA1234567890abcdef1234567890abcdef",
          from: "+15551234567",
          to: phoneNumber || "+15559876543",
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
          from: phoneNumber || "+15559876543",
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
          to: phoneNumber || "+15559876543",
          direction: "inbound",
          status: "no-answer",
          duration: "0",
          start_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          end_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        },
      ];

      return new Response(
        JSON.stringify({
          calls: sampleCalls,
          success: true,
          total: sampleCalls.length,
          demo_mode: true,
          message:
            "Demo data - Configure Twilio credentials to see real call logs",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build Twilio API URL for call logs
    let url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json?PageSize=${limit}`;

    // Add phone number filter if provided
    if (phoneNumber) {
      // Get both inbound and outbound calls for this number
      const inboundUrl = `${url}&To=${encodeURIComponent(phoneNumber)}`;
      const outboundUrl = `${url}&From=${encodeURIComponent(phoneNumber)}`;

      // Fetch both inbound and outbound calls
      const [inboundResponse, outboundResponse] = await Promise.all([
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
      ]);

      if (!inboundResponse.ok || !outboundResponse.ok) {
        const inboundError = !inboundResponse.ok
          ? await inboundResponse.text()
          : null;
        const outboundError = !outboundResponse.ok
          ? await outboundResponse.text()
          : null;

        console.error("Twilio API error:", {
          inboundStatus: inboundResponse.status,
          outboundStatus: outboundResponse.status,
          inboundError,
          outboundError,
        });

        return new Response(
          JSON.stringify({
            error: "Failed to fetch call logs from Twilio",
            details: {
              inboundError,
              outboundError,
              inboundStatus: inboundResponse.status,
              outboundStatus: outboundResponse.status,
            },
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const inboundData = await inboundResponse.json();
      const outboundData = await outboundResponse.json();

      console.log("Twilio API responses:", {
        inboundCount: inboundData.calls?.length || 0,
        outboundCount: outboundData.calls?.length || 0,
        inboundSample: inboundData.calls?.[0] || null,
        outboundSample: outboundData.calls?.[0] || null,
      });

      // Combine and deduplicate calls
      const allCalls = [
        ...(inboundData.calls || []),
        ...(outboundData.calls || []),
      ];
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
          filtered_by: phoneNumber,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      // Get all calls if no phone number filter
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
        return new Response(
          JSON.stringify({ error: "Failed to fetch call logs from Twilio" }),
          {
            status: response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const data = await response.json();

      return new Response(
        JSON.stringify({
          calls: data.calls || [],
          success: true,
          total: data.calls?.length || 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (error) {
    console.error("Error fetching Twilio call logs:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
