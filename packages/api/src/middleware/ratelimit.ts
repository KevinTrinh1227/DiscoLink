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

function getClientIdentifier(c: Context): string {
  // Use user ID if authenticated, otherwise use IP
  const user = c.get("user");
  if (user) {
    return `user:${user.sub}`;
  }

  // Get IP from various headers
  const forwarded = c.req.header("x-forwarded-for");
  const realIp = c.req.header("x-real-ip");
  const cfIp = c.req.header("cf-connecting-ip");

  const ip = cfIp ?? realIp ?? forwarded?.split(",")[0]?.trim() ?? "unknown";
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
