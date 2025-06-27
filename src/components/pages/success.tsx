import { CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../supabase/auth";

export default function Success() {
  const { checkPaymentStatus } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Wait for webhook processing then redirect
    const handleSuccess = async () => {
      // Wait longer for webhook to process subscription
      setTimeout(async () => {
        await checkPaymentStatus();
      }, 2000);

      // Clean up session storage
      sessionStorage.removeItem("selectedPlan");
      sessionStorage.removeItem("userId");

      // Auto-redirect to dashboard after webhook processing
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 4000);
    };

    handleSuccess();
  }, [checkPaymentStatus, navigate]);

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
          Welcome to NumSphere! Your subscription is now active. You'll be
          redirected to your dashboard shortly.
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
