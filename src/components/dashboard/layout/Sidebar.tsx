import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  HelpCircle,
  FolderKanban,
  Menu,
  X,
  CreditCard,
  Clock,
  Receipt,
} from "lucide-react";
import { useAuth } from "../../../../supabase/auth";
import { supabase } from "../../../../supabase/supabase";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href?: string;
  isActive?: boolean;
}

interface SidebarProps {
  items?: NavItem[];
  activeItem?: string;
  onItemClick?: (label: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface SubscriptionInfo {
  status: string;
  plan_id: string;
  current_period_end: string;
  usage_percentage: number;
  credits_used: number;
  credits_total: number;
}

const defaultNavItems: NavItem[] = [
  { icon: <Home size={20} />, label: "Home", isActive: true },
  { icon: <LayoutDashboard size={20} />, label: "Select Number" },
  { icon: <FolderKanban size={20} />, label: "Call Flows" },
  { icon: <Clock size={20} />, label: "Call Logs" },
  { icon: <Receipt size={20} />, label: "Billing" },
];

const defaultBottomItems: NavItem[] = [
  { icon: <Settings size={20} />, label: "Settings" },
  { icon: <HelpCircle size={20} />, label: "Help" },
];

const Sidebar = ({
  items = defaultNavItems,
  activeItem = "Home",
  onItemClick = () => {},
  isCollapsed = false,
  onToggleCollapse = () => {},
}: SidebarProps) => {
  const { user } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] =
    useState<SubscriptionInfo | null>(null);
  const [userProfile, setUserProfile] = useState<{
    full_name: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchSubscriptionInfo = async () => {
      if (!user) return;

      try {
        // Fetch user profile
        const { data: userData } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .single();

        setUserProfile(userData);

        // Fetch subscription info
        const { data: subData, error: subError } = await supabase
          .from("user_subscriptions")
          .select("status, plan_id, created_at, updated_at")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("updated_at", { ascending: false })
          .maybeSingle();

        if (subError && subError.code !== "PGRST116") {
          console.error("Error fetching subscription:", subError);
        }

        if (subData) {
          // Calculate actual usage from Twilio call logs for current month
          let totalMinutesUsed = 0;
          try {
            const { data: twilioCallLogs, error: twilioError } =
              await supabase.functions.invoke(
                "supabase-functions-get-twilio-call-logs",
                {
                  body: {
                    userId: user.id,
                    limit: 1000,
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

              // Convert to minutes with precision
              totalMinutesUsed =
                Math.round((totalExactSeconds / 60) * 100) / 100;
            } else {
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

              const totalSeconds =
                callLogsData?.reduce(
                  (sum, log) => sum + (log.call_duration || 0),
                  0,
                ) || 0;

              // Convert exact seconds to minutes for fair billing
              totalMinutesUsed = Math.round((totalSeconds / 60) * 100) / 100;
            }
          } catch (error) {
            console.error("Error calculating sidebar usage:", error);
            totalMinutesUsed = 0;
          }

          // Plan limits
          const planLimits = {
            starter: 500,
            business: 2000,
            enterprise: -1, // unlimited
          };

          const planLimit =
            planLimits[subData.plan_id as keyof typeof planLimits] || 500;
          const isUnlimited = planLimit === -1;

          const usageData = {
            credits_used: totalMinutesUsed,
            credits_total: isUnlimited ? totalMinutesUsed + 1000 : planLimit, // Show some buffer for unlimited
          };

          setSubscriptionInfo({
            ...subData,
            usage_percentage: isUnlimited
              ? 0
              : (usageData.credits_used / usageData.credits_total) * 100,
            ...usageData,
          });
        }
      } catch (error) {
        console.error("Error fetching subscription info:", error);
      }
    };

    fetchSubscriptionInfo();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const userName =
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  return (
    <div
      className={`${isCollapsed ? "w-16" : "w-[320px]"} h-full bg-white/80 backdrop-blur-md border-r border-gray-200 flex flex-col transition-all duration-300`}
    >
      {/* Header with hamburger */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">NumSphere</h2>
              <p className="text-sm text-gray-500">Manage your phone numbers</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-8 w-8 rounded-lg hover:bg-gray-100"
          >
            {isCollapsed ? <Menu size={18} /> : <X size={18} />}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4">
        {/* Subscription Info - Show when not collapsed and subscription info exists */}
        {!isCollapsed && subscriptionInfo && (
          <div className="py-4">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 mb-4 border border-blue-100">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  Hello, {userName}! 👋
                </h3>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      subscriptionInfo.status === "active"
                        ? "default"
                        : "secondary"
                    }
                    className="text-xs"
                  >
                    {subscriptionInfo.status === "active"
                      ? "✓ Active"
                      : subscriptionInfo.status}
                  </Badge>
                  <span className="text-xs text-gray-600 capitalize">
                    {subscriptionInfo.plan_id} Plan
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-700">
                      Usage
                    </span>
                    <span className="text-xs text-gray-600">
                      {subscriptionInfo.credits_used} /{" "}
                      {subscriptionInfo.plan_id === "enterprise"
                        ? "Unlimited"
                        : subscriptionInfo.credits_total}{" "}
                      min (exact)
                    </span>
                  </div>
                  <Progress
                    value={subscriptionInfo.usage_percentage}
                    className="h-2"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {Math.round(subscriptionInfo.usage_percentage)}% used
                  </div>
                </div>

                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8 bg-white/50 hover:bg-white/80"
                    onClick={() => onItemClick("Billing")}
                  >
                    <CreditCard size={12} className="mr-1" />
                    Manage Plan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-blue-200 text-blue-700 hover:text-blue-800"
                    onClick={() => onItemClick("Change Plan")}
                  >
                    <span className="mr-1">🔄</span>
                    Change Plan
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="space-y-1.5 py-2">
          {items.map((item) => (
            <Button
              key={item.label}
              variant={"ghost"}
              className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start gap-3"} h-10 rounded-xl text-sm font-medium ${item.label === activeItem ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "text-gray-700 hover:bg-gray-100"}`}
              onClick={() => onItemClick(item.label)}
              title={isCollapsed ? item.label : undefined}
            >
              <span
                className={`${item.label === activeItem ? "text-blue-600" : "text-gray-500"}`}
              >
                {item.icon}
              </span>
              {!isCollapsed && item.label}
            </Button>
          ))}
        </div>

        {!isCollapsed && (
          <>
            <Separator className="my-4 bg-gray-100" />

            <div className="space-y-3">
              <h3 className="text-xs font-medium px-4 py-1 text-gray-500 uppercase tracking-wider">
                Quick Stats
              </h3>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Active Numbers
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Call Flows
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Usage Stats
              </Button>
            </div>
          </>
        )}
      </ScrollArea>

      <div className="p-4 mt-auto border-t border-gray-200">
        {defaultBottomItems.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            className={`w-full ${isCollapsed ? "justify-center px-2" : "justify-start gap-3"} h-10 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 mb-1.5`}
            onClick={() => onItemClick(item.label)}
            title={isCollapsed ? item.label : undefined}
          >
            <span className="text-gray-500">{item.icon}</span>
            {!isCollapsed && item.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
