import { Hono } from "hono";
import { z } from "zod";
import {
  getDb,
  channels,
  threads,
  users,
  eq,
  and,
  isNull,
  desc,
  asc,
} from "@discord-forum-api/db";
import { filterThreadsByConsent, type ConsentCheckContext } from "../lib/consent.js";

const app = new Hono();

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const threadFiltersSchema = z.object({
  status: z.enum(["open", "resolved", "locked", "all"]).default("all"),
  sort: z.enum(["latest", "oldest", "popular", "recently_active"]).default("latest"),
});

// GET /channels/:channelId
app.get("/:channelId", async (c) => {
  const db = getDb();
  const channelId = c.req.param("channelId");

  const channelResult = await db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), isNull(channels.deletedAt)))
    .limit(1);

  const channel = channelResult[0];

  if (!channel) {
    return c.json({ error: "Channel not found", code: "NOT_FOUND" }, 404);
  }

  return c.json({
    id: channel.id,
    serverId: channel.serverId,
    name: channel.name,
    type: channel.type,
    topic: channel.topic,
    position: channel.position,
    parentId: channel.parentId,
  });
});

// GET /channels/:channelId/threads
app.get("/:channelId/threads", async (c) => {
  const db = getDb();
  const channelId = c.req.param("channelId");

  // Parse query params
  const paginationResult = paginationSchema.safeParse({
    limit: c.req.query("limit"),
    cursor: c.req.query("cursor"),
  });

  if (!paginationResult.success) {
    return c.json({ error: "Invalid pagination parameters", code: "VALIDATION_ERROR" }, 400);
  }

  const filtersResult = threadFiltersSchema.safeParse({
    status: c.req.query("status"),
    sort: c.req.query("sort"),
  });

  if (!filtersResult.success) {
    return c.json({ error: "Invalid filter parameters", code: "VALIDATION_ERROR" }, 400);
  }

  const { limit } = paginationResult.data;
  const { status, sort } = filtersResult.data;

  // Verify channel exists
  const channelResult = await db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), isNull(channels.deletedAt)))
    .limit(1);

  const channel = channelResult[0];

  if (!channel) {
    return c.json({ error: "Channel not found", code: "NOT_FOUND" }, 404);
  }

  // Build query conditions
  const conditions = [eq(threads.channelId, channelId), isNull(threads.deletedAt)];

  if (status !== "all") {
    conditions.push(eq(threads.status, status));
  }

  // Determine sort order
  let orderBy;
  switch (sort) {
    case "oldest":
      orderBy = asc(threads.createdAt);
      break;
    case "popular":
      orderBy = desc(threads.messageCount);
      break;
    case "recently_active":
      orderBy = desc(threads.lastActivityAt);
      break;
    case "latest":
    default:
      orderBy = desc(threads.createdAt);
  }

  // Fetch threads with authors
  const threadList = await db
    .select()
    .from(threads)
    .leftJoin(users, eq(threads.authorId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit + 1);

  const hasMore = threadList.length > limit;
  const items = hasMore ? threadList.slice(0, limit) : threadList;

  // Apply consent filtering
  const context: ConsentCheckContext = {
    requesterId: c.get("user")?.sub,
    requesterGuildIds: c.get("userGuildIds"),
    isAuthenticated: c.get("isAuthenticated"),
  };

  const filteredItems = filterThreadsByConsent(
    items.map((i) => ({ ...i.threads, author: i.users })),
    channel.serverId,
    context
  );

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.threads.id : undefined;

  c.header("X-Has-More", hasMore.toString());
  if (nextCursor) {
    c.header("X-Next-Cursor", nextCursor);
  }

  return c.json({
    threads: filteredItems.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      status: t.status,
      messageCount: t.messageCount,
      createdAt: t.createdAt.toISOString(),
      lastActivityAt: t.lastActivityAt.toISOString(),
      author: t.author
        ? {
            id: t.author.id,
            username: t.author.username,
            avatar: t.author.avatar,
          }
        : null,
    })),
    pagination: {
      hasMore,
      nextCursor,
    },
  });
});

export default app;
