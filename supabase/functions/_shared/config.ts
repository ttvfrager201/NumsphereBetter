// Shared configuration utilities for edge functions

/**
 * Get the base URL for the current environment
 * This ensures all webhook URLs use the correct domain
 */
export function getBaseUrl(req?: Request): string {
  // Try to get from environment first (most reliable)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (supabaseUrl) {
    return supabaseUrl;
  }

  // Fallback to request headers if available
  if (req) {
    const origin = req.headers.get("origin");
    if (origin) {
      return origin;
    }

    const referer = req.headers.get("referer");
    if (referer) {
      try {
        const url = new URL(referer);
        return `${url.protocol}//${url.host}`;
      } catch {
        // Invalid URL, continue to fallback
      }
    }

    const host = req.headers.get("host");
    if (host) {
      // Determine protocol based on host
      const protocol =
        host.includes("localhost") || host.includes("127.0.0.1")
          ? "http"
          : "https";
      return `${protocol}://${host}`;
    }
  }

  // Final fallback - this should be updated for your specific deployment
  return "https://pedantic-easley2-9urye.view-3.tempo-dev.app";
}

/**
 * Get the webhook base URL for Supabase functions
 */
export function getWebhookBaseUrl(req?: Request): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (supabaseUrl) {
    return `${supabaseUrl}/functions/v1`;
  }

  // Fallback to constructing from base URL
  const baseUrl = getBaseUrl(req);
  return `${baseUrl}/functions/v1`;
}

/**
 * Get the frontend base URL for redirects
 */
export function getFrontendBaseUrl(req?: Request): string {
  // For frontend URLs, we want the main application URL
  const frontendUrl =
    Deno.env.get("FRONTEND_URL") || Deno.env.get("VITE_APP_URL");
  if (frontendUrl) {
    return frontendUrl;
  }

  // Try to determine from request
  if (req) {
    const origin = req.headers.get("origin");
    if (origin) {
      return origin;
    }

    const referer = req.headers.get("referer");
    if (referer) {
      try {
        const url = new URL(referer);
        return `${url.protocol}//${url.host}`;
      } catch {
        // Invalid URL, continue to fallback
      }
    }
  }

  // Default to the current deployment URL
  return "https://pedantic-easley2-9urye.view-3.tempo-dev.app";
}

/**
 * Validate that a URL is properly formatted
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Log configuration for debugging
 */
export function logConfig(context: string, req?: Request) {
  console.log(`[${context}] Configuration:`, {
    supabase_url: Deno.env.get("SUPABASE_URL"),
    frontend_url: Deno.env.get("FRONTEND_URL"),
    base_url: getBaseUrl(req),
    webhook_base_url: getWebhookBaseUrl(req),
    frontend_base_url: getFrontendBaseUrl(req),
    origin: req?.headers.get("origin"),
    referer: req?.headers.get("referer"),
    host: req?.headers.get("host"),
  });
}
