import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  hasCompletedPayment: boolean;
  requiresOtpVerification: boolean;
  checkPaymentStatus: () => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ requiresOtp: boolean }>;
  signInWithFacebook: () => Promise<void>;
  verifyOtp: (
    email: string,
    token: string,
    type: "signup" | "email" | "signin",
    rememberDevice?: boolean,
  ) => Promise<void>;
  isDeviceTrusted: (email: string) => boolean;
  shouldSkipOtp: (email: string) => boolean;
  resendOtp: (
    email: string,
    type: "signup" | "email" | "signin",
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  generateDeviceFingerprint: () => string;
  checkDeviceStatus: (email: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedPayment, setHasCompletedPayment] = useState(false);
  const [requiresOtpVerification, setRequiresOtpVerification] = useState(false);

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

  const generateDeviceFingerprint = (): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("Device fingerprint", 2, 2);
    }

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

  const checkDeviceStatus = async (email: string): Promise<boolean> => {
    try {
      const deviceFingerprint = generateDeviceFingerprint();

      // Get user by email first
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, requires_otp_verification, last_otp_verification")
        .eq("email", email)
        .single();

      if (userError || !userData) {
        console.log("User not found, will require OTP");
        return true; // Require OTP for unknown users
      }

      // Check if this is the user's first login (requires OTP)
      if (!userData.last_otp_verification) {
        console.log("First time login, requires OTP");
        return true;
      }

      // Check if device is trusted
      const { data: deviceData, error: deviceError } = await supabase
        .from("user_devices")
        .select("is_trusted, expires_at")
        .eq("user_id", userData.id)
        .eq("device_fingerprint", deviceFingerprint)
        .eq("is_trusted", true)
        .single();

      if (deviceError || !deviceData) {
        console.log("New device, requires OTP");
        return true; // New device, require OTP
      }

      // Check if device trust has expired
      const now = new Date();
      const expiresAt = new Date(deviceData.expires_at);

      if (now > expiresAt) {
        console.log("Device trust expired, requires OTP");
        // Remove expired device trust
        await supabase
          .from("user_devices")
          .delete()
          .eq("user_id", userData.id)
          .eq("device_fingerprint", deviceFingerprint);
        return true;
      }

      console.log("Device is trusted, skipping OTP");
      return false; // Device is trusted, skip OTP
    } catch (error) {
      console.error("Error checking device status:", error);
      return true; // On error, require OTP for security
    }
  };

  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ requiresOtp: boolean }> => {
    // First check if this device/user combination requires OTP
    const requiresOtp = await checkDeviceStatus(email);

    if (requiresOtp) {
      // Send OTP but don't complete sign in yet
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpError) {
        // If OTP fails, try regular password sign in (might be wrong email)
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        return { requiresOtp: false };
      }

      setRequiresOtpVerification(true);
      return { requiresOtp: true };
    } else {
      // Device is trusted, proceed with normal sign in
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { requiresOtp: false };
    }
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
    type: "signup" | "email" | "signin",
    rememberDevice?: boolean,
  ) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: type === "signin" ? "email" : type,
    });
    if (error) throw error;

    // If device should be remembered, store device info
    if (rememberDevice && data.user) {
      const deviceFingerprint = generateDeviceFingerprint();
      const deviceName = `${navigator.platform} - ${navigator.userAgent.split(" ").slice(-2).join(" ")}`;

      try {
        // Store trusted device
        await supabase.from("user_devices").upsert(
          {
            user_id: data.user.id,
            device_fingerprint: deviceFingerprint,
            device_name: deviceName,
            is_trusted: true,
            last_login: new Date().toISOString(),
            expires_at: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(), // 30 days
          },
          {
            onConflict: "user_id,device_fingerprint",
          },
        );

        // Update user's last OTP verification
        await supabase
          .from("users")
          .update({
            last_otp_verification: new Date().toISOString(),
            requires_otp_verification: false,
          })
          .eq("id", data.user.id);
      } catch (dbError) {
        console.error("Error storing device trust:", dbError);
      }
    }

    setRequiresOtpVerification(false);
    console.log("OTP verified successfully", { rememberDevice });
  };

  const isDeviceTrusted = (email: string): boolean => {
    try {
      const trustedDevice = localStorage.getItem("trusted_device");
      if (!trustedDevice) return false;

      const deviceData = JSON.parse(trustedDevice);
      const now = new Date();
      const expiryDate = new Date(deviceData.expiryDate);

      // Check if device trust has expired
      if (now > expiryDate) {
        localStorage.removeItem("trusted_device");
        return false;
      }

      // Check if email matches
      return deviceData.email === email;
    } catch (error) {
      console.error("Error checking device trust:", error);
      localStorage.removeItem("trusted_device");
      return false;
    }
  };

  const shouldSkipOtp = (email: string): boolean => {
    return isDeviceTrusted(email);
  };

  const resendOtp = async (
    email: string,
    type: "signup" | "email" | "signin",
  ) => {
    const actualType = type === "signin" ? "email" : type;

    if (type === "signin") {
      // For sign in OTP, use signInWithOtp
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
    } else {
      // For signup/email change, use resend
      const { data, error } = await supabase.auth.resend({
        type: actualType,
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      console.log("OTP resent successfully:", data);
    }
  };

  const resetPassword = async (email: string) => {
    console.log("[Auth] Initiating password reset for:", email);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      const endTime = Date.now();
      console.log(
        `[Auth] Supabase resetPasswordForEmail completed in ${endTime - startTime}ms`,
      );
      console.log("[Auth] Reset password response:", { data, error });

      if (error) {
        console.error("[Auth] Reset password error:", error);
        throw error;
      }

      console.log("[Auth] Password reset email request successful");
    } catch (error) {
      console.error("[Auth] Password reset failed:", error);
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
        requiresOtpVerification,
        checkPaymentStatus,
        signUp,
        signIn,
        signInWithFacebook,
        verifyOtp,
        resendOtp,
        resetPassword,
        signOut,
        isDeviceTrusted,
        shouldSkipOtp,
        generateDeviceFingerprint,
        checkDeviceStatus,
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
