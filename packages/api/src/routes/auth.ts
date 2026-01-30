import { Hono } from "hono";
import { z } from "zod";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { getDb, upsertUser, getUserById, updateUserConsent } from "@discolink/db";
import { getOAuthUrl, exchangeCode, getUser } from "../lib/discord.js";
import { signJwt } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { getConfig } from "../config.js";

const consentSchema = z.object({
  level: z.enum(["public", "anonymous", "private"]),
});

const app = new Hono();

// OAuth state cookie settings
const STATE_COOKIE_NAME = "oauth_state";
const STATE_COOKIE_MAX_AGE = 600; // 10 minutes

// GET /auth/discord - Start OAuth flow
app.get("/discord", (c) => {
  // Generate cryptographically secure state for CSRF protection
  const state = crypto.randomUUID();
  const config = getConfig();
  const isProduction = config.NODE_ENV === "production";

  // Store state in secure httpOnly cookie
  setCookie(c, STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    maxAge: STATE_COOKIE_MAX_AGE,
    path: "/",
  });

  const url = getOAuthUrl(state);

  return c.redirect(url);
});

// GET /auth/discord/callback - OAuth callback
app.get("/discord/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    deleteCookie(c, STATE_COOKIE_NAME);
    return c.json({ error: `OAuth error: ${error}`, code: "OAUTH_ERROR" }, 400);
  }

  if (!code) {
    deleteCookie(c, STATE_COOKIE_NAME);
    return c.json({ error: "Missing authorization code", code: "BAD_REQUEST" }, 400);
  }

  // Verify CSRF state - CRITICAL SECURITY CHECK
  const storedState = getCookie(c, STATE_COOKIE_NAME);
  deleteCookie(c, STATE_COOKIE_NAME); // Always delete the state cookie after use

  if (!state || !storedState || state !== storedState) {
    console.error("OAuth CSRF validation failed", {
      hasState: !!state,
      hasStoredState: !!storedState,
      match: state === storedState,
    });
    return c.json(
      { error: "Invalid or expired OAuth state. Please try again.", code: "CSRF_ERROR" },
      400
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    // Get user info
    const discordUser = await getUser(tokens.access_token);

    // Upsert user in database
    const db = getDb();
    await upsertUser(db, {
      id: discordUser.id,
      username: discordUser.username,
      globalName: discordUser.global_name,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      isBot: false,
    });

    // Generate JWT
    const jwt = await signJwt({
      sub: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar ?? undefined,
    });

    // Return token (in production, might set as httpOnly cookie)
    return c.json({
      token: jwt,
      user: {
        id: discordUser.id,
        username: discordUser.username,
        globalName: discordUser.global_name,
        avatar: discordUser.avatar,
      },
    });
  } catch (err) {
    console.error("OAuth callback error:", err);
    return c.json(
      { error: "Authentication failed", code: "OAUTH_ERROR" },
      500
    );
  }
});

// GET /auth/me - Get current user
app.get("/me", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  const dbUser = await getUserById(db, user.sub);

  if (!dbUser) {
    return c.json({ error: "User not found", code: "NOT_FOUND" }, 404);
  }

  return c.json({
    id: dbUser.id,
    username: dbUser.username,
    globalName: dbUser.globalName,
    avatar: dbUser.avatar,
    consentStatus: dbUser.consentStatus,
  });
});

// GET /me/consent - Get consent status
app.get("/me/consent", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  const dbUser = await getUserById(db, user.sub);

  if (!dbUser) {
    return c.json({ error: "User not found", code: "NOT_FOUND" }, 404);
  }

  return c.json({
    consentStatus: dbUser.consentStatus ?? "public",
    updatedAt: dbUser.consentUpdatedAt?.toISOString() ?? null,
  });
});

// PUT /me/consent - Update consent status
app.put("/me/consent", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body", code: "VALIDATION_ERROR" }, 400);
  }

  const result = consentSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      { error: "Invalid consent level", code: "VALIDATION_ERROR", details: result.error.errors },
      400
    );
  }

  const { level } = result.data;
  await updateUserConsent(db, user.sub, level);

  return c.json({
    consentStatus: level,
    updatedAt: new Date().toISOString(),
  });
});

// POST /auth/logout - Logout (client-side token removal)
app.post("/logout", (c) => {
  // JWT is stateless, so logout is handled client-side
  // In production with refresh tokens, you'd invalidate the refresh token here
  return c.json({ success: true });
});

export default app;
