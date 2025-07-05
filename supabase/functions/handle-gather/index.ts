import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
};
Deno.serve(async (req) => {
  // Handle CORS preflight early
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  const url = new URL(req.url);
  const blockId = url.searchParams.get("blockId");
  const retryCount = parseInt(url.searchParams.get("retry") || "0");
  // Parse parameters ONCE here
  let callSid, from, to, digits;
  if (req.method === "POST") {
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);
    callSid = params.get("CallSid");
    from = params.get("From");
    to = params.get("To");
    digits = params.get("Digits");
  } else if (req.method === "GET") {
    callSid = url.searchParams.get("CallSid");
    from = url.searchParams.get("From");
    to = url.searchParams.get("To");
    digits = url.searchParams.get("Digits");
  }
  console.log("[handle-gather] Processing gather input:", {
    callSid,
    from,
    to,
    digits,
    blockId,
    retryCount,
  });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY");
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
      console.error("[handle-gather] No active call flow found");
      return generateErrorTwiML("No active call flow found.");
    }
    const config =
      typeof activeFlow.flow_config === "string"
        ? JSON.parse(activeFlow.flow_config)
        : activeFlow.flow_config;
    if (!config.blocks || !Array.isArray(config.blocks)) {
      console.error("[handle-gather] Invalid call flow configuration");
      return generateErrorTwiML("Invalid call flow configuration.");
    }
    // Find the gather block
    const gatherBlock = config.blocks.find((block) => block.id === blockId);
    if (!gatherBlock || gatherBlock.type !== "gather") {
      console.error(
        `[handle-gather] Gather block not found for blockId: ${blockId}`,
      );
      console.error(
        "[handle-gather] Available blocks:",
        config.blocks.map((b) => ({
          id: b.id,
          type: b.type,
        })),
      );
      return generateErrorTwiML("Gather block not found.");
    }
    const maxRetries = gatherBlock.config.maxRetries || 3;
    const retryMessage =
      gatherBlock.config.retryMessage ||
      "Sorry, I didn't understand. Please try again.";
    const goodbyeMessage =
      gatherBlock.config.goodbyeMessage || "Thank you for calling. Goodbye!";
    const voice = gatherBlock.config.voice || "alice";
    // Handle no input or invalid input with retry logic
    if (!digits) {
      console.log(
        `[handle-gather] No digits received, retry ${retryCount + 1}/${maxRetries}`,
      );

      if (retryCount < maxRetries - 1) {
        // Retry - say retry message then resay the prompt
        const origin = new URL(req.url).origin;
        const retryUrl = `${origin}/functions/v1/supabase-functions-handle-gather?blockId=${blockId}&retry=${retryCount + 1}`;

        let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
        twiml += `  <Say voice="${voice}">${escapeXml(retryMessage)}</Say>\n`;
        twiml += `  <Gather input="dtmf" timeout="10" numDigits="1" action="${retryUrl}">\n`;
        twiml += `    <Say voice="${voice}">${escapeXml(gatherBlock.config.prompt)}</Say>\n`;
        twiml += `  </Gather>\n`;
        // Add fallback for no input after retry
        twiml += `  <Redirect>${retryUrl}</Redirect>\n`;
        twiml += `</Response>`;

        return new Response(twiml, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/xml",
          },
        });
      } else {
        // Max retries reached
        console.log(`[handle-gather] Max retries reached, saying goodbye`);
        return generateGoodbyeTwiML(goodbyeMessage, voice);
      }
    }
    // Find the matching option
    const selectedOption = gatherBlock.config.options?.find(
      (option) => option.digit === digits.toString(),
    );
    console.log(
      "[handle-gather] Available options:",
      JSON.stringify(gatherBlock.config.options, null, 2),
    );
    console.log("[handle-gather] Looking for digit:", digits);
    console.log(
      "[handle-gather] Selected option:",
      JSON.stringify(selectedOption, null, 2),
    );
    let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
    if (selectedOption) {
      console.log("[handle-gather] Processing selected option:", {
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
          console.log("[handle-gather] Routing to connected block:", {
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
            "[handle-gather] Connected block not found:",
            selectedOption.blockId,
          );
          twiml += `  <Say voice="${voice}">Configuration error. Connected block not found. Please contact support.</Say>\n`;
          twiml += `  <Hangup/>\n`;
        }
      } else {
        // No block connection - provide response based on option text or action
        console.log(
          "[handle-gather] No block connection for option, using text response",
        );
        if (selectedOption.text && selectedOption.text.trim() !== "") {
          twiml += `  <Say voice="${voice}">${escapeXml(selectedOption.text)}</Say>\n`;
        } else {
          twiml += `  <Say voice="${voice}">Thank you for selecting option ${digits}.</Say>\n`;
        }
        twiml += `  <Hangup/>\n`;
      }
    } else {
      // Invalid option selected, retry if possible
      console.log(
        `[handle-gather] Invalid option ${digits}, retry ${retryCount + 1}/${maxRetries}`,
      );

      if (retryCount < maxRetries - 1) {
        // Retry with invalid option message
        const origin = new URL(req.url).origin;
        const retryUrl = `${origin}/functions/v1/supabase-functions-handle-gather?blockId=${blockId}&retry=${retryCount + 1}`;

        twiml += `  <Say voice="${voice}">Invalid selection. You pressed ${digits}. `;
        // List available options
        if (
          gatherBlock.config.options &&
          gatherBlock.config.options.length > 0
        ) {
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
        twiml += `${escapeXml(retryMessage)}</Say>\n`;
        twiml += `  <Gather input="dtmf" timeout="10" numDigits="1" action="${retryUrl}">\n`;
        twiml += `    <Say voice="${voice}">${escapeXml(gatherBlock.config.prompt)}</Say>\n`;
        twiml += `  </Gather>\n`;
        // Add fallback for no input after retry
        twiml += `  <Redirect>${retryUrl}</Redirect>\n`;
      } else {
        // Max retries reached
        twiml += `  <Say voice="${voice}">Invalid selection. You pressed ${digits}. `;
        if (
          gatherBlock.config.options &&
          gatherBlock.config.options.length > 0
        ) {
          const optionsList = gatherBlock.config.options
            .filter((opt) => opt.digit && opt.digit.trim() !== "")
            .map(
              (opt) =>
                `Press ${opt.digit} for ${opt.text || "option " + opt.digit}`,
            )
            .join(", ");
          if (optionsList) {
            twiml += `The available options were: ${escapeXml(optionsList)}. `;
          }
        }
        twiml += `${escapeXml(goodbyeMessage)}</Say>\n`;
        twiml += `  <Hangup/>\n`;
      }
    }
    twiml += `</Response>`;
    console.log("[handle-gather] Generated TwiML:", twiml);
    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error("[handle-gather] Error:", error);
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
function generateGoodbyeTwiML(message, voice = "alice") {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXml(message)}</Say>
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
    console.log("[generateBlockTwiML] Processing block:", {
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
          const blockVoice = currentBlock.config.voice || voice;
          blockTwiml += `  <Say voice="${blockVoice}" rate="${rate}">${escapeXml(currentBlock.config.text)}</Say>\n`;
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
      case "multi_forward":
        if (
          currentBlock.config.numbers &&
          currentBlock.config.numbers.length > 0
        ) {
          const timeout = currentBlock.config.ringTimeout || 20;
          const strategy =
            currentBlock.config.forwardStrategy || "simultaneous";

          if (strategy === "simultaneous") {
            blockTwiml += `  <Dial timeout="${timeout}">\n`;
            currentBlock.config.numbers.forEach((number) => {
              if (number.trim()) {
                blockTwiml += `    <Number>${escapeXml(number)}</Number>\n`;
              }
            });
            blockTwiml += `  </Dial>\n`;
          } else {
            // Sequential or priority - dial one at a time
            const validNumbers = currentBlock.config.numbers.filter((n) =>
              n.trim(),
            );
            validNumbers.forEach((number, index) => {
              blockTwiml += `  <Dial timeout="${timeout}">${escapeXml(number)}</Dial>\n`;
              if (index < validNumbers.length - 1) {
                blockTwiml += `  <Pause length="1"/>\n`;
              }
            });
          }
        }
        break;
      case "hold":
        const holdMessage =
          currentBlock.config.message || "Please hold while we connect you.";
        const musicType = currentBlock.config.musicType || "preset";
        const holdMusicLoop = currentBlock.config.holdMusicLoop || 10;
        const blockVoice = currentBlock.config.voice || voice;

        blockTwiml += `  <Say voice="${blockVoice}">${escapeXml(holdMessage)}</Say>\n`;

        if (musicType === "preset") {
          const presetMusic = currentBlock.config.presetMusic || "classical";
          const musicUrls = {
            classical:
              "https://www.soundjay.com/misc/sounds/classical-music.mp3",
            jazz: "https://www.soundjay.com/misc/sounds/jazz-music.mp3",
            ambient: "https://www.soundjay.com/misc/sounds/ambient-music.mp3",
            corporate:
              "https://www.soundjay.com/misc/sounds/corporate-music.mp3",
            nature: "https://www.soundjay.com/misc/sounds/nature-sounds.mp3",
            piano: "https://www.soundjay.com/misc/sounds/piano-music.mp3",
          };
          const musicUrl = musicUrls[presetMusic] || musicUrls.classical;
          blockTwiml += `  <Play loop="${holdMusicLoop}">${musicUrl}</Play>\n`;
        } else if (musicType === "custom" && currentBlock.config.musicUrl) {
          blockTwiml += `  <Play loop="${holdMusicLoop}">${escapeXml(currentBlock.config.musicUrl)}</Play>\n`;
        }
        break;
      case "record":
        const maxLength = currentBlock.config.maxLength || 300;
        const finishOnKey = currentBlock.config.finishOnKey || "#";
        if (currentBlock.config.prompt) {
          const blockVoice = currentBlock.config.voice || voice;
          blockTwiml += `  <Say voice="${blockVoice}">${escapeXml(currentBlock.config.prompt)}</Say>\n`;
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
          "[generateBlockTwiML] Skipping gather block to avoid loops",
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
          "[generateBlockTwiML] Unknown block type:",
          currentBlock.type,
        );
        blockTwiml += `  <Say voice="${voice}">Unknown block type.</Say>\n`;
        blockTwiml += `  <Hangup/>\n`;
        return blockTwiml;
    }
    // Process connected blocks
    if (currentBlock.connections && currentBlock.connections.length > 0) {
      console.log(
        "[generateBlockTwiML] Processing connections:",
        currentBlock.connections,
      );
      const nextBlock = allBlocks.find(
        (b) => b.id === currentBlock.connections[0],
      );
      if (nextBlock) {
        blockTwiml += processBlock(nextBlock);
      } else {
        console.log(
          "[generateBlockTwiML] Connected block not found:",
          currentBlock.connections[0],
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
