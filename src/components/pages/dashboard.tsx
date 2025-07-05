import React, { useState, useEffect } from "react";
import TopNavigation from "../dashboard/layout/TopNavigation";
import Sidebar from "../dashboard/layout/Sidebar";
import DashboardGrid from "../dashboard/DashboardGrid";
import TaskBoard from "../dashboard/TaskBoard";
import TwilioNumberManager from "../dashboard/TwilioNumberManager";
import CallFlowManager from "../dashboard/CallFlowManager";
import CallLogs from "../dashboard/CallLogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import LoadingSpinner from "@/components/ui/loading-spinner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  Upload,
  User,
  Mail,
  Lock,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";

// Plan Expiration Notification Component - Simplified without API calls
const PlanExpirationNotification = ({
  subscriptionData,
}: {
  subscriptionData: any;
}) => {
  // For now, we'll skip the expiration notification to avoid API errors
  // This can be re-enabled once the payment history function is fixed
  return null;
};

// Plan Change Component
const PlanChangeComponent = () => {
  const { user } = useAuth();
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [scheduledPlanChange, setScheduledPlanChange] = useState<string | null>(
    null,
  );
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const [actualPlanFromStripe, setActualPlanFromStripe] = useState<
    string | null
  >(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCurrentPlan = async () => {
      if (!user) return;

      try {
        // Get current plan from database as source of truth
        const { data: dbSubscription, error: dbError } = await supabase
          .from("user_subscriptions")
          .select(
            "plan_id, scheduled_plan_change, current_period_end, stripe_subscription_id, status",
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (!dbError && dbSubscription) {
          console.log(
            "Plan Change Component - Database subscription:",
            dbSubscription,
          );

          // Use database plan_id as the current active plan
          const currentPlanId = dbSubscription.plan_id || "starter";
          setCurrentPlan(currentPlanId);
          setActualPlanFromStripe(currentPlanId); // Set same as current for consistency

          // Set scheduled plan change if exists
          if (dbSubscription.scheduled_plan_change) {
            setScheduledPlanChange(dbSubscription.scheduled_plan_change);
          }

          // Set next billing date
          if (dbSubscription.current_period_end) {
            const billingDate = new Date(dbSubscription.current_period_end);
            setNextBillingDate(
              billingDate.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            );
          } else {
            // Try to get billing date from Stripe if not in database
            try {
              const { data: paymentData, error: paymentError } =
                await supabase.functions.invoke(
                  "supabase-functions-get-payment-history",
                  {
                    body: { userId: user.id },
                  },
                );

              if (
                !paymentError &&
                paymentData?.subscription?.current_period_end
              ) {
                const actualNextBilling = new Date(
                  paymentData.subscription.current_period_end * 1000,
                );
                setNextBillingDate(
                  actualNextBilling.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }),
                );
              }
            } catch (stripeError) {
              console.log("Could not fetch Stripe billing date:", stripeError);
            }
          }
        } else if (dbError) {
          console.error("Error fetching database subscription:", dbError);
          toast({
            title: "Error",
            description:
              "Failed to load current plan information. Please refresh the page.",
            variant: "destructive",
          });
        } else {
          console.log("No subscription found for user");
          toast({
            title: "No Subscription",
            description:
              "No subscription found. Please contact support if you believe this is an error.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error fetching current plan:", error);
        toast({
          title: "Error",
          description:
            "Failed to load current plan information. Please refresh the page.",
          variant: "destructive",
        });
      }
    };

    fetchCurrentPlan();
  }, [user, toast]);

  const handlePlanChange = async (newPlanId: string) => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to change your plan.",
        variant: "destructive",
      });
      return;
    }

    if (!currentPlan) {
      toast({
        title: "Error",
        description:
          "Unable to determine current plan. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (newPlanId === currentPlan) {
      toast({
        title: "Same Plan Selected",
        description: "You're already on this plan.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPlan(true);
    setSelectedPlan(newPlanId);

    try {
      console.log("Attempting to change plan:", {
        userId: user.id,
        currentPlan,
        newPlanId,
        actualPlanFromStripe,
      });

      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-change-subscription-plan",
        {
          body: {
            userId: user.id,
            newPlanId,
          },
        },
      );

      console.log("Plan change response:", { data, error });

      if (error) {
        console.error("Plan change error:", error);
        toast({
          title: "Plan Change Failed",
          description:
            error.message ||
            "Failed to schedule plan change. Please try again or contact support.",
          variant: "destructive",
        });
      } else if (data?.success) {
        // Update local state to reflect the scheduled change
        toast({
          title: "🎉 Plan Change Scheduled!",
          description:
            data.message ||
            `Your plan will change to ${newPlanId} at your next billing cycle.`,
        });

        // Refresh the plan data after successful change
        await fetchCurrentPlan();
      } else {
        toast({
          title: "Plan Change Failed",
          description:
            data?.error || "Unknown error occurred. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Plan change exception:", error);
      toast({
        title: "Plan Change Failed",
        description:
          error.message ||
          "An unexpected error occurred. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPlan(false);
      setSelectedPlan(null);
    }
  };

  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: 10,
      features: [
        "1 Phone Number",
        "500 Minutes",
        "Basic Call Flows",
        "Email Support",
      ],
    },
    {
      id: "business",
      name: "Business",
      price: 29,
      features: [
        "5 Phone Numbers",
        "2,000 Minutes",
        "Advanced Call Flows",
        "Priority Support",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 99,
      features: [
        "25 Phone Numbers",
        "Unlimited Minutes",
        "Custom Call Flows",
        "24/7 Support",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Change Your Plan
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Upgrade or downgrade your plan. Changes will take effect at your next
          billing cycle.
        </p>
        {currentPlan && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">
            <span>
              Current Plan:{" "}
              {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
            </span>
            {actualPlanFromStripe && actualPlanFromStripe !== currentPlan && (
              <span className="text-xs text-blue-600">
                (Synced from Stripe: {actualPlanFromStripe})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Scheduled Plan Change Info */}
      {scheduledPlanChange && scheduledPlanChange !== currentPlan && (
        <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-900 mb-1">
                Plan Change Scheduled
              </h4>
              <p className="text-sm text-green-700">
                Your plan will change from{" "}
                <strong>
                  {currentPlan?.charAt(0).toUpperCase() + currentPlan?.slice(1)}
                </strong>{" "}
                to{" "}
                <strong>
                  {scheduledPlanChange.charAt(0).toUpperCase() +
                    scheduledPlanChange.slice(1)}
                </strong>{" "}
                on <strong>{nextBillingDate}</strong>. This change will be
                reflected in your Stripe customer portal.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          const isScheduledPlan = scheduledPlanChange === plan.id;

          return (
            <Card
              key={plan.id}
              className={`relative ${
                isCurrentPlan
                  ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : isScheduledPlan
                    ? "ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20"
                    : "bg-white dark:bg-gray-800"
              }`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white px-3 py-1">
                    Current Plan
                  </Badge>
                </div>
              )}
              {isScheduledPlan && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-green-500 text-white px-3 py-1">
                    Scheduled for {nextBillingDate}
                  </Badge>
                </div>
              )}
              <CardContent className="pt-8 pb-8">
                <div className="text-center space-y-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {plan.name}
                  </h3>
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    ${plan.price}
                    <span className="text-sm font-normal text-gray-500">
                      /month
                    </span>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handlePlanChange(plan.id)}
                    disabled={
                      isChangingPlan ||
                      currentPlan === plan.id ||
                      scheduledPlanChange === plan.id ||
                      !currentPlan
                    }
                    className={`w-full transition-all duration-200 ${
                      currentPlan === plan.id
                        ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                        : scheduledPlanChange === plan.id
                          ? "bg-green-500 text-white cursor-not-allowed"
                          : !currentPlan
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                    }`}
                  >
                    {isChangingPlan && selectedPlan === plan.id ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        <span>Processing...</span>
                      </>
                    ) : currentPlan === plan.id ? (
                      "✓ Current Plan"
                    ) : scheduledPlanChange === plan.id ? (
                      "✓ Scheduled"
                    ) : !currentPlan ? (
                      "Loading..."
                    ) : (
                      `Change to ${plan.name}`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Plan Change Information
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Plan changes are scheduled for your next billing cycle. You'll
              continue to enjoy your current plan's features until then. No
              immediate charges will be applied.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Optimized Stripe Customer Portal Component with OTP Security
const BillingManagement = () => {
  const { user, resendOtp, verifyOtp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showOtpDialog, setShowOtpDialog] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [pendingPortalAccess, setPendingPortalAccess] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { toast } = useToast();

  const handleOpenPortal = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user || loading) return;

    // First, send OTP for security
    setLoading(true);
    try {
      await resendOtp(user.email!, "signin");
      setShowOtpDialog(true);
      setPendingPortalAccess(true);
      toast({
        title: "Security Verification",
        description:
          "We've sent a verification code to your email for secure billing portal access.",
      });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to send verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!user || !otpCode.trim()) return;

    setIsVerifyingOtp(true);
    try {
      await verifyOtp(user.email!, otpCode.trim(), "signin", false);

      // OTP verified, now access billing portal
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-create-customer-portal",
        {
          body: { userId: user.id },
        },
      );

      if (error) {
        console.error("Error from edge function:", error);
        throw error;
      }

      if (data?.customerPortalUrl) {
        setShowOtpDialog(false);
        setOtpCode("");
        setPendingPortalAccess(false);
        setIsRedirecting(true);

        // Show loading state for 2 seconds before redirect
        toast({
          title: "Redirecting to Billing Portal",
          description:
            "Please wait while we redirect you to the secure billing portal...",
        });

        setTimeout(() => {
          window.location.href = data.customerPortalUrl;
        }, 2000);
      } else {
        throw new Error(data?.message || "No customer portal URL available");
      }
    } catch (error: any) {
      console.error("Error verifying OTP or accessing portal:", error);
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to verify code or access billing portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!user) return;

    try {
      await resendOtp(user.email!, "signin");
      toast({
        title: "Code Resent",
        description: "A new verification code has been sent to your email.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend verification code.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Billing Management
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          Manage your subscription, payment methods, and download invoices
          through our secure billing portal.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                <CreditCard className="h-8 w-8 text-white" />
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Stripe Customer Portal
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Access your complete billing dashboard to:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300 mb-8">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Update payment methods
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Download invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    View billing history
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Manage subscriptions
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={handleOpenPortal}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  type="button"
                >
                  <CreditCard className="h-5 w-5 mr-2" />
                  {loading ? "Sending Security Code..." : "Open Billing Portal"}
                </Button>

                <Button
                  onClick={() => {
                    console.log("Change Plan button clicked from billing page");
                    setActiveTab("Change Plan");
                  }}
                  variant="outline"
                  className="w-full border-2 border-blue-200 hover:border-blue-300 text-blue-700 hover:text-blue-800 hover:bg-blue-50 px-8 py-3 rounded-xl font-semibold transition-all duration-200"
                >
                  <span className="mr-2">🔄</span>
                  Change Plan
                </Button>
              </div>

              {/* OTP Verification Dialog */}
              <Dialog
                open={showOtpDialog}
                onOpenChange={(open) => {
                  if (!open) {
                    setShowOtpDialog(false);
                    setOtpCode("");
                    setPendingPortalAccess(false);
                  }
                }}
              >
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-blue-600" />
                      Security Verification
                    </DialogTitle>
                    <DialogDescription>
                      Enter the verification code sent to your email to access
                      the billing portal securely.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp-code">Verification Code</Label>
                      <Input
                        id="otp-code"
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={otpCode}
                        onChange={(e) =>
                          setOtpCode(
                            e.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        maxLength={6}
                        className="text-center text-lg tracking-widest"
                        onKeyPress={(e) => {
                          if (e.key === "Enter" && otpCode.length === 6) {
                            handleVerifyOtp();
                          }
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleVerifyOtp}
                        disabled={isVerifyingOtp || otpCode.length !== 6}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        {isVerifyingOtp
                          ? "Verifying..."
                          : "Verify & Access Portal"}
                      </Button>
                    </div>
                    <div className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResendOtp}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        Resend Code
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Loading Screen for Redirection */}
              {isRedirecting && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="bg-white rounded-2xl p-8 max-w-md mx-4 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Redirecting to Billing Portal
                    </h3>
                    <p className="text-gray-600">
                      Please wait while we securely redirect you to Stripe's
                      billing portal...
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                You'll be redirected to Stripe's secure billing portal
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional billing info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Secure & Safe
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Powered by Stripe
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    Easy Management
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    All-in-one portal
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL params for initial tab
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    const isFirstTime = urlParams.get("first_time") === "true";

    if (isFirstTime && tabParam === "Select Number") {
      // Clear URL params after reading them
      window.history.replaceState({}, document.title, window.location.pathname);
      return "Select Number";
    }

    return "Home";
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [planDetails, setPlanDetails] = useState<{
    plan_id: string;
    amount: number;
  } | null>(null);
  const [loadingStripeData, setLoadingStripeData] = useState(true);
  const [activeNumbersCount, setActiveNumbersCount] = useState(0);
  const [activeFlowsCount, setActiveFlowsCount] = useState(0);
  const [totalMinutesUsed, setTotalMinutesUsed] = useState(0);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [userProfile, setUserProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const { user, signOut, checkPaymentStatus } = useAuth();
  const { toast } = useToast();

  // Handle return from billing portal and prevent unnecessary refreshes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromBillingPortal = urlParams.get("from");

    if (fromBillingPortal === "billing_portal") {
      // Clean up URL without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);

      // Show success message
      toast({
        title: "Welcome back!",
        description: "You've returned from the billing portal.",
      });
    }

    // Completely prevent any refresh behavior on tab visibility changes
    const handleVisibilityChange = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // Do nothing - prevent any refresh logic
    };

    const handleFocus = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // Do nothing - prevent any refresh logic
    };

    const handleBlur = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // Do nothing - prevent any refresh logic
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only prevent if user is actually trying to leave the page
      if (e.type === "beforeunload") {
        return;
      }
    };

    // Add event listeners with passive: false to ensure we can prevent default
    document.addEventListener("visibilitychange", handleVisibilityChange, {
      passive: false,
    });
    window.addEventListener("focus", handleFocus, { passive: false });
    window.addEventListener("blur", handleBlur, { passive: false });
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [toast]);

  // Fetch user profile and subscription data only once on mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // Use user metadata from auth instead of database query
        setUserProfile({
          full_name: user?.user_metadata?.full_name || null,
          avatar_url: user?.user_metadata?.avatar_url || null,
        });

        // First get database subscription data as source of truth for current plan
        try {
          // Try to get subscription (active or any status)
          const { data: dbSubscription, error: dbError } = await supabase
            .from("user_subscriptions")
            .select(
              "plan_id, status, stripe_subscription_id, scheduled_plan_change, current_period_end",
            )
            .eq("user_id", user.id)
            .maybeSingle();

          console.log("Raw database subscription query result:", {
            dbSubscription,
            dbError,
          });

          if (!dbError && dbSubscription) {
            console.log("Database subscription data:", dbSubscription);

            // Use database plan_id as the current active plan
            const currentPlanId = dbSubscription.plan_id || "starter";
            const subscriptionStatus = dbSubscription.status || "active";

            // Set plan pricing based on current plan
            const planPricing = {
              starter: 10,
              business: 29,
              enterprise: 99,
            };

            const currentAmount =
              planPricing[currentPlanId as keyof typeof planPricing] || 10;

            // Set subscription data from database (source of truth)
            setSubscriptionData({
              plan_id: currentPlanId,
              status: subscriptionStatus,
            });

            setPlanDetails({
              plan_id: currentPlanId,
              amount: currentAmount,
            });

            // Set next billing date from database or Stripe
            if (dbSubscription.current_period_end) {
              const billingDate = new Date(dbSubscription.current_period_end);
              setNextBillingDate(
                billingDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }),
              );
            }

            // Now try to get additional Stripe data for billing date if not in database
            if (
              !dbSubscription.current_period_end &&
              dbSubscription.stripe_subscription_id
            ) {
              try {
                const { data: paymentData, error: paymentError } =
                  await supabase.functions.invoke(
                    "supabase-functions-get-payment-history",
                    {
                      body: { userId: user.id },
                    },
                  );

                if (
                  !paymentError &&
                  paymentData?.subscription?.current_period_end
                ) {
                  const actualNextBilling = new Date(
                    paymentData.subscription.current_period_end * 1000,
                  );
                  setNextBillingDate(
                    actualNextBilling.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }),
                  );
                }
              } catch (stripeError) {
                console.log(
                  "Could not fetch Stripe billing date:",
                  stripeError,
                );
              }
            }
          } else if (dbError) {
            console.error("Error fetching database subscription:", dbError);
            // Set default values on error
            setSubscriptionData({
              plan_id: "starter",
              status: "inactive",
            });
            setPlanDetails({
              plan_id: "starter",
              amount: 10,
            });
          } else {
            console.log("No database subscription found, setting defaults");
            // Set default values if no subscription found
            setSubscriptionData({
              plan_id: "starter",
              status: "inactive",
            });
            setPlanDetails({
              plan_id: "starter",
              amount: 10,
            });
          }
        } catch (error) {
          console.error("Error fetching database subscription:", error);
          // Set default values on error
          setSubscriptionData({
            plan_id: "starter",
            status: "inactive",
          });
          setPlanDetails({
            plan_id: "starter",
            amount: 10,
          });
        }

        // Fetch active numbers count from database directly
        try {
          const { data: numbersData, error: numbersError } = await supabase
            .from("twilio_numbers")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "active");

          console.log("Active numbers query result:", {
            numbersData,
            numbersError,
            count: numbersData?.length || 0,
          });

          if (!numbersError && numbersData) {
            setActiveNumbersCount(numbersData.length);
          } else {
            console.error(
              "Error fetching numbers from database:",
              numbersError,
            );
            setActiveNumbersCount(0);
          }
        } catch (error) {
          console.error("Error fetching numbers count:", error);
          setActiveNumbersCount(0);
        }

        // Calculate total minutes used from Twilio call logs for current month
        try {
          const { data: twilioCallLogs, error: twilioError } =
            await supabase.functions.invoke(
              "supabase-functions-get-twilio-call-logs",
              {
                body: {
                  userId: user.id,
                  limit: 1000, // Get more logs for accurate usage calculation
                  filterByUserNumbers: true,
                },
              },
            );

          if (!twilioError && twilioCallLogs?.calls) {
            // Filter calls from current month
            const currentDate = new Date();
            const firstDayOfMonth = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              1,
            );

            const currentMonthCalls = twilioCallLogs.calls.filter(
              (call: any) => {
                const callDate = new Date(call.start_time);
                return callDate >= firstDayOfMonth;
              },
            );

            // Calculate total exact seconds for fair billing
            const totalExactSeconds = currentMonthCalls.reduce(
              (sum: number, call: any) => {
                const exactSeconds =
                  call.exact_seconds || parseInt(call.duration || "0");
                return sum + exactSeconds;
              },
              0,
            );

            console.log("Dashboard usage calculation (exact seconds):", {
              totalCalls: currentMonthCalls.length,
              totalExactSeconds,
              totalMinutes: (totalExactSeconds / 60).toFixed(2),
              callDetails: currentMonthCalls.map((call: any) => ({
                sid: call.sid,
                duration: call.duration,
                exactSeconds: call.exact_seconds,
                exactMinutes: (
                  (call.exact_seconds || parseInt(call.duration || "0")) / 60
                ).toFixed(2),
              })),
            });

            // Use exact seconds converted to minutes for fair billing
            setTotalMinutesUsed(
              Math.round((totalExactSeconds / 60) * 100) / 100,
            );
          } else {
            console.error(
              "Error fetching Twilio call logs for usage:",
              twilioError,
            );
            // Fallback to database call logs
            const currentDate = new Date();
            const firstDayOfMonth = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              1,
            );

            const { data: callLogsData } = await supabase
              .from("call_logs")
              .select("call_duration")
              .eq("user_id", user.id)
              .gte("created_at", firstDayOfMonth.toISOString());

            if (callLogsData) {
              const totalSeconds = callLogsData.reduce(
                (sum, log) => sum + (log.call_duration || 0),
                0,
              );
              // Convert exact seconds to minutes for fair billing
              setTotalMinutesUsed(Math.round((totalSeconds / 60) * 100) / 100);
            }
          }
        } catch (error) {
          console.error("Error calculating usage from call logs:", error);
          setTotalMinutesUsed(0);
        }

        // Fetch active call flows count
        try {
          const { data: flowsData, error: flowsError } = await supabase
            .from("call_flows")
            .select("id")
            .eq("user_id", user.id)
            .eq("is_active", true);

          if (!flowsError && flowsData) {
            setActiveFlowsCount(flowsData.length);
          } else {
            setActiveFlowsCount(0);
          }
        } catch (error) {
          console.error("Error fetching call flows count:", error);
          setActiveFlowsCount(0);
        }

        // Active flows count is now fetched above
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoadingStripeData(false);
      }
    };

    // Only fetch once when component mounts
    fetchUserData();
  }, [user?.id]); // Only depend on user.id to prevent unnecessary refetches

  // Function to trigger loading state for demonstration
  const handleRefresh = () => {
    setLoading(true);
    // Reset loading after 2 seconds
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  const handleSidebarClick = (label: string) => {
    if (label === "Settings") {
      setIsSettingsOpen(true);
    } else if (label === "Change Plan") {
      setActiveTab("Change Plan");
    } else {
      setActiveTab(label);
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleUpdateEmail = async () => {
    if (!formData.email || !user) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    // Check if email is the same as current
    if (formData.email === user.email) {
      toast({
        title: "Error",
        description: "This is already your current email address.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update email in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        email: formData.email,
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          throw new Error(
            "This email address is already in use by another account.",
          );
        }
        throw authError;
      }

      // Update email in the users table
      const { error: dbError } = await supabase
        .from("users")
        .update({ email: formData.email })
        .eq("id", user.id);

      if (dbError) {
        console.error("Database update error:", dbError);
        // Don't throw here as auth update succeeded
      }

      toast({
        title: "Success",
        description:
          "Email update initiated. Please check your new email for confirmation.",
      });
      setFormData((prev) => ({ ...prev, email: "" }));
    } catch (error: any) {
      console.error("Error updating email:", error);
      toast({
        title: "Error",
        description:
          error.message || "Failed to update email. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePassword = async () => {
    if (
      !formData.newPassword ||
      formData.newPassword !== formData.confirmPassword
    ) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (error) throw error;

      // Password updated successfully - no need to check payment status
      console.log("Password updated successfully");

      toast({
        title: "Success",
        description: "Password updated successfully!",
      });
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (error) {
      console.error("Error updating password:", error);
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-cancel-subscription",
        {
          body: { userId: user?.id },
        },
      );

      if (error) throw error;

      // Subscription cancelled - webhook will handle status updates
      console.log("Subscription cancelled successfully");

      toast({
        title: "Success",
        description:
          "Subscription cancelled successfully. You'll retain access until the end of your billing period.",
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please contact support.",
        variant: "destructive",
      });
    }
  };
  return (
    <div className="h-screen bg-[#f5f5f7] dark:bg-gray-900 transition-colors duration-200 overflow-hidden">
      <TopNavigation onSettingsClick={() => setIsSettingsOpen(true)} />
      <div className="flex h-[calc(100vh-64px)] mt-16">
        <Sidebar
          activeItem={activeTab}
          onItemClick={handleSidebarClick}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
        <main className="flex-1 overflow-auto hide-scrollbar">
          <div className="container mx-auto px-6 pt-4 pb-2 flex justify-end items-center">
            <Button
              onClick={handleRefresh}
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 h-9 shadow-sm transition-colors flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Loading..." : "Refresh Dashboard"}
            </Button>
          </div>
          <div
            className={cn(
              "container mx-auto p-6 space-y-8 min-h-full",
              "transition-all duration-300 ease-in-out",
            )}
          >
            {/* Plan Expiration Notification */}
            <PlanExpirationNotification subscriptionData={subscriptionData} />

            {/* Content based on active tab */}
            {activeTab === "Home" && (
              <div className="space-y-8">
                {/* Welcome Section */}
                <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Welcome to NumSphere! 👋
                  </h1>
                  <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
                    Hello,{" "}
                    {userProfile?.full_name ||
                      user?.user_metadata?.full_name ||
                      user?.email?.split("@")[0] ||
                      "User"}
                    !
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Manage your virtual phone numbers and call flows with ease
                  </p>
                </div>

                {/* Next Billing Cycle Card */}
                {subscriptionData && nextBillingDate && (
                  <div className="mb-8">
                    <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-900">
                          <Calendar className="h-5 w-5" />
                          Next Billing Cycle
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center">
                            <p className="text-sm text-gray-600 mb-1">
                              Next Billing Date
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {nextBillingDate}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600 mb-1">
                              Current Plan
                            </p>
                            <p className="text-lg font-semibold text-gray-900 capitalize">
                              {subscriptionData.plan_id} Plan
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-gray-600 mb-1">Amount</p>
                            <p className="text-lg font-semibold text-gray-900">
                              ${planDetails?.amount || 0}/month
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Dashboard Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Subscription Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {subscriptionData?.status === "active" ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {subscriptionData?.status === "active"
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-1 space-y-1">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {subscriptionData?.plan_id
                            ? `${subscriptionData.plan_id.charAt(0).toUpperCase() + subscriptionData.plan_id.slice(1)} Plan`
                            : "No Plan"}
                        </p>
                        {planDetails && (
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            ${planDetails.amount}/month
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Phone Numbers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {activeNumbersCount}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Active numbers
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Minutes Used
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {totalMinutesUsed}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        This month
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Call Flows
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {activeFlowsCount}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Active flows
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      onClick={() => setActiveTab("Select Number")}
                      className="h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex flex-col items-center justify-center gap-2"
                    >
                      <span className="text-lg">📞</span>
                      <span>Get Phone Number</span>
                    </Button>
                    <Button
                      onClick={() => setActiveTab("Call Flows")}
                      variant="outline"
                      className="h-16 rounded-xl flex flex-col items-center justify-center gap-2"
                    >
                      <span className="text-lg">🔄</span>
                      <span>Setup Call Flows</span>
                    </Button>
                    <Button
                      onClick={() => setActiveTab("Billing")}
                      variant="outline"
                      className="h-16 rounded-xl flex flex-col items-center justify-center gap-2"
                    >
                      <span className="text-lg">💳</span>
                      <span>Manage Billing</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Select Number" && (
              <div className="space-y-6">
                <TwilioNumberManager />
              </div>
            )}

            {activeTab === "Call Flows" && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Call Flow Management
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    Design and manage your custom call flows for your phone
                    numbers.
                  </p>
                </div>
                <CallFlowManager />
              </div>
            )}

            {activeTab === "Call Logs" && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Call Logs & History
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    View detailed call logs, duration, caller information, and
                    recordings.
                  </p>
                </div>
                <CallLogs />
              </div>
            )}

            {activeTab === "Billing" && <BillingManagement />}
            {activeTab === "Payment History" && <BillingManagement />}
            {activeTab === "Change Plan" && <PlanChangeComponent />}
          </div>
        </main>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto hide-scrollbar bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">
              Account Settings
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Manage your account preferences and subscription.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="subscription">Subscription</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>View your profile details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={
                        userProfile?.full_name ||
                        user?.user_metadata?.full_name ||
                        ""
                      }
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={user?.email || ""}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Change Email
                  </CardTitle>
                  <CardDescription>
                    Update your email address. You'll need to verify the new
                    email.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-email">Current Email</Label>
                    <Input
                      id="current-email"
                      value={user?.email || ""}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-email">New Email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      placeholder="Enter new email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    onClick={handleUpdateEmail}
                    disabled={!formData.email}
                  >
                    Update Email
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="password" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Change Password
                  </CardTitle>
                  <CardDescription>
                    Update your account password
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Enter new password"
                      value={formData.newPassword}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          newPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Confirm new password"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    onClick={handleUpdatePassword}
                    disabled={
                      !formData.newPassword || !formData.confirmPassword
                    }
                  >
                    Update Password
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscription" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Subscription Management
                  </CardTitle>
                  <CardDescription>
                    Manage your subscription settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800">
                      Active Subscription
                    </h4>
                    <p className="text-sm text-green-600 mt-1">
                      Your subscription is currently active and in good
                      standing.
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Cancel Subscription</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will cancel your subscription. You'll retain
                          access until the end of your current billing period,
                          but won't be charged again.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelSubscription}>
                          Cancel Subscription
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
