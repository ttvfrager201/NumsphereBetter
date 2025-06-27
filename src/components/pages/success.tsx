import { CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../../../supabase/auth";
import { LoadingScreen } from "../ui/loading-spinner";

export default function Success() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { user, checkPaymentStatus } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processPaymentSuccess = async () => {
      if (!sessionId || !user) {
        console.error("Missing session information:", {
          sessionId,
          userId: user?.id,
        });
        setError("Missing session information");
        setIsProcessing(false);
        return;
      }

      // Prevent multiple processing attempts
      const processingKey = `processing_${sessionId}`;
      if (sessionStorage.getItem(processingKey)) {
        console.log("Payment already being processed, skipping");
        setIsProcessing(false);
        return;
      }
      sessionStorage.setItem(processingKey, "true");

      try {
        console.log("Processing payment success for session:", sessionId);
        console.log("User ID:", user.id);

        // First, verify the Stripe session and get subscription details
        const { data: sessionData, error: sessionError } =
          await supabase.functions.invoke("supabase-functions-verify-payment", {
            body: {
              sessionId,
              userId: user.id,
            },
          });

        if (sessionError) {
          console.error("Error verifying payment session:", sessionError);
          throw new Error("Failed to verify payment session");
        }

        if (!sessionData || !sessionData.success) {
          console.error("Payment verification failed:", sessionData);
          throw new Error("Payment verification failed");
        }

        console.log("Payment verified successfully:", sessionData);

        // Update user payment status and subscription in a single transaction
        const { error: transactionError } = await supabase.rpc(
          "update_payment_status",
          {
            p_user_id: user.id,
            p_plan_id: sessionData.planId,
            p_session_id: sessionId,
            p_subscription_id: sessionData.subscriptionId,
            p_customer_id: sessionData.customerId,
          },
        );

        if (transactionError) {
          console.error(
            "Error in payment status transaction:",
            transactionError,
          );

          // Fallback to individual updates if RPC fails
          try {
            await supabase
              .from("users")
              .update({ has_completed_payment: true })
              .eq("id", user.id);

            await supabase.from("user_subscriptions").upsert(
              {
                user_id: user.id,
                plan_id: sessionData.planId,
                stripe_checkout_session_id: sessionId,
                stripe_subscription_id: sessionData.subscriptionId,
                stripe_customer_id: sessionData.customerId,
                status: "active",
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: "user_id",
              },
            );
          } catch (fallbackError) {
            console.error("Fallback update also failed:", fallbackError);
            throw fallbackError;
          }
        }

        console.log("Payment status updated successfully");

        // Refresh payment status in auth context multiple times to ensure it's updated
        console.log("Refreshing payment status...");
        await checkPaymentStatus();

        // Wait a bit and check again to ensure the state is properly updated
        setTimeout(async () => {
          await checkPaymentStatus();
          console.log("Payment status refreshed again");
        }, 500);

        // Clean up session storage
        sessionStorage.removeItem("selectedPlan");
        sessionStorage.removeItem("userId");

        console.log("Payment processing completed successfully");
        setIsProcessing(false);

        // Clear processing flag
        sessionStorage.removeItem(processingKey);

        // Auto-redirect to dashboard after 3 seconds
        setTimeout(() => {
          console.log("Redirecting to dashboard...");
          window.location.href = "/dashboard";
        }, 3000);
      } catch (error) {
        console.error("Error processing payment success:", error);
        setError(error.message || "Failed to process payment confirmation");
        setIsProcessing(false);

        // Clear processing flag on error
        sessionStorage.removeItem(processingKey);
      }
    };

    processPaymentSuccess();
  }, [sessionId, user, checkPaymentStatus]);

  if (isProcessing) {
    return <LoadingScreen text="Processing your payment..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Payment Error
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/plan-selection"
            className="inline-block bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors duration-200"
          >
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        >
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-3xl font-bold text-gray-800 mb-4"
        >
          Payment Successful!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-gray-600 mb-6"
        >
          Welcome to NumSphere! Your subscription is now active. You can now
          access your dashboard and add phone numbers when needed.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="space-y-4"
        >
          <Link
            to="/dashboard"
            className="block bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition-colors duration-200"
          >
            Go to Dashboard
          </Link>
          <Link
            to="/"
            className="block text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            Back to Home
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
