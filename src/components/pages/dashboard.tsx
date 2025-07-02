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
  const [customerPortalUrl, setCustomerPortalUrl] = useState<string | null>(
    null,
  );
  const [subscription, setSubscription] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaymentHistory = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setError(null);
        const { data, error: invokeError } = await supabase.functions.invoke(
          "supabase-functions-get-payment-history",
          {
            body: { userId: user.id },
          },
        );

        if (invokeError) {
          console.error("Function invoke error:", invokeError);
          setError("Failed to load payment history. Please try again later.");
          return;
        }

        if (data) {
          if (data.error) {
            setError(data.error);
          } else {
            setPayments(data.payments || []);
            setCustomerPortalUrl(data.customerPortalUrl);
            setSubscription(data.subscription);
          }
        }
      } catch (error) {
        console.error("Payment history error:", error);
        setError("An unexpected error occurred while loading payment history.");
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

  const downloadPdfStatement = async (payment: any) => {
    setDownloadingPdf(payment.id);
    try {
      // Generate PDF content
      const pdfContent = generatePdfStatement(payment);

      // Create blob and download
      const blob = new Blob([pdfContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `statement-${payment.id.slice(-8)}-${payment.date.replace(/\s/g, "-")}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading PDF:", error);
    } finally {
      setDownloadingPdf(null);
    }
  };

  const generatePdfStatement = (payment: any) => {
    const billingAddress = payment.customer_address;
    const addressHtml = billingAddress
      ? `
        <div class="address-section">
            <h3>Billing Address</h3>
            <div class="address">
                ${billingAddress.line1 || ""}<br>
                ${billingAddress.line2 ? billingAddress.line2 + "<br>" : ""}
                ${billingAddress.city || ""}, ${billingAddress.state || ""} ${billingAddress.postal_code || ""}<br>
                ${billingAddress.country || ""}
            </div>
        </div>
    `
      : "";

    const periodInfo =
      payment.period_start && payment.period_end
        ? `
        <div class="detail-row">
            <span class="detail-label">Service Period:</span>
            <span>${new Date(payment.period_start).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} - ${new Date(payment.period_end).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
    `
        : "";

    const taxInfo = payment.tax
      ? `
        <div class="detail-row">
            <span class="detail-label">Subtotal:</span>
            <span>${formatAmount(payment.subtotal || payment.amount, payment.currency)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Tax:</span>
            <span>${formatAmount(payment.tax, payment.currency)}</span>
        </div>
    `
      : "";

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Payment Statement - ${payment.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; line-height: 1.6; }
        .header { text-align: center; border-bottom: 2px solid #4F46E5; padding-bottom: 20px; margin-bottom: 30px; }
        .company-name { font-size: 28px; font-weight: bold; color: #4F46E5; margin-bottom: 5px; }
        .statement-title { font-size: 18px; color: #666; }
        .details { margin: 30px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #555; }
        .amount { font-size: 24px; font-weight: bold; color: #059669; }
        .status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
        .status-succeeded { background: #D1FAE5; color: #059669; }
        .status-pending { background: #FEF3C7; color: #D97706; }
        .status-failed { background: #FEE2E2; color: #DC2626; }
        .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
        .address-section { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .address-section h3 { margin: 0 0 10px 0; color: #4F46E5; }
        .address { color: #555; }
        .total-section { background: #f0f9ff; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">NumSphere</div>
        <div class="statement-title">Payment Statement</div>
    </div>
    
    ${addressHtml}
    
    <div class="details">
        <div class="detail-row">
            <span class="detail-label">Transaction ID:</span>
            <span>${payment.id}</span>
        </div>
        ${
          payment.invoice_number
            ? `
        <div class="detail-row">
            <span class="detail-label">Invoice Number:</span>
            <span>${payment.invoice_number}</span>
        </div>
        `
            : ""
        }
        <div class="detail-row">
            <span class="detail-label">Date:</span>
            <span>${payment.date}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Time:</span>
            <span>${payment.time}</span>
        </div>
        ${periodInfo}
        <div class="detail-row">
            <span class="detail-label">Description:</span>
            <span>${payment.description}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Payment Method:</span>
            <span>${payment.payment_method?.toUpperCase() || "CARD"}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="status status-${payment.status}">${payment.status.toUpperCase()}</span>
        </div>
    </div>
    
    <div class="total-section">
        ${taxInfo}
        <div class="detail-row" style="border-bottom: none; font-size: 18px;">
            <span class="detail-label">Total Amount:</span>
            <span class="amount">${formatAmount(payment.total || payment.amount, payment.currency)}</span>
        </div>
    </div>
    
    <div class="footer">
        <p><strong>This is an official payment statement from NumSphere.</strong></p>
        <p>Generated on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        <p>For questions about this statement, please contact support@numsphere.com</p>
    </div>
</body>
</html>
    `;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Subscription & Billing
          </h2>
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading payment history...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Subscription & Billing
          </h2>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md mx-auto">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/20"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Subscription & Billing
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your subscription, view payment history, and billing details.
        </p>
      </div>

      <div className="space-y-6">
        {/* Enhanced Subscription Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                <CheckCircle className="h-6 w-6 text-green-500" />
                Subscription Overview
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                Your current plan details and billing information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          Plan Details
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Plan:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {subscription.name ||
                                `${subscription.plan_id?.charAt(0).toUpperCase()}${subscription.plan_id?.slice(1)} Plan`}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Price:
                            </span>
                            <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                              {formatAmount(
                                subscription.amount,
                                subscription.currency,
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Billing:
                            </span>
                            <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                              {subscription.interval}ly
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          Status & Settings
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Status:
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                                subscription.status === "active"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                  : subscription.status === "trialing"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                              }`}
                            >
                              {subscription.status.charAt(0).toUpperCase() +
                                subscription.status.slice(1)}
                            </span>
                          </div>
                          {subscription.cancel_at_period_end && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Cancellation:
                              </span>
                              <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">
                                Ends at period end
                              </span>
                            </div>
                          )}
                          {subscription.trial_end &&
                            new Date(subscription.trial_end * 1000) >
                              new Date() && (
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  Trial ends:
                                </span>
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                  {new Date(
                                    subscription.trial_end * 1000,
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          Billing Period
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Current period:
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {new Date(
                                subscription.current_period_start * 1000,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              -{" "}
                              {new Date(
                                subscription.current_period_end * 1000,
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              Next billing:
                            </span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {subscription.cancel_at_period_end
                                ? "Subscription ending"
                                : new Date(
                                    subscription.current_period_end * 1000,
                                  ).toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          Quick Actions
                        </h4>
                        <div className="space-y-2">
                          {customerPortalUrl && (
                            <>
                              <Button
                                onClick={() =>
                                  window.open(customerPortalUrl, "_blank")
                                }
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm"
                                size="sm"
                              >
                                <CreditCard className="h-4 w-4 mr-2" />
                                Manage Billing
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() =>
                                  window.open(customerPortalUrl, "_blank")
                                }
                                className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20 text-sm"
                                size="sm"
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Update Payment
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No Active Subscription
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    You don't have an active subscription at the moment.
                  </p>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    View Plans
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                <CreditCard className="h-5 w-5 text-green-600" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {payments.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Total Transactions
                  </div>
                </div>

                {payments.length > 0 && (
                  <div className="space-y-3">
                    <div className="border-t border-green-200 dark:border-green-700 pt-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Last Payment
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatAmount(
                          payments[0]?.total || payments[0]?.amount || 0,
                          payments[0]?.currency || "usd",
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {payments[0]?.date ||
                          formatDate(payments[0]?.created || "")}
                      </div>
                    </div>

                    <div className="border-t border-green-200 dark:border-green-700 pt-3">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Payment Status
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payments[0]?.status || "unknown")}
                        <span className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">
                          {payments[0]?.status || "Unknown"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

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
                <CreditCard className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  No payment history found.
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Your payment transactions will appear here once you make your
                  first payment.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(payment.status)}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {payment.description || "Payment"}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Transaction ID: {payment.id.slice(-8)}
                          </p>
                          {payment.invoice_number && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Invoice: {payment.invoice_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                          {formatAmount(
                            payment.total || payment.amount,
                            payment.currency,
                          )}
                        </p>
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getStatusColor(payment.status)} dark:bg-opacity-20`}
                        >
                          {payment.status.charAt(0).toUpperCase() +
                            payment.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          Date:
                        </span>
                        <p>{payment.date || formatDate(payment.created)}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          Time:
                        </span>
                        <p>
                          {payment.time ||
                            new Date(payment.created).toLocaleTimeString(
                              "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                timeZoneName: "short",
                              },
                            )}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          Payment Method:
                        </span>
                        <p className="capitalize">
                          {payment.payment_method || "Card"}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          Type:
                        </span>
                        <p className="capitalize">
                          {payment.type === "invoice"
                            ? "Subscription"
                            : "One-time"}
                        </p>
                      </div>
                    </div>

                    {payment.period_start && payment.period_end && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <span className="font-medium">Service Period:</span>{" "}
                          {new Date(payment.period_start).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}{" "}
                          -{" "}
                          {new Date(payment.period_end).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </p>
                      </div>
                    )}

                    {payment.tax && (
                      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>
                            {formatAmount(
                              payment.subtotal || payment.amount,
                              payment.currency,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax:</span>
                          <span>
                            {formatAmount(payment.tax, payment.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between font-medium text-gray-900 dark:text-gray-100 border-t pt-1 mt-1">
                          <span>Total:</span>
                          <span>
                            {formatAmount(
                              payment.total || payment.amount,
                              payment.currency,
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      {payment.receipt_url && (
                        <Button
                          onClick={() =>
                            window.open(payment.receipt_url, "_blank")
                          }
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                        >
                          <svg
                            className="h-4 w-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          View Receipt
                        </Button>
                      )}
                      <Button
                        onClick={() => downloadPdfStatement(payment)}
                        disabled={downloadingPdf === payment.id}
                        variant="outline"
                        size="sm"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/20"
                      >
                        {downloadingPdf === payment.id ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <svg
                            className="h-4 w-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        )}
                        Download Statement
                      </Button>
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
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
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
                        onClick={() => setActiveTab("Subscription & Billing")}
                        variant="outline"
                        className="h-20 rounded-xl flex flex-col items-center justify-center gap-2 border-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                      >
                        <span className="text-2xl">💳</span>
                        <span className="font-medium">View Billing</span>
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

              {activeTab === "Subscription & Billing" && <PaymentHistory />}
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
