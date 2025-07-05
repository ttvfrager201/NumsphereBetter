import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bell, Home, Search, Settings, User, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../../supabase/auth";
import { useState, useEffect } from "react";
import { supabase } from "../../../../supabase/supabase";

interface TopNavigationProps {
  onSearch?: (query: string) => void;
  notifications?: Array<{
    id: string;
    title: string;
    type?: string;
    date?: string;
  }>;
  onSettingsClick?: () => void;
}

interface UserProfile {
  full_name: string | null;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

const TopNavigation = ({
  onSearch = () => {},
  notifications = [],
  onSettingsClick = () => {},
}: TopNavigationProps) => {
  const { user, signOut } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dynamicNotifications, setDynamicNotifications] = useState<
    Array<{
      id: string;
      title: string;
      type?: string;
      date?: string;
      read?: boolean;
    }>
  >([]);
  const [readNotifications, setReadNotifications] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      try {
        const { data } = await supabase
          .from("users")
          .select("full_name, email, created_at")
          .eq("id", user.id)
          .single();

        if (data) {
          setUserProfile(data);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    const fetchNotifications = async () => {
      if (!user) return;

      try {
        // Fetch subscription data for billing notifications
        const { data: subData } = await supabase
          .from("user_subscriptions")
          .select("plan_id, created_at, updated_at")
          .eq("user_id", user.id)
          .eq("status", "active")
          .single();

        const newNotifications = [];

        if (subData) {
          // Calculate next billing date
          const lastUpdate = new Date(subData.updated_at || subData.created_at);
          const nextBilling = new Date(lastUpdate);
          nextBilling.setDate(nextBilling.getDate() + 30);

          // Check if billing is within 7 days
          const daysUntilBilling = Math.ceil(
            (nextBilling.getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          );

          if (daysUntilBilling <= 7 && daysUntilBilling > 0) {
            newNotifications.push({
              id: "billing-reminder",
              title: `Billing reminder: Your ${subData.plan_id} plan renews in ${daysUntilBilling} day${daysUntilBilling > 1 ? "s" : ""}`,
              type: "billing",
              date: nextBilling.toLocaleDateString(),
              read: readNotifications.has("billing-reminder"),
            });
          }
        }

        // Check for recent call activity
        const { data: recentCalls } = await supabase
          .from("call_logs")
          .select("id, created_at")
          .eq("user_id", user.id)
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          )
          .limit(5);

        if (recentCalls && recentCalls.length > 0) {
          newNotifications.push({
            id: "recent-calls",
            title: `You have ${recentCalls.length} new call${recentCalls.length > 1 ? "s" : ""} in the last 24 hours`,
            type: "activity",
            date: new Date().toLocaleDateString(),
            read: readNotifications.has("recent-calls"),
          });
        }

        // Welcome notification for new users
        if (userProfile?.created_at) {
          const accountAge = Math.ceil(
            (new Date().getTime() -
              new Date(userProfile.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          if (accountAge <= 3) {
            newNotifications.push({
              id: "welcome",
              title:
                "Welcome to NumSphere! Get started by purchasing your first phone number",
              type: "welcome",
              date: new Date().toLocaleDateString(),
              read: readNotifications.has("welcome"),
            });
          }
        }

        setDynamicNotifications(newNotifications);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchUserProfile();
    fetchNotifications();
  }, [user, userProfile?.created_at, readNotifications]);

  const handleMarkAsRead = (notificationId: string) => {
    setReadNotifications((prev) => new Set([...prev, notificationId]));
    // Store in localStorage to persist across sessions
    const stored = JSON.parse(
      localStorage.getItem("readNotifications") || "[]",
    );
    const updated = [...new Set([...stored, notificationId])];
    localStorage.setItem("readNotifications", JSON.stringify(updated));
  };

  const handleMarkAllAsRead = () => {
    const allIds = dynamicNotifications.map((n) => n.id);
    setReadNotifications((prev) => new Set([...prev, ...allIds]));
    // Store in localStorage
    const stored = JSON.parse(
      localStorage.getItem("readNotifications") || "[]",
    );
    const updated = [...new Set([...stored, ...allIds])];
    localStorage.setItem("readNotifications", JSON.stringify(updated));
  };

  // Load read notifications from localStorage on mount
  useEffect(() => {
    const stored = JSON.parse(
      localStorage.getItem("readNotifications") || "[]",
    );
    setReadNotifications(new Set(stored));
  }, []);

  if (!user) return null;

  return (
    <div className="w-full h-16 border-b border-gray-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 fixed top-0 z-50 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <Link
          to="/"
          className="flex items-center text-gray-900 hover:text-gray-700 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <span className="font-semibold text-lg">NumSphere</span>
          </div>
        </Link>
        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search dashboard..."
            className="pl-9 h-10 rounded-full bg-gray-100 border-0 text-sm focus:ring-2 focus:ring-gray-200 focus-visible:ring-gray-200 focus-visible:ring-offset-0"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative rounded-full h-9 w-9 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <Bell className="h-4 w-4 text-gray-700" />
                    {(notifications.length > 0 ||
                      dynamicNotifications.filter((n) => !n.read).length >
                        0) && (
                      <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center font-medium border border-white">
                        {notifications.length +
                          dynamicNotifications.filter((n) => !n.read).length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="rounded-xl overflow-hidden p-2 border border-gray-200 shadow-lg"
                >
                  <div className="flex items-center justify-between px-2 py-1">
                    <DropdownMenuLabel className="text-sm font-medium text-gray-900 p-0">
                      Notifications
                    </DropdownMenuLabel>
                    {dynamicNotifications.some((n) => !n.read) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-700 h-6 px-2"
                      >
                        Mark all read
                      </Button>
                    )}
                  </div>
                  <DropdownMenuSeparator className="my-1 bg-gray-100" />
                  {dynamicNotifications.length === 0 &&
                  notifications.length === 0 ? (
                    <DropdownMenuItem className="rounded-lg text-sm py-2 text-gray-500 italic">
                      No new notifications
                    </DropdownMenuItem>
                  ) : (
                    <>
                      {dynamicNotifications.map((notification) => (
                        <div key={notification.id} className="relative group">
                          <DropdownMenuItem
                            className={`rounded-lg text-sm py-3 focus:bg-gray-100 flex flex-col items-start gap-1 pr-8 ${
                              notification.read ? "opacity-60" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between w-full">
                              <div className="flex-1">
                                <span
                                  className={`font-medium ${
                                    notification.read
                                      ? "text-gray-600"
                                      : "text-gray-900"
                                  }`}
                                >
                                  {notification.title}
                                </span>
                                {notification.date && (
                                  <span className="text-xs text-gray-500 block mt-1">
                                    {notification.date}
                                  </span>
                                )}
                              </div>
                              {!notification.read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1 flex-shrink-0"></div>
                              )}
                            </div>
                          </DropdownMenuItem>
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-600 hover:text-blue-700 h-6 w-6 p-0"
                              title="Mark as read"
                            >
                              ✓
                            </Button>
                          )}
                        </div>
                      ))}
                      {notifications.map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className="rounded-lg text-sm py-2 focus:bg-gray-100"
                        >
                          {notification.title}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            <TooltipContent className="rounded-lg bg-gray-900 text-white text-xs px-3 py-1.5">
              <p>Notifications</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <User className="h-4 w-4 text-gray-700" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded-xl border-none shadow-lg"
          >
            <DropdownMenuLabel className="text-xs text-gray-500">
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => setIsProfileOpen(true)}
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={onSettingsClick}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Account Profile</DialogTitle>
            <DialogDescription>
              Your account information and history
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">
                Account Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">
                    {userProfile?.full_name ||
                      user?.user_metadata?.full_name ||
                      "Not set"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Member since:</span>
                  <span className="font-medium">
                    {userProfile?.created_at
                      ? new Date(userProfile.created_at).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )
                      : "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last login:</span>
                  <span className="font-medium">
                    {user?.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )
                      : "Recent"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Account Status</h3>
              <div className="text-sm text-blue-700">
                <p>✓ Account verified</p>
                <p>✓ Subscription active</p>
                <p>✓ All services available</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopNavigation;
