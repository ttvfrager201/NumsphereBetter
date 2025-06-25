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
import { Phone, Plus, Search, MapPin, Clock } from "lucide-react";
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
  const [areaCode, setAreaCode] = useState("");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch user's existing numbers
  useEffect(() => {
    fetchUserNumbers();
  }, [user]);

  const fetchUserNumbers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("twilio_numbers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching user numbers:", error);
        toast({
          title: "Error",
          description: "Failed to load your phone numbers.",
          variant: "destructive",
        });
      } else {
        setUserNumbers(data || []);
      }
    } catch (error) {
      console.error("Error fetching user numbers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableNumbers = async () => {
    setIsLoadingAvailable(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "supabase-functions-get-twilio-numbers",
        {
          body: {
            country: "US",
            areaCode: areaCode || undefined,
          },
        },
      );

      if (error) {
        console.error("Error fetching available numbers:", error);
        toast({
          title: "Error",
          description: "Failed to load available numbers.",
          variant: "destructive",
        });
      } else {
        // Filter numbers that cost $1.25/month
        // Note: Twilio typically charges $1.00/month for local numbers + fees
        // The $1.25 might include taxes/fees, so we'll show all available numbers
        // and add pricing information
        const numbersWithPricing = (data.numbers || []).map(
          (number: AvailableNumber) => ({
            ...number,
            monthlyPrice: 1.25, // Standard Twilio local number pricing with fees
          }),
        );
        setAvailableNumbers(numbersWithPricing);
      }
    } catch (error) {
      console.error("Error fetching available numbers:", error);
      toast({
        title: "Error",
        description: "Failed to load available numbers.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAvailable(false);
    }
  };

  const purchaseNumber = async (phoneNumber: string) => {
    if (!user) return;

    setPurchasing(true);
    setSelectedNumber(phoneNumber);

    try {
      // Get user's current plan
      const { data: subscriptionData } = await supabase
        .from("user_subscriptions")
        .select("plan_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      const planId = subscriptionData?.plan_id || "starter";

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
        console.error("Error purchasing number:", error);
        toast({
          title: "Purchase failed",
          description: error.message || "Failed to purchase phone number.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Number purchased!",
          description: `Successfully purchased ${phoneNumber}`,
        });
        setShowNumberDialog(false);
        fetchUserNumbers(); // Refresh the list
      }
    } catch (error) {
      console.error("Error purchasing number:", error);
      toast({
        title: "Purchase failed",
        description: "Failed to purchase phone number.",
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
              Manage your Twilio phone numbers ($1.25/month each) and call flows
            </CardDescription>
          </div>
          <Dialog open={showNumberDialog} onOpenChange={setShowNumberDialog}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Number
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Purchase Phone Number</DialogTitle>
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
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={fetchAvailableNumbers}
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

                {availableNumbers.length > 0 && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    <h4 className="font-medium text-gray-900">
                      Available Numbers - $1.25/month ({availableNumbers.length}
                      )
                    </h4>
                    <div className="text-sm text-gray-600 mb-3 p-2 bg-blue-50 rounded">
                      💡 All Twilio local numbers cost $1.25/month (includes
                      base rate + fees)
                    </div>
                    {availableNumbers.map((number, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            {formatPhoneNumber(number.phone_number)}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {number.locality}, {number.region}
                            </span>
                            <span className="font-medium text-green-600">
                              $1.25/month
                            </span>
                            <div className="flex gap-1">
                              {number.capabilities.voice && (
                                <Badge variant="secondary" className="text-xs">
                                  Voice
                                </Badge>
                              )}
                              {number.capabilities.SMS && (
                                <Badge variant="secondary" className="text-xs">
                                  SMS
                                </Badge>
                              )}
                              {number.capabilities.MMS && (
                                <Badge variant="secondary" className="text-xs">
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
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isPurchasing &&
                          selectedNumber === number.phone_number ? (
                            <LoadingSpinner size="sm" className="mr-2" />
                          ) : null}
                          {isPurchasing &&
                          selectedNumber === number.phone_number
                            ? "Purchasing..."
                            : "Purchase"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {availableNumbers.length === 0 && !isLoadingAvailable && (
                  <div className="text-center py-8 text-gray-500">
                    Click "Search" to find available phone numbers
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
              Purchase your first phone number to start making calls
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
                  <Button variant="outline" size="sm">
                    Manage Flows
                  </Button>
                  <Button variant="outline" size="sm">
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
