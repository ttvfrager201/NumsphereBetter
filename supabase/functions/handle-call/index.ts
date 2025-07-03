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
          twilio_sid: string;
          friendly_name: string | null;
          minutes_allocated: number | null;
          minutes_used: number | null;
          plan_id: string;
          status: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
      };
      call_flows: {
        Row: {
          id: string;
          user_id: string | null;
          twilio_number_id: string | null;
          flow_name: string;
          flow_config: any;
          twilio_flow_sid: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
      };
      users: {
        Row: {
          id: string;
          has_completed_payment: boolean | null;
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
    const from = formData.get("From")?.toString();
    const to = formData.get("To")?.toString();
    const callStatus = formData.get("CallStatus")?.toString();
    const direction = formData.get("Direction")?.toString();

    console.log(`[handle-call] Incoming call:`, {
      callSid,
      from,
      to,
      callStatus,
      direction,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Find the Twilio number and associated call flow
    const { data: twilioNumber, error: numberError } = await supabase
      .from("twilio_numbers")
      .select(
        `
        *,
        call_flows(
          id,
          flow_name,
          flow_config,
          is_active
        )
      `,
      )
      .eq("phone_number", to)
      .eq("status", "active")
      .single();

    if (numberError || !twilioNumber) {
      console.error(
        `[handle-call] No active number found for ${to}:`,
        numberError,
      );
      return generateErrorTwiML("This number is not configured.");
    }

    // Check user's subscription and minute limits
    const { data: userData } = await supabase
      .from("users")
      .select("has_completed_payment")
      .eq("id", twilioNumber.user_id)
      .single();

    if (!userData?.has_completed_payment) {
      console.log(
        `[handle-call] User ${twilioNumber.user_id} has no active subscription`,
      );
      return generateErrorTwiML("This service is temporarily unavailable.");
    }

    // Check minute limits based on plan
    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select("plan_id")
      .eq("user_id", twilioNumber.user_id)
      .eq("status", "active")
      .single();

    const planLimits = {
      starter: 500,
      business: 2000,
      enterprise: -1, // unlimited
    };

    const minuteLimit =
      planLimits[subscription?.plan_id as keyof typeof planLimits] || 500;
    const minutesUsed = twilioNumber.minutes_used || 0;

    if (minuteLimit !== -1 && minutesUsed >= minuteLimit) {
      console.log(
        `[handle-call] Minute limit exceeded for user ${twilioNumber.user_id}`,
      );
      return generateErrorTwiML(
        "Your monthly minute limit has been reached. Please upgrade your plan.",
      );
    }

    // Get active call flow or use default
    const activeFlow = twilioNumber.call_flows?.find(
      (flow: any) => flow.is_active,
    );

    let twiml;
    if (activeFlow && activeFlow.flow_config) {
      // Use configured flow
      twiml = generateTwiMLFromFlow(activeFlow.flow_config, {
        from,
        to,
        callSid,
        webhookUrl: `${req.url.split("/handle-call")[0]}/handle-call-status`,
      });
    } else {
      // Default greeting with webhook for call tracking
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello! Thank you for calling. This number is powered by NumSphere.</Say>
  <Pause length="1"/>
  <Say voice="alice">Please configure your call flow in the dashboard to customize this experience.</Say>
  <Hangup/>
</Response>`;
    }

    console.log(`[handle-call] Generated TwiML for ${callSid}`);

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error(`[handle-call] Error:`, error);
    return generateErrorTwiML(
      "We're experiencing technical difficulties. Please try again later.",
    );
  }
});

function generateErrorTwiML(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/xml",
    },
  });
}

function generateTwiMLFromFlow(
  flowConfig: any,
  context: { from: string; to: string; callSid: string; webhookUrl: string },
): string {
  try {
    const config =
      typeof flowConfig === "string" ? JSON.parse(flowConfig) : flowConfig;

    let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;

    // Add status callback for call tracking
    const statusCallback = `${context.webhookUrl}?callSid=${context.callSid}`;

    if (config.blocks && Array.isArray(config.blocks)) {
      // New block-based format
      twiml += generateBlockBasedTwiML(
        config.blocks,
        config.voice || "alice",
        statusCallback,
      );
    } else {
      // Legacy format
      twiml += generateLegacyTwiML(config, statusCallback);
    }

    twiml += `</Response>`;

    return twiml;
  } catch (error) {
    console.error("Error generating TwiML from flow:", error);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="alice">Configuration error. Please contact support.</Say>\n  <Hangup/>\n</Response>`;
  }
}

function generateBlockBasedTwiML(
  blocks: any[],
  voice: string,
  statusCallback: string,
): string {
  let twiml = "";

  for (const block of blocks) {
    switch (block.type) {
      case "say":
        if (block.config.text) {
          twiml += `  <Say voice="${voice}">${escapeXml(block.config.text)}</Say>\n`;
        }
        break;

      case "pause":
        const duration = block.config.duration || 2;
        twiml += `  <Pause length="${duration}"/>\n`;
        break;

      case "gather":
        if (block.config.prompt) {
          twiml += `  <Gather input="dtmf" timeout="10" numDigits="1">\n`;
          twiml += `    <Say voice="${voice}">${escapeXml(block.config.prompt)}</Say>\n`;
          twiml += `  </Gather>\n`;
        }
        break;

      case "forward":
        if (block.config.number) {
          const timeout = block.config.timeout || 30;
          twiml += `  <Dial timeout="${timeout}" callerId="${block.config.number}" statusCallback="${statusCallback}">${block.config.number}</Dial>\n`;
        }
        break;

      case "record":
        const maxLength = block.config.maxLength || 300;
        const finishOnKey = block.config.finishOnKey || "#";
        if (block.config.prompt) {
          twiml += `  <Say voice="${voice}">${escapeXml(block.config.prompt)}</Say>\n`;
        }
        twiml += `  <Record maxLength="${maxLength}" finishOnKey="${finishOnKey}" transcribe="true"/>\n`;
        break;

      case "play":
        if (block.config.url) {
          twiml += `  <Play>${escapeXml(block.config.url)}</Play>\n`;
        }
        break;

      case "sms":
        if (block.config.message) {
          const to = block.config.to || "{{From}}";
          twiml += `  <Sms to="${to}">${escapeXml(block.config.message)}</Sms>\n`;
        }
        break;

      case "hangup":
        twiml += `  <Hangup/>\n`;
        break;
    }
  }

  return twiml;
}

function generateLegacyTwiML(config: any, statusCallback: string): string {
  let twiml = "";
  const voice = config.voice || "alice";

  if (config.greeting) {
    twiml += `  <Say voice="${voice}">${escapeXml(config.greeting)}</Say>\n`;
  }

  if (config.menu && config.menu.options) {
    twiml += `  <Gather input="dtmf" timeout="10" numDigits="1">\n`;
    twiml += `    <Say voice="${voice}">${escapeXml(config.menu.prompt || "Please select an option.")}</Say>\n`;
    twiml += `  </Gather>\n`;
  }

  if (config.voicemail) {
    twiml += `  <Say voice="${voice}">${escapeXml(config.voicemail.prompt || "Please leave a message after the beep.")}</Say>\n`;
    twiml += `  <Record maxLength="60" transcribe="true"/>\n`;
  }

  if (config.forward) {
    twiml += `  <Dial timeout="30" statusCallback="${statusCallback}">${config.forward.number}</Dial>\n`;
  }

  return twiml;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
