import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  User,
  Calendar,
  Play,
  Download,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../../supabase/auth";
import { supabase } from "../../../supabase/supabase";
import { useToast } from "@/components/ui/use-toast";

interface CallLog {
  id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  direction: string;
  call_status: string;
  call_duration: number | null;
  call_minutes: number | null;
  started_at: string | null;
  ended_at: string | null;
  recording_url: string | null;
  transcription: string | null;
  created_at: string;
  twilio_numbers?: {
    phone_number: string;
    friendly_name: string | null;
  };
}

interface CallLogsProps {
  phoneNumber?: string;
}

export default function CallLogs({ phoneNumber }: CallLogsProps = {}) {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchCallLogs();
  }, [user, phoneNumber]);

  const fetchCallLogs = async (showRefreshIndicator = false) => {
    if (!user) return;

    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      if (phoneNumber) {
        // Fetch call logs from Twilio for specific phone number
        console.log(`Fetching call logs for phone number: ${phoneNumber}`);

        const { data: twilioData, error: twilioError } =
          await supabase.functions.invoke(
            "supabase-functions-get-twilio-call-logs",
            {
              body: {
                phoneNumber: phoneNumber,
                userId: user.id,
                limit: 100,
              },
            },
          );

        console.log("Twilio function response:", {
          data: twilioData,
          error: twilioError,
          hasData: !!twilioData,
          hasError: !!twilioError,
        });

        if (twilioError) {
          console.error("Error fetching Twilio call logs:", twilioError);
          toast({
            title: "Error",
            description:
              twilioError.message ||
              "Failed to load call logs from Twilio. Please check your Twilio credentials.",
            variant: "destructive",
          });
          setCallLogs([]);
          return;
        }

        if (!twilioData) {
          console.warn("No data returned from Twilio function");
          toast({
            title: "Warning",
            description:
              "No call logs data returned. This might be normal if you haven't made any calls yet.",
            variant: "default",
          });
          setCallLogs([]);
          return;
        }

        // Remove demo mode notification to hide Twilio references
        // if (twilioData.demo_mode) {
        //   toast({
        //     title: "Demo Mode",
        //     description:
        //       twilioData.message ||
        //       "Showing sample data. Configure credentials for real call logs.",
        //     variant: "default",
        //   });
        // }

        // Transform Twilio data to match our interface with exact seconds
        const transformedLogs = (twilioData?.calls || []).map((call: any) => {
          const exactSeconds =
            call.exact_seconds || (call.duration ? parseInt(call.duration) : 0);
          const billingMinutes =
            call.billing_minutes ||
            (exactSeconds > 0 ? Math.ceil(exactSeconds / 60) : 0);

          return {
            id: call.sid,
            call_sid: call.sid,
            from_number: call.from,
            to_number: call.to,
            direction: call.direction === "inbound" ? "inbound" : "outbound",
            call_status: call.status,
            call_duration: exactSeconds, // Exact seconds for precise billing
            call_minutes: billingMinutes, // Rounded up minutes for billing
            started_at: call.start_time,
            ended_at: call.end_time,
            recording_url: null, // Twilio recordings would need separate API call
            transcription: null,
            created_at: call.start_time,
          };
        });

        console.log(
          "Transformed call logs with exact billing:",
          transformedLogs.map((log) => ({
            sid: log.call_sid,
            exactSeconds: log.call_duration,
            billingMinutes: log.call_minutes,
            duration: `${Math.floor(log.call_duration / 60)}:${(log.call_duration % 60).toString().padStart(2, "0")}`,
          })),
        );

        setCallLogs(transformedLogs);
        console.log(
          `Loaded ${transformedLogs.length} call logs from Twilio for ${phoneNumber}`,
        );
      } else {
        // Get call logs filtered by user's subscribed numbers
        console.log(
          "Fetching call logs for user's subscribed numbers:",
          user.id,
        );

        const { data: callLogsData, error: callLogsError } =
          await supabase.functions.invoke(
            "supabase-functions-get-twilio-call-logs",
            {
              body: {
                userId: user.id,
                limit: 100,
                filterByUserNumbers: true,
              },
            },
          );

        console.log("Call logs function response:", {
          data: callLogsData,
          error: callLogsError,
          hasData: !!callLogsData,
          hasError: !!callLogsError,
        });

        if (callLogsError) {
          console.error("Error fetching call logs:", callLogsError);
          toast({
            title: "Error",
            description:
              callLogsError.message ||
              "Failed to load call logs. Please try again.",
            variant: "destructive",
          });
          setCallLogs([]);
          return;
        }

        if (!callLogsData) {
          console.warn("No data returned from call logs function");
          setCallLogs([]);
          return;
        }

        // Transform the data to match our interface with exact seconds
        const transformedLogs = (callLogsData?.calls || []).map((call: any) => {
          const exactSeconds =
            call.exact_seconds || (call.duration ? parseInt(call.duration) : 0);
          const billingMinutes =
            call.billing_minutes ||
            (exactSeconds > 0 ? Math.ceil(exactSeconds / 60) : 0);

          return {
            id: call.sid,
            call_sid: call.sid,
            from_number: call.from,
            to_number: call.to,
            direction: call.direction === "inbound" ? "inbound" : "outbound",
            call_status: call.status,
            call_duration: exactSeconds, // Store exact seconds for accurate usage tracking
            call_minutes: billingMinutes, // Billing minutes (rounded up)
            started_at: call.start_time,
            ended_at: call.end_time,
            recording_url: null,
            transcription: null,
            created_at: call.start_time,
          };
        });

        console.log(
          "Transformed call logs from database with exact billing:",
          transformedLogs.map((log) => ({
            sid: log.call_sid,
            exactSeconds: log.call_duration,
            billingMinutes: log.call_minutes,
            duration: `${Math.floor(log.call_duration / 60)}:${(log.call_duration % 60).toString().padStart(2, "0")}`,
          })),
        );

        setCallLogs(transformedLogs);
        console.log(`Loaded ${transformedLogs.length} call logs from function`);

        // Remove demo mode notification to hide Twilio references
        // if (callLogsData.demo_mode) {
        //   toast({
        //     title: "Demo Mode",
        //     description:
        //       callLogsData.message ||
        //       "Showing sample data for your subscribed number. Configure credentials for real call logs.",
        //     variant: "default",
        //   });
        // }

        // Show info about filtered numbers
        if (
          callLogsData.filtered_by_user_numbers &&
          callLogsData.filtered_by_user_numbers.length > 0
        ) {
          console.log(
            "Call logs filtered by user numbers:",
            callLogsData.filtered_by_user_numbers,
          );
        }
      }
    } catch (error) {
      console.error("Error fetching call logs:", error);
      toast({
        title: "Error",
        description: "Failed to load call logs. Please try again.",
        variant: "destructive",
      });
      setCallLogs([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
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

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0s";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "busy":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "no-answer":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      case "in-progress":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction?.toLowerCase()) {
      case "inbound":
        return <PhoneIncoming className="h-4 w-4 text-green-600" />;
      case "outbound":
        return <PhoneOutgoing className="h-4 w-4 text-blue-600" />;
      default:
        return <Phone className="h-4 w-4 text-gray-600" />;
    }
  };

  const handlePlayRecording = (recordingUrl: string) => {
    window.open(recordingUrl, "_blank");
  };

  const handleDownloadRecording = (recordingUrl: string, callSid: string) => {
    const link = document.createElement("a");
    link.href = recordingUrl;
    link.download = `recording-${callSid}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Call Logs {phoneNumber && `- ${formatPhoneNumber(phoneNumber)}`}
          </CardTitle>
          <CardDescription>
            {phoneNumber
              ? `Loading call history from Twilio for ${formatPhoneNumber(phoneNumber)}`
              : "View your call history and recordings"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" text="Loading call logs..." />
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
              <PhoneCall className="h-5 w-5" />
              Call Logs {phoneNumber && `- ${formatPhoneNumber(phoneNumber)}`}
            </CardTitle>
            <CardDescription>
              {phoneNumber
                ? `Call history from Twilio for ${formatPhoneNumber(phoneNumber)}`
                : "View your call history, duration, and recordings"}
            </CardDescription>
          </div>
          <Button
            onClick={() => fetchCallLogs(true)}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {callLogs.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-8 border border-blue-100">
              <PhoneCall className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                📞 No Call Logs Yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Your call history will appear here once you start receiving or
                making calls through your phone numbers. Make sure you have
                active phone numbers and call flows configured.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Configure your phone service
                  credentials in the project settings to see real call logs from
                  your phone numbers.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">
                    Total Calls
                  </span>
                </div>
                <div className="text-2xl font-bold text-blue-800 mt-1">
                  {callLogs.length}
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center gap-2">
                  <PhoneIncoming className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-900">Inbound</span>
                </div>
                <div className="text-2xl font-bold text-green-800 mt-1">
                  {callLogs.filter((log) => log.direction === "inbound").length}
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2">
                  <PhoneOutgoing className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold text-purple-900">
                    Outbound
                  </span>
                </div>
                <div className="text-2xl font-bold text-purple-800 mt-1">
                  {
                    callLogs.filter((log) => log.direction === "outbound")
                      .length
                  }
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <span className="font-semibold text-orange-900">
                    Total Usage
                  </span>
                </div>
                <div className="text-2xl font-bold text-orange-800 mt-1">
                  {(
                    callLogs.reduce(
                      (sum, log) => sum + (log.call_duration || 0),
                      0,
                    ) / 60
                  ).toFixed(2)}{" "}
                  min
                </div>
                <div className="text-xs text-orange-600 mt-1">
                  (
                  {callLogs.reduce(
                    (sum, log) => sum + (log.call_duration || 0),
                    0,
                  )}{" "}
                  seconds exact)
                </div>
              </div>
            </div>

            {/* Call Logs Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-12">Type</TableHead>
                    <TableHead>Caller ID</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {callLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center justify-center">
                          {getDirectionIcon(log.direction)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {log.direction === "inbound"
                              ? formatPhoneNumber(log.from_number)
                              : formatPhoneNumber(log.to_number)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">
                          {log.twilio_numbers?.friendly_name ||
                            formatPhoneNumber(
                              log.direction === "inbound"
                                ? log.to_number
                                : log.from_number,
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <div className="flex flex-col">
                            <span className="font-mono text-sm font-semibold text-gray-900">
                              {log.call_duration
                                ? `${log.call_duration}s`
                                : "0s"}
                            </span>
                            <span className="text-xs text-gray-500">
                              {log.call_duration
                                ? `${Math.floor(log.call_duration / 60)}:${(log.call_duration % 60).toString().padStart(2, "0")}`
                                : "0:00"}
                            </span>
                            <span className="text-xs text-blue-600 font-medium">
                              Exact: {(log.call_duration / 60).toFixed(2)} min
                            </span>
                            <span className="text-xs text-green-600 font-medium">
                              Billing: {Math.ceil(log.call_duration / 60)} min
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getStatusColor(log.call_status)}`}
                        >
                          {log.call_status || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {log.recording_url && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handlePlayRecording(log.recording_url!)
                                }
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Play Recording"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleDownloadRecording(
                                    log.recording_url!,
                                    log.call_sid,
                                  )
                                }
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Download Recording"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {log.transcription && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 text-xs"
                              title={`Transcription: ${log.transcription}`}
                            >
                              📝
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
