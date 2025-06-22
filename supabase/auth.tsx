import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useNavigate } from "react-router-dom";
import type { MobileOtpType } from '@supabase/supabase-js';

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
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasCompletedPayment, setHasCompletedPayment] = useState(false);

  const checkPaymentStatus = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from("users")
        .select("has_completed_payment")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error checking payment status:", error);
        return false;
      }

      const completed = data?.has_completed_payment || false;
      setHasCompletedPayment(completed);
      return completed;
    } catch (error) {
      console.error("Error checking payment status:", error);
      return false;
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkPaymentStatus();
      }
      setLoading(false);
    });

    // Listen for changes on auth state (signed in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkPaymentStatus();
      } else {
        setHasCompletedPayment(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    // First check if user already exists by trying to sign in
    const { error: existingUserError } = await supabase.auth.signInWithPassword(
      {
        email,
        password,
      },
    );

    // If sign in succeeds, user already exists
    if (!existingUserError) {
      await supabase.auth.signOut(); // Sign out the user we just signed in
      return {
        needsOtp: false,
        error:
          "An account with this email already exists. Please sign in instead.",
      };
    }

    // Try to sign up the user
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
      throw signUpError;
    }

    return { needsOtp: true };
  };

  const signIn = async (email: string, password: string) => {
    // First try to sign in with password to validate credentials
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        // Send OTP for email verification
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: undefined, // Prevent magic link
          },
        });
        if (otpError) throw otpError;
        return { needsOtp: true };
      }
      throw error;
    }

    // For existing confirmed users, sign them out and require OTP verification
    await supabase.auth.signOut();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: undefined, // Prevent magic link
      },
    });

    if (otpError) throw otpError;

    return { needsOtp: true };
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
    type: type as OtpType,  // <--- CAST HERE
  });
  if (error) throw error;
};

const resendOtp = async (email: string, type: "signup" | "email") => {
  const { error } = await supabase.auth.resend({
    type: type as OtpType,   // <--- CAST HERE
    email,
    options: {
      emailRedirectTo: undefined,
    },
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
        signIn,
        signUp,
        verifyOtp,
        resendOtp,
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
