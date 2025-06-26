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
    type: "signup" | "email" | "signin" | "password_reset",
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

    // Check if we have a cached result that's still valid (within 5 minutes)
    const cacheKey = `payment_status_${user.id}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const { status, timestamp } = JSON.parse(cached);
      const now = Date.now();
      if (now - timestamp < 300000) {
        // 5 minutes cache to prevent tab switching redirects
        // Using cached payment status
        setHasCompletedPayment(status);
        return status;
      }
    }

    try {
      // Checking payment status

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

      // Payment status check completed

      // Cache the result
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          status: completed,
          timestamp: Date.now(),
        }),
      );

      // Set payment status based on actual data
      setHasCompletedPayment(completed);
      return completed;
    } catch (error) {
      console.error("Error checking payment status:", error);
      // On error, check if we have any cached status to fall back to
      if (cached) {
        const { status } = JSON.parse(cached);
        // Using cached payment status due to error
        setHasCompletedPayment(status);
        return status;
      }
      // Only as last resort, assume payment is incomplete
      setHasCompletedPayment(false);
      return false;
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Initial session check
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
      // Auth state change

      // Only check payment status on actual auth changes, not on tab focus
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
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
      }
    });

    // Handle page visibility changes to prevent unnecessary redirects
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        // Only refresh payment status if cache is very old (10+ minutes)
        const cacheKey = `payment_status_${user.id}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          const now = Date.now();
          if (now - timestamp > 600000) {
            // 10 minutes
            checkPaymentStatus();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);

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
    try {
      // Check device status first to avoid unnecessary auth calls
      const requiresOtp = await checkDeviceStatus(email);

      // If device is trusted, proceed with normal sign in
      if (!requiresOtp) {
        const { error: passwordError } = await supabase.auth.signInWithPassword(
          {
            email,
            password,
          },
        );

        if (passwordError) {
          // Handle rate limiting specifically
          if (
            passwordError.message?.includes("rate") ||
            passwordError.message?.includes("limit")
          ) {
            throw new Error(
              "Too many login attempts. Please wait a few minutes before trying again.",
            );
          }
          throw passwordError;
        }

        return { requiresOtp: false };
      }

      // For new devices, verify password first without signing in
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (passwordError) {
        // Handle rate limiting specifically
        if (
          passwordError.message?.includes("rate") ||
          passwordError.message?.includes("limit")
        ) {
          throw new Error(
            "Too many login attempts. Please wait a few minutes before trying again.",
          );
        }
        throw passwordError;
      }

      // Sign out immediately since we need OTP
      await supabase.auth.signOut();

      // Add delay to avoid rate limiting on OTP request
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send OTP with retry logic
      let otpAttempts = 0;
      const maxOtpAttempts = 3;

      while (otpAttempts < maxOtpAttempts) {
        try {
          const { error: otpError } = await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: false,
            },
          });

          if (!otpError) {
            setRequiresOtpVerification(true);
            return { requiresOtp: true };
          }

          // Handle rate limiting for OTP
          if (
            otpError.message?.includes("rate") ||
            otpError.message?.includes("limit")
          ) {
            if (otpAttempts === maxOtpAttempts - 1) {
              throw new Error(
                "Email rate limit exceeded. Please wait 5-10 minutes before trying again.",
              );
            }
            // Wait longer between attempts
            await new Promise((resolve) =>
              setTimeout(resolve, 2000 * (otpAttempts + 1)),
            );
            otpAttempts++;
            continue;
          }

          throw otpError;
        } catch (error) {
          if (otpAttempts === maxOtpAttempts - 1) {
            throw error;
          }
          otpAttempts++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      throw new Error(
        "Failed to send verification code after multiple attempts.",
      );
    } catch (error: any) {
      // Provide user-friendly error messages
      if (error.message?.includes("rate") || error.message?.includes("limit")) {
        throw new Error(
          "Too many requests. Please wait 5-10 minutes before trying again.",
        );
      }
      throw error;
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
    type: "signup" | "email" | "signin" | "password_reset",
  ) => {
    const actualType =
      type === "signin" || type === "password_reset" ? "email" : type;

    try {
      if (type === "signin" || type === "password_reset") {
        // Add delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // For sign in OTP or password reset, use signInWithOtp with retry logic
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
          try {
            const { error } = await supabase.auth.signInWithOtp({
              email,
              options: {
                shouldCreateUser: false,
                data:
                  type === "password_reset"
                    ? { type: "password_reset" }
                    : undefined,
              },
            });

            if (!error) return;

            if (
              error.message?.includes("rate") ||
              error.message?.includes("limit")
            ) {
              if (attempts === maxAttempts - 1) {
                throw new Error(
                  "Email rate limit exceeded. Please wait 5-10 minutes before requesting another code.",
                );
              }
              await new Promise((resolve) => setTimeout(resolve, 3000));
              attempts++;
              continue;
            }

            throw error;
          } catch (err) {
            if (attempts === maxAttempts - 1) {
              throw err;
            }
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      } else {
        // For signup/email change, use resend
        const { data, error } = await supabase.auth.resend({
          type: actualType,
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) {
          if (
            error.message?.includes("rate") ||
            error.message?.includes("limit")
          ) {
            throw new Error(
              "Email rate limit exceeded. Please wait 5-10 minutes before requesting another code.",
            );
          }
          throw error;
        }

        console.log("OTP resent successfully:", data);
      }
    } catch (error: any) {
      if (error.message?.includes("rate") || error.message?.includes("limit")) {
        throw new Error(
          "Too many email requests. Please wait 5-10 minutes before trying again.",
        );
      }
      throw error;
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
