import { Hono } from "hono";
import { z } from "zod";
import {
  getDb,
  channels,
  threads,
  messages,
  attachments,
  reactions,
  users,
  eq,
  and,
  isNull,
  desc,
  asc,
  lt,
  gt,
  inArray,
} from "@discolink/db";
import { filterThreadsByConsent, filterMessagesByConsent, type ConsentCheckContext } from "../lib/consent.js";
import { safeParseJson } from "../lib/safe-json.js";

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

// GET /channels/:channelId/messages - Get messages from a text channel (non-thread messages)
app.get("/:channelId/messages", async (c) => {
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

  const { limit, cursor } = paginationResult.data;
  const sort = c.req.query("sort") === "oldest" ? "oldest" : "latest";
  const before = c.req.query("before");
  const after = c.req.query("after");

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

  // Only return messages for channels with full sync mode
  if (channel.syncMode !== "full") {
    return c.json({
      error: "Channel messages not available",
      code: "SYNC_MODE_DISABLED",
      message: "This channel does not have full message sync enabled",
    }, 403);
  }

  // Build query conditions - only non-thread messages (threadId is null)
  const conditions = [
    eq(messages.channelId, channelId),
    isNull(messages.threadId),
    isNull(messages.deletedAt),
  ];

  // Apply time-based filters
  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) {
      conditions.push(lt(messages.createdAt, beforeDate));
    }
  }

  if (after) {
    const afterDate = new Date(after);
    if (!isNaN(afterDate.getTime())) {
      conditions.push(gt(messages.createdAt, afterDate));
    }
  }

  // Determine sort order
  const orderBy = sort === "oldest" ? asc(messages.createdAt) : desc(messages.createdAt);

  // Fetch messages with authors
  const messageList = await db
    .select()
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit + 1);

  const hasMore = messageList.length > limit;
  const items = hasMore ? messageList.slice(0, limit) : messageList;

  // Get attachments and reactions for these messages
  const messageIds = items.map((m) => m.messages.id);

  const attachmentsList = messageIds.length > 0
    ? await db.select().from(attachments).where(inArray(attachments.messageId, messageIds))
    : [];

  const reactionsList = messageIds.length > 0
    ? await db.select().from(reactions).where(inArray(reactions.messageId, messageIds))
    : [];

  // Group by message ID
  const attachmentsByMessage = new Map<string, typeof attachmentsList>();
  for (const att of attachmentsList) {
    const existing = attachmentsByMessage.get(att.messageId) ?? [];
    existing.push(att);
    attachmentsByMessage.set(att.messageId, existing);
  }

  const reactionsByMessage = new Map<string, typeof reactionsList>();
  for (const r of reactionsList) {
    const existing = reactionsByMessage.get(r.messageId) ?? [];
    existing.push(r);
    reactionsByMessage.set(r.messageId, existing);
  }

  // Apply consent filtering
  const context: ConsentCheckContext = {
    requesterId: c.get("user")?.sub,
    requesterGuildIds: c.get("userGuildIds"),
    isAuthenticated: c.get("isAuthenticated"),
  };

  const filteredMessages = filterMessagesByConsent(
    items.map((m) => ({ ...m.messages, author: m.users })),
    channel.serverId,
    context
  );

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.messages.id : undefined;

  c.header("X-Has-More", hasMore.toString());
  if (nextCursor) {
    c.header("X-Next-Cursor", nextCursor);
  }

  return c.json({
    messages: filteredMessages.map((m) => {
      const msgAttachments = attachmentsByMessage.get(m.id) ?? [];
      const msgReactions = reactionsByMessage.get(m.id) ?? [];

      return {
        id: m.id,
        content: m.content,
        contentHtml: m.contentHtml,
        createdAt: m.createdAt.toISOString(),
        editedAt: m.editedAt?.toISOString() ?? null,
        isEdited: m.isEdited,
        isPinned: m.isPinned,
        replyToId: m.replyToId,
        author: m.author
          ? {
              id: m.author.id,
              username: m.author.username,
              avatar: m.author.avatar,
              isBot: m.author.isBot,
            }
          : null,
        attachments: msgAttachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          url: a.url,
          contentType: a.contentType,
          size: a.size,
          width: a.width,
          height: a.height,
          isImage: a.isImage,
          isVideo: a.isVideo,
        })),
        reactions: msgReactions.map((r) => ({
          emoji: r.emoji,
          emojiName: r.emojiName,
          count: r.count,
          isCustom: r.isCustom,
        })),
        embeds: safeParseJson(m.embeds, []),
      };
    }),
    pagination: {
      hasMore,
      nextCursor,
    },
  });
});

export default app;
