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
        setError("Missing session information");
        setIsProcessing(false);
        return;
      }

      try {
        // Update user payment status
        const { error: userError } = await supabase
          .from("users")
          .update({ has_completed_payment: true })
          .eq("id", user.id);

        if (userError) {
          console.error("Error updating user payment status:", userError);
        }

        // Update subscription status
        const { error: subError } = await supabase
          .from("user_subscriptions")
          .update({ status: "active" })
          .eq("user_id", user.id)
          .eq("stripe_checkout_session_id", sessionId);

        if (subError) {
          console.error("Error updating subscription status:", subError);
        }

        // Refresh payment status in auth context
        await checkPaymentStatus();

        setIsProcessing(false);
      } catch (error) {
        console.error("Error processing payment success:", error);
        setError("Failed to process payment confirmation");
        setIsProcessing(false);
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
          Welcome to NumSphere! Your subscription is now active and you can
          access all features.
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
