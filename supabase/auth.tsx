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

    try {
      // Enhanced security check - verify multiple sources
      const [userResult, subscriptionResult] = await Promise.all([
        supabase
          .from("users")
          .select("has_completed_payment, updated_at")
          .eq("id", user.id)
          .single(),
        supabase
          .from("user_subscriptions")
          .select(
            "status, stripe_subscription_id, updated_at, security_fingerprint",
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const { data: userData, error: userError } = userResult;
      const { data: subscriptionData, error: subError } = subscriptionResult;

      if (userError && userError.code !== "PGRST116") {
        console.error("Error checking user payment status:", userError);
        setHasCompletedPayment(false);
        return false;
      }

      // Security validation - check for tampering
      const currentFingerprint = generateSecurityFingerprint();
      const storedFingerprint = subscriptionData?.security_fingerprint;

      // Allow some flexibility for legitimate device changes
      const fingerprintValid =
        !storedFingerprint ||
        Math.abs(
          parseInt(currentFingerprint, 36) - parseInt(storedFingerprint, 36),
        ) < 1000000;

      if (!fingerprintValid) {
        console.warn("Security fingerprint mismatch detected");
        // Don't block immediately, but log for monitoring
      }

      // Strict validation - both conditions must be true
      const hasValidPayment =
        userData?.has_completed_payment === true &&
        subscriptionData?.status === "active" &&
        subscriptionData?.stripe_subscription_id;

      // Additional security check - verify subscription is recent enough
      if (hasValidPayment && subscriptionData?.updated_at) {
        const lastUpdate = new Date(subscriptionData.updated_at);
        const daysSinceUpdate =
          (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

        // If subscription hasn't been updated in 35 days, re-verify
        if (daysSinceUpdate > 35) {
          console.log("Subscription verification needed - outdated");
          // Could trigger re-verification here
        }
      }

      setHasCompletedPayment(hasValidPayment);
      return hasValidPayment;
    } catch (error) {
      console.error("Error checking payment status:", error);
      setHasCompletedPayment(false);
      return false;
    }
  };

  // Security utility function
  const generateSecurityFingerprint = (): string => {
    if (typeof window === "undefined") return "server";

    const data = [
      navigator.userAgent || "",
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      navigator.language || "",
    ].join("|");

    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  useEffect(() => {
    let isInitialLoad = true;
    let lastPaymentCheck = 0;
    const PAYMENT_CHECK_COOLDOWN = 30000; // 30 seconds

    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user && isInitialLoad) {
        lastPaymentCheck = Date.now();
        await checkPaymentStatus();
      } else if (!session?.user) {
        setHasCompletedPayment(false);
      }
      setLoading(false);
      isInitialLoad = false;
    });

    // Listen for changes on auth state (signed in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event);

      // Only check payment status on actual sign in, not on token refresh or other events
      if (event === "SIGNED_IN" && !isInitialLoad) {
        setUser(session?.user ?? null);
        if (session?.user) {
          const now = Date.now();
          // Only check payment status if enough time has passed
          if (now - lastPaymentCheck > PAYMENT_CHECK_COOLDOWN) {
            lastPaymentCheck = now;
            await checkPaymentStatus();
          }
        }
        setLoading(false);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setHasCompletedPayment(false);
        setLoading(false);
        lastPaymentCheck = 0;
      } else if (event === "TOKEN_REFRESHED") {
        // Don't check payment status on token refresh to avoid unnecessary calls
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    // Prevent payment status checks when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log(
          "Tab became visible - skipping payment check to prevent redirects",
        );
        // Don't check payment status when tab becomes visible
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    // Basic input validation
    if (!email || !password || !fullName) {
      throw new Error("All fields are required");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    // Basic password validation
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Name validation
    if (fullName.trim().length < 2) {
      throw new Error("Full name must be at least 2 characters long");
    }

    // Sanitize full name
    const sanitizedName = fullName.trim().replace(/[<>"'&]/g, "");

    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          full_name: sanitizedName,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
    console.log("Sign up successful, user needs to verify email:", data);
  };

  const generateDeviceFingerprint = (): string => {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      let canvasFingerprint = "";

      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillText("Device fingerprint", 2, 2);
        canvasFingerprint = canvas.toDataURL();
      }

      // Enhanced fingerprinting with more data points
      const fingerprint = [
        navigator.userAgent || "",
        navigator.language || "",
        navigator.languages?.join(",") || "",
        screen.width + "x" + screen.height,
        screen.colorDepth || "",
        new Date().getTimezoneOffset(),
        navigator.platform || "",
        navigator.cookieEnabled ? "1" : "0",
        navigator.doNotTrack || "",
        canvasFingerprint,
        // Add WebGL fingerprint if available
        getWebGLFingerprint(),
      ].join("|");

      // Enhanced hash function (FNV-1a)
      let hash = 2166136261;
      for (let i = 0; i < fingerprint.length; i++) {
        hash ^= fingerprint.charCodeAt(i);
        hash *= 16777619;
        hash = hash >>> 0; // Convert to 32-bit unsigned integer
      }

      return hash.toString(36);
    } catch (error) {
      console.error("Error generating device fingerprint:", error);
      // Fallback fingerprint
      return (Date.now() + Math.random()).toString(36);
    }
  };

  const getWebGLFingerprint = (): string => {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return "";

      const renderer = gl.getParameter(gl.RENDERER);
      const vendor = gl.getParameter(gl.VENDOR);
      return `${vendor}|${renderer}`;
    } catch (error) {
      return "";
    }
  };

  const checkDeviceStatus = async (email: string): Promise<boolean> => {
    try {
      // Input validation
      if (!email) {
        console.log("No email provided, requiring OTP");
        return true;
      }

      const deviceFingerprint = generateDeviceFingerprint();

      // Rate limiting for device checks
      const checkKey = `device_check_${email}`;
      const lastCheck = localStorage.getItem(checkKey);
      const nowDate = new Date();

      if (lastCheck && nowDate - parseInt(lastCheck) < 5000) {
        // 5 second rate limit
        console.log("Device check rate limited");
        return true;
      }

      localStorage.setItem(checkKey, nowDate.toString());

      // Get user by email first with enhanced error handling
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, requires_otp_verification, last_otp_verification")
        .eq("email", email.toLowerCase().trim())
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

      // Check if device is trusted with additional security checks
      const { data: deviceData, error: deviceError } = await supabase
        .from("user_devices")
        .select("is_trusted, expires_at, last_login, created_at")
        .eq("user_id", userData.id)
        .eq("device_fingerprint", deviceFingerprint)
        .eq("is_trusted", true)
        .single();

      if (deviceError || !deviceData) {
        console.log("New device, requires OTP");
        return true; // New device, require OTP
      }

      // Enhanced device trust validation
      const currentDate = new Date();
      const expiresAt = new Date(deviceData.expires_at);
      const lastLogin = new Date(
        deviceData.last_login || deviceData.created_at,
      );

      // Check if device trust has expired
      if (currentDate > expiresAt) {
        console.log("Device trust expired, requires OTP");
        // Remove expired device trust
        await supabase
          .from("user_devices")
          .delete()
          .eq("user_id", userData.id)
          .eq("device_fingerprint", deviceFingerprint);
        return true;
      }

      // Check if device hasn't been used for too long (30 days)
      const daysSinceLastLogin =
        (currentDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceLastLogin > 30) {
        console.log("Device inactive for too long, requires OTP");
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
      // Input validation
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error("Invalid email format");
      }

      // Simple sign in without device checking to avoid rate limits
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

      return { requiresOtp: false };
    } catch (error: any) {
      // Provide user-friendly error messages
      if (error.message?.includes("rate") || error.message?.includes("limit")) {
        throw new Error(
          "Too many requests. Please wait a few minutes before trying again.",
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
    // Enhanced OTP validation with expiry check
    const otpRequestTime = localStorage.getItem(`otp_request_${email}`);
    const currentTime = Date.now();
    const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds

    if (otpRequestTime) {
      const timeDiff = currentTime - parseInt(otpRequestTime);
      if (timeDiff > fifteenMinutes) {
        localStorage.removeItem(`otp_request_${email}`);
        throw new Error("OTP has expired. Please request a new code.");
      }
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: type === "signin" ? "email" : type,
    });
    if (error) {
      // Enhanced error handling
      if (
        error.message?.includes("expired") ||
        error.message?.includes("invalid")
      ) {
        localStorage.removeItem(`otp_request_${email}`);
        throw new Error(
          "OTP has expired or is invalid. Please request a new code.",
        );
      }
      throw error;
    }

    // Clear OTP request time on successful verification
    localStorage.removeItem(`otp_request_${email}`);

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
      // Store new OTP request time for 15-minute expiry
      localStorage.setItem(`otp_request_${email}`, Date.now().toString());

      if (type === "signin" || type === "password_reset") {
        // Simple OTP request without retry logic to avoid rate limits
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

        if (error) {
          if (
            error.message?.includes("rate") ||
            error.message?.includes("limit")
          ) {
            throw new Error(
              "Please wait a moment before requesting another code.",
            );
          }
          throw error;
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
              "Please wait a moment before requesting another code.",
            );
          }
          throw error;
        }

        console.log("OTP resent successfully:", data);
      }
    } catch (error: any) {
      if (error.message?.includes("rate") || error.message?.includes("limit")) {
        throw new Error("Please wait a moment before trying again.");
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
