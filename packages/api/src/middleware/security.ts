import { type Context, type Next } from "hono";

/**
 * Security headers middleware.
 * Adds standard security headers to all responses.
 */
export async function securityHeaders(c: Context, next: Next): Promise<void> {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "0"); // Disable legacy XSS filter, rely on CSP
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");

  // HSTS only in production
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}
