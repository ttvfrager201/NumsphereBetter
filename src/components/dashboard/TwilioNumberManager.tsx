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
import { Phone, Plus, Search, MapPin, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";
import CallFlowManager from "./CallFlowManager";

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
  const [areaCode, setAreaCode] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchAreaCode, setLastSearchAreaCode] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch user's existing numbers and check release status
  useEffect(() => {
    fetchUserNumbers();
    checkReleaseStatus();
  }, [user]);

  const checkReleaseStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("number_audit_log")
        .select("id")
        .eq("user_id", user.id)
        .eq("action", "released")
        .limit(1);

      if (!error && data && data.length > 0) {
        setHasUsedRelease(true);
      }
    } catch (error) {
      console.error("Error checking release status:", error);
    }
  };

  const fetchUserNumbers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("twilio_numbers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load your phone numbers.",
          variant: "destructive",
        });
      } else {
        setUserNumbers(data || []);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableNumbers = async (isLoadMore = false) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to search for numbers.",
        variant: "destructive",
      });
      return;
    }

    // Check if this is a new search (different area code or first search)
    const isNewSearch =
      !isLoadMore && (areaCode !== lastSearchAreaCode || !hasSearched);

    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingAvailable(true);
      // Reset everything for a new search
      if (isNewSearch) {
        setCurrentPage(0);
        setAvailableNumbers([]);
        setLastSearchAreaCode(areaCode);
      }
      setHasSearched(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-get-twilio-numbers",
        {
          body: {
            country: "US",
            areaCode: areaCode || undefined,
            limit: 30,
            offset: isLoadMore ? (currentPage + 1) * 30 : 0,
          },
        },
      );

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load available numbers. Please try again.",
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

      if (isLoadMore) {
        setAvailableNumbers((prev) => [...prev, ...numbersWithPricing]);
        setCurrentPage((prev) => prev + 1);
      } else {
        // For new searches, replace the entire list
        setAvailableNumbers(numbersWithPricing);
        setCurrentPage(0);
      }

      if (numbersWithPricing.length === 0 && areaCode && !isLoadMore) {
        toast({
          title: "No Numbers Available",
          description: `No phone numbers available for area code ${areaCode}. Try a different area code or search without one.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load available numbers. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (isLoadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoadingAvailable(false);
      }
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

      // Check current number count against plan limits
      const planLimits = {
        starter: { maxNumbers: 1, minutes: 500 },
        business: { maxNumbers: 5, minutes: 2000 },
        enterprise: { maxNumbers: 25, minutes: 10000 },
      };

      const currentLimit = planLimits[planId as keyof typeof planLimits];
      if (!currentLimit) {
        toast({
          title: "Invalid plan",
          description:
            "Your current plan is not recognized. Please contact support.",
          variant: "destructive",
        });
        return;
      }

      if (userNumbers.length >= currentLimit.maxNumbers) {
        toast({
          title: "Number limit reached",
          description: `Your ${planId} plan allows up to ${currentLimit.maxNumbers} phone numbers. Please upgrade your plan or remove an existing number.`,
          variant: "destructive",
        });
        return;
      }

      console.log(
        `Purchasing number ${phoneNumber} for user ${user.id} on ${planId} plan`,
      );

      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-purchase-twilio-number",
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
          description: `${data.number?.formatted_number || phoneNumber} is now ready to use with ${data.minutesAllocated} minutes allocated for your ${data.planId} plan.`,
        });

        // Remove the purchased number from available numbers list
        setAvailableNumbers((prev) =>
          prev.filter((num) => num.phone_number !== phoneNumber),
        );

        // Close dialog and refresh numbers
        setShowNumberDialog(false);
        await fetchUserNumbers();

        // Reset search state
        setAvailableNumbers([]);
        setHasSearched(false);
        setAreaCode("");
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

  const [showCallFlowManager, setShowCallFlowManager] = useState(false);
  const [selectedNumberForFlows, setSelectedNumberForFlows] = useState<{
    id: string;
    phoneNumber: string;
  } | null>(null);

  const handleManageFlows = (numberId: string) => {
    const number = userNumbers.find((n) => n.id === numberId);
    if (number) {
      setSelectedNumberForFlows({
        id: numberId,
        phoneNumber: number.phone_number,
      });
      setShowCallFlowManager(true);
    }
  };

  // Check if number has existing flow
  const checkNumberHasFlow = async (numberId: string) => {
    if (!user) return false;

    try {
      const { data: flowData } = await supabase
        .from("call_flows")
        .select("id, flow_name")
        .eq("twilio_number_id", numberId)
        .eq("is_active", true)
        .maybeSingle();

      return flowData;
    } catch (error) {
      console.error("Error checking flow:", error);
      return false;
    }
  };

  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [numberToRelease, setNumberToRelease] = useState<TwilioNumber | null>(
    null,
  );
  const [isReleasing, setIsReleasing] = useState(false);
  const [hasUsedRelease, setHasUsedRelease] = useState(false);

  const handleNumberSettings = (numberId: string) => {
    if (hasUsedRelease) {
      toast({
        title: "Release Limit Reached",
        description:
          "You have already used your one-time number release ticket for this subscription. Contact support if you need to release another number.",
        variant: "destructive",
      });
      return;
    }

    const number = userNumbers.find((n) => n.id === numberId);
    if (number) {
      setNumberToRelease(number);
      setShowReleaseDialog(true);
    }
  };

  const handleReleaseNumber = async () => {
    if (!numberToRelease || !user) return;

    setIsReleasing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-release-twilio-number",
        {
          body: {
            numberId: numberToRelease.id,
            phoneNumber: numberToRelease.phone_number,
            userId: user.id,
          },
        },
      );

      if (error) {
        console.error("Release error:", error);
        toast({
          title: "Release failed",
          description:
            error.message ||
            "Failed to release phone number. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Number released successfully",
          description: `${formatPhoneNumber(numberToRelease.phone_number)} has been released and is no longer active.`,
        });

        // Refresh the numbers list and release status
        await fetchUserNumbers();
        await checkReleaseStatus();
        setShowReleaseDialog(false);
        setNumberToRelease(null);
      } else {
        toast({
          title: "Release incomplete",
          description:
            "The number release may not have completed successfully. Please contact support if needed.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Release exception:", error);
      toast({
        title: "Release failed",
        description:
          "An unexpected error occurred. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsReleasing(false);
    }
  };

  // Reset search state when dialog closes
  const handleDialogChange = (open: boolean) => {
    setShowNumberDialog(open);
    if (!open) {
      // Reset search state when dialog closes
      setAvailableNumbers([]);
      setHasSearched(false);
      setCurrentPage(0);
      setLastSearchAreaCode("");
      setAreaCode("");
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
                  Select a phone number from available options
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
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          fetchAvailableNumbers();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => fetchAvailableNumbers(false)}
                      disabled={isLoadingAvailable}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isLoadingAvailable ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Search
                    </Button>
                  </div>
                </div>

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
                        {areaCode && (
                          <span className="text-sm text-gray-500 ml-2">
                            - Area Code: {areaCode}
                          </span>
                        )}
                      </h4>
                    </div>
                    <div className="text-sm text-gray-600 mb-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎯</span>
                        <span className="font-medium">Pro Tip:</span>
                        <span>
                          Press Select to claim your perfect phone number!
                        </span>
                      </div>
                    </div>
                    <div
                      className="max-h-96 overflow-y-auto space-y-2"
                      onScroll={(e) => {
                        const { scrollTop, scrollHeight, clientHeight } =
                          e.currentTarget;
                        if (
                          scrollHeight - scrollTop - clientHeight < 50 &&
                          !isLoadingMore &&
                          availableNumbers.length > 0 &&
                          availableNumbers.length % 30 === 0
                        ) {
                          fetchAvailableNumbers(true);
                        }
                      }}
                    >
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
                      {isLoadingMore && (
                        <div className="flex items-center justify-center py-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="h-8 w-8 rounded-full border-4 border-blue-100 border-t-blue-500 animate-spin" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-3 w-3 rounded-full bg-blue-500/20 animate-pulse" />
                              </div>
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              🔍 Finding more amazing numbers for you...
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {availableNumbers.length === 0 &&
                  !isLoadingAvailable &&
                  !hasSearched && (
                    <div className="text-center py-8 text-gray-500">
                      Click "Search" to find available phone numbers
                    </div>
                  )}

                {availableNumbers.length === 0 &&
                  !isLoadingAvailable &&
                  hasSearched && (
                    <div className="text-center py-8 text-gray-500">
                      No numbers found. Try a different area code or search
                      without one.
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
                    className={`${
                      hasUsedRelease
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-red-600 hover:text-red-700 hover:bg-red-50"
                    }`}
                    disabled={hasUsedRelease}
                  >
                    {hasUsedRelease ? "Release Used" : "Release Number"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Release Number Dialog */}
      <Dialog
        open={showReleaseDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowReleaseDialog(false);
            setNumberToRelease(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Release Phone Number
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to release this phone number? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {numberToRelease && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="font-semibold text-red-800">
                  {formatPhoneNumber(numberToRelease.phone_number)}
                </div>
                <div className="text-sm text-red-600 mt-1">
                  {numberToRelease.minutes_used} /{" "}
                  {numberToRelease.minutes_allocated} minutes used
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="font-semibold text-yellow-800 mb-2">
                    🎫 This is your ONE-TIME release ticket!
                  </p>
                  <p className="text-yellow-700 text-xs">
                    You can only release one number per subscription to prevent
                    abuse. Use it wisely!
                  </p>
                </div>
                <p className="mb-2">
                  ⚠️ <strong>Warning:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>This number will be permanently released</li>
                  <li>All call flows and settings will be deleted</li>
                  <li>You may not be able to get this exact number back</li>
                  <li>Any unused minutes will be forfeited</li>
                  <li>
                    <strong>
                      This is your only release ticket for this subscription
                    </strong>
                  </li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowReleaseDialog(false)}
                  className="flex-1"
                  disabled={isReleasing}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReleaseNumber}
                  disabled={isReleasing}
                  className="flex-1"
                >
                  {isReleasing ? "Releasing..." : "Release Number"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Call Flow Manager */}
      {showCallFlowManager && selectedNumberForFlows && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <CallFlowManager
              numberId={selectedNumberForFlows.id}
              phoneNumber={selectedNumberForFlows.phoneNumber}
              onClose={() => {
                setShowCallFlowManager(false);
                setSelectedNumberForFlows(null);
              }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
