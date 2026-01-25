import { Hono } from "hono";
import { z } from "zod";
import {
  getDb,
  users,
  threads,
  eq,
  and,
  isNull,
  desc,
} from "@discord-forum-api/db";
import { type ConsentCheckContext } from "../lib/consent.js";

const app = new Hono();

// Helper to decode Discord user flags into badge names
function decodeBadges(publicFlags: number | null | undefined): string[] {
  if (!publicFlags) return [];

  const badges: string[] = [];
  const flagMap: Record<number, string> = {
    1: "Discord_Employee",
    2: "Partnered_Server_Owner",
    4: "HypeSquad_Events",
    8: "Bug_Hunter_Level_1",
    64: "HypeSquad_Bravery",
    128: "HypeSquad_Brilliance",
    256: "HypeSquad_Balance",
    512: "Early_Supporter",
    1024: "Team_User",
    16384: "Bug_Hunter_Level_2",
    65536: "Verified_Bot",
    131072: "Early_Verified_Bot_Developer",
    262144: "Discord_Certified_Moderator",
    524288: "Bot_HTTP_Interactions",
    4194304: "Active_Developer",
  };

  for (const [flag, name] of Object.entries(flagMap)) {
    if (publicFlags & Number(flag)) {
      badges.push(name);
    }
  }

  return badges;
}

// Helper to decode premium type
function getPremiumTypeName(premiumType: number | null | undefined): string | null {
  if (!premiumType) return null;
  const types: Record<number, string> = {
    1: "Nitro_Classic",
    2: "Nitro",
    3: "Nitro_Basic",
  };
  return types[premiumType] ?? null;
}

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// GET /users/:userId
app.get("/:userId", async (c) => {
  const db = getDb();
  const userId = c.req.param("userId");

  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userResult[0];

  if (!user) {
    return c.json({ error: "User not found", code: "NOT_FOUND" }, 404);
  }

  // Check consent - if private, only show to authenticated users in same servers
  const context: ConsentCheckContext = {
    requesterId: c.get("user")?.sub,
    requesterGuildIds: c.get("userGuildIds"),
    isAuthenticated: c.get("isAuthenticated"),
  };

  // For user profiles, we need to check if we can view them at all
  // If consent is private and requester isn't authenticated or doesn't share a server, hide
  if (user.consentStatus === "private") {
    if (!context.isAuthenticated) {
      return c.json({ error: "User not found", code: "NOT_FOUND" }, 404);
    }
    // Would need to check shared servers - simplified for now
  }

  if (user.consentStatus === "anonymous") {
    return c.json({
      id: "anonymous",
      username: "Anonymous",
      avatar: null,
      banner: null,
      badges: [],
      premiumType: null,
      isBot: false,
    });
  }

  return c.json({
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    discriminator: user.discriminator,
    avatar: user.avatar,
    banner: user.banner,
    accentColor: user.accentColor,
    isBot: user.isBot,
    badges: decodeBadges(user.publicFlags),
    premiumType: getPremiumTypeName(user.premiumType),
    createdAt: user.createdAt.toISOString(),
  });
});

// GET /users/:userId/threads
app.get("/:userId/threads", async (c) => {
  const db = getDb();
  const userId = c.req.param("userId");

  const paginationResult = paginationSchema.safeParse({
    limit: c.req.query("limit"),
    cursor: c.req.query("cursor"),
  });

  if (!paginationResult.success) {
    return c.json({ error: "Invalid pagination parameters", code: "VALIDATION_ERROR" }, 400);
  }

  const { limit } = paginationResult.data;

  // Verify user exists
  const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userResult[0];

  if (!user) {
    return c.json({ error: "User not found", code: "NOT_FOUND" }, 404);
  }

  // Check consent
  const context: ConsentCheckContext = {
    requesterId: c.get("user")?.sub,
    requesterGuildIds: c.get("userGuildIds"),
    isAuthenticated: c.get("isAuthenticated"),
  };

  if (user.consentStatus === "private" && !context.isAuthenticated) {
    return c.json({ error: "User not found", code: "NOT_FOUND" }, 404);
  }

  // Get user's public threads
  const threadList = await db
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.authorId, userId),
        eq(threads.visibility, "public"),
        isNull(threads.deletedAt)
      )
    )
    .orderBy(desc(threads.createdAt))
    .limit(limit + 1);

  const hasMore = threadList.length > limit;
  const items = hasMore ? threadList.slice(0, limit) : threadList;

  // If user is anonymous, hide the author info
  const authorInfo =
    user.consentStatus === "anonymous"
      ? { id: "anonymous", username: "Anonymous", avatar: null }
      : { id: user.id, username: user.username, avatar: user.avatar };

  const lastItem = items[items.length - 1];

  return c.json({
    threads: items.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      status: t.status,
      serverId: t.serverId,
      channelId: t.channelId,
      messageCount: t.messageCount,
      createdAt: t.createdAt.toISOString(),
      lastActivityAt: t.lastActivityAt.toISOString(),
      author: authorInfo,
    })),
    pagination: {
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : undefined,
    },
  });
});

export default app;
