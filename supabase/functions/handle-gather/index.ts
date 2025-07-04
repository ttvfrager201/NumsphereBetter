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
    const url = new URL(req.url);
    const blockId = url.searchParams.get("blockId");

    const formData = await req.formData();
    const callSid = formData.get("CallSid")?.toString();
    const from = formData.get("From")?.toString();
    const to = formData.get("To")?.toString();
    const digits = formData.get("Digits")?.toString();

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
        `[handle-gather] No active number found for ${to}:`,
        numberError,
      );
      return generateErrorTwiML("This number is not configured.");
    }

    // Get active call flow
    const activeFlow = twilioNumber.call_flows?.find(
      (flow: any) => flow.is_active,
    );

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
    const gatherBlock = config.blocks.find(
      (block: any) => block.id === blockId,
    );
    if (!gatherBlock || gatherBlock.type !== "gather") {
      console.error(
        `[handle-gather] Gather block not found for blockId: ${blockId}`,
      );
      return generateErrorTwiML("Gather block not found.");
    }

    // Find the matching option
    const selectedOption = gatherBlock.config.options?.find(
      (option: any) => option.digit === digits,
    );

    console.log(
      `[handle-gather] Available options:`,
      gatherBlock.config.options,
    );
    console.log(`[handle-gather] Looking for digit:`, digits);
    console.log(`[handle-gather] Selected option:`, selectedOption);

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
      if (selectedOption.blockId) {
        const connectedBlock = config.blocks.find(
          (b: any) => b.id === selectedOption.blockId,
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
            twiml += `  <Say voice="${voice}">Thank you for your selection.</Say>
`;
            twiml += `  <Hangup/>
`;
          }
        } else {
          console.error(
            `[handle-gather] Connected block not found:`,
            selectedOption.blockId,
          );
          twiml += `  <Say voice="${voice}">Configuration error. Please contact support.</Say>
`;
          twiml += `  <Hangup/>
`;
        }
      } else {
        // No block connection - provide default response
        console.log(`[handle-gather] No block connection for option`);
        if (selectedOption.text) {
          twiml += `  <Say voice="${voice}">${escapeXml(selectedOption.text)}</Say>
`;
        } else {
          twiml += `  <Say voice="${voice}">Thank you for selecting option ${digits}.</Say>
`;
        }
        twiml += `  <Hangup/>
`;
      }
    } else {
      // No matching option, provide default response
      console.log(
        `[handle-gather] No matching option found for digit: ${digits}`,
      );
      twiml += `  <Say voice="${voice}">Invalid selection. You pressed ${digits}. Please try again.</Say>
`;

      // Get the base URL for redirect
      const baseUrl =
        Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "") || "";
      const redirectUrl = `${baseUrl}/functions/v1/supabase-functions-handle-call`;

      console.log(`[handle-gather] Redirecting to: ${redirectUrl}`);
      twiml += `  <Redirect>${redirectUrl}</Redirect>
`;
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

function generateErrorTwiML(message: string): Response {
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

function generateBlockTwiML(
  block: any,
  allBlocks: any[],
  voice: string,
): string {
  let twiml = "";
  const processedBlocks = new Set<string>();

  function processBlock(currentBlock: any): string {
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
          blockTwiml += `  <Say voice="${voice}" rate="${rate}">${escapeXml(currentBlock.config.text)}</Say>
`;
        }
        break;

      case "pause":
        const duration = currentBlock.config.duration || 2;
        blockTwiml += `  <Pause length="${duration}"/>
`;
        break;

      case "forward":
        if (currentBlock.config.number) {
          const timeout = currentBlock.config.timeout || 30;
          blockTwiml += `  <Dial timeout="${timeout}">${escapeXml(currentBlock.config.number)}</Dial>
`;
        }
        break;

      case "record":
        const maxLength = currentBlock.config.maxLength || 300;
        const finishOnKey = currentBlock.config.finishOnKey || "#";
        if (currentBlock.config.prompt) {
          blockTwiml += `  <Say voice="${voice}">${escapeXml(currentBlock.config.prompt)}</Say>
`;
        }
        blockTwiml += `  <Record maxLength="${maxLength}" finishOnKey="${finishOnKey}" transcribe="true"/>
`;
        break;

      case "play":
        if (currentBlock.config.url) {
          blockTwiml += `  <Play>${escapeXml(currentBlock.config.url)}</Play>
`;
        }
        break;

      case "hangup":
        blockTwiml += `  <Hangup/>
`;
        return blockTwiml; // Don't process further connections after hangup

      case "gather":
        // Don't process gather blocks in this context to avoid infinite loops
        console.log(
          `[generateBlockTwiML] Skipping gather block to avoid loops`,
        );
        blockTwiml += `  <Say voice="${voice}">Menu option processed.</Say>
`;
        blockTwiml += `  <Hangup/>
`;
        return blockTwiml;

      case "sms":
        if (currentBlock.config.message) {
          const to = currentBlock.config.to || "{{From}}";
          blockTwiml += `  <Sms to="${escapeXml(to)}">${escapeXml(currentBlock.config.message)}</Sms>
`;
        }
        break;

      default:
        console.log(
          `[generateBlockTwiML] Unknown block type: ${currentBlock.type}`,
        );
        blockTwiml += `  <Say voice="${voice}">Unknown block type.</Say>
`;
        blockTwiml += `  <Hangup/>
`;
        return blockTwiml;
    }

    // Process connected blocks
    if (currentBlock.connections && currentBlock.connections.length > 0) {
      console.log(
        `[generateBlockTwiML] Processing connections:`,
        currentBlock.connections,
      );
      const nextBlock = allBlocks.find(
        (b: any) => b.id === currentBlock.connections[0],
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

function escapeXml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
