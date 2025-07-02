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
  const [loadingSubscriptionData, setLoadingSubscriptionData] = useState(true);
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

  // Fetch user profile and subscription data with caching and error handling
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        // Check cache first
        const cacheKey = `dashboard_data_${user.id}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          try {
            const cached = JSON.parse(cachedData);
            const cacheAge = Date.now() - cached.timestamp;
            // Use cache if less than 5 minutes old
            if (cacheAge < 5 * 60 * 1000) {
              setUserProfile(cached.profile);
              setSubscriptionData(cached.subscription);
              setLoadingSubscriptionData(false);
              return;
            }
          } catch (e) {
            localStorage.removeItem(cacheKey);
          }
        }

        // Fetch data with retry logic
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            // Fetch user profile and subscription data in parallel with timeout
            const fetchPromises = [
              supabase
                .from("users")
                .select("full_name, avatar_url")
                .eq("id", user.id)
                .single(),
              supabase
                .from("user_subscriptions")
                .select(
                  "plan_id, status, created_at, stripe_customer_id, stripe_subscription_id",
                )
                .eq("user_id", user.id)
                .eq("status", "active")
                .maybeSingle(),
            ];

            // Add timeout to prevent hanging requests
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Request timeout")), 10000),
            );

            const results = await Promise.race([
              Promise.all(fetchPromises),
              timeoutPromise,
            ]);

            const [profileResult, subscriptionResult] = results as any[];

            if (profileResult.data) {
              setUserProfile(profileResult.data);
            }

            if (subscriptionResult.data) {
              setSubscriptionData(subscriptionResult.data);
            }

            // Cache the results
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                profile: profileResult.data,
                subscription: subscriptionResult.data,
                timestamp: Date.now(),
              }),
            );

            break; // Success, exit retry loop
          } catch (error) {
            console.error(`Attempt ${retryCount + 1} failed:`, error);
            retryCount++;

            if (retryCount >= maxRetries) {
              console.error("All retry attempts failed for fetching user data");
              // Try to use any cached data as fallback
              const fallbackCache = localStorage.getItem(cacheKey);
              if (fallbackCache) {
                try {
                  const cached = JSON.parse(fallbackCache);
                  setUserProfile(cached.profile);
                  setSubscriptionData(cached.subscription);
                } catch (e) {}
              }
            } else {
              // Wait before retrying
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * retryCount),
              );
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoadingSubscriptionData(false);
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

  const handleSidebarClick = async (label: string) => {
    if (label === "Settings") {
      setIsSettingsOpen(true);
    } else if (label === "Subscription & Billing") {
      // Redirect to Stripe customer portal with enhanced error handling
      try {
        toast({
          title: "Opening Billing Portal",
          description: "Redirecting to secure billing portal...",
        });

        const { data, error } = await supabase.functions.invoke(
          "supabase-functions-create-customer-portal",
          {
            body: { userId: user?.id },
          },
        );

        if (error) {
          console.error("Billing portal error:", error);
          toast({
            title: "Error",
            description: "Unable to access billing portal. Please try again.",
            variant: "destructive",
          });
          return;
        }

        if (data?.url) {
          // Open in same tab for better user experience
          window.location.href = data.url;
        } else {
          toast({
            title: "Billing Portal",
            description:
              "No billing information available. Complete your first payment to access billing details.",
          });
        }
      } catch (error) {
        console.error("Error accessing billing portal:", error);
        toast({
          title: "Error",
          description:
            "Unable to access billing portal. Please try again later.",
          variant: "destructive",
        });
      }
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

      // Refresh payment status after cancellation to reflect webhook changes
      setTimeout(async () => {
        await checkPaymentStatus();
      }, 2000);

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
      <TopNavigation
        onSettingsClick={() => setIsSettingsOpen(true)}
        theme={theme}
        onThemeToggle={toggleTheme}
      />
      <div className="flex h-[calc(100vh-64px)] mt-16">
        <Sidebar
          activeItem={activeTab}
          onItemClick={handleSidebarClick}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
        <main className="flex-1 bg-[#f5f5f7] dark:bg-gray-900 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto px-6 pt-4 pb-2 flex justify-between items-center">
              <div></div>
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
                "max-w-7xl mx-auto p-6 space-y-8 pb-8",
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
                    <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Subscription
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 mb-3">
                          {subscriptionData?.status === "active" ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {subscriptionData?.plan_id
                              ? `${subscriptionData.plan_id.charAt(0).toUpperCase() + subscriptionData.plan_id.slice(1)} Plan`
                              : "No Plan"}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">
                              Status:
                            </span>
                            <span
                              className={
                                subscriptionData?.status === "active"
                                  ? "text-green-600 font-medium"
                                  : "text-red-600 font-medium"
                              }
                            >
                              {subscriptionData?.status === "active"
                                ? "Active"
                                : "Inactive"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">
                              Amount:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              $29.99/month
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 dark:text-gray-400">
                              Next billing:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {subscriptionData?.created_at
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
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Phone Numbers
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            0
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Active numbers
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Minutes Used
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                            0
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          This month
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow border-0 shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Call Flows
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
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
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border-0 shadow-sm">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button
                        onClick={() => setActiveTab("Select Number")}
                        className="h-20 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                      >
                        <span className="text-2xl">📞</span>
                        <span className="font-medium">Get Phone Number</span>
                      </Button>
                      <Button
                        onClick={() => setActiveTab("Call Flows")}
                        variant="outline"
                        className="h-20 rounded-xl flex flex-col items-center justify-center gap-2 border-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                      >
                        <span className="text-2xl">🔄</span>
                        <span className="font-medium">Setup Call Flows</span>
                      </Button>
                      <Button
                        onClick={() =>
                          handleSidebarClick("Subscription & Billing")
                        }
                        variant="outline"
                        className="h-20 rounded-xl flex flex-col items-center justify-center gap-2 border-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                      >
                        <span className="text-2xl">💳</span>
                        <span className="font-medium">Manage Billing</span>
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

              {activeTab === "Subscription & Billing" && (
                <div className="text-center py-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    Subscription & Billing
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300">
                    Manage your subscription and billing through Stripe's secure
                    portal.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Click "Subscription & Billing" in the sidebar to access your
                    billing portal.
                  </p>
                </div>
              )}
            </div>
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
