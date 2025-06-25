import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  hasCompletedPayment: boolean;
  checkPaymentStatus: () => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithFacebook: () => Promise<void>;
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
    console.log("Sign up successful, user needs to verify email:", data);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signInWithFacebook = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) throw error;
    console.log("Facebook OAuth initiated:", data);
  };

  const verifyOtp = async (
    email: string,
    token: string,
    type: "signup" | "email",
  ) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    if (error) throw error;
  };

  const resendOtp = async (email: string, type: "signup" | "email") => {
    const { data, error } = await supabase.auth.resend({
      type,
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
    console.log("OTP resent successfully:", data);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
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
        signUp,
        signIn,
        signInWithFacebook,
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
