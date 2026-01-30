import { Hono } from "hono";
import { z } from "zod";
import {
  getDb,
  threads,
  messages,
  users,
  tags,
  threadTags,
  attachments,
  reactions,
  threadParticipants,
  eq,
  and,
  isNull,
  desc,
  asc,
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
  serverId: z.string().optional(),
  channelId: z.string().optional(),
  tag: z.string().optional(),
  status: z.enum(["open", "resolved", "locked", "all"]).default("all"),
  sort: z.enum(["latest", "oldest", "popular", "recently_active", "unanswered"]).default("latest"),
});

// GET /threads
app.get("/", async (c) => {
  const db = getDb();

  const paginationResult = paginationSchema.safeParse({
    limit: c.req.query("limit"),
    cursor: c.req.query("cursor"),
  });

  if (!paginationResult.success) {
    return c.json({ error: "Invalid pagination parameters", code: "VALIDATION_ERROR" }, 400);
  }

  const filtersResult = threadFiltersSchema.safeParse({
    serverId: c.req.query("serverId"),
    channelId: c.req.query("channelId"),
    tag: c.req.query("tag"),
    status: c.req.query("status"),
    sort: c.req.query("sort"),
  });

  if (!filtersResult.success) {
    return c.json({ error: "Invalid filter parameters", code: "VALIDATION_ERROR" }, 400);
  }

  const { limit } = paginationResult.data;
  const { serverId, channelId, status, sort } = filtersResult.data;

  // Build conditions
  const conditions = [isNull(threads.deletedAt), eq(threads.visibility, "public")];

  if (serverId) conditions.push(eq(threads.serverId, serverId));
  if (channelId) conditions.push(eq(threads.channelId, channelId));
  if (status !== "all") conditions.push(eq(threads.status, status));

  // Sort order
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
    case "unanswered":
      orderBy = desc(threads.createdAt);
      conditions.push(isNull(threads.answerId));
      break;
    case "latest":
    default:
      orderBy = desc(threads.createdAt);
  }

  const threadList = await db
    .select()
    .from(threads)
    .leftJoin(users, eq(threads.authorId, users.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit + 1);

  const hasMore = threadList.length > limit;
  const items = hasMore ? threadList.slice(0, limit) : threadList;

  const context: ConsentCheckContext = {
    requesterId: c.get("user")?.sub,
    requesterGuildIds: c.get("userGuildIds"),
    isAuthenticated: c.get("isAuthenticated"),
  };

  const filteredItems = items.map((i) => {
    const filtered = filterThreadsByConsent(
      [{ ...i.threads, author: i.users }],
      i.threads.serverId,
      context
    );
    return filtered[0];
  }).filter(Boolean);

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.threads.id : undefined;

  return c.json({
    threads: filteredItems.map((t) => ({
      id: t?.id,
      title: t?.title,
      slug: t?.slug,
      status: t?.status,
      serverId: t?.serverId,
      channelId: t?.channelId,
      messageCount: t?.messageCount,
      createdAt: t?.createdAt.toISOString(),
      lastActivityAt: t?.lastActivityAt.toISOString(),
      author: t?.author
        ? {
            id: t.author.id,
            username: t.author.username,
            avatar: t.author.avatar,
          }
        : null,
    })),
    pagination: { hasMore, nextCursor },
  });
});

// GET /threads/:threadId
app.get("/:threadId", async (c) => {
  const db = getDb();
  const threadId = c.req.param("threadId");

  const threadResult = await db
    .select()
    .from(threads)
    .leftJoin(users, eq(threads.authorId, users.id))
    .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
    .limit(1);

  const result = threadResult[0];

  if (!result) {
    return c.json({ error: "Thread not found", code: "NOT_FOUND" }, 404);
  }

  const thread = result.threads;
  const author = result.users;

  // Get thread tags
  const threadTagsList = await db
    .select()
    .from(threadTags)
    .innerJoin(tags, eq(threadTags.tagId, tags.id))
    .where(eq(threadTags.threadId, threadId));

  // Get messages with authors
  const messageList = await db
    .select()
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.threadId, threadId), isNull(messages.deletedAt)))
    .orderBy(asc(messages.createdAt))
    .limit(100);

  // Get all attachments for messages in this thread
  const messageIds = messageList.map((m) => m.messages.id);
  const attachmentsList = messageIds.length > 0
    ? await db
        .select()
        .from(attachments)
        .where(inArray(attachments.messageId, messageIds))
    : [];

  // Get all reactions for messages in this thread
  const reactionsList = messageIds.length > 0
    ? await db
        .select()
        .from(reactions)
        .where(inArray(reactions.messageId, messageIds))
    : [];

  // Group attachments and reactions by message ID
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

  const context: ConsentCheckContext = {
    requesterId: c.get("user")?.sub,
    requesterGuildIds: c.get("userGuildIds"),
    isAuthenticated: c.get("isAuthenticated"),
  };

  const filteredMessages = filterMessagesByConsent(
    messageList.map((m) => ({ ...m.messages, author: m.users })),
    thread.serverId,
    context
  );

  return c.json({
    id: thread.id,
    title: thread.title,
    slug: thread.slug,
    status: thread.status,
    serverId: thread.serverId,
    channelId: thread.channelId,
    messageCount: thread.messageCount,
    createdAt: thread.createdAt.toISOString(),
    lastActivityAt: thread.lastActivityAt.toISOString(),
    isArchived: thread.isArchived,
    isLocked: thread.isLocked,
    isPinned: thread.isPinned,
    author: author
      ? {
          id: author.id,
          username: author.username,
          avatar: author.avatar,
          isBot: author.isBot,
        }
      : null,
    tags: threadTagsList.map((row) => ({
      id: row.tags.id,
      name: row.tags.name,
      emoji: row.tags.emoji,
    })),
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
        isAnswer: m.isAnswer,
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
          isSpoiler: a.isSpoiler,
          description: a.description,
          duration: a.duration,
        })),
        reactions: msgReactions.map((r) => ({
          emoji: r.emoji,
          emojiName: r.emojiName,
          count: r.count,
          isCustom: r.isCustom,
          isAnimated: r.isAnimated,
          emojiUrl: r.emojiUrl,
        })),
        embeds: safeParseJson(m.embeds, []),
        stickers: safeParseJson(m.stickers, []),
        mentionedUserIds: safeParseJson(m.mentionedUserIds, []),
        mentionedRoleIds: safeParseJson(m.mentionedRoleIds, []),
        mentionedChannelIds: safeParseJson(m.mentionedChannelIds, []),
      };
    }),
  });
});

// GET /threads/:threadId/participants
app.get("/:threadId/participants", async (c) => {
  const db = getDb();
  const threadId = c.req.param("threadId");

  // Verify thread exists
  const threadResult = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
    .limit(1);

  if (threadResult.length === 0) {
    return c.json({ error: "Thread not found", code: "NOT_FOUND" }, 404);
  }

  // Get participants
  const participantsList = await db
    .select()
    .from(threadParticipants)
    .leftJoin(users, eq(threadParticipants.userId, users.id))
    .where(eq(threadParticipants.threadId, threadId))
    .orderBy(desc(threadParticipants.messageCount));

  const context: ConsentCheckContext = {
    requesterId: c.get("user")?.sub,
    requesterGuildIds: c.get("userGuildIds"),
    isAuthenticated: c.get("isAuthenticated"),
  };

  const humans = participantsList.filter((p) => !p.thread_participants.isBot);
  const bots = participantsList.filter((p) => p.thread_participants.isBot);

  return c.json({
    total: participantsList.length,
    humans: humans.length,
    bots: bots.length,
    participants: participantsList.map((p) => {
      const user = p.users;
      const participant = p.thread_participants;

      // Apply consent filtering
      if (user?.consentStatus === "private" && !context.isAuthenticated) {
        return null;
      }

      const isAnonymous = user?.consentStatus === "anonymous";

      return {
        userId: isAnonymous ? "anonymous" : participant.userId,
        username: isAnonymous ? "Anonymous" : (user?.username ?? "Unknown"),
        avatar: isAnonymous ? null : (user?.avatar ?? null),
        isBot: participant.isBot,
        messageCount: participant.messageCount,
        joinedAt: participant.joinedAt.toISOString(),
        lastMessageAt: participant.lastMessageAt?.toISOString() ?? null,
      };
    }).filter(Boolean),
  });
});

// GET /threads/by-slug/:serverId/:slug
app.get("/by-slug/:serverId/:slug", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");
  const slug = c.req.param("slug");

  const threadResult = await db
    .select()
    .from(threads)
    .where(
      and(eq(threads.serverId, serverId), eq(threads.slug, slug), isNull(threads.deletedAt))
    )
    .limit(1);

  const result = threadResult[0];

  if (!result) {
    return c.json({ error: "Thread not found", code: "NOT_FOUND" }, 404);
  }

  // Redirect to the full thread endpoint
  return c.redirect(`/threads/${result.id}`);
});

export default app;
