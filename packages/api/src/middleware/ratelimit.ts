import { type Context, type Next } from "hono";
import { getConfig } from "../config.js";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (use Redis in production for distributed systems)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Get client IP address securely.
 *
 * SECURITY: Only trust proxy headers when TRUSTED_PROXY is explicitly enabled.
 * Without this check, attackers can spoof IP addresses by setting headers like
 * X-Forwarded-For, X-Real-IP, or CF-Connecting-IP to bypass rate limiting.
 */
function getClientIp(c: Context): string {
  const config = getConfig();

  // Only trust proxy headers if explicitly configured to trust proxies
  if (config.TRUSTED_PROXY) {
    // Cloudflare's header takes priority (cannot be spoofed behind Cloudflare)
    const cfIp = c.req.header("cf-connecting-ip");
    if (cfIp) return cfIp;

    // X-Forwarded-For: may contain chain of IPs, take the first (client) IP
    // Note: Only the leftmost IP is the client; others are proxies
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      const firstIp = forwarded.split(",")[0]?.trim();
      if (firstIp) return firstIp;
    }

    // X-Real-IP: typically set by nginx
    const realIp = c.req.header("x-real-ip");
    if (realIp) return realIp;
  }

  // Fallback: Use the direct connection IP (not spoofable)
  // In Hono/Node.js, this comes from the socket
  // Note: c.req.raw may vary by runtime - handle gracefully
  try {
    // @ts-expect-error - Runtime-specific socket access
    const socketIp = c.req.raw.socket?.remoteAddress;
    if (socketIp) return socketIp;
  } catch {
    // Ignore if socket access fails
  }

  // Last resort: return "unknown" which will share rate limit bucket
  // This is safer than trusting potentially spoofed headers
  return "unknown";
}

function getClientIdentifier(c: Context): string {
  // Use user ID if authenticated, otherwise use IP
  const user = c.get("user");
  if (user) {
    return `user:${user.sub}`;
  }

  const ip = getClientIp(c);
  return `ip:${ip}`;
}

export async function rateLimitMiddleware(c: Context, next: Next): Promise<Response | void> {
  const config = getConfig();
  const identifier = getClientIdentifier(c);
  const now = Date.now();

  let entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.RATE_LIMIT_WINDOW_MS,
    };
  }

  entry.count++;
  rateLimitStore.set(identifier, entry);

  // Set rate limit headers
  c.header("X-RateLimit-Limit", config.RATE_LIMIT_MAX_REQUESTS.toString());
  c.header("X-RateLimit-Remaining", Math.max(0, config.RATE_LIMIT_MAX_REQUESTS - entry.count).toString());
  c.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000).toString());

  if (entry.count > config.RATE_LIMIT_MAX_REQUESTS) {
    c.header("Retry-After", Math.ceil((entry.resetAt - now) / 1000).toString());
    return c.json(
      {
        error: "Too many requests",
        code: "RATE_LIMITED",
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      },
      429
    );
  }

  return next();
}
