import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Phone,
  Zap,
  Building,
  Crown,
  ChevronDown,
  LogOut,
  Calendar,
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../../supabase/auth";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "../../../supabase/supabase";

// Security utility functions
const generateSecurityFingerprint = (): string => {
  const data = [
    navigator.userAgent,
    screen.width + "x" + screen.height,
    new Date().getTimezoneOffset(),
    navigator.language,
    Date.now().toString(),
  ].join("|");

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
};

const detectPaymentBypassAttempt = (): boolean => {
  // Check for common bypass indicators
  const suspiciousPatterns = [
    () => localStorage.getItem("payment_bypass_attempt"),
    () => sessionStorage.getItem("fake_payment_success"),
    () => window.location.search.includes("bypass=true"),
    () => document.cookie.includes("payment_hacked"),
  ];

  return suspiciousPatterns.some((check) => check());
};

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 10,
    description: "Perfect for small businesses getting started",
    icon: Zap,
    color: "from-green-500 to-green-600",
    features: [
      "1 Virtual Phone Number",
      "500 Minutes/Month",
      "Basic Call Flows",
      "Email Support",
      "Call Recording",
      "Voicemail to Email",
    ],
    popular: false,
  },
  {
    id: "business",
    name: "Business",
    price: 29,
    description: "Most popular choice for growing businesses",
    icon: Building,
    color: "from-blue-500 to-blue-600",
    features: [
      "5 Virtual Phone Numbers",
      "2,000 Minutes/Month",
      "Advanced Call Flows",
      "Priority Support",
      "Analytics Dashboard",
      "Team Management",
      "Call Recording",
      "Auto Attendant",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    description: "Complete solution for large organizations",
    icon: Crown,
    color: "from-purple-500 to-purple-600",
    features: [
      "Unlimited Phone Numbers",
      "Unlimited Minutes",
      "Custom Call Flows",
      "24/7 Phone Support",
      "Advanced Analytics",
      "API Access",
      "White-label Options",
      "Dedicated Account Manager",
    ],
    popular: false,
  },
];

export default function PlanSelection({
  hasActiveSubscription = false,
}: {
  hasActiveSubscription?: boolean;
}) {
  const [isChangingPlan, setIsChangingPlan] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [nextBillingDate, setNextBillingDate] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  // Check if this is a plan change request and fetch subscription data
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const changePlan = urlParams.get("change_plan");
    if (changePlan === "true") {
      setIsChangingPlan(true);
    }

    // Get current plan and subscription data
    const fetchSubscriptionData = async () => {
      if (user) {
        const { data } = await supabase
          .from("user_subscriptions")
          .select("plan_id, created_at, updated_at")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();
        if (data) {
          setCurrentPlan(data.plan_id);
          setSubscriptionData(data);

          // Calculate next billing date (30 days from creation or last update)
          const lastUpdate = new Date(data.updated_at || data.created_at);
          const nextBilling = new Date(lastUpdate);
          nextBilling.setDate(nextBilling.getDate() + 30);
          setNextBillingDate(
            nextBilling.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          );
        }
      }
    };
    fetchSubscriptionData();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // If user has active subscription, show subscription status instead of plans
  if (hasActiveSubscription) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                  <Phone className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">NumSphere</h1>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">
                  <span>
                    Welcome, {user?.user_metadata?.full_name || user?.email}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-6 py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-6">
              <Check className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
              You're Already Subscribed!
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              Your payment has been successful and your subscription is active.
              You can access all the features from your dashboard.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                onClick={() => navigate("/dashboard")}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg"
              >
                Go to Dashboard
              </Button>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="px-8 py-3 rounded-xl font-semibold border-2 hover:bg-gray-50"
              >
                Go to Home
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const handlePlanSelect = async (planId: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to continue.",
        variant: "destructive",
      });
      return;
    }

    // Security check for bypass attempts
    if (detectPaymentBypassAttempt()) {
      console.warn("Payment bypass attempt detected");
      localStorage.setItem("security_violation", Date.now().toString());
      toast({
        title: "Security Error",
        description: "Please refresh the page and try again.",
        variant: "destructive",
      });
      return;
    }

    setSelectedPlan(planId);
    setIsLoading(true);

    try {
      console.log("Creating checkout session for plan:", planId);

      // Create checkout session via edge function
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-create-checkout-session",
        {
          body: {
            planId,
            userId: user.id,
            userEmail: user.email,
            isChangingPlan: isChangingPlan,
            currentPlan: currentPlan,
          },
        },
      );

      console.log("Edge function response:", { data, error });

      if (error) {
        console.error("Error creating checkout session:", error);
        throw new Error(error.message || "Failed to create checkout session");
      }

      if (!data) {
        throw new Error("No response data received from edge function");
      }

      if (data.error) {
        throw new Error(data.error + (data.details ? `: ${data.details}` : ""));
      }

      if (!data.url) {
        console.error("No checkout URL in response:", data);
        throw new Error("No checkout URL received from payment processor");
      }

      console.log("Checkout URL received, storing subscription...");

      // Store the pending subscription in the database with enhanced security
      try {
        const securityFingerprint = generateSecurityFingerprint();
        const { error: dbError } = await supabase
          .from("user_subscriptions")
          .upsert(
            {
              user_id: user.id,
              plan_id: planId,
              stripe_checkout_session_id: data.sessionId,
              status: "pending_payment",
              security_fingerprint: securityFingerprint,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id",
              ignoreDuplicates: false,
            },
          );

        if (dbError) {
          console.error("Error storing subscription:", dbError);
          // Don't throw here, still proceed to checkout
        } else {
          console.log("Pending subscription stored successfully");
        }
      } catch (dbError) {
        console.error("Database error storing subscription:", dbError);
        // Continue to checkout even if DB storage fails
      }

      console.log("Redirecting to Stripe checkout:", data.url);

      // Store encrypted session data for security
      const sessionData = {
        planId,
        userId: user.id,
        timestamp: Date.now(),
        sessionId: data.sessionId,
      };

      // Store with expiry (30 minutes)
      const expiryTime = Date.now() + 30 * 60 * 1000;
      sessionStorage.setItem(
        "payment_session",
        JSON.stringify({
          data: sessionData,
          expires: expiryTime,
        }),
      );

      // Clear any existing payment status to prevent bypass
      sessionStorage.removeItem("payment_verified");
      localStorage.removeItem("payment_bypass_attempt");

      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      console.error("Plan selection error:", error);
      toast({
        title: "Payment setup failed",
        description: error.message || "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setSelectedPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <Phone className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">NumSphere</h1>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 transition-colors cursor-pointer">
                <span>
                  Welcome, {user?.user_metadata?.full_name || user?.email}
                </span>
                <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Thank You Banner */}
        {hasActiveSubscription && (
          <div className="mb-8 bg-gradient-to-r from-green-500 to-blue-600 rounded-2xl p-8 text-white text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-2">
              Thank You for Choosing NumSphere! 🎉
            </h2>
            <p className="text-xl opacity-90">
              We appreciate your trust in our VoIP services. Your subscription
              is active and ready to use!
            </p>
          </div>
        )}

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
                    <p className="text-sm text-gray-600 mb-1">Current Plan</p>
                    <p className="text-lg font-semibold text-gray-900 capitalize">
                      {subscriptionData.plan_id} Plan
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-1">Amount</p>
                    <p className="text-lg font-semibold text-gray-900">
                      $
                      {plans.find((p) => p.id === subscriptionData.plan_id)
                        ?.price || 0}
                      /month
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 bg-gradient-to-r from-gray-900 to-blue-900 bg-clip-text text-transparent">
            {isChangingPlan ? "Change Your Plan" : "Choose Your Plan"}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {isChangingPlan
              ? `You're currently on the ${currentPlan ? currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1) : ""} plan. Select a new plan below to upgrade or downgrade.`
              : "Select the perfect VoIP solution for your business needs. You can upgrade or downgrade at any time."}
          </p>
          {isChangingPlan && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg inline-block">
              <p className="text-sm text-blue-800">
                💡 <strong>Plan Change:</strong> Your new plan will take effect
                immediately.
                {currentPlan && plans.find((p) => p.id === currentPlan) && (
                  <span>You'll be prorated for the difference.</span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const IconComponent = plan.icon;
            const isSelected = selectedPlan === plan.id;
            const isCurrentlyLoading = isLoading && isSelected;

            return (
              <Card
                key={plan.id}
                className={`relative transition-all duration-300 transform hover:-translate-y-2 ${
                  plan.popular
                    ? "border-2 border-blue-200 shadow-xl"
                    : "border border-gray-200 shadow-lg hover:shadow-xl"
                } ${isSelected ? "ring-2 ring-blue-500 ring-opacity-50" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white px-4 py-1 text-sm font-semibold">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br ${plan.color} rounded-2xl mb-4 mx-auto`}
                  >
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>
                  <CardTitle className="text-2xl font-bold text-gray-900">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    {plan.description}
                  </CardDescription>
                  <div className="mt-4">
                    <div
                      className={`text-4xl font-bold bg-gradient-to-r ${plan.color.replace("to-", "to-")} bg-clip-text text-transparent`}
                    >
                      ${plan.price}
                    </div>
                    <div className="text-gray-500 text-sm">per month</div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li
                        key={index}
                        className="flex items-center text-gray-600"
                      >
                        <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handlePlanSelect(plan.id)}
                    disabled={
                      isLoading || (isChangingPlan && currentPlan === plan.id)
                    }
                    className={`w-full h-12 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] ${
                      isChangingPlan && currentPlan === plan.id
                        ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                        : plan.popular
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
                          : `bg-gradient-to-r ${plan.color} hover:opacity-90 text-white shadow-lg`
                    } ${
                      isCurrentlyLoading ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                  >
                    {isChangingPlan && currentPlan === plan.id ? (
                      "Current Plan"
                    ) : isCurrentlyLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        {isChangingPlan
                          ? "Changing plan..."
                          : "Setting up your plan..."}
                      </div>
                    ) : isChangingPlan ? (
                      `Change to ${plan.name}`
                    ) : (
                      `Get Started with ${plan.name}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">
            Need help choosing? Our team is here to help.
          </p>
          <Button variant="outline" className="rounded-xl">
            Contact Sales
          </Button>
        </div>
      </main>
    </div>
  );
}
