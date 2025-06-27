import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
};

// Database types
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
        Insert: {
          id?: string;
          user_id?: string | null;
          phone_number: string;
          twilio_sid: string;
          friendly_name?: string | null;
          minutes_allocated?: number | null;
          minutes_used?: number | null;
          plan_id: string;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          phone_number?: string;
          twilio_sid?: string;
          friendly_name?: string | null;
          minutes_allocated?: number | null;
          minutes_used?: number | null;
          plan_id?: string;
          status?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      call_flows: {
        Row: {
          id: string;
          user_id: string | null;
          twilio_number_id: string | null;
          flow_name: string;
          flow_config: Json;
          twilio_flow_sid: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          twilio_number_id?: string | null;
          flow_name: string;
          flow_config?: Json;
          twilio_flow_sid?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          twilio_number_id?: string | null;
          flow_name?: string;
          flow_config?: Json;
          twilio_flow_sid?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
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

    console.log(`[twilio-voice-webhook] Incoming call:`, {
      callSid,
      from,
      to,
      callStatus,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Find the Twilio number and associated call flow
    const { data: twilioNumber } = await supabase
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

    if (!twilioNumber) {
      console.error(`[twilio-voice-webhook] No active number found for ${to}`);
      // Return basic TwiML response
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, this number is not configured. Please contact support.</Say>
  <Hangup/>
</Response>`;

      return new Response(twiml, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/xml",
        },
      });
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
      });
    } else {
      // Default greeting
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello! Thank you for calling. This number is powered by NumSphere.</Say>
  <Pause length="1"/>
  <Say voice="alice">Please configure your call flow in the dashboard to customize this experience.</Say>
  <Hangup/>
</Response>`;
    }

    console.log(`[twilio-voice-webhook] Generated TwiML for ${callSid}`);

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error(`[twilio-voice-webhook] Error:`, error);

    // Return error TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We're experiencing technical difficulties. Please try again later.</Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml",
      },
    });
  }
});

function generateTwiMLFromFlow(
  flowConfig: any,
  context: { from: string; to: string; callSid: string },
): string {
  try {
    const config =
      typeof flowConfig === "string" ? JSON.parse(flowConfig) : flowConfig;

    // Basic flow structure
    let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;

    if (config.greeting) {
      twiml += `  <Say voice="${config.voice || "alice"}">${config.greeting}</Say>\n`;
    }

    if (config.menu && config.menu.options) {
      twiml += `  <Gather input="dtmf" timeout="10" numDigits="1" action="${config.menu.action || ""}">\n`;
      twiml += `    <Say voice="${config.voice || "alice"}">${config.menu.prompt || "Please select an option."}</Say>\n`;
      twiml += `  </Gather>\n`;
    }

    if (config.voicemail) {
      twiml += `  <Say voice="${config.voice || "alice"}">${config.voicemail.prompt || "Please leave a message after the beep."}</Say>\n`;
      twiml += `  <Record maxLength="60" transcribe="true" transcribeCallback="${config.voicemail.callback || ""}"/>\n`;
    }

    if (config.forward) {
      twiml += `  <Dial timeout="30">${config.forward.number}</Dial>\n`;
    }

    twiml += `</Response>`;

    return twiml;
  } catch (error) {
    console.error("Error generating TwiML from flow:", error);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="alice">Configuration error. Please contact support.</Say>\n  <Hangup/>\n</Response>`;
  }
}
