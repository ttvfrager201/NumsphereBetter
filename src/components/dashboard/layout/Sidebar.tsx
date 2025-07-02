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
  { icon: <Receipt size={20} />, label: "Subscription & Billing" },
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
  const [userProfile, setUserProfile] = useState<{
    full_name: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      try {
        // Only fetch user profile with error handling and caching
        const cacheKey = `user_profile_${user.id}`;
        const cachedProfile = localStorage.getItem(cacheKey);

        if (cachedProfile) {
          try {
            const cached = JSON.parse(cachedProfile);
            const cacheAge = Date.now() - cached.timestamp;
            // Use cache if less than 10 minutes old
            if (cacheAge < 10 * 60 * 1000) {
              setUserProfile(cached.data);
              return;
            }
          } catch (e) {
            localStorage.removeItem(cacheKey);
          }
        }

        const { data: userData, error } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          return;
        }

        setUserProfile(userData);

        // Cache the result
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            data: userData,
            timestamp: Date.now(),
          }),
        );
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
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
        {/* Welcome Section - Show when not collapsed */}
        {!isCollapsed && (
          <div className="py-4">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 mb-4 border border-blue-100">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  Hello, {userName}! 👋
                </h3>
                <p className="text-xs text-gray-600">Welcome to NumSphere</p>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs h-8 bg-white/50 hover:bg-white/80"
                onClick={() => onItemClick("Subscription & Billing")}
              >
                <CreditCard size={12} className="mr-1" />
                Manage Billing
              </Button>
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
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                Active Numbers
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                Call Flows
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <span className="h-2 w-2 rounded-full bg-purple-500"></span>
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
