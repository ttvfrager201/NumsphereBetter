import { CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../../../supabase/supabase";
import { useAuth } from "../../../supabase/auth";
import { LoadingScreen } from "../ui/loading-spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Search, MapPin } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface AvailableNumber {
  phone_number: string;
  friendly_name: string;
  locality: string;
  region: string;
  iso_country: string;
  address_requirements: string;
  beta: boolean;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
  };
}

export default function Success() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const { user, checkPaymentStatus } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNumberSelection, setShowNumberSelection] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>(
    [],
  );
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(false);
  const [isPurchasing, setPurchasing] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const processPaymentSuccess = async () => {
      if (!sessionId || !user) {
        setError("Missing session information");
        setIsProcessing(false);
        return;
      }

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

        // Update user payment status
        const { error: userError } = await supabase
          .from("users")
          .update({ has_completed_payment: true })
          .eq("id", user.id);

        if (userError) {
          console.error("Error updating user payment status:", userError);
          throw userError;
        }

        console.log("User payment status updated successfully");

        // Update or insert subscription status
        const { error: subError } = await supabase
          .from("user_subscriptions")
          .upsert(
            {
              user_id: user.id,
              plan_id: sessionData.planId,
              stripe_checkout_session_id: sessionId,
              stripe_subscription_id: sessionData.subscriptionId,
              stripe_customer_id: sessionData.customerId,
              status: "active",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id",
            },
          );

        if (subError) {
          console.error("Error updating subscription status:", subError);
          throw subError;
        }

        console.log("Subscription status updated successfully");

        // Refresh payment status in auth context multiple times to ensure it's updated
        console.log("Refreshing payment status...");
        await checkPaymentStatus();

        // Wait a bit and check again to ensure the state is properly updated
        setTimeout(async () => {
          await checkPaymentStatus();
          console.log("Payment status refreshed again");
        }, 500);

        // Check if we should show Twilio number selection
        const storedPlan = sessionStorage.getItem("selectedPlan");
        if (storedPlan || sessionData.planId) {
          setSelectedPlan(storedPlan || sessionData.planId);
          setShowNumberSelection(true);
          sessionStorage.removeItem("selectedPlan");
          sessionStorage.removeItem("userId");
        }

        console.log("Payment processing completed successfully");
        setIsProcessing(false);

        // Auto-redirect to dashboard after 5 seconds if no number selection
        if (!storedPlan && !sessionData.planId) {
          setTimeout(() => {
            console.log("Redirecting to dashboard...");
            window.location.href = "/dashboard";
          }, 5000);
        }
      } catch (error) {
        console.error("Error processing payment success:", error);
        setError(error.message || "Failed to process payment confirmation");
        setIsProcessing(false);
      }
    };

    processPaymentSuccess();
  }, [sessionId, user, checkPaymentStatus]);

  const fetchAvailableNumbers = async () => {
    setIsLoadingNumbers(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-get-twilio-numbers",
        {
          body: {
            country: "US",
            areaCode: areaCode || undefined,
          },
        },
      );

      if (error) {
        console.error("Error fetching available numbers:", error);
        toast({
          title: "Error",
          description: "Failed to load available numbers.",
          variant: "destructive",
        });
      } else {
        setAvailableNumbers(data.numbers || []);
      }
    } catch (error) {
      console.error("Error fetching available numbers:", error);
      toast({
        title: "Error",
        description: "Failed to load available numbers.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingNumbers(false);
    }
  };

  const purchaseNumber = async (phoneNumber: string) => {
    if (!user || !selectedPlan) return;

    setPurchasing(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-purchase-twilio-number",
        {
          body: {
            phoneNumber,
            userId: user.id,
            planId: selectedPlan,
          },
        },
      );

      if (error) {
        console.error("Error purchasing number:", error);
        toast({
          title: "Purchase failed",
          description: error.message || "Failed to purchase phone number.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Number purchased!",
          description: `Successfully purchased ${formatPhoneNumber(phoneNumber)}`,
        });
        setShowNumberSelection(false);
        // Redirect to dashboard after successful purchase
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 2000);
      }
    } catch (error) {
      console.error("Error purchasing number:", error);
      toast({
        title: "Purchase failed",
        description: "Failed to purchase phone number.",
        variant: "destructive",
      });
    } finally {
      setPurchasing(false);
    }
  };

  const skipNumberSelection = () => {
    setShowNumberSelection(false);
    toast({
      title: "Setup complete!",
      description: "You can add phone numbers later from your dashboard.",
    });
    // Redirect to dashboard
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 2000);
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      const number = cleaned.slice(1);
      return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    }
    return phoneNumber;
  };

  // Auto-fetch numbers when dialog opens
  useEffect(() => {
    if (showNumberSelection && availableNumbers.length === 0) {
      fetchAvailableNumbers();
    }
  }, [showNumberSelection]);

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

      {/* Twilio Number Selection Dialog */}
      <Dialog open={showNumberSelection} onOpenChange={setShowNumberSelection}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Your Phone Number</DialogTitle>
            <DialogDescription>
              Complete your setup by selecting a phone number for your{" "}
              {selectedPlan} plan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="areaCode">Area Code (Optional)</Label>
                <Input
                  id="areaCode"
                  placeholder="e.g., 415, 212, 555"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value)}
                  maxLength={3}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={fetchAvailableNumbers}
                  disabled={isLoadingNumbers}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoadingNumbers ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Search
                </Button>
              </div>
            </div>

            {availableNumbers.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <h4 className="font-medium text-gray-900">
                  Available Numbers ({availableNumbers.length})
                </h4>
                {availableNumbers.map((number, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {formatPhoneNumber(number.phone_number)}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {number.locality}, {number.region}
                        </span>
                        <div className="flex gap-1">
                          {number.capabilities.voice && (
                            <Badge variant="secondary" className="text-xs">
                              Voice
                            </Badge>
                          )}
                          {number.capabilities.SMS && (
                            <Badge variant="secondary" className="text-xs">
                              SMS
                            </Badge>
                          )}
                          {number.capabilities.MMS && (
                            <Badge variant="secondary" className="text-xs">
                              MMS
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => purchaseNumber(number.phone_number)}
                      disabled={isPurchasing}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isPurchasing ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : null}
                      {isPurchasing ? "Purchasing..." : "Select"}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={skipNumberSelection}
                disabled={isPurchasing}
              >
                Skip for now
              </Button>
              {availableNumbers.length === 0 && !isLoadingNumbers && (
                <div className="text-center flex-1 py-4 text-gray-500">
                  Click "Search" to find available phone numbers
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
