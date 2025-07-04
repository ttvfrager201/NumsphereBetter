import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Credentials": "true",
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
    const digits = formData.get("Digits")?.toString();
    const forwardNumbers = formData.get("ForwardNumbers")?.toString();
    const strategy = formData.get("Strategy")?.toString() || "simultaneous";
    const ringTimeout = parseInt(
      formData.get("RingTimeout")?.toString() || "20",
    );

    console.log(`[handle-multi-forward] Processing multi-forward:`, {
      callSid,
      from,
      to,
      digits,
      forwardNumbers,
      strategy,
      ringTimeout,
    });

    if (!forwardNumbers) {
      console.error(`[handle-multi-forward] No forward numbers provided`);
      return new Response(
        generateErrorTwiML("Configuration error. Please contact support."),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/xml",
          },
        },
      );
    }

    const numbers = forwardNumbers
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n);

    if (numbers.length === 0) {
      console.error(`[handle-multi-forward] No valid forward numbers`);
      return new Response(
        generateErrorTwiML("No valid forwarding numbers configured."),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/xml",
          },
        },
      );
    }

    let twiml;

    switch (strategy) {
      case "simultaneous":
        twiml = generateSimultaneousForwardTwiML(numbers, ringTimeout);
        break;
      case "sequential":
        twiml = generateSequentialForwardTwiML(numbers, ringTimeout);
        break;
      case "priority":
        twiml = generatePriorityForwardTwiML(numbers, ringTimeout);
        break;
      default:
        twiml = generateSimultaneousForwardTwiML(numbers, ringTimeout);
    }

    console.log(
      `[handle-multi-forward] Generated ${strategy} forward TwiML for ${numbers.length} numbers`,
    );

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error(`[handle-multi-forward] Error:`, error);

    return new Response(
      generateErrorTwiML("Internal server error. Please try again."),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/xml",
        },
      },
    );
  }
});

// Generate TwiML for simultaneous forwarding (ring all numbers at once)
function generateSimultaneousForwardTwiML(
  numbers: string[],
  timeout: number,
): string {
  const dialTargets = numbers
    .map((number) => `    <Number>${number}</Number>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call to our team. Please hold.</Say>
  <Dial timeout="${timeout}" record="record-from-ringing-dual" recordingStatusCallback="/supabase/functions/handle-recording">
${dialTargets}
  </Dial>
  <Say voice="alice">Sorry, no one is available to take your call right now. Please leave a message after the beep.</Say>
  <Record maxLength="60" transcribe="true" transcribeCallback="/supabase/functions/handle-transcription" />
  <Say voice="alice">Thank you for your message. We'll get back to you soon. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

// Generate TwiML for sequential forwarding (try numbers one by one)
function generateSequentialForwardTwiML(
  numbers: string[],
  timeout: number,
): string {
  let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
  twiml += `  <Say voice="alice">Connecting your call. Please hold.</Say>\n`;

  numbers.forEach((number, index) => {
    twiml += `  <Dial timeout="${timeout}" record="record-from-ringing-dual" recordingStatusCallback="/supabase/functions/handle-recording">\n`;
    twiml += `    <Number>${number}</Number>\n`;
    twiml += `  </Dial>\n`;

    if (index < numbers.length - 1) {
      twiml += `  <Say voice="alice">Trying another number. Please continue to hold.</Say>\n`;
    }
  });

  twiml += `  <Say voice="alice">Sorry, no one is available to take your call right now. Please leave a message after the beep.</Say>\n`;
  twiml += `  <Record maxLength="60" transcribe="true" transcribeCallback="/supabase/functions/handle-transcription" />\n`;
  twiml += `  <Say voice="alice">Thank you for your message. We'll get back to you soon. Goodbye.</Say>\n`;
  twiml += `  <Hangup/>\n`;
  twiml += `</Response>`;

  return twiml;
}

// Generate TwiML for priority forwarding (try primary first, then fallbacks)
function generatePriorityForwardTwiML(
  numbers: string[],
  timeout: number,
): string {
  const primaryNumber = numbers[0];
  const fallbackNumbers = numbers.slice(1);

  let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n`;
  twiml += `  <Say voice="alice">Connecting you to our primary contact. Please hold.</Say>\n`;

  // Try primary number first with longer timeout
  twiml += `  <Dial timeout="${timeout + 10}" record="record-from-ringing-dual" recordingStatusCallback="/supabase/functions/handle-recording">\n`;
  twiml += `    <Number>${primaryNumber}</Number>\n`;
  twiml += `  </Dial>\n`;

  if (fallbackNumbers.length > 0) {
    twiml += `  <Say voice="alice">Trying our backup contacts. Please continue to hold.</Say>\n`;

    // Try all fallback numbers simultaneously
    twiml += `  <Dial timeout="${timeout}" record="record-from-ringing-dual" recordingStatusCallback="/supabase/functions/handle-recording">\n`;
    fallbackNumbers.forEach((number) => {
      twiml += `    <Number>${number}</Number>\n`;
    });
    twiml += `  </Dial>\n`;
  }

  twiml += `  <Say voice="alice">Sorry, no one is available to take your call right now. Please leave a message after the beep.</Say>\n`;
  twiml += `  <Record maxLength="60" transcribe="true" transcribeCallback="/supabase/functions/handle-transcription" />\n`;
  twiml += `  <Say voice="alice">Thank you for your message. We'll get back to you soon. Goodbye.</Say>\n`;
  twiml += `  <Hangup/>\n`;
  twiml += `</Response>`;

  return twiml;
}

// Generate error TwiML
function generateErrorTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${message}</Say>
  <Hangup/>
</Response>`;
}
