import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// CORS headers - All restrictions removed
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
    const { action, userId, twilioNumberId, flowData } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({
          error: "User ID is required",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SERVICE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    switch (action) {
      case "list":
        const { data: flows, error: listError } = await supabase
          .from("call_flows")
          .select(
            `
            *,
            twilio_numbers(
              phone_number,
              friendly_name
            )
          `,
          )
          .eq("user_id", userId)
          .order("created_at", {
            ascending: false,
          });
        if (listError) {
          return new Response(
            JSON.stringify({
              error: "Failed to fetch call flows",
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        return new Response(
          JSON.stringify({
            flows,
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      case "create":
        if (!twilioNumberId || !flowData) {
          return new Response(
            JSON.stringify({
              error: "Twilio number ID and flow data are required",
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        // Verify user owns the Twilio number
        const { data: numberCheck } = await supabase
          .from("twilio_numbers")
          .select("id")
          .eq("id", twilioNumberId)
          .eq("user_id", userId)
          .single();
        if (!numberCheck) {
          return new Response(
            JSON.stringify({
              error: "Twilio number not found or not owned by user",
            }),
            {
              status: 403,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        // Deactivate other flows for this number
        await supabase
          .from("call_flows")
          .update({
            is_active: false,
          })
          .eq("twilio_number_id", twilioNumberId);
        const { data: newFlow, error: createError } = await supabase
          .from("call_flows")
          .insert({
            user_id: userId,
            twilio_number_id: twilioNumberId,
            flow_name: flowData.name || "Untitled Flow",
            flow_config: flowData,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (createError) {
          return new Response(
            JSON.stringify({
              error: "Failed to create call flow",
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        return new Response(
          JSON.stringify({
            flow: newFlow,
            message: "Call flow created successfully",
          }),
          {
            status: 201,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      case "update":
        const { flowId } = await req.json();
        if (!flowId || !flowData) {
          return new Response(
            JSON.stringify({
              error: "Flow ID and flow data are required",
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        const { data: updatedFlow, error: updateError } = await supabase
          .from("call_flows")
          .update({
            flow_name: flowData.name || "Untitled Flow",
            flow_config: flowData,
            updated_at: new Date().toISOString(),
          })
          .eq("id", flowId)
          .eq("user_id", userId)
          .select()
          .single();
        if (updateError) {
          return new Response(
            JSON.stringify({
              error: "Failed to update call flow",
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        return new Response(
          JSON.stringify({
            flow: updatedFlow,
            message: "Call flow updated successfully",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      case "delete":
        const { flowId: deleteFlowId } = await req.json();
        if (!deleteFlowId) {
          return new Response(
            JSON.stringify({
              error: "Flow ID is required",
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        const { error: deleteError } = await supabase
          .from("call_flows")
          .delete()
          .eq("id", deleteFlowId)
          .eq("user_id", userId);
        if (deleteError) {
          return new Response(
            JSON.stringify({
              error: "Failed to delete call flow",
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        return new Response(
          JSON.stringify({
            message: "Call flow deleted successfully",
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      case "update_webhooks":
        if (!twilioNumberId) {
          return new Response(
            JSON.stringify({
              error: "Twilio number ID is required",
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        // Get Twilio credentials from environment
        const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const baseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "");
        if (!twilioAccountSid || !twilioAuthToken || !baseUrl) {
          return new Response(
            JSON.stringify({
              error: "Twilio credentials not configured",
              details:
                "Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or SUPABASE_URL",
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
        try {
          // Get the Twilio number details
          const { data: twilioNumber } = await supabase
            .from("twilio_numbers")
            .select("twilio_sid, phone_number")
            .eq("id", twilioNumberId)
            .eq("user_id", userId)
            .single();
          if (!twilioNumber) {
            return new Response(
              JSON.stringify({
                error: "Twilio number not found",
              }),
              {
                status: 404,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              },
            );
          }
          // Update webhook URL using Twilio REST API
          const webhookUrl = `${baseUrl}/functions/v1/supabase-functions-handle-call`;
          const statusCallbackUrl = `${baseUrl}/functions/v1/supabase-functions-handle-call-status`;
          const updateData = new URLSearchParams({
            VoiceUrl: webhookUrl,
            VoiceMethod: "POST",
            StatusCallback: statusCallbackUrl,
            StatusCallbackMethod: "POST",
          });
          const twilioResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${twilioNumber.twilio_sid}.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: updateData,
            },
          );
          if (!twilioResponse.ok) {
            const errorText = await twilioResponse.text();
            console.error("Twilio webhook update failed:", errorText);
            return new Response(
              JSON.stringify({
                error: "Failed to update Twilio webhook",
                details: errorText,
              }),
              {
                status: 500,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              },
            );
          }
          const twilioResult = await twilioResponse.json();
          console.log("Twilio webhook updated successfully:", twilioResult);
          return new Response(
            JSON.stringify({
              message: "Webhook updated successfully",
              webhookUrl,
              statusCallbackUrl,
              twilioSid: twilioNumber.twilio_sid,
            }),
            {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        } catch (error) {
          console.error("Error updating webhook:", error);
          return new Response(
            JSON.stringify({
              error: "Failed to update webhook",
              details: error.message,
            }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            },
          );
        }
      default:
        return new Response(
          JSON.stringify({
            error: "Invalid action",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
    }
  } catch (error) {
    console.error(`[manage-call-flows] Error:`, error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
