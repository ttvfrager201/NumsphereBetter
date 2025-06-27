// Environment variable validation for client-side

interface EnvConfig {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
}

class EnvironmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvironmentError";
  }
}

/**
 * Validate required environment variables
 */
export function validateClientEnvironment(): EnvConfig {
  const requiredVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };

  const missing: string[] = [];
  const invalid: string[] = [];

  // Check for missing variables
  Object.entries(requiredVars).forEach(([key, value]) => {
    if (!value) {
      missing.push(key);
    }
  });

  if (missing.length > 0) {
    throw new EnvironmentError(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Please check your project settings in Tempo.",
    );
  }

  // Validate Supabase URL format
  if (requiredVars.VITE_SUPABASE_URL) {
    try {
      const url = new URL(requiredVars.VITE_SUPABASE_URL);
      if (!url.hostname.includes("supabase")) {
        invalid.push("VITE_SUPABASE_URL (invalid Supabase URL format)");
      }
    } catch {
      invalid.push("VITE_SUPABASE_URL (invalid URL format)");
    }
  }

  // Validate Supabase anon key format (should be a JWT-like string)
  if (requiredVars.VITE_SUPABASE_ANON_KEY) {
    const anonKey = requiredVars.VITE_SUPABASE_ANON_KEY;
    if (!anonKey.startsWith("eyJ") || anonKey.split(".").length !== 3) {
      invalid.push("VITE_SUPABASE_ANON_KEY (invalid JWT format)");
    }
  }

  if (invalid.length > 0) {
    throw new EnvironmentError(
      `Invalid environment variables: ${invalid.join(", ")}. ` +
        "Please check your project settings in Tempo.",
    );
  }

  return requiredVars as EnvConfig;
}

/**
 * Get validated environment configuration
 */
export function getEnvConfig(): EnvConfig {
  try {
    return validateClientEnvironment();
  } catch (error) {
    console.error("Environment validation failed:", error.message);

    // In development, show a helpful error
    if (import.meta.env.DEV) {
      const errorDiv = document.createElement("div");
      errorDiv.innerHTML = `
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.9);
          color: white;
          padding: 2rem;
          font-family: monospace;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
        ">
          <h1 style="color: #ff6b6b; margin-bottom: 1rem;">Environment Configuration Error</h1>
          <p style="margin-bottom: 1rem; max-width: 600px; text-align: center;">
            ${error.message}
          </p>
          <p style="color: #ffd93d; font-size: 0.9rem;">
            Go to your Tempo project settings to configure these environment variables.
          </p>
        </div>
      `;
      document.body.appendChild(errorDiv);
    }

    throw error;
  }
}

/**
 * Check if we're in a secure context (HTTPS or localhost)
 */
export function validateSecureContext(): boolean {
  if (typeof window === "undefined") return true; // SSR context

  const isSecure =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (!isSecure && import.meta.env.PROD) {
    console.warn(
      "Application is running in production over HTTP. " +
        "This is insecure and may cause authentication issues.",
    );
  }

  return isSecure;
}

/**
 * Validate browser security features
 */
export function validateBrowserSecurity(): {
  secure: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Check for required APIs
  if (typeof crypto === "undefined" || !crypto.subtle) {
    warnings.push(
      "Web Crypto API not available - some security features may not work",
    );
  }

  if (typeof localStorage === "undefined") {
    warnings.push(
      "localStorage not available - device trust features disabled",
    );
  }

  if (typeof sessionStorage === "undefined") {
    warnings.push("sessionStorage not available - some features may not work");
  }

  // Check for secure context
  if (!validateSecureContext()) {
    warnings.push(
      "Insecure context detected - authentication may not work properly",
    );
  }

  // Check for third-party cookies (affects OAuth)
  if (
    typeof navigator !== "undefined" &&
    "cookieEnabled" in navigator &&
    !navigator.cookieEnabled
  ) {
    warnings.push("Cookies disabled - OAuth authentication will not work");
  }

  return {
    secure: warnings.length === 0,
    warnings,
  };
}

// Initialize environment validation on module load
if (typeof window !== "undefined") {
  // Validate environment in browser context
  try {
    validateClientEnvironment();

    const browserCheck = validateBrowserSecurity();
    if (!browserCheck.secure) {
      console.warn("Browser security warnings:", browserCheck.warnings);
    }
  } catch (error) {
    // Error handling is done in getEnvConfig
  }
}
