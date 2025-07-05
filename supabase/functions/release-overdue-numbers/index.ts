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
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string | null;
          plan_id: string;
          status: string | null;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          created_at: string | null;
          updated_at: string | null;
          current_period_end: string | null;
        };
        Update: {
          status?: string | null;
          updated_at?: string | null;
        };
      };
      twilio_numbers: {
        Row: {
          id: string;
          user_id: string | null;
          phone_number: string;
          status: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Update: {
          status?: string;
          updated_at?: string | null;
        };
      };
      number_audit_log: {
        Insert: {
          user_id: string;
          phone_number: string;
          action: string;
          reason: string;
          metadata?: any;
          created_at?: string;
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
    console.log("[release-overdue-numbers] Starting overdue payment check");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_KEY")!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Calculate the cutoff date (15 days ago)
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const cutoffDate = fifteenDaysAgo.toISOString();

    console.log(
      `[release-overdue-numbers] Checking for subscriptions older than: ${cutoffDate}`,
    );

    // Find subscriptions that are:
    // 1. Inactive/unpaid for more than 15 days
    // 2. OR past_due status for more than 15 days
    // 3. OR created more than 15 days ago but never had a successful payment
    const { data: overdueSubscriptions, error: subscriptionError } =
      await supabase
        .from("user_subscriptions")
        .select("id, user_id, status, created_at, updated_at")
        .or(`status.eq.inactive,status.eq.past_due,status.eq.unpaid`)
        .lt("created_at", cutoffDate);

    if (subscriptionError) {
      console.error(
        "[release-overdue-numbers] Error fetching overdue subscriptions:",
        subscriptionError,
      );
      throw subscriptionError;
    }

    console.log(
      `[release-overdue-numbers] Found ${overdueSubscriptions?.length || 0} overdue subscriptions`,
    );

    if (!overdueSubscriptions || overdueSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No overdue subscriptions found",
          releasedNumbers: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let totalReleasedNumbers = 0;
    const releaseResults = [];

    // Process each overdue subscription
    for (const subscription of overdueSubscriptions) {
      console.log(
        `[release-overdue-numbers] Processing subscription for user: ${subscription.user_id}`,
      );

      // Find all active phone numbers for this user
      const { data: userNumbers, error: numbersError } = await supabase
        .from("twilio_numbers")
        .select("id, phone_number, status")
        .eq("user_id", subscription.user_id)
        .in("status", ["active", "suspended_limit_reached"]);

      if (numbersError) {
        console.error(
          `[release-overdue-numbers] Error fetching numbers for user ${subscription.user_id}:`,
          numbersError,
        );
        continue;
      }

      if (!userNumbers || userNumbers.length === 0) {
        console.log(
          `[release-overdue-numbers] No active numbers found for user: ${subscription.user_id}`,
        );
        continue;
      }

      console.log(
        `[release-overdue-numbers] Found ${userNumbers.length} numbers to release for user: ${subscription.user_id}`,
      );

      // Release each phone number
      for (const number of userNumbers) {
        try {
          // Update number status to released
          const { error: updateError } = await supabase
            .from("twilio_numbers")
            .update({
              status: "released_overdue_payment",
              updated_at: new Date().toISOString(),
            })
            .eq("id", number.id);

          if (updateError) {
            console.error(
              `[release-overdue-numbers] Error updating number ${number.phone_number}:`,
              updateError,
            );
            continue;
          }

          // Log the release action
          const { error: auditError } = await supabase
            .from("number_audit_log")
            .insert({
              user_id: subscription.user_id!,
              phone_number: number.phone_number,
              action: "released_overdue_payment",
              reason: "Payment not received within 15 days",
              metadata: {
                subscription_id: subscription.id,
                subscription_status: subscription.status,
                release_date: new Date().toISOString(),
                days_overdue: Math.floor(
                  (Date.now() - new Date(subscription.created_at!).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              },
              created_at: new Date().toISOString(),
            });

          if (auditError) {
            console.error(
              `[release-overdue-numbers] Error logging audit for ${number.phone_number}:`,
              auditError,
            );
          }

          console.log(
            `[release-overdue-numbers] Successfully released number: ${number.phone_number}`,
          );
          totalReleasedNumbers++;

          releaseResults.push({
            userId: subscription.user_id,
            phoneNumber: number.phone_number,
            previousStatus: number.status,
            releaseReason: "overdue_payment",
            daysOverdue: Math.floor(
              (Date.now() - new Date(subscription.created_at!).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          });

          // Optional: Release the number from Twilio (uncomment if you want to actually release from Twilio)
          /*
          try {
            const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
            const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
            
            if (twilioAccountSid && twilioAuthToken) {
              const releaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;
              
              // Find the Twilio SID for this number
              const listResponse = await fetch(`${releaseUrl}?PhoneNumber=${encodeURIComponent(number.phone_number)}`, {
                method: "GET",
                headers: {
                  Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                },
              });
              
              if (listResponse.ok) {
                const listData = await listResponse.json();
                if (listData.incoming_phone_numbers && listData.incoming_phone_numbers.length > 0) {
                  const twilioSid = listData.incoming_phone_numbers[0].sid;
                  
                  // Release the number from Twilio
                  const deleteResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers/${twilioSid}.json`, {
                    method: "DELETE",
                    headers: {
                      Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                    },
                  });
                  
                  if (deleteResponse.ok) {
                    console.log(`[release-overdue-numbers] Successfully released ${number.phone_number} from Twilio`);
                  } else {
                    console.error(`[release-overdue-numbers] Failed to release ${number.phone_number} from Twilio:`, await deleteResponse.text());
                  }
                }
              }
            }
          } catch (twilioError) {
            console.error(`[release-overdue-numbers] Error releasing ${number.phone_number} from Twilio:`, twilioError);
          }
          */
        } catch (error) {
          console.error(
            `[release-overdue-numbers] Error processing number ${number.phone_number}:`,
            error,
          );
        }
      }

      // Update subscription status to indicate numbers have been released
      const { error: subscriptionUpdateError } = await supabase
        .from("user_subscriptions")
        .update({
          status: "numbers_released_overdue",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);

      if (subscriptionUpdateError) {
        console.error(
          `[release-overdue-numbers] Error updating subscription status:`,
          subscriptionUpdateError,
        );
      }
    }

    console.log(
      `[release-overdue-numbers] Completed. Released ${totalReleasedNumbers} phone numbers`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully processed overdue payments and released ${totalReleasedNumbers} phone numbers`,
        releasedNumbers: totalReleasedNumbers,
        subscriptionsProcessed: overdueSubscriptions.length,
        releaseDetails: releaseResults,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[release-overdue-numbers] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process overdue payments",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
