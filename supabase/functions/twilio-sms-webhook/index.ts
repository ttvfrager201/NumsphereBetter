import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "@shared/cors.ts";
import { Database } from "@shared/database.types.ts";

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
    const messageSid = formData.get("MessageSid")?.toString();
    const from = formData.get("From")?.toString();
    const to = formData.get("To")?.toString();
    const body = formData.get("Body")?.toString();
    const numMedia = parseInt(formData.get("NumMedia")?.toString() || "0");

    console.log(`[twilio-sms-webhook] Incoming SMS:`, {
      messageSid,
      from,
      to,
      body: body?.substring(0, 100) + (body && body.length > 100 ? "..." : ""),
      numMedia,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Find the Twilio number
    const { data: twilioNumber } = await supabase
      .from("twilio_numbers")
      .select("*")
      .eq("phone_number", to)
      .eq("status", "active")
      .single();

    if (!twilioNumber) {
      console.error(`[twilio-sms-webhook] No active number found for ${to}`);
      return new Response("Number not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Store the incoming message (you can create a messages table for this)
    console.log(
      `[twilio-sms-webhook] Message received for number ${to} from ${from}`,
    );

    // Auto-reply logic (customize as needed)
    let responseMessage = "";

    if (body?.toLowerCase().includes("help")) {
      responseMessage =
        "Hello! This is an automated response. For support, please visit our website or call our support line.";
    } else if (body?.toLowerCase().includes("stop")) {
      responseMessage =
        "You have been unsubscribed from messages. Reply START to re-subscribe.";
    } else if (body?.toLowerCase().includes("start")) {
      responseMessage = "Welcome! You are now subscribed to receive messages.";
    } else {
      responseMessage =
        "Thank you for your message. We'll get back to you soon!";
    }

    // Generate TwiML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMessage}</Message>
</Response>`;

    console.log(`[twilio-sms-webhook] Sending auto-reply for ${messageSid}`);

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error(`[twilio-sms-webhook] Error:`, error);

    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
