import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useNavigate } from "react-router-dom";
import type { MobileOtpType } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  hasCompletedPayment: boolean;
  checkPaymentStatus: () => Promise<boolean>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ needsOtp: boolean; error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ needsOtp: boolean; error?: string }>;
  verifyOtp: (
    email: string,
    token: string,
    type: "signup" | "email",
  ) => Promise<void>;
  resendOtp: (email: string, type: "signup" | "email") => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedPayment, setHasCompletedPayment] = useState(false);

  const checkPaymentStatus = async (): Promise<boolean> => {
    if (!user) {
      setHasCompletedPayment(false);
      return false;
    }

    try {
      console.log("Checking payment status for user:", user.id);

      // Check both user payment status and active subscription
      const [userResult, subscriptionResult] = await Promise.all([
        supabase
          .from("users")
          .select("has_completed_payment")
          .eq("id", user.id)
          .single(),
        supabase
          .from("user_subscriptions")
          .select("status, stripe_subscription_id, plan_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

      const { data: userData, error: userError } = userResult;
      const { data: subscriptionData, error: subscriptionError } =
        subscriptionResult;

      // Log errors but don't fail if records don't exist
      if (userError && userError.code !== "PGRST116") {
        console.error("Error checking user payment status:", userError);
      }

      if (subscriptionError && subscriptionError.code !== "PGRST116") {
        console.error("Error checking subscription status:", subscriptionError);
      }

      // User has completed payment if either:
      // 1. has_completed_payment is true in users table, OR
      // 2. has an active subscription (not canceled)
      const hasPayment = userData?.has_completed_payment || false;
      const hasActiveSubscription = subscriptionData?.status === "active";
      const isCanceled = subscriptionData?.status === "canceled";

      // Only consider payment incomplete if subscription is explicitly canceled
      // Otherwise, if they have payment record OR active subscription, they're good
      const completed = (hasPayment || hasActiveSubscription) && !isCanceled;

      console.log("Payment status check result:", {
        userId: user.id,
        hasPayment,
        hasActiveSubscription,
        isCanceled,
        completed,
        userData,
        subscriptionData,
      });

      // Set payment status based on actual data
      setHasCompletedPayment(completed);
      return completed;
    } catch (error) {
      console.error("Error checking payment status:", error);
      // On error, be more lenient - assume payment is complete to avoid disruption
      // Only redirect to payment if we're certain they haven't paid
      const fallbackStatus = hasCompletedPayment || true;
      setHasCompletedPayment(fallbackStatus);
      return fallbackStatus;
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log("Initial session check:", session?.user?.id);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Add a small delay to ensure database is ready
        setTimeout(async () => {
          await checkPaymentStatus();
        }, 100);
      } else {
        setHasCompletedPayment(false);
      }
      setLoading(false);
    });

    // Listen for changes on auth state (signed in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event, session?.user?.id);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Add a small delay to ensure database is ready
        setTimeout(async () => {
          await checkPaymentStatus();
        }, 100);
      } else {
        setHasCompletedPayment(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      // Try to sign up the user directly without checking existing user first
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: undefined, // Prevent magic link
        },
      });

      if (signUpError) {
        if (
          signUpError.message.includes("already registered") ||
          signUpError.message.includes("already exists") ||
          signUpError.message.includes("User already registered")
        ) {
          return {
            needsOtp: false,
            error:
              "An account with this email already exists. Please sign in instead.",
          };
        }

        // Handle rate limit errors gracefully - don't throw, just return error
        if (
          signUpError.message.includes("rate") ||
          signUpError.message.includes("too many") ||
          signUpError.message.includes("exceeded") ||
          signUpError.message.includes("Email rate limit exceeded")
        ) {
          return {
            needsOtp: false,
            error:
              "Please wait a moment before trying again. Email service is temporarily busy.",
          };
        }

        // For other errors, return them instead of throwing
        return {
          needsOtp: false,
          error: signUpError.message || "Error creating account",
        };
      }

      return { needsOtp: true };
    } catch (error: any) {
      // Catch any unexpected errors and handle rate limits
      if (
        error.message?.includes("rate") ||
        error.message?.includes("too many") ||
        error.message?.includes("exceeded") ||
        error.message?.includes("Email rate limit exceeded")
      ) {
        return {
          needsOtp: false,
          error:
            "Please wait a moment before trying again. Email service is temporarily busy.",
        };
      }

      return {
        needsOtp: false,
        error: error.message || "Error creating account",
      };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // First try to sign in with password to validate credentials
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Handle rate limit errors gracefully
        if (
          error.message.includes("rate") ||
          error.message.includes("too many") ||
          error.message.includes("exceeded") ||
          error.message.includes("Email rate limit exceeded")
        ) {
          throw new Error(
            "Please wait a moment before trying again. Email service is temporarily busy.",
          );
        }

        if (error.message.includes("Email not confirmed")) {
          // Send OTP for email verification with rate limit handling
          try {
            const { error: otpError } = await supabase.auth.signInWithOtp({
              email: email,
              options: {
                shouldCreateUser: false,
                emailRedirectTo: undefined, // Prevent magic link
              },
            });
            if (otpError) {
              if (
                otpError.message.includes("rate") ||
                otpError.message.includes("too many") ||
                otpError.message.includes("exceeded") ||
                otpError.message.includes("Email rate limit exceeded")
              ) {
                throw new Error(
                  "Please wait a moment before trying again. Email service is temporarily busy.",
                );
              }
              throw otpError;
            }
            return { needsOtp: true };
          } catch (otpError: any) {
            if (
              otpError.message?.includes("rate") ||
              otpError.message?.includes("too many") ||
              otpError.message?.includes("exceeded") ||
              otpError.message?.includes("Email rate limit exceeded")
            ) {
              throw new Error(
                "Please wait a moment before trying again. Email service is temporarily busy.",
              );
            }
            throw otpError;
          }
        }
        throw error;
      }

      // For existing confirmed users, sign them out and require OTP verification
      await supabase.auth.signOut();
      try {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: undefined, // Prevent magic link
          },
        });

        if (otpError) {
          if (
            otpError.message.includes("rate") ||
            otpError.message.includes("too many") ||
            otpError.message.includes("exceeded") ||
            otpError.message.includes("Email rate limit exceeded")
          ) {
            throw new Error(
              "Please wait a moment before trying again. Email service is temporarily busy.",
            );
          }
          throw otpError;
        }

        return { needsOtp: true };
      } catch (otpError: any) {
        if (
          otpError.message?.includes("rate") ||
          otpError.message?.includes("too many") ||
          otpError.message?.includes("exceeded") ||
          otpError.message?.includes("Email rate limit exceeded")
        ) {
          throw new Error(
            "Please wait a moment before trying again. Email service is temporarily busy.",
          );
        }
        throw otpError;
      }
    } catch (error: any) {
      // Final catch for any unexpected rate limit errors
      if (
        error.message?.includes("rate") ||
        error.message?.includes("too many") ||
        error.message?.includes("exceeded") ||
        error.message?.includes("Email rate limit exceeded")
      ) {
        throw new Error(
          "Please wait a moment before trying again. Email service is temporarily busy.",
        );
      }
      throw error;
    }
  };

  type OtpType = "signup" | "email" | "email_change" | MobileOtpType;

  const verifyOtp = async (
    email: string,
    token: string,
    type: "signup" | "email",
  ) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: type as OtpType, // <--- CAST HERE
    });
    if (error) throw error;
  };

  const resendOtp = async (email: string, type: "signup" | "email") => {
    const { error } = await supabase.auth.resend({
      type: type as OtpType, // <--- CAST HERE
      email,
      options: {
        emailRedirectTo: undefined,
      },
    });
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    // Simply send the reset password email without validation
    // Supabase will handle the email existence check internally
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      // If the error is about user not found, provide a user-friendly message
      if (
        error.message.includes("User not found") ||
        error.message.includes("not found")
      ) {
        throw new Error("No account found with this email address.");
      }
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        hasCompletedPayment,
        checkPaymentStatus,
        signIn,
        signUp,
        verifyOtp,
        resendOtp,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
