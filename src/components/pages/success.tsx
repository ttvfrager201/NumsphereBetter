import { CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const handleSuccess = async () => {
      try {
        const sessionId = searchParams.get("session_id");
        const securityToken = searchParams.get("security_token");

        if (!sessionId) {
          setVerificationStatus("error");
          setErrorMessage("Invalid payment session");
          return;
        }

        // Verify session data integrity
        const storedSession = sessionStorage.getItem("payment_session");
        if (storedSession) {
          try {
            const sessionData = JSON.parse(storedSession);
            if (sessionData.expires < Date.now()) {
              setVerificationStatus("error");
              setErrorMessage("Payment session expired");
              return;
            }
          } catch {
            console.warn("Invalid session data format");
          }
        }

        // Enhanced payment verification using Stripe functions API
        console.log(
          "Verifying payment with enhanced security using Stripe API...",
        );

        // Wait for webhook processing with multiple verification attempts
        let verificationAttempts = 0;
        const maxAttempts = 8;
        let paymentVerified = false;

        while (verificationAttempts < maxAttempts && !paymentVerified) {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          try {
            // Use Stripe functions API instead of direct database queries
            const { data: verificationResult, error: apiError } =
              await supabase.functions.invoke(
                "supabase-functions-verify-payment",
                {
                  body: JSON.stringify({
                    sessionId,
                    userId: user?.id,
                    securityToken,
                  }),
                  headers: {
                    "Content-Type": "application/json",
                  },
                },
              );

            if (apiError) {
              console.log(
                `Stripe API verification error (attempt ${verificationAttempts + 1}):`,
                apiError,
              );
              // Continue to next attempt instead of breaking
            }

            if (verificationResult?.success) {
              paymentVerified = true;
              break;
            }
          } catch (error) {
            console.log(
              `Verification attempt ${verificationAttempts + 1} failed:`,
              error,
            );
          }

          verificationAttempts++;
        }

        if (paymentVerified) {
          // Final payment status check
          const finalCheck = await checkPaymentStatus();
          if (finalCheck) {
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

            if (shouldRedirectToDashboard) {
              // Redirect immediately to dashboard for number selection
              setTimeout(() => {
                navigate("/dashboard?tab=Select Number&first_time=true", {
                  replace: true,
                });
              }, 2000);
            } else {
              // Normal redirect after confirmation
              setTimeout(() => {
                navigate("/dashboard", { replace: true });
              }, 3000);
            }
          } else {
            setVerificationStatus("error");
            setErrorMessage("Payment verification failed");
          }
        } else {
          // Trigger automatic refund for failed payment verification using Stripe API
          console.log(
            "Payment verification failed, initiating automatic refund via Stripe API...",
          );

          try {
            const refundResponse = await supabase.functions.invoke(
              "supabase-functions-verify-payment",
              {
                body: JSON.stringify({
                  sessionId,
                  userId: user?.id,
                  action: "refund_failed_payment",
                  securityToken,
                }),
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );

            if (refundResponse.data?.refund_initiated) {
              setVerificationStatus("error");
              setErrorMessage(
                "Payment verification failed. An automatic refund has been processed and will appear in your account within 5-10 business days.",
              );
            } else {
              setVerificationStatus("error");
              setErrorMessage(
                "Payment processing timeout. Please contact support for assistance and refund processing.",
              );
            }
          } catch (refundError) {
            console.error("Automatic refund failed:", refundError);
            setVerificationStatus("error");
            setErrorMessage(
              "Payment verification failed. Please contact support immediately for refund processing.",
            );
          }
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        setVerificationStatus("error");
        setErrorMessage("Payment verification failed");
      }
    };

    handleSuccess();
  }, [checkPaymentStatus, navigate, searchParams, user]);

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
