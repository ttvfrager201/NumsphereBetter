import { useState, useEffect } from "react";
import { useAuth } from "../../../supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Mail, Lock, Eye, EyeOff, Phone } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import OtpVerification from "./OtpVerification";

const testimonials = [
  {
    quote:
      "NumSphere transformed our customer service. The call flow designer is incredibly intuitive, and we've reduced wait times by 60%.",
    author: "Sarah Johnson",
    role: "CEO, TechStart Inc.",
    avatar: "Sarah",
  },
  {
    quote:
      "The setup was incredibly easy. Within 10 minutes, we had our virtual number running with custom call flows.",
    author: "Michael Chen",
    role: "Sales Director, GrowthCorp",
    avatar: "Michael",
  },
  {
    quote:
      "NumSphere's reliability is outstanding. 99.9% uptime means our business never stops.",
    author: "Emily Rodriguez",
    role: "Operations Manager, ServicePro",
    avatar: "Emily",
  },
  {
    quote:
      "The analytics dashboard gives us insights we never had before. We've optimized our entire call strategy.",
    author: "David Kim",
    role: "Marketing Director, InnovateCorp",
    avatar: "David",
  },
  {
    quote:
      "Customer support is phenomenal. They helped us migrate from our old system seamlessly.",
    author: "Lisa Thompson",
    role: "IT Manager, GlobalTech",
    avatar: "Lisa",
  },
  {
    quote:
      "The cost savings are remarkable. We're paying 40% less than our previous provider with better features.",
    author: "Robert Wilson",
    role: "CFO, StartupHub",
    avatar: "Robert",
  },
];

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const { signIn, signInWithFacebook, shouldSkipOtp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
        setIsAnimating(false);
      }, 300);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn(email, password);

      if (result.requiresOtp) {
        setShowOtpVerification(true);
        toast({
          title: "Verification required",
          description: "Please check your email for the verification code.",
        });
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully signed in to NumSphere.",
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      setError(error.message || "Failed to sign in");
      toast({
        title: "Sign in failed",
        description:
          error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    setShowOtpVerification(false);
  };

  const handleFacebookSignIn = async () => {
    try {
      await signInWithFacebook();
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description:
          error.message || "Failed to sign in with Facebook. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (showOtpVerification) {
    return (
      <OtpVerification
        email={email}
        type="signin"
        onBack={handleBackToSignIn}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
      {/* Left side - Testimonials */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-700 p-12 flex-col justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">NumSphere</h1>
            <p className="text-xl text-blue-100">Professional VoIP Solutions</p>
          </div>

          <div
            className={`transition-all duration-300 transform ${
              isAnimating
                ? "opacity-0 translate-y-4"
                : "opacity-100 translate-y-0"
            }`}
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 text-yellow-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-white text-lg mb-6 leading-relaxed">
                &quot;{testimonials[currentTestimonial].quote}&quot;
              </blockquote>
              <div className="flex items-center">
                <img
                  className="w-12 h-12 rounded-full mr-4"
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${testimonials[currentTestimonial].avatar}`}
                  alt={testimonials[currentTestimonial].author}
                />
                <div>
                  <div className="font-semibold text-white">
                    {testimonials[currentTestimonial].author}
                  </div>
                  <div className="text-blue-200 text-sm">
                    {testimonials[currentTestimonial].role}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-center mt-8 space-x-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentTestimonial(index)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  index === currentTestimonial ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
              <Phone className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome Back
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
                "Sign In"
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleFacebookSignIn}
              className="w-full h-12 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold transition-all duration-200"
            >
              <svg
                className="h-5 w-5 mr-2"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continue with Facebook
            </Button>

            <div className="text-center space-y-4">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
              >
                Forgot your password?
              </Link>
              <p className="text-sm text-gray-600">
                Don't have an account?{" "}
                <Link
                  to="/signup"
                  className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
