import React, { useState, useEffect } from "react";
import TopNavigation from "../dashboard/layout/TopNavigation";
import Sidebar from "../dashboard/layout/Sidebar";
import DashboardGrid from "../dashboard/DashboardGrid";
import TaskBoard from "../dashboard/TaskBoard";
import TwilioNumberManager from "../dashboard/TwilioNumberManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";

// Theme Context
const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return { theme, toggleTheme };
};

// Payment History Component
const PaymentHistory = () => {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stripeCustomerPortalUrl, setStripeCustomerPortalUrl] = useState<
    string | null
  >(null);

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      if (!user) return;

      try {
        setError(null);
        // Fetch payment history from Stripe via edge function with better error handling
        const { data, error } = await supabase.functions.invoke(
          "supabase-functions-get-payment-history",
          {
            body: { userId: user.id },
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        if (error) {
          console.error("Payment history error:", error);
          setError("Unable to load payment history. Please try again later.");
          setPayments([]);
        } else {
          setPayments(data?.payments || []);
          setStripeCustomerPortalUrl(data?.customerPortalUrl || null);
        }
      } catch (error) {
        console.error("Payment history fetch error:", error);
        setError("Unable to load payment history. Please try again later.");
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentHistory();
  }, [user]);

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "pending":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "succeeded":
        return "text-green-600 bg-green-50";
      case "failed":
        return "text-red-600 bg-red-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Payment History
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Loading payment history...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Payment History
          </h2>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment History
        </h2>
        <p className="text-gray-600">
          View all your payment transactions and billing history.
        </p>
      </div>

      <div className="space-y-6">
        {/* Stripe Customer Portal Link */}
        {stripeCustomerPortalUrl && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-900">
                    Manage Your Subscription
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Update payment methods, download invoices, and manage your
                    billing preferences
                  </p>
                </div>
                <Button
                  onClick={() => window.open(stripeCustomerPortalUrl, "_blank")}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Billing
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              All payments and billing transactions for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No payment history found.</p>
                <p className="text-sm text-gray-400">
                  Your payment transactions will appear here once you make your
                  first payment.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(payment.status)}
                      <div>
                        <p className="font-medium text-gray-900">
                          {payment.description || "Payment"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(payment.created)} • ID:{" "}
                          {payment.id.slice(-8)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatAmount(payment.amount, payment.currency)}
                      </p>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(payment.status)}`}
                      >
                        {payment.status.charAt(0).toUpperCase() +
                          payment.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Home = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("Home");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [stripeData, setStripeData] = useState<any>(null);
  const [loadingStripeData, setLoadingStripeData] = useState(true);
  const [stripeSubscription, setStripeSubscription] = useState<any>(null);
  const { theme, toggleTheme } = useTheme();

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

  // Fetch user profile and subscription data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .single();

        if (!profileError) {
          setUserProfile(profileData);
        }

        // Fetch subscription data with better error handling
        try {
          const { data: subData, error: subError } = await supabase
            .from("user_subscriptions")
            .select(
              "plan_id, status, created_at, stripe_customer_id, stripe_subscription_id",
            )
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no data

          if (!subError && subData) {
            setSubscriptionData(subData);
          } else if (subError) {
            console.error("Error fetching subscription:", subError);
          }
        } catch (subError) {
          console.error("Subscription fetch error:", subError);
        }

        // Fetch Stripe data for real subscription info with better error handling
        try {
          const { data: stripeResponse, error: stripeError } =
            await supabase.functions.invoke(
              "supabase-functions-get-payment-history",
              {
                body: { userId: user.id },
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );

          if (!stripeError && stripeResponse) {
            console.log("Stripe data received:", stripeResponse);
            setStripeData(stripeResponse);
            setStripeSubscription(stripeResponse?.subscription);
          } else {
            console.log("No Stripe data or error:", stripeError);
            // Set empty data to show "No subscription" state
            setStripeData(null);
            setStripeSubscription(null);
          }
        } catch (error) {
          console.error("Stripe API error:", error);
          // Set empty data to show "No subscription" state
          setStripeData(null);
          setStripeSubscription(null);
        }
      } catch (error) {
        // Silently handle errors to reduce console noise
      } finally {
        setLoadingStripeData(false);
      }
    };

    fetchUserData();
  }, [user]);

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
      // Handle plan change - could redirect to plan selection or open a modal
      toast({
        title: "Plan Change",
        description: "Plan change functionality will be available soon.",
      });
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

      // Force payment status check after password change to ensure user stays logged in
      console.log("Password updated, refreshing payment status...");
      setTimeout(async () => {
        await checkPaymentStatus();
        console.log("Payment status refreshed after password change");
      }, 500);

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
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-900 transition-colors duration-200">
      <TopNavigation onSettingsClick={() => setIsSettingsOpen(true)} />
      <div className="flex h-[calc(100vh-64px)] mt-16">
        <Sidebar
          activeItem={activeTab}
          onItemClick={handleSidebarClick}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
        <main className="flex-1 overflow-auto hide-scrollbar">
          <div className="container mx-auto px-6 pt-4 pb-2 flex justify-between items-center">
            <Button
              onClick={toggleTheme}
              variant="outline"
              size="icon"
              className="rounded-full h-9 w-9 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              ) : (
                <Sun className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              )}
            </Button>
            <Button
              onClick={handleRefresh}
              className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-full px-4 h-9 shadow-sm transition-colors flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Loading..." : "Refresh Dashboard"}
            </Button>
          </div>
          <div
            className={cn(
              "container mx-auto p-6 space-y-8",
              "transition-all duration-300 ease-in-out",
            )}
          >
            {/* Content based on active tab */}
            {activeTab === "Home" && (
              <div className="space-y-8">
                {/* Big Hello Section */}
                <div className="text-center py-8 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Hello,{" "}
                    {userProfile?.full_name ||
                      user?.user_metadata?.full_name ||
                      user?.email?.split("@")[0] ||
                      "User"}
                    ! 👋
                  </h1>
                  <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
                    Welcome to your NumSphere Dashboard
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Manage your virtual phone numbers and call flows with ease
                  </p>
                </div>

                {/* Subscription Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Subscription Status Card */}
                  <Card className="bg-white dark:bg-gray-800 hover:shadow-lg dark:hover:shadow-gray-900/20 transition-shadow duration-200 border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Subscription Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingStripeData ? (
                        <div className="animate-pulse">
                          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {stripeSubscription?.status === "active" ||
                          subscriptionData?.status === "active" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {stripeSubscription?.status === "active" ||
                            subscriptionData?.status === "active"
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {stripeSubscription?.product_name ||
                          stripeSubscription?.name ||
                          (subscriptionData?.plan_id
                            ? `${subscriptionData.plan_id.charAt(0).toUpperCase() + subscriptionData.plan_id.slice(1)} Plan`
                            : "Free Plan")}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Next Billing Cycle Card */}
                  <Card className="bg-white dark:bg-gray-800 hover:shadow-lg dark:hover:shadow-gray-900/20 transition-shadow duration-200 border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Next Billing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingStripeData ? (
                        <div className="animate-pulse">
                          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-blue-500" />
                          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {stripeSubscription?.current_period_end
                              ? new Date(
                                  stripeSubscription.current_period_end * 1000,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : subscriptionData?.created_at
                                ? new Date(
                                    new Date(
                                      subscriptionData.created_at,
                                    ).getTime() +
                                      30 * 24 * 60 * 60 * 1000,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "N/A"}
                          </span>
                        </div>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {stripeSubscription?.status === "active" ||
                        subscriptionData?.status === "active"
                          ? `${stripeSubscription?.interval || "Monthly"} billing`
                          : "No active billing"}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Payment Amount Card */}
                  <Card className="bg-white dark:bg-gray-800 hover:shadow-lg dark:hover:shadow-gray-900/20 transition-shadow duration-200 border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Monthly Payment
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingStripeData ? (
                        <div className="animate-pulse">
                          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {stripeSubscription?.amount
                              ? new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency:
                                    stripeSubscription.currency?.toUpperCase() ||
                                    "USD",
                                }).format(stripeSubscription.amount / 100)
                              : subscriptionData?.plan_id === "starter"
                                ? "$9.00"
                                : subscriptionData?.plan_id === "business"
                                  ? "$29.00"
                                  : subscriptionData?.plan_id === "enterprise"
                                    ? "$99.00"
                                    : "$0.00"}
                          </span>
                        </div>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {stripeSubscription?.interval
                          ? `Per ${stripeSubscription.interval}`
                          : stripeSubscription?.status === "active" ||
                              subscriptionData?.status === "active"
                            ? "Per month"
                            : "No subscription"}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Credits Usage Card */}
                  <Card className="bg-white dark:bg-gray-800 hover:shadow-lg dark:hover:shadow-gray-900/20 transition-shadow duration-200 border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Minutes Used
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingStripeData ? (
                        <div className="animate-pulse">
                          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {stripeSubscription?.status === "active" ||
                              subscriptionData?.plan_id
                                ? "0%"
                                : "N/A"}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {stripeSubscription?.status === "active" ||
                              subscriptionData?.plan_id
                                ? subscriptionData?.plan_id === "starter"
                                  ? "0/500"
                                  : subscriptionData?.plan_id === "business"
                                    ? "0/2000"
                                    : subscriptionData?.plan_id === "enterprise"
                                      ? "0/Unlimited"
                                      : "0/500"
                                : "No plan"}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-500 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                              style={{ width: "0%" }}
                            ></div>
                          </div>
                        </div>
                      )}
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
                      className="h-16 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-xl flex flex-col items-center justify-center gap-2"
                    >
                      <span className="text-lg">📞</span>
                      <span>Get Phone Number</span>
                    </Button>
                    <Button
                      onClick={() => setActiveTab("Call Flows")}
                      variant="outline"
                      className="h-16 rounded-xl flex flex-col items-center justify-center gap-2 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      <span className="text-lg">🔄</span>
                      <span>Setup Call Flows</span>
                    </Button>
                    <Button
                      onClick={() => setActiveTab("Payment History")}
                      variant="outline"
                      className="h-16 rounded-xl flex flex-col items-center justify-center gap-2 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      <span className="text-lg">💳</span>
                      <span>View Payments</span>
                    </Button>
                  </div>
                </div>

                {/* Quick Start Button */}
                <div className="text-center py-8">
                  <Button
                    onClick={() => setActiveTab("Select Number")}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 dark:from-blue-700 dark:to-purple-700 dark:hover:from-blue-800 dark:hover:to-purple-800 text-white px-8 py-4 text-lg rounded-xl shadow-lg"
                  >
                    🚀 Quick Start - Get Your First Number
                  </Button>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Get started by selecting your first phone number
                  </p>
                </div>
              </div>
            )}

            {activeTab === "Select Number" && (
              <div className="space-y-6">
                <TwilioNumberManager />
              </div>
            )}

            {activeTab === "Call Flows" && (
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  Call Flows
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                  Design and manage your custom call flows here.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Coming soon...
                </p>
              </div>
            )}

            {activeTab === "Payment History" && <PaymentHistory />}
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
