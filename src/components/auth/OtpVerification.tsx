import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, RefreshCw, Phone, Shield } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "../../../supabase/auth";
import { useNavigate } from "react-router-dom";

interface OtpVerificationProps {
  email: string;
  type: "signup" | "email" | "signin" | "password_reset";
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
  const [rememberDevice, setRememberDevice] = useState(false);
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

  // Generate a unique device identifier
  const generateDeviceId = () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx!.textBaseline = "top";
    ctx!.font = "14px Arial";
    ctx!.fillText("Device fingerprint", 2, 2);

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join("|");

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
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
      // Use different verification type for password reset
      const verifyType = type === "password_reset" ? "email" : type;
      await verifyOtp(email, otpCode, verifyType, rememberDevice);

      // Store device trust if user opted to remember (not for password reset)
      if (rememberDevice && type !== "password_reset") {
        const deviceId = generateDeviceId();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        localStorage.setItem(
          "trusted_device",
          JSON.stringify({
            deviceId,
            email,
            expiryDate: expiryDate.toISOString(),
            createdAt: new Date().toISOString(),
          }),
        );

        toast({
          title: "Device remembered!",
          description:
            "You won't need to verify OTP on this device for 30 days.",
        });
      }

      toast({
        title: "Verification successful!",
        description:
          type === "signup"
            ? "Welcome to NumSphere! Please select your plan."
            : type === "signin"
              ? "Welcome back! Device verified successfully."
              : type === "password_reset"
                ? "Email verified! You can now reset your password."
                : "Welcome back to NumSphere!",
      });

      // Redirect based on verification type
      if (type === "signup") {
        navigate("/plan-selection");
      } else if (type === "signin") {
        navigate("/dashboard");
      } else if (type === "password_reset") {
        // For password reset, go to reset password form
        navigate("/reset-password");
      } else {
        // For existing users (email change), go to dashboard
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
            {type === "signin"
              ? "Device Verification"
              : type === "password_reset"
                ? "Reset Password Verification"
                : "Verify Your Email"}
          </h2>
          <p className="text-gray-600">
            {type === "signin"
              ? "For security, we've sent a verification code to"
              : type === "password_reset"
                ? "We've sent a password reset code to"
                : "We've sent a 6-digit code to"}
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

          {(type === "signin" || type === "signup") &&
            type !== "password_reset" && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <Checkbox
                    id="remember-device"
                    checked={rememberDevice}
                    onCheckedChange={(checked) =>
                      setRememberDevice(checked as boolean)
                    }
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <Label
                      htmlFor="remember-device"
                      className="text-sm font-medium text-blue-900 cursor-pointer"
                    >
                      Remember this device for 30 days
                    </Label>
                  </div>
                </div>
                <p className="text-xs text-gray-500 px-1">
                  {rememberDevice
                    ? "You won't need to enter OTP codes on this device for the next 30 days."
                    : "Check the box above to skip OTP verification on this device for 30 days."}
                </p>
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
              ← Back to{" "}
              {type === "signup"
                ? "Sign Up"
                : type === "password_reset"
                  ? "Password Reset"
                  : "Sign In"}
            </Button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
