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

// Optimized Stripe Customer Portal Component
const BillingManagement = () => {
  const { user } = useAuth();
  const [customerPortalUrl, setCustomerPortalUrl] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCustomerPortal = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase.functions.invoke(
          "supabase-functions-get-payment-history",
          {
            body: { userId: user.id },
          },
        );

        if (error) {
          console.error("Error from edge function:", error);
          throw error;
        }

        if (data?.customerPortalUrl) {
          setCustomerPortalUrl(data.customerPortalUrl);
        }
      } catch (error) {
        console.error("Error fetching customer portal:", error);
        toast({
          title: "Error",
          description: "Failed to load billing management. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerPortal();
  }, [user, toast]);

  const handleOpenPortal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (customerPortalUrl) {
      // Open in new tab/window
      const newWindow = window.open(
        customerPortalUrl,
        "_blank",
        "noopener,noreferrer",
      );
      if (newWindow) {
        newWindow.focus();
      } else {
        // Fallback if popup blocked
        window.location.href = customerPortalUrl;
      }
    } else {
      toast({
        title: "Error",
        description:
          "Billing portal is not available. Please try again or contact support.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Billing Management
          </h2>
          <p className="text-gray-600">Loading billing portal...</p>
        </div>
      </div>
    );
  }

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

              <Button
                onClick={handleOpenPortal}
                disabled={!customerPortalUrl || loading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                type="button"
              >
                <CreditCard className="h-5 w-5 mr-2" />
                {loading ? "Loading..." : "Open Billing Portal"}
              </Button>

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

  // Prevent subscription checks when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Tab became visible - not checking subscription status");
        // Don't check payment status when tab becomes visible
        // Only check on actual sign-in/sign-out events
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Fetch user profile and subscription data only once on mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // Fetch user profile
        const { data: profileData } = await supabase
          .from("users")
          .select("full_name, avatar_url")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setUserProfile(profileData);
        }

        // Fetch subscription data - webhook managed
        const { data: subData } = await supabase
          .from("user_subscriptions")
          .select(
            "plan_id, status, created_at, stripe_customer_id, stripe_subscription_id",
          )
          .eq("user_id", user.id)
          .eq("status", "active")
          .maybeSingle();

        if (subData) {
          setSubscriptionData(subData);

          // Set plan details with pricing
          const planPricing = {
            starter: 9,
            business: 29,
            enterprise: 99,
          };

          setPlanDetails({
            plan_id: subData.plan_id,
            amount:
              planPricing[subData.plan_id as keyof typeof planPricing] || 0,
          });
        }
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
                          0
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
                          0
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
                          0
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

            {activeTab === "Billing" && <BillingManagement />}
            {activeTab === "Payment History" && <BillingManagement />}
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
