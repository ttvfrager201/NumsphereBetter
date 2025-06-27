// Security utilities and validation for enterprise SaaS

/**
 * Validate required environment variables
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ];

  const missing = required.filter((key) => !Deno.env.get(key));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate Stripe webhook signature with enhanced security
 */
export function validateStripeSignature(
  payload: string,
  signature: string,
  secret: string,
  tolerance: number = 300, // 5 minutes
): boolean {
  try {
    const elements = signature.split(",");
    const signatureElements: { [key: string]: string } = {};

    for (const element of elements) {
      const [key, value] = element.split("=");
      signatureElements[key] = value;
    }

    if (!signatureElements.t || !signatureElements.v1) {
      return false;
    }

    const timestamp = parseInt(signatureElements.t);
    const now = Math.floor(Date.now() / 1000);

    // Check timestamp tolerance
    if (Math.abs(now - timestamp) > tolerance) {
      console.warn(
        `Webhook timestamp outside tolerance: ${Math.abs(now - timestamp)}s`,
      );
      return false;
    }

    // Verify signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = await computeSignature(signedPayload, secret);

    return secureCompare(signatureElements.v1, expectedSignature);
  } catch (error) {
    console.error("Signature validation error:", error);
    return false;
  }
}

/**
 * Compute HMAC-SHA256 signature
 */
async function computeSignature(
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Secure string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .trim()
    .replace(/[<>"'&]/g, (match) => {
      const entities: { [key: string]: string } = {
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "&": "&amp;",
      };
      return entities[match] || match;
    })
    .substring(0, 1000); // Limit length
}

/**
 * Validate email format with enhanced checks
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return false;
  }

  // Length checks
  if (email.length > 254 || email.length < 5) {
    return false;
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /<script/i,
    /on\w+=/i,
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(email));
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== "string") {
    return false;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Rate limiting implementation
 */
class RateLimiter {
  private requests = new Map<string, { count: number; resetTime: number }>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetTime) {
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

// Export singleton rate limiter instances
export const webhookRateLimiter = new RateLimiter(50, 60000); // 50 requests per minute
export const apiRateLimiter = new RateLimiter(100, 60000); // 100 requests per minute

/**
 * Log security events
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: "low" | "medium" | "high" | "critical" = "medium",
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    severity,
    details: {
      ...details,
      // Remove sensitive data
      password: details.password ? "[REDACTED]" : undefined,
      token: details.token ? "[REDACTED]" : undefined,
      secret: details.secret ? "[REDACTED]" : undefined,
    },
    source: "numsphere-security",
  };

  if (severity === "critical" || severity === "high") {
    console.error("[SECURITY]", JSON.stringify(logEntry));
  } else {
    console.warn("[SECURITY]", JSON.stringify(logEntry));
  }

  // TODO: Send to external security monitoring service
  // - Datadog, New Relic, Sentry, etc.
  // - SIEM systems
  // - Slack/Discord alerts for critical events
}

/**
 * Detect suspicious patterns in requests
 */
export function detectSuspiciousActivity(request: {
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  body?: any;
}): { suspicious: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check for common attack patterns
  const suspiciousPatterns = [
    /union.*select/i,
    /script.*alert/i,
    /<script/i,
    /javascript:/i,
    /eval\(/i,
    /document\.cookie/i,
    /\.\.\/\.\.\/\.\./,
    /etc\/passwd/i,
    /cmd\.exe/i,
    /powershell/i,
  ];

  const checkString = JSON.stringify(request.body || "") + (request.path || "");

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkString)) {
      reasons.push(`Suspicious pattern detected: ${pattern.source}`);
    }
  }

  // Check user agent
  if (request.userAgent) {
    const suspiciousAgents = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /burp/i,
      /scanner/i,
      /bot.*attack/i,
    ];

    for (const agent of suspiciousAgents) {
      if (agent.test(request.userAgent)) {
        reasons.push(`Suspicious user agent: ${request.userAgent}`);
      }
    }
  }

  // Check for rapid requests from same IP
  if (request.ip) {
    // This would need to be implemented with a proper rate limiting store
    // For now, just log the IP for monitoring
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}
