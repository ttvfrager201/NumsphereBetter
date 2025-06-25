import { useState, useEffect } from "react";
import { useAuth } from "../../../supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Mail, Phone, ArrowLeft, CheckCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const testimonials = [
  {
    quote:
      "NumSphere's password recovery is as smooth as their service. Got back into my account in minutes.",
    author: "Kevin Park",
    role: "IT Administrator, SecureTech",
    avatar: "Kevin",
  },
  {
    quote:
      "The security features give me peace of mind. NumSphere takes data protection seriously.",
    author: "Amanda Foster",
    role: "Security Officer, DataSafe",
    avatar: "Amanda",
  },
  {
    quote:
      "Even password recovery is designed with user experience in mind. Everything just works.",
    author: "Ryan Cooper",
    role: "UX Director, DesignFlow",
    avatar: "Ryan",
  },
  {
    quote:
      "Quick, secure, and reliable. NumSphere's attention to detail shows in every feature.",
    author: "Sophie Chen",
    role: "Product Manager, InnovateLab",
    avatar: "Sophie",
  },
];

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const { resetPassword } = useAuth();
  const { toast } = useToast();

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
      console.log(
        "[ForgotPassword] Starting password reset process for:",
        email,
      );
      const startTime = Date.now();

      await resetPassword(email);

      const endTime = Date.now();
      console.log(
        `[ForgotPassword] Password reset completed in ${endTime - startTime}ms`,
      );

      setEmailSent(true);
      toast({
        title: "Reset link sent!",
        description: "Please check your email for the password reset link.",
      });
    } catch (error: any) {
      console.error("[ForgotPassword] Password reset error:", error);
      setError(error.message || "Failed to send reset email");
      toast({
        title: "Failed to send reset email",
        description: "Please check your email address and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex">
        {/* Left side - Testimonials */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 to-blue-700 p-12 flex-col justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-white mb-4">NumSphere</h1>
              <p className="text-xl text-purple-100">Secure & Reliable</p>
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
                    <div className="text-purple-200 text-sm">
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

        {/* Right side - Success Message */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl mb-4">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Check your email
              </h2>
              <p className="text-gray-600">
                We've sent a password reset link to{" "}
                <span className="font-semibold text-gray-900">{email}</span>
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>Next steps:</strong>
                  <br />• Check your email inbox (and spam folder)
                  <br />• Click the reset link in the email
                  <br />• Create a new password
                </p>
              </div>

              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center w-full h-12 rounded-xl border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 text-sm font-semibold transition-all duration-200"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex">
      {/* Left side - Testimonials */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 to-blue-700 p-12 flex-col justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">NumSphere</h1>
            <p className="text-xl text-purple-100">Secure & Reliable</p>
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
                  <div className="text-purple-200 text-sm">
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

      {/* Right side - Reset Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl mb-4">
              <Phone className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Reset your password
            </h2>
            <p className="text-gray-600">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
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
                  className="h-12 pl-10 rounded-xl border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
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
              className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  Sending reset link...
                </div>
              ) : (
                "Send reset link"
              )}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center text-sm font-medium text-purple-600 hover:text-purple-500 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
