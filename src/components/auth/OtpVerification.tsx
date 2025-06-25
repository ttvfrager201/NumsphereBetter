import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Mail, RefreshCw, Phone } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "../../../supabase/auth";
import { useNavigate } from "react-router-dom";

interface OtpVerificationProps {
  email: string;
  type: "signup" | "email";
  onBack: () => void;
}

export default function OtpVerification({
  email,
  type,
  onBack,
}: OtpVerificationProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Start with ability to resend immediately
    setCanResend(true);
    setCountdown(0);
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !canResend) {
      setCanResend(true);
    }
  }, [countdown, canResend]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join("");

    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await verifyOtp(email, otpCode, type);
      toast({
        title: "Verification successful!",
        description:
          type === "signup"
            ? "Welcome to NumSphere! Please select your plan."
            : "Welcome back to NumSphere!",
      });

      // Always redirect to plan selection for new users, dashboard for existing users
      if (type === "signup") {
        navigate("/plan-selection");
      } else {
        // For existing users, check if they have a plan selected
        // For now, redirect to dashboard - you can add plan checking logic here
        navigate("/dashboard");
      }
    } catch (error: any) {
      setError(error.message || "Invalid verification code");
      toast({
        title: "Verification failed",
        description: "Please check your code and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    setError("");
    setCanResend(false);

    try {
      await resendOtp(email, type);
      setCountdown(30); // Shorter cooldown
      toast({
        title: "Code resent!",
        description: "A new verification code has been sent to your email.",
      });
    } catch (error: any) {
      console.error("Resend OTP error:", error);
      setError(error.message || "Failed to resend code");
      setCanResend(true);
      toast({
        title: "Resend failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Verify Your Email
          </h2>
          <p className="text-gray-600">
            We've sent a 6-digit code to
            <br />
            <span className="font-semibold text-gray-900">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">
              Verification Code
            </Label>
            <div className="flex justify-center space-x-2">
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={isLoading}
                  className="w-12 h-12 text-center text-lg font-semibold rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || otp.join("").length !== 6}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-2" />
                Verifying...
              </div>
            ) : (
              "Verify Code"
            )}
          </Button>

          <div className="text-center space-y-4">
            <p className="text-sm text-gray-500">Didn't receive the code?</p>

            <Button
              type="button"
              variant="ghost"
              onClick={handleResend}
              disabled={isResending || !canResend || countdown > 0}
              className="text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-50"
            >
              {isResending ? (
                <div className="flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Resending...
                </div>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                "Resend Code"
              )}
            </Button>
          </div>

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              className="text-gray-600 hover:text-gray-700 font-semibold"
            >
              ← Back to {type === "signup" ? "Sign Up" : "Sign In"}
            </Button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
