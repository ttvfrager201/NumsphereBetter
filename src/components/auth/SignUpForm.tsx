import { useState } from "react";
import { useAuth } from "../../../supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import AuthLayout from "./AuthLayout";
import { useToast } from "@/components/ui/use-toast";
import OtpVerification from "./OtpVerification";

export default function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [accountExistsError, setAccountExistsError] = useState("");
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthLabels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-blue-500",
    "bg-green-500",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setAccountExistsError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }

    try {
      const result = await signUp(email, password, fullName);

      if (result.error) {
        setAccountExistsError(result.error);
        setIsLoading(false);
        return;
      }

      if (result.needsOtp) {
        toast({
          title: "Verification code sent!",
          description: "Please check your email for the verification code.",
        });
        setShowOtpVerification(true);
      }
    } catch (error: any) {
      setError(error.message || "Error creating account");
      toast({
        title: "Sign up failed",
        description:
          "Please try again or contact support if the problem persists.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackFromOtp = () => {
    setShowOtpVerification(false);
  };

  if (showOtpVerification) {
    return (
      <OtpVerification email={email} type="signup" onBack={handleBackFromOtp} />
    );
  }

  return (
    <AuthLayout>
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl mb-4">
            <Phone className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Join NumSphere
          </h2>
          <p className="text-gray-600">Create your business VoIP account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label
              htmlFor="fullName"
              className="text-sm font-semibold text-gray-700"
            >
              Full Name
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="fullName"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 pl-10 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-sm font-semibold text-gray-700"
            >
              Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 pl-10 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-sm font-semibold text-gray-700"
            >
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-12 pl-10 pr-10 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">
                    Password strength
                  </span>
                  <span
                    className={`text-xs font-medium ${passwordStrength >= 3 ? "text-green-600" : passwordStrength >= 2 ? "text-yellow-600" : "text-red-600"}`}
                  >
                    {strengthLabels[passwordStrength - 1] || "Very Weak"}
                  </span>
                </div>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-2 flex-1 rounded-full transition-colors duration-200 ${
                        level <= passwordStrength
                          ? strengthColors[passwordStrength - 1] || "bg-red-500"
                          : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 space-y-1">
              <div
                className={`flex items-center text-xs ${password.length >= 8 ? "text-green-600" : "text-gray-400"}`}
              >
                <CheckCircle
                  className={`h-3 w-3 mr-2 ${password.length >= 8 ? "text-green-500" : "text-gray-300"}`}
                />
                At least 8 characters
              </div>
              <div
                className={`flex items-center text-xs ${/[A-Z]/.test(password) && /[a-z]/.test(password) ? "text-green-600" : "text-gray-400"}`}
              >
                <CheckCircle
                  className={`h-3 w-3 mr-2 ${/[A-Z]/.test(password) && /[a-z]/.test(password) ? "text-green-500" : "text-gray-300"}`}
                />
                Upper and lowercase letters
              </div>
              <div
                className={`flex items-center text-xs ${/[0-9]/.test(password) ? "text-green-600" : "text-gray-400"}`}
              >
                <CheckCircle
                  className={`h-3 w-3 mr-2 ${/[0-9]/.test(password) ? "text-green-500" : "text-gray-300"}`}
                />
                At least one number
              </div>
            </div>
          </div>

          {accountExistsError && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm text-amber-800 font-medium mb-2">
                    {accountExistsError}
                  </p>
                  <Link
                    to="/login"
                    className="text-sm text-amber-700 hover:text-amber-800 font-semibold underline"
                  >
                    Sign in to your existing account →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || passwordStrength < 2}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-green-600 to-blue-600 text-white hover:from-green-700 hover:to-blue-700 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-2" />
                Creating account...
              </div>
            ) : (
              "Create NumSphere Account"
            )}
          </Button>

          <div className="text-xs text-center text-gray-500 bg-gray-50 rounded-xl p-3">
            By creating an account, you agree to our{" "}
            <Link
              to="/terms"
              className="text-blue-600 hover:underline font-medium"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to="/privacy"
              className="text-blue-600 hover:underline font-medium"
            >
              Privacy Policy
            </Link>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">
                Already have an account?
              </span>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full h-12 rounded-xl border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 text-sm font-semibold transition-all duration-200"
            >
              Sign in to your account
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
