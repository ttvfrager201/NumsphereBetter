import { useState } from "react";
import { useAuth } from "../../../supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate, Link } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Eye, EyeOff, Mail, Lock, Phone } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { useToast } from "@/components/ui/use-toast";
import OtpVerification from "./OtpVerification";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn(email, password);

      if (result.needsOtp) {
        toast({
          title: "Verification code sent!",
          description: "Please check your email for the verification code.",
        });
        setShowOtpVerification(true);
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in to NumSphere.",
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      setError(error.message || "Invalid email or password");
      toast({
        title: "Sign in failed",
        description: "Please check your credentials and try again.",
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
      <OtpVerification email={email} type="email" onBack={handleBackFromOtp} />
    );
  }

  return (
    <AuthLayout>
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
            <Phone className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back
          </h2>
          <p className="text-gray-600">Sign in to your NumSphere account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
            <div className="flex items-center justify-between">
              <Label
                htmlFor="password"
                className="text-sm font-semibold text-gray-700"
              >
                Password
              </Label>
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
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
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            {isLoading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-2" />
                Signing in...
              </div>
            ) : (
              "Sign in to NumSphere"
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">
                New to NumSphere?
              </span>
            </div>
          </div>

          <div className="text-center">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center w-full h-12 rounded-xl border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 text-sm font-semibold transition-all duration-200"
            >
              Create your account
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
