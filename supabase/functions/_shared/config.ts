// Shared configuration utilities for edge functions

/**
 * Get the base URL for the current environment
 * This ensures all webhook URLs use the correct domain
 */
export function getBaseUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable is required");
  }
  return supabaseUrl;
}

/**
 * Get the webhook base URL for Supabase functions
 */
export function getWebhookBaseUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable is required");
  }
  return `${supabaseUrl}/functions/v1`;
}

/**
 * Get the frontend base URL for redirects
 */
export function getFrontendBaseUrl(): string {
  // Check for explicit frontend URL first
  const frontendUrl =
    Deno.env.get("FRONTEND_URL") || Deno.env.get("VITE_APP_URL");
  if (frontendUrl) {
    return frontendUrl;
  }

  // Fallback to the deployment URL
  const deploymentUrl = Deno.env.get("DEPLOYMENT_URL");
  if (deploymentUrl) {
    return deploymentUrl;
  }

  // Final fallback - use the known deployment URL
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
export function logConfig(context: string) {
  console.log(`[${context}] Configuration:`, {
    supabase_url: Deno.env.get("SUPABASE_URL"),
    frontend_url: Deno.env.get("FRONTEND_URL"),
    vite_app_url: Deno.env.get("VITE_APP_URL"),
    deployment_url: Deno.env.get("DEPLOYMENT_URL"),
    base_url: getBaseUrl(),
    webhook_base_url: getWebhookBaseUrl(),
    frontend_base_url: getFrontendBaseUrl(),
  });
}
