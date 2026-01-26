import { Hono } from "hono";
import { z } from "zod";
import {
  getDb,
  messages,
  threads,
  users,
  servers,
  eq,
  and,
  isNull,
  ne,
} from "@discordlink/db";
import { cacheMiddleware, serverCacheKey } from "../middleware/cache.js";

const app = new Hono();

// Cache leaderboard for 120 seconds per server
app.use("/:serverId", cacheMiddleware(120, serverCacheKey));

const leaderboardSchema = z.object({
  type: z.enum(["messages", "threads", "reactions"]).default("messages"),
  limit: z.coerce.number().min(1).max(50).default(10),
  excludeBots: z.coerce.boolean().default(false),
  botsOnly: z.coerce.boolean().default(false),
});

// GET /leaderboard/:serverId
app.get("/:serverId", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");

  const result = leaderboardSchema.safeParse({
    type: c.req.query("type"),
    limit: c.req.query("limit"),
    excludeBots: c.req.query("excludeBots"),
    botsOnly: c.req.query("botsOnly"),
  });

  if (!result.success) {
    return c.json({ error: "Invalid parameters", code: "VALIDATION_ERROR" }, 400);
  }

  const { type, limit, excludeBots, botsOnly } = result.data;

  // Verify server exists
  const serverResult = await db
    .select()
    .from(servers)
    .where(and(eq(servers.id, serverId), eq(servers.isActive, true)))
    .limit(1);

  const server = serverResult[0];

  if (!server) {
    return c.json({ error: "Server not found", code: "NOT_FOUND" }, 404);
  }

  interface LeaderboardEntry {
    userId: string;
    username: string;
    avatar: string | null;
    isBot: boolean;
    count: number;
  }

  let leaderboard: LeaderboardEntry[] = [];

  if (type === "messages") {
    // Get all messages with user info
    const allMessages = await db
      .select()
      .from(messages)
      .innerJoin(users, eq(messages.authorId, users.id))
      .where(and(
        eq(messages.serverId, serverId),
        isNull(messages.deletedAt),
        ne(users.consentStatus, "private")
      ));

    // Apply bot filter
    let filtered = allMessages;
    if (excludeBots) {
      filtered = filtered.filter((r) => !r.users.isBot);
    } else if (botsOnly) {
      filtered = filtered.filter((r) => r.users.isBot);
    }

    // Aggregate by author
    const authorMap = new Map<string, { user: typeof filtered[0]["users"]; count: number }>();
    for (const row of filtered) {
      const authorId = row.messages.authorId;
      const existing = authorMap.get(authorId);
      if (existing) {
        existing.count++;
      } else {
        authorMap.set(authorId, { user: row.users, count: 1 });
      }
    }

    leaderboard = [...authorMap.entries()]
      .map(([authorId, data]) => ({
        userId: data.user.consentStatus === "anonymous" ? "anonymous" : authorId,
        username: data.user.consentStatus === "anonymous" ? "Anonymous" : data.user.username,
        avatar: data.user.consentStatus === "anonymous" ? null : data.user.avatar,
        isBot: data.user.isBot ?? false,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } else if (type === "threads") {
    // Get all threads with user info
    const allThreads = await db
      .select()
      .from(threads)
      .innerJoin(users, eq(threads.authorId, users.id))
      .where(and(
        eq(threads.serverId, serverId),
        isNull(threads.deletedAt),
        ne(users.consentStatus, "private")
      ));

    // Apply bot filter
    let filtered = allThreads;
    if (excludeBots) {
      filtered = filtered.filter((r) => !r.users.isBot);
    } else if (botsOnly) {
      filtered = filtered.filter((r) => r.users.isBot);
    }

    // Aggregate by author
    const authorMap = new Map<string, { user: typeof filtered[0]["users"]; count: number }>();
    for (const row of filtered) {
      const authorId = row.threads.authorId;
      const existing = authorMap.get(authorId);
      if (existing) {
        existing.count++;
      } else {
        authorMap.set(authorId, { user: row.users, count: 1 });
      }
    }

    leaderboard = [...authorMap.entries()]
      .map(([authorId, data]) => ({
        userId: data.user.consentStatus === "anonymous" ? "anonymous" : authorId,
        username: data.user.consentStatus === "anonymous" ? "Anonymous" : data.user.username,
        avatar: data.user.consentStatus === "anonymous" ? null : data.user.avatar,
        isBot: data.user.isBot ?? false,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } else if (type === "reactions") {
    // Get all messages with user info and reaction counts
    const allMessages = await db
      .select()
      .from(messages)
      .innerJoin(users, eq(messages.authorId, users.id))
      .where(and(
        eq(messages.serverId, serverId),
        isNull(messages.deletedAt),
        ne(users.consentStatus, "private")
      ));

    // Apply bot filter
    let filtered = allMessages;
    if (excludeBots) {
      filtered = filtered.filter((r) => !r.users.isBot);
    } else if (botsOnly) {
      filtered = filtered.filter((r) => r.users.isBot);
    }

    // Aggregate reaction counts by author
    const authorMap = new Map<string, { user: typeof filtered[0]["users"]; count: number }>();
    for (const row of filtered) {
      const authorId = row.messages.authorId;
      const reactionCount = row.messages.reactionCount ?? 0;
      const existing = authorMap.get(authorId);
      if (existing) {
        existing.count += reactionCount;
      } else {
        authorMap.set(authorId, { user: row.users, count: reactionCount });
      }
    }

    leaderboard = [...authorMap.entries()]
      .map(([authorId, data]) => ({
        userId: data.user.consentStatus === "anonymous" ? "anonymous" : authorId,
        username: data.user.consentStatus === "anonymous" ? "Anonymous" : data.user.username,
        avatar: data.user.consentStatus === "anonymous" ? null : data.user.avatar,
        isBot: data.user.isBot ?? false,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  return c.json({
    serverId,
    type,
    filters: {
      excludeBots,
      botsOnly,
    },
    leaderboard: leaderboard.map((entry, index) => ({
      rank: index + 1,
      ...entry,
    })),
  });
});

export default app;
