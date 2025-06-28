import { CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { LoadingScreen } from "@/components/ui/loading-spinner";

export default function Success() {
  const { checkPaymentStatus, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [verificationStatus, setVerificationStatus] = useState<
    "verifying" | "success" | "error"
  >("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  const hasProcessedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessedRef.current) {
      return;
    }

    const handleSuccess = async () => {
      try {
        // Check if page is visible and focused
        if (document.hidden || !document.hasFocus()) {
          console.log("Page not visible or focused, skipping verification");
          return;
        }

        const sessionId = searchParams.get("session_id");
        const securityToken = searchParams.get("security_token");

        if (!sessionId) {
          setVerificationStatus("error");
          setErrorMessage("Invalid payment session");
          hasProcessedRef.current = true;
          return;
        }

        // Wait for user to be loaded if not available yet
        if (!user) {
          console.log("Waiting for user authentication...");
          return;
        }

        // Mark as processed to prevent re-execution
        hasProcessedRef.current = true;

        console.log("Starting payment verification for user:", user.id);
        console.log("Session ID:", sessionId);
        console.log("Security Token:", securityToken ? "present" : "missing");

        // Enhanced payment verification using Stripe functions API
        console.log(
          "Verifying payment with enhanced security using Stripe API...",
        );

        try {
          // Direct verification call to Stripe API
          const { data: verificationResult, error: apiError } =
            await supabase.functions.invoke(
              "supabase-functions-verify-payment",
              {
                body: {
                  sessionId,
                  userId: user.id,
                  securityToken,
                },
              },
            );

          console.log("Verification API response:", {
            verificationResult,
            apiError,
          });

          if (apiError) {
            console.error("Stripe API verification error:", apiError);
            setVerificationStatus("error");
            setErrorMessage(
              `Payment verification failed: ${apiError.message || "Unknown error"}`,
            );
            return;
          }

          if (verificationResult?.success) {
            console.log("Payment verified successfully!");

            // Update user payment status in database
            try {
              const { error: updateError } = await supabase
                .from("users")
                .update({ has_completed_payment: true })
                .eq("id", user.id);

              if (updateError) {
                console.error(
                  "Error updating user payment status:",
                  updateError,
                );
              }
            } catch (dbError) {
              console.error("Database update error:", dbError);
            }

            setVerificationStatus("success");

            // Clean up session storage securely
            sessionStorage.removeItem("payment_session");
            sessionStorage.removeItem("selectedPlan");
            sessionStorage.removeItem("userId");

            // Mark payment as verified
            sessionStorage.setItem("payment_verified", Date.now().toString());

            // Check if should redirect to dashboard immediately
            const shouldRedirectToDashboard =
              searchParams.get("redirect_to_dashboard") === "true";

            // Only redirect if page is still visible and focused
            const scheduleRedirect = (delay: number, path: string) => {
              timeoutRef.current = setTimeout(() => {
                if (!document.hidden && document.hasFocus()) {
                  navigate(path, { replace: true });
                } else {
                  console.log("Page not focused, skipping redirect");
                }
              }, delay);
            };

            if (shouldRedirectToDashboard) {
              // Redirect immediately to dashboard for number selection
              scheduleRedirect(
                2000,
                "/dashboard?tab=Select Number&first_time=true",
              );
            } else {
              // Normal redirect after confirmation
              scheduleRedirect(3000, "/dashboard");
            }
          } else {
            console.error("Payment verification failed:", verificationResult);
            setVerificationStatus("error");
            setErrorMessage(
              verificationResult?.error || "Payment verification failed",
            );
          }
        } catch (error) {
          console.error("Payment verification error:", error);
          setVerificationStatus("error");
          setErrorMessage(
            `Payment verification failed: ${error.message || "Unknown error"}`,
          );
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setVerificationStatus("error");
        setErrorMessage("Payment verification failed");
      }
    };

    handleSuccess();

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [user, searchParams, navigate, checkPaymentStatus]);

  if (verificationStatus === "verifying") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <LoadingScreen text="Verifying your payment securely..." />
      </div>
    );
  }

  if (verificationStatus === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center"
        >
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Payment Verification Failed
          </h1>
          <p className="text-gray-600 mb-6">
            {errorMessage ||
              "There was an issue verifying your payment. Please contact support."}
          </p>
          <div className="space-y-4">
            <Link
              to="/plan-selection"
              className="block bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors duration-200"
            >
              Try Again
            </Link>
            <Link
              to="/"
              className="block text-gray-600 hover:text-gray-800 transition-colors duration-200"
            >
              Back to Home
            </Link>
          </div>
        </motion.div>
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
          Payment Verified!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-gray-600 mb-6"
        >
          Welcome to NumSphere! Your subscription has been verified and is now
          active. You'll be redirected to select your first phone number
          shortly.
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
            Select Your First Number
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
