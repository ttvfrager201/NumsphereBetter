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
      return generateErrorTwiML("No active call flow found.");
    }

    const config =
      typeof activeFlow.flow_config === "string"
        ? JSON.parse(activeFlow.flow_config)
        : activeFlow.flow_config;

    if (!config.blocks || !Array.isArray(config.blocks)) {
      return generateErrorTwiML("Invalid call flow configuration.");
    }

    // Find the gather block
    const gatherBlock = config.blocks.find(
      (block: any) => block.id === blockId,
    );
    if (!gatherBlock || gatherBlock.type !== "gather") {
      return generateErrorTwiML("Gather block not found.");
    }

    // Find the matching option
    const selectedOption = gatherBlock.config.options?.find(
      (option: any) => option.digit === digits,
    );

    let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
    const voice = config.voice || "alice";

    if (selectedOption) {
      // Handle the selected option
      switch (selectedOption.action) {
        case "say":
          if (selectedOption.text) {
            twiml += `  <Say voice="${voice}">${escapeXml(selectedOption.text)}</Say>\n`;
          }
          break;
        case "forward":
          if (selectedOption.number) {
            const timeout = selectedOption.timeout || 30;
            twiml += `  <Dial timeout="${timeout}">${selectedOption.number}</Dial>\n`;
          }
          break;
        case "record":
          if (selectedOption.text) {
            twiml += `  <Say voice="${voice}">${escapeXml(selectedOption.text)}</Say>\n`;
          }
          twiml += `  <Record maxLength="300" finishOnKey="#" transcribe="true"/>\n`;
          break;
        default:
          if (selectedOption.text) {
            twiml += `  <Say voice="${voice}">${escapeXml(selectedOption.text)}</Say>\n`;
          }
      }

      // Process connected blocks from the gather block
      if (gatherBlock.connections && gatherBlock.connections.length > 0) {
        const nextBlockId = gatherBlock.connections[0];
        const nextBlock = config.blocks.find((b: any) => b.id === nextBlockId);
        if (nextBlock) {
          twiml += generateBlockTwiML(nextBlock, config.blocks, voice);
        }
      }
    } else {
      // No matching option, provide default response
      twiml += `  <Say voice="${voice}">Invalid selection. Please try again.</Say>\n`;

      // Redirect back to the gather block
      const gatherUrl = `${req.url.split("/handle-gather")[0]}/handle-call`;
      twiml += `  <Redirect>${gatherUrl}</Redirect>\n`;
    }

    twiml += `</Response>`;

    console.log(`[handle-gather] Generated TwiML for ${callSid}`);

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
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="alice">${message}</Say>\n  <Hangup/>\n</Response>`;

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
    if (processedBlocks.has(currentBlock.id)) return "";
    processedBlocks.add(currentBlock.id);

    let blockTwiml = "";

    switch (currentBlock.type) {
      case "say":
        if (currentBlock.config.text) {
          blockTwiml += `  <Say voice="${voice}">${escapeXml(currentBlock.config.text)}</Say>\n`;
        }
        break;

      case "pause":
        const duration = currentBlock.config.duration || 2;
        blockTwiml += `  <Pause length="${duration}"/>\n`;
        break;

      case "forward":
        if (currentBlock.config.number) {
          const timeout = currentBlock.config.timeout || 30;
          blockTwiml += `  <Dial timeout="${timeout}">${currentBlock.config.number}</Dial>\n`;
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
    }

    // Process connected blocks
    if (currentBlock.connections && currentBlock.connections.length > 0) {
      const nextBlock = allBlocks.find(
        (b: any) => b.id === currentBlock.connections[0],
      );
      if (nextBlock) {
        blockTwiml += processBlock(nextBlock);
      }
    }

    return blockTwiml;
  }

  return processBlock(block);
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
