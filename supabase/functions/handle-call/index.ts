import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SERVICE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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
      enterprise: -1,
    };
    const minuteLimit = planLimits[subscription?.plan_id] || 500;
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
    const activeFlow = twilioNumber.call_flows?.find((flow) => flow.is_active);
    console.log(`[handle-call] Active flow found:`, {
      hasFlow: !!activeFlow,
      flowName: activeFlow?.flow_name,
      hasConfig: !!activeFlow?.flow_config,
      configType: typeof activeFlow?.flow_config,
    });
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
function generateErrorTwiML(message) {
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
function generateTwiMLFromFlow(flowConfig, context) {
  try {
    const config =
      typeof flowConfig === "string" ? JSON.parse(flowConfig) : flowConfig;
    console.log(`[generateTwiMLFromFlow] Processing config:`, {
      hasBlocks: !!(config.blocks && Array.isArray(config.blocks)),
      blocksCount: config.blocks?.length || 0,
      voice: config.voice,
      version: config.version,
    });
    let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
    // Add status callback for call tracking
    const statusCallback = `${context.webhookUrl}?callSid=${context.callSid}`;
    if (
      config.blocks &&
      Array.isArray(config.blocks) &&
      config.blocks.length > 0
    ) {
      // New block-based format
      twiml += generateBlockBasedTwiML(config.blocks, "alice", statusCallback);
    } else {
      // Legacy format or fallback
      console.log(`[generateTwiMLFromFlow] Using legacy format or fallback`);
      twiml += generateLegacyTwiML(config, statusCallback);
    }
    twiml += `</Response>`;
    console.log(
      `[generateTwiMLFromFlow] Generated TwiML:`,
      twiml.substring(0, 200) + "...",
    );
    return twiml;
  } catch (error) {
    console.error("Error generating TwiML from flow:", error);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="alice">Configuration error. Please contact support.</Say>\n  <Hangup/>\n</Response>`;
  }
}
function generateBlockBasedTwiML(blocks, _voice, statusCallback) {
  let twiml = "";
  const processedBlocks = new Set();
  console.log(`[generateBlockBasedTwiML] Processing ${blocks.length} blocks`);
  // Find the first block (one with no incoming connections)
  const firstBlock =
    blocks.find(
      (block) =>
        !blocks.some((b) => b.connections && b.connections.includes(block.id)),
    ) || blocks[0];
  console.log(`[generateBlockBasedTwiML] First block:`, {
    id: firstBlock?.id,
    type: firstBlock?.type,
    hasConfig: !!firstBlock?.config,
  });
  if (!firstBlock) {
    console.log(`[generateBlockBasedTwiML] No first block found`);
    return twiml;
  }
  // Process blocks in connection order
  function processBlock(block) {
    if (processedBlocks.has(block.id)) return "";
    processedBlocks.add(block.id);
    console.log(`[processBlock] Processing block:`, {
      id: block.id,
      type: block.type,
      config: block.config,
    });
    let blockTwiml = "";
    switch (block.type) {
      case "say":
        if (block.config.text) {
          const speed = block.config.speed || 1.0;
          const rate = Math.max(0.5, Math.min(2.0, speed)); // Clamp between 0.5 and 2.0
          blockTwiml += `  <Say voice="alice" rate="${rate}">${escapeXml(block.config.text)}</Say>\n`;
        }
        break;
      case "pause":
        const duration = block.config.duration || 2;
        blockTwiml += `  <Pause length="${duration}"/>\n`;
        break;
      case "gather":
        if (block.config.prompt) {
          // For gather blocks, we need to handle the menu options
          const origin = new URL(statusCallback).origin;
          const gatherUrl = `${origin}/functions/v1/supabase-functions-handle-gather?blockId=${block.id}`;
          blockTwiml += `  <Gather input="dtmf" timeout="10" numDigits="1" action="${gatherUrl}">\n`;
          blockTwiml += `    <Say voice="alice">${escapeXml(block.config.prompt)}</Say>\n`;
          blockTwiml += `  </Gather>\n`;
          // Add default action if no input - say invalid and hangup
          blockTwiml += `  <Say voice="alice">Sorry, I didn't receive any input. Please try calling again.</Say>\n`;
          blockTwiml += `  <Hangup/>\n`;
          return blockTwiml; // Don't process connections here as gather handles routing
        }
        break;
      case "forward":
        if (block.config.number) {
          const timeout = block.config.timeout || 30;
          // Optional hold music URL (must be an accessible audio file)
          const holdMusicUrl = block.config.holdMusicUrl;
          // Optional loop count for hold music (default to 10 loops)
          const holdMusicLoop = block.config.holdMusicLoop || 10;

          if (holdMusicUrl) {
            // Play hold music while dialing
            blockTwiml += `  <Dial timeout="${timeout}" statusCallback="${statusCallback}">\n`;
            blockTwiml += `    <Play loop="${holdMusicLoop}">${escapeXml(holdMusicUrl)}</Play>\n`;
            blockTwiml += `    <Number>${escapeXml(block.config.number)}</Number>\n`;
            blockTwiml += `  </Dial>\n`;
          } else {
            // No hold music, regular dial
            blockTwiml += `  <Dial timeout="${timeout}" statusCallback="${statusCallback}">${escapeXml(block.config.number)}</Dial>\n`;
          }
        }
        break;
      case "record":
        const maxLength = block.config.maxLength || 300;
        const finishOnKey = block.config.finishOnKey || "#";
        if (block.config.prompt) {
          blockTwiml += `  <Say voice="alice">${escapeXml(block.config.prompt)}</Say>\n`;
        }
        blockTwiml += `  <Record maxLength="${maxLength}" finishOnKey="${finishOnKey}" transcribe="true"/>\n`;
        break;
      case "play":
        if (block.config.url) {
          blockTwiml += `  <Play>${escapeXml(block.config.url)}</Play>\n`;
        }
        break;
      case "sms":
        if (block.config.message) {
          const to = block.config.to || "{{From}}";
          blockTwiml += `  <Sms to="${to}">${escapeXml(block.config.message)}</Sms>\n`;
        }
        break;
      case "hangup":
        blockTwiml += `  <Hangup/>\n`;
        return blockTwiml; // Don't process further connections after hangup
    }
    // Process connected blocks (except for gather which handles its own routing)
    if (
      block.type !== "gather" &&
      block.connections &&
      block.connections.length > 0
    ) {
      const nextBlock = blocks.find((b) => b.id === block.connections[0]);
      if (nextBlock) {
        blockTwiml += processBlock(nextBlock);
      }
    }
    return blockTwiml;
  }
  twiml = processBlock(firstBlock);
  return twiml;
}
function generateLegacyTwiML(config, statusCallback) {
  let twiml = "";
  if (config.greeting) {
    twiml += `  <Say voice="alice">${escapeXml(config.greeting)}</Say>\n`;
  }
  if (config.menu && config.menu.options) {
    twiml += `  <Gather input="dtmf" timeout="10" numDigits="1">\n`;
    twiml += `    <Say voice="alice">${escapeXml(config.menu.prompt || "Please select an option.")}</Say>\n`;
    twiml += `  </Gather>\n`;
  }
  if (config.voicemail) {
    twiml += `  <Say voice="alice">${escapeXml(config.voicemail.prompt || "Please leave a message after the beep.")}</Say>\n`;
    twiml += `  <Record maxLength="60" transcribe="true"/>\n`;
  }
  if (config.forward) {
    twiml += `  <Dial timeout="30" statusCallback="${statusCallback}">${config.forward.number}</Dial>\n`;
  }
  return twiml;
}
function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
