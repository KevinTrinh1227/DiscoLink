import { type Context, type Next } from "hono";
import { verifyJwt, type JwtPayload } from "../lib/jwt.js";

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload | null;
    userGuildIds: string[];
    isAuthenticated: boolean;
  }
}

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    c.set("user", null);
    c.set("userGuildIds", []);
    c.set("isAuthenticated", false);
    return next();
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token);

  if (!payload) {
    c.set("user", null);
    c.set("userGuildIds", []);
    c.set("isAuthenticated", false);
    return next();
  }

  c.set("user", payload);
  c.set("isAuthenticated", true);

  // We don't have access token stored, so guilds will need to be fetched differently
  // For now, we'll leave this empty and handle it in routes that need it
  c.set("userGuildIds", []);

  return next();
}

export function requireAuth(c: Context, next: Next): Response | Promise<Response | void> {
  if (!c.get("isAuthenticated")) {
    return c.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }
  return next();
}
