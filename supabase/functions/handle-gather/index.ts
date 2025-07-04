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
    const url = new URL(req.url);
    const blockId = url.searchParams.get("blockId");
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);
    const callSid = params.get("CallSid")?.toString();
    const from = params.get("From")?.toString();
    const to = params.get("To")?.toString();
    const digits = params.get("Digits")?.toString();
    console.log(`[handle-gather] Processing gather input:`, {
      callSid,
      from,
      to,
      digits,
      blockId,
    });
    if (!digits) {
      console.log(`[handle-gather] No digits received`);
      return generateErrorTwiML("No input received. Please try again.");
    }
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
        `[handle-gather] No active number found for ${to}:`,
        numberError,
      );
      return generateErrorTwiML("This number is not configured.");
    }
    // Get active call flow
    const activeFlow = twilioNumber.call_flows?.find((flow) => flow.is_active);
    if (!activeFlow || !activeFlow.flow_config) {
      console.error(`[handle-gather] No active call flow found`);
      return generateErrorTwiML("No active call flow found.");
    }
    const config =
      typeof activeFlow.flow_config === "string"
        ? JSON.parse(activeFlow.flow_config)
        : activeFlow.flow_config;
    if (!config.blocks || !Array.isArray(config.blocks)) {
      console.error(`[handle-gather] Invalid call flow configuration`);
      return generateErrorTwiML("Invalid call flow configuration.");
    }
    // Find the gather block
    const gatherBlock = config.blocks.find((block) => block.id === blockId);
    if (!gatherBlock || gatherBlock.type !== "gather") {
      console.error(
        `[handle-gather] Gather block not found for blockId: ${blockId}`,
      );
      console.error(
        `[handle-gather] Available blocks:`,
        config.blocks.map((b) => ({
          id: b.id,
          type: b.type,
        })),
      );
      return generateErrorTwiML("Gather block not found.");
    }
    // Find the matching option
    const selectedOption = gatherBlock.config.options?.find(
      (option) => option.digit === digits.toString(),
    );
    console.log(
      `[handle-gather] Available options:`,
      JSON.stringify(gatherBlock.config.options, null, 2),
    );
    console.log(`[handle-gather] Looking for digit:`, digits);
    console.log(
      `[handle-gather] Selected option:`,
      JSON.stringify(selectedOption, null, 2),
    );
    let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
`;
    const voice = "alice";
    if (selectedOption) {
      console.log(`[handle-gather] Processing selected option:`, {
        digit: selectedOption.digit,
        text: selectedOption.text,
        blockId: selectedOption.blockId,
        hasBlockConnection: !!selectedOption.blockId,
      });
      // If the option has a connected block, route to that block
      if (selectedOption.blockId && selectedOption.blockId.trim() !== "") {
        const connectedBlock = config.blocks.find(
          (b) => b.id === selectedOption.blockId,
        );
        if (connectedBlock) {
          console.log(`[handle-gather] Routing to connected block:`, {
            blockId: connectedBlock.id,
            blockType: connectedBlock.type,
            blockConfig: connectedBlock.config,
          });
          const blockTwiML = generateBlockTwiML(
            connectedBlock,
            config.blocks,
            voice,
          );
          if (blockTwiML.trim()) {
            twiml += blockTwiML;
          } else {
            // Fallback if block generates no TwiML
            twiml += `  <Say voice="${voice}">Thank you for your selection.</Say>\n`;
            twiml += `  <Hangup/>\n`;
          }
        } else {
          console.error(
            `[handle-gather] Connected block not found:`,
            selectedOption.blockId,
          );
          twiml += `  <Say voice="${voice}">Configuration error. Connected block not found. Please contact support.</Say>\n`;
          twiml += `  <Hangup/>\n`;
        }
      } else {
        // No block connection - provide response based on option text or action
        console.log(
          `[handle-gather] No block connection for option, using text response`,
        );
        if (selectedOption.text && selectedOption.text.trim() !== "") {
          twiml += `  <Say voice="${voice}">${escapeXml(selectedOption.text)}</Say>\n`;
        } else {
          twiml += `  <Say voice="${voice}">Thank you for selecting option ${digits}.</Say>\n`;
        }
        twiml += `  <Hangup/>\n`;
      }
    } else {
      // No matching option, provide default response
      console.log(
        `[handle-gather] No matching option found for digit: ${digits}`,
      );
      console.log(
        `[handle-gather] All available options:`,
        gatherBlock.config.options?.map((opt) => ({
          digit: opt.digit,
          text: opt.text,
          blockId: opt.blockId,
        })),
      );
      twiml += `  <Say voice="${voice}">Invalid selection. You pressed ${digits}. The available options are: `;
      // List available options
      if (gatherBlock.config.options && gatherBlock.config.options.length > 0) {
        const optionsList = gatherBlock.config.options
          .filter((opt) => opt.digit && opt.digit.trim() !== "")
          .map(
            (opt) =>
              `Press ${opt.digit} for ${opt.text || "option " + opt.digit}`,
          )
          .join(", ");
        if (optionsList) {
          twiml += `${escapeXml(optionsList)}. `;
        }
      }
      twiml += `Please call back and try again.</Say>\n`;
      twiml += `  <Hangup/>\n`;
    }
    twiml += `</Response>`;
    console.log(`[handle-gather] Generated TwiML:`, twiml);
    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error(`[handle-gather] Error:`, error);
    return generateErrorTwiML(
      "We're experiencing technical difficulties. Please try again later.",
    );
  }
});
function generateErrorTwiML(message) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${escapeXml(message)}</Say>
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
function generateBlockTwiML(block, allBlocks, voice) {
  let twiml = "";
  const processedBlocks = new Set();
  function processBlock(currentBlock) {
    if (processedBlocks.has(currentBlock.id)) {
      console.log(
        `[generateBlockTwiML] Block already processed: ${currentBlock.id}`,
      );
      return "";
    }
    processedBlocks.add(currentBlock.id);
    console.log(`[generateBlockTwiML] Processing block:`, {
      id: currentBlock.id,
      type: currentBlock.type,
      config: currentBlock.config,
    });
    let blockTwiml = "";
    switch (currentBlock.type) {
      case "say":
        if (currentBlock.config.text) {
          const speed = currentBlock.config.speed || 1.0;
          const rate = Math.max(0.5, Math.min(2.0, speed)); // Clamp between 0.5 and 2.0
          blockTwiml += `  <Say voice="${voice}" rate="${rate}">${escapeXml(currentBlock.config.text)}</Say>\n`;
        }
        break;
      case "pause":
        const duration = currentBlock.config.duration || 2;
        blockTwiml += `  <Pause length="${duration}"/>\n`;
        break;
      case "forward":
        if (currentBlock.config.number) {
          const timeout = currentBlock.config.timeout || 30;
          blockTwiml += `  <Dial timeout="${timeout}">${escapeXml(currentBlock.config.number)}</Dial>\n`;
        }
        break;
      case "record":
        const maxLength = currentBlock.config.maxLength || 300;
        const finishOnKey = currentBlock.config.finishOnKey || "#";
        if (currentBlock.config.prompt) {
          blockTwiml += `  <Say voice="${voice}">${escapeXml(currentBlock.config.prompt)}</Say>\n`;
        }
        blockTwiml += `  <Record maxLength="${maxLength}" finishOnKey="${finishOnKey}" transcribe="true"/>\n`;
        break;
      case "play":
        if (currentBlock.config.url) {
          blockTwiml += `  <Play>${escapeXml(currentBlock.config.url)}</Play>\n`;
        }
        break;
      case "hangup":
        blockTwiml += `  <Hangup/>\n`;
        return blockTwiml; // Don't process further connections after hangup
      case "gather":
        // Don't process gather blocks in this context to avoid infinite loops
        console.log(
          `[generateBlockTwiML] Skipping gather block to avoid loops`,
        );
        blockTwiml += `  <Say voice="${voice}">Menu option processed.</Say>\n`;
        blockTwiml += `  <Hangup/>\n`;
        return blockTwiml;
      case "sms":
        if (currentBlock.config.message) {
          const to = currentBlock.config.to || "{{From}}";
          blockTwiml += `  <Sms to="${escapeXml(to)}">${escapeXml(currentBlock.config.message)}</Sms>\n`;
        }
        break;
      default:
        console.log(
          `[generateBlockTwiML] Unknown block type: ${currentBlock.type}`,
        );
        blockTwiml += `  <Say voice="${voice}">Unknown block type.</Say>\n`;
        blockTwiml += `  <Hangup/>\n`;
        return blockTwiml;
    }
    // Process connected blocks
    if (currentBlock.connections && currentBlock.connections.length > 0) {
      console.log(
        `[generateBlockTwiML] Processing connections:`,
        currentBlock.connections,
      );
      const nextBlock = allBlocks.find(
        (b) => b.id === currentBlock.connections[0],
      );
      if (nextBlock) {
        blockTwiml += processBlock(nextBlock);
      } else {
        console.log(
          `[generateBlockTwiML] Connected block not found: ${currentBlock.connections[0]}`,
        );
      }
    }
    return blockTwiml;
  }
  return processBlock(block);
}
function escapeXml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
