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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Phone, Plus, MapPin, Clock } from "lucide-react";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";

interface TwilioNumber {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  minutes_allocated: number;
  minutes_used: number;
  plan_id: string;
  status: string;
  created_at: string;
}

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
  monthlyPrice?: number;
}

export default function TwilioNumberManager() {
  const [userNumbers, setUserNumbers] = useState<TwilioNumber[]>([]);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false);
  const [isPurchasing, setPurchasing] = useState(false);
  const [showNumberDialog, setShowNumberDialog] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch user's existing numbers - OPTIMIZED to prevent excessive calls
  useEffect(() => {
    let isMounted = true;
    let fetchInProgress = false;

    const fetchNumbers = async () => {
      if (!user?.id || fetchInProgress) return;

      fetchInProgress = true;

      // Check cache first
      const cacheKey = `twilio_numbers_${user.id}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        try {
          const cached = JSON.parse(cachedData);
          const cacheAge = Date.now() - cached.timestamp;
          // Use cache if less than 2 minutes old
          if (cacheAge < 2 * 60 * 1000) {
            if (isMounted) {
              setUserNumbers(cached.numbers || []);
              setIsLoading(false);
            }
            fetchInProgress = false;
            return;
          }
        } catch (e) {
          localStorage.removeItem(cacheKey);
        }
      }

      try {
        const { data, error } = await supabase
          .from("twilio_numbers")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (isMounted) {
          if (error) {
            console.error("Error loading phone numbers:", error);
            // Try to use cached data as fallback
            if (cachedData) {
              try {
                const cached = JSON.parse(cachedData);
                setUserNumbers(cached.numbers || []);
              } catch (e) {}
            }
          } else {
            setUserNumbers(data || []);
            // Cache the results
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                numbers: data || [],
                timestamp: Date.now(),
              }),
            );
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Exception loading phone numbers:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      } finally {
        fetchInProgress = false;
      }
    };

    fetchNumbers();

    return () => {
      isMounted = false;
    };
  }, [user?.id]); // Only depend on user.id

  const fetchUserNumbers = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("twilio_numbers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching user numbers:", error);
      } else {
        setUserNumbers(data || []);
        // Update cache
        const cacheKey = `twilio_numbers_${user.id}`;
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            numbers: data || [],
            timestamp: Date.now(),
          }),
        );
      }
    } catch (error) {
      console.error("Error fetching user numbers:", error);
    }
  };

  const fetchAvailableNumbers = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to search for numbers.",
        variant: "destructive",
      });
      return;
    }

    // Prevent multiple simultaneous requests
    if (isLoadingAvailable) {
      return;
    }

    setIsLoadingAvailable(true);
    setAvailableNumbers([]);

    try {
      const payload = {
        country: "US",
        limit: 30,
        offset: 0,
      };

      console.log(
        "[TwilioNumberManager] Fetching random numbers from all states",
      );

      const { data, error } = await supabase.functions.invoke(
        "get-twilio-numbers",
        {
          body: JSON.stringify(payload),
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (error) {
        console.error("Error loading available numbers:", error);
        toast({
          title: "Error",
          description: `Failed to load available numbers: ${error.message || "Please try again."}`,
          variant: "destructive",
        });
        return;
      }

      if (!data) {
        console.error("No data received from Twilio API");
        toast({
          title: "Error",
          description:
            "No response from phone number service. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const numbersWithPricing = (data.numbers || []).map(
        (number: AvailableNumber) => ({
          ...number,
          monthlyPrice: 1.25,
        }),
      );

      setAvailableNumbers(numbersWithPricing);

      if (numbersWithPricing.length > 0) {
        console.log(
          `[TwilioNumberManager] Found ${numbersWithPricing.length} numbers from various states`,
        );
      }
    } catch (error) {
      console.error("Exception loading available numbers:", error);
      toast({
        title: "Error",
        description: "Failed to load available numbers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAvailable(false);
    }
  };

  const purchaseNumber = async (phoneNumber: string) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to purchase phone numbers.",
        variant: "destructive",
      });
      return;
    }

    setPurchasing(true);
    setSelectedNumber(phoneNumber);

    try {
      // Get user's current plan with error handling
      const { data: subscriptionData, error: subError } = await supabase
        .from("user_subscriptions")
        .select("plan_id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (subError || !subscriptionData) {
        toast({
          title: "Subscription required",
          description:
            "You need an active subscription to purchase phone numbers. Please upgrade your plan.",
          variant: "destructive",
        });
        return;
      }

      const planId = subscriptionData.plan_id;

      console.log(
        `Purchasing number ${phoneNumber} for user ${user.id} on ${planId} plan`,
      );

      const { data, error } = await supabase.functions.invoke(
        "purchase-twilio-number",
        {
          body: {
            phoneNumber,
            userId: user.id,
            planId,
          },
        },
      );

      if (error) {
        console.error("Purchase error:", error);

        // Enhanced error handling with specific messages
        let errorTitle = "Purchase failed";
        let errorDescription =
          "Failed to purchase phone number. Please try again.";

        if (error.message) {
          if (error.message.includes("limit reached")) {
            errorTitle = "Number limit reached";
            errorDescription = `Your ${planId} plan has reached its phone number limit. Please upgrade your plan or remove an existing number.`;
          } else if (error.message.includes("not available")) {
            errorTitle = "Number unavailable";
            errorDescription =
              "This phone number is no longer available. Please select a different number.";
          } else if (error.message.includes("already owned")) {
            errorTitle = "Number already owned";
            errorDescription = "You already own this phone number.";
          } else if (error.message.includes("rate limit")) {
            errorTitle = "Too many attempts";
            errorDescription =
              "Please wait a moment before trying to purchase another number.";
          } else {
            errorDescription = error.message;
          }
        }

        toast({
          title: errorTitle,
          description: errorDescription,
          variant: "destructive",
        });
      } else if (data?.success) {
        console.log("Purchase successful:", data);

        toast({
          title: "🎉 Number purchased successfully!",
          description: `${data.number?.formatted_number || phoneNumber} is now ready to use with ${data.minutesAllocated} minutes allocated.`,
        });

        // Close dialog and refresh numbers
        setShowNumberDialog(false);
        await fetchUserNumbers();

        // Reset search state
        setAvailableNumbers([]);
      } else {
        toast({
          title: "Purchase incomplete",
          description:
            "The purchase may not have completed successfully. Please check your numbers or contact support.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Purchase exception:", error);
      toast({
        title: "Purchase failed",
        description:
          "An unexpected error occurred. Please try again or contact support if the problem persists.",
        variant: "destructive",
      });
    } finally {
      setPurchasing(false);
      setSelectedNumber(null);
    }
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      const number = cleaned.slice(1);
      return `+1 (${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    }
    return phoneNumber;
  };

  const handleManageFlows = (numberId: string) => {
    toast({
      title: "Call Flow Management",
      description:
        "Call flow management interface coming soon! You'll be able to create custom voice menus, voicemail, and call routing.",
    });
  };

  const handleNumberSettings = (numberId: string) => {
    toast({
      title: "Number Settings",
      description:
        "Number settings interface coming soon! You'll be able to configure forwarding, recording, and other advanced features.",
    });
  };

  // Reset search state when dialog closes
  const handleDialogChange = (open: boolean) => {
    setShowNumberDialog(open);
    if (!open) {
      // Reset search state when dialog closes
      setAvailableNumbers([]);
    } else {
      // Auto-load numbers when dialog opens
      fetchAvailableNumbers();
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Numbers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Phone Numbers
            </CardTitle>
            <CardDescription>
              Manage your Phone numbers and call flows
            </CardDescription>
          </div>
          <Dialog open={showNumberDialog} onOpenChange={handleDialogChange}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Number
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Select Your Phone Number</DialogTitle>
                <DialogDescription>
                  Choose from available phone numbers across all US states
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {isLoadingAvailable && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center py-12 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <div className="h-12 w-12 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-6 w-6 rounded-full bg-blue-500/20 animate-pulse" />
                          </div>
                        </div>
                        <div className="text-center">
                          <h4 className="font-semibold text-gray-900 mb-1">
                            🔍 Searching for Numbers...
                          </h4>
                          <p className="text-sm text-gray-600">
                            Finding the best available phone numbers for you
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {availableNumbers.length > 0 && !isLoadingAvailable && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">
                        Available Numbers ({availableNumbers.length})
                      </h4>
                      <Button
                        onClick={fetchAvailableNumbers}
                        variant="outline"
                        size="sm"
                        disabled={isLoadingAvailable}
                      >
                        Refresh
                      </Button>
                    </div>
                    <div className="text-sm text-gray-600 mb-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎯</span>
                        <span className="font-medium">Pro Tip:</span>
                        <span>
                          Numbers from various US states - Select to claim
                          yours!
                        </span>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {availableNumbers.map((number, index) => (
                        <div
                          key={`${number.phone_number}-${index}`}
                          className="flex items-center justify-between p-4 border rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 hover:border-blue-200 transition-all duration-200 group"
                        >
                          <div className="flex-1">
                            <div className="font-semibold text-lg text-gray-900 group-hover:text-blue-900">
                              {formatPhoneNumber(number.phone_number)}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-blue-500" />
                                {number.locality}, {number.region}
                              </span>
                              <span className="font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs">
                                $1.25/month
                              </span>
                              <div className="flex gap-1">
                                {number.capabilities.voice && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-blue-100 text-blue-700"
                                  >
                                    Voice
                                  </Badge>
                                )}
                                {number.capabilities.SMS && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-green-100 text-green-700"
                                  >
                                    SMS
                                  </Badge>
                                )}
                                {number.capabilities.MMS && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs bg-purple-100 text-purple-700"
                                  >
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
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-6"
                          >
                            {isPurchasing &&
                            selectedNumber === number.phone_number ? (
                              <LoadingSpinner size="sm" className="mr-2" />
                            ) : (
                              <span className="mr-2">⚡</span>
                            )}
                            {isPurchasing &&
                            selectedNumber === number.phone_number
                              ? "Selecting..."
                              : "Select"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {availableNumbers.length === 0 && !isLoadingAvailable && (
                  <div className="text-center py-8 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-3xl">📞</span>
                      <h4 className="font-semibold text-gray-900">
                        No Numbers Available
                      </h4>
                      <p className="text-gray-600 text-center max-w-md">
                        No phone numbers are currently available. Please try
                        again later.
                      </p>
                      <Button
                        onClick={fetchAvailableNumbers}
                        variant="outline"
                        size="sm"
                        className="mt-2"
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {userNumbers.length === 0 ? (
          <div className="text-center py-8">
            <Phone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Phone Numbers
            </h3>
            <p className="text-gray-500 mb-4">
              Select your first phone number to start making calls
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {userNumbers.map((number) => (
              <div
                key={number.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium text-lg">
                    {formatPhoneNumber(number.phone_number)}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {number.minutes_used} / {number.minutes_allocated} minutes
                      used
                    </span>
                    <Badge
                      variant={
                        number.status === "active" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {number.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {number.plan_id} plan
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleManageFlows(number.id)}
                  >
                    Manage Flows
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleNumberSettings(number.id)}
                  >
                    Settings
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
