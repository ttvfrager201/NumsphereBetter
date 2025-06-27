import { createClient } from "@supabase/supabase-js";
import { getEnvConfig, validateSecureContext } from "../src/lib/env-validation";

// Validate environment and get configuration
const envConfig = getEnvConfig();

// Validate secure context for production
validateSecureContext();

// Enhanced Supabase client configuration for enterprise SaaS
export const supabase = createClient(
  envConfig.VITE_SUPABASE_URL,
  envConfig.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      // Enhanced security settings
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce", // Use PKCE flow for better security
      // Storage configuration with fallback
      storage: {
        getItem: (key: string) => {
          try {
            return localStorage.getItem(key);
          } catch {
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            localStorage.setItem(key, value);
          } catch {
            // Silently fail if localStorage is not available
          }
        },
        removeItem: (key: string) => {
          try {
            localStorage.removeItem(key);
          } catch {
            // Silently fail if localStorage is not available
          }
        },
      },
    },
    // Database configuration
    db: {
      schema: "public",
    },
    // Global configuration
    global: {
      headers: {
        "X-Client-Info": "numsphere-web-client",
        "X-Client-Version": "1.0.0",
      },
    },
    // Realtime configuration
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },
);

// Enhanced error handling for Supabase operations
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    // Clear any cached data on sign out
    try {
      localStorage.removeItem("supabase.auth.token");
      sessionStorage.clear();
    } catch {
      // Silently fail if storage is not available
    }
  }

  if (event === "TOKEN_REFRESHED") {
    console.log("Auth token refreshed successfully");
  }

  if (event === "SIGNED_IN") {
    console.log("User signed in successfully");
  }
});

// Export helper functions for common operations
export const supabaseHelpers = {
  /**
   * Check if user is authenticated
   */
  isAuthenticated: async (): Promise<boolean> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return !!session;
    } catch {
      return false;
    }
  },

  /**
   * Get current user safely
   */
  getCurrentUser: async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  },

  /**
   * Sign out with cleanup
   */
  signOut: async (): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase.auth.signOut();

      // Clear local storage
      try {
        localStorage.removeItem("supabase.auth.token");
        sessionStorage.clear();
      } catch {
        // Silently fail if storage is not available
      }

      return { error };
    } catch (error) {
      console.error("Error during sign out:", error);
      return { error: error as Error };
    }
  },

  /**
   * Check connection to Supabase
   */
  checkConnection: async (): Promise<boolean> => {
    try {
      const { error } = await supabase.from("users").select("id").limit(1);
      return !error;
    } catch {
      return false;
    }
  },
};

// Log successful initialization
console.log("Supabase client initialized successfully");

// Export the configured client as default
export default supabase;
