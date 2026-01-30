import { type Context, type Next } from "hono";

interface CacheEntry {
  data: unknown;
  expires: number;
}

const MAX_CACHE_ENTRIES = 10000;

// In-memory cache with TTL
// Note: For production, consider using Redis or similar
const cache = new Map<string, CacheEntry>();

/**
 * Evict oldest 20% of entries when cache exceeds max size.
 */
function evictIfNeeded(): void {
  if (cache.size <= MAX_CACHE_ENTRIES) return;

  const entriesToEvict = Math.ceil(cache.size * 0.2);
  const sorted = [...cache.entries()].sort((a, b) => a[1].expires - b[1].expires);

  for (let i = 0; i < entriesToEvict && i < sorted.length; i++) {
    const entry = sorted[i];
    if (entry) cache.delete(entry[0]);
  }
}

// Cleanup interval (run every minute)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.expires < now) {
        cache.delete(key);
      }
    }
  }, 60000);
}

function stopCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export function clearCache() {
  cache.clear();
}

export function invalidateCache(pattern?: string | RegExp) {
  if (!pattern) {
    cache.clear();
    return;
  }

  const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
    }
  }
}

/**
 * Response caching middleware
 * @param ttlSeconds - Cache TTL in seconds (default: 60)
 * @param keyGenerator - Optional function to generate cache key (defaults to URL)
 */
export function cacheMiddleware(
  ttlSeconds = 60,
  keyGenerator?: (c: Context) => string | null
) {
  startCleanup();

  return async (c: Context, next: Next): Promise<Response | void> => {
    // Only cache GET requests
    if (c.req.method !== "GET") {
      await next();
      return;
    }

    // Generate cache key
    const key = keyGenerator ? keyGenerator(c) : c.req.url;
    if (!key) {
      await next();
      return;
    }

    // Check cache
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      c.header("X-Cache", "HIT");
      c.header("X-Cache-TTL", String(Math.round((cached.expires - Date.now()) / 1000)));
      return c.json(cached.data as object);
    }

    c.header("X-Cache", "MISS");

    // Store original json method
    const originalJson = c.json.bind(c);

    // Override json to capture response
    let responseData: unknown;
    c.json = ((data: object, status?: number) => {
      responseData = data;
      return originalJson(data, status as any);
    }) as typeof c.json;

    await next();

    // Cache the response if successful
    if (responseData && c.res.status >= 200 && c.res.status < 300) {
      cache.set(key, {
        data: responseData,
        expires: Date.now() + ttlSeconds * 1000,
      });
      evictIfNeeded();
    }

    c.header("X-Cache-Size", String(cache.size));
  };
}

/**
 * Cache key generator that includes query parameters
 */
export function urlWithQueryKey(c: Context): string {
  return c.req.url;
}

/**
 * Cache key generator that excludes user-specific data
 */
export function publicCacheKey(c: Context): string | null {
  // Don't cache authenticated requests
  if (c.get("isAuthenticated")) {
    return null;
  }
  return c.req.url;
}

/**
 * Per-server cache key
 */
export function serverCacheKey(c: Context): string | null {
  const serverId = c.req.param("serverId");
  if (!serverId) return null;
  return `server:${serverId}:${c.req.path}`;
}

// Cleanup on process exit
if (typeof process !== "undefined") {
  process.on("beforeExit", stopCleanup);
}
