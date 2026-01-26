import { Hono } from "hono";
import { z } from "zod";
import {
  getDb,
  threads,
  messages,
  users,
  eq,
  and,
  isNull,
  like,
  desc,
  sql,
} from "@discordlink/db";
import { filterThreadsByConsent, filterMessagesByConsent, type ConsentCheckContext } from "../lib/consent.js";
import { cacheMiddleware, publicCacheKey } from "../middleware/cache.js";

const app = new Hono();

// Cache search results for 30 seconds (only for unauthenticated requests)
app.use("/*", cacheMiddleware(30, publicCacheKey));

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  serverId: z.string().optional(),
  channelId: z.string().optional(),
  type: z.enum(["threads", "messages", "all"]).default("all"),
  limit: z.coerce.number().min(1).max(50).default(20),
  useFts: z.coerce.boolean().default(true), // Use FTS5 if available
});

// Check if FTS5 tables exist
let ftsAvailable: boolean | null = null;

async function checkFtsAvailability(db: ReturnType<typeof getDb>): Promise<boolean> {
  if (ftsAvailable !== null) return ftsAvailable;

  try {
    // Try to query the FTS table
    await db.all(sql`SELECT 1 FROM messages_fts LIMIT 1`);
    ftsAvailable = true;
  } catch {
    ftsAvailable = false;
  }

  return ftsAvailable;
}

// GET /search
app.get("/", async (c) => {
  const db = getDb();

  const result = searchSchema.safeParse({
    q: c.req.query("q"),
    serverId: c.req.query("serverId"),
    channelId: c.req.query("channelId"),
    type: c.req.query("type"),
    limit: c.req.query("limit"),
    useFts: c.req.query("useFts"),
  });

  if (!result.success) {
    return c.json(
      { error: "Invalid search parameters", code: "VALIDATION_ERROR", details: result.error.errors },
      400
    );
  }

  const { q, serverId, channelId, type, limit, useFts } = result.data;

  // Check if FTS5 is available
  const ftsEnabled = useFts && (await checkFtsAvailability(db));

  const context: ConsentCheckContext = {
    requesterId: c.get("user")?.sub,
    requesterGuildIds: c.get("userGuildIds"),
    isAuthenticated: c.get("isAuthenticated"),
  };

  const searchResults: {
    threads: unknown[];
    messages: unknown[];
  } = {
    threads: [],
    messages: [],
  };

  // Escape special characters for FTS5 query
  const sanitizeFtsQuery = (query: string): string => {
    // Remove special FTS5 operators and escape quotes
    return query
      .replace(/['"]/g, "")
      .replace(/[+\-*^~()]/g, " ")
      .trim();
  };

  // Search threads (always uses LIKE since titles are short)
  if (type === "threads" || type === "all") {
    const threadConditions = [
      isNull(threads.deletedAt),
      eq(threads.visibility, "public"),
      like(threads.title, `%${q}%`),
    ];

    if (serverId) threadConditions.push(eq(threads.serverId, serverId));
    if (channelId) threadConditions.push(eq(threads.channelId, channelId));

    const threadResultList = await db
      .select()
      .from(threads)
      .leftJoin(users, eq(threads.authorId, users.id))
      .where(and(...threadConditions))
      .orderBy(desc(threads.lastActivityAt))
      .limit(limit);

    const filteredThreads = threadResultList.map((r) => {
      const filtered = filterThreadsByConsent(
        [{ ...r.threads, author: r.users }],
        r.threads.serverId,
        context
      );
      return filtered[0];
    }).filter(Boolean);

    searchResults.threads = filteredThreads.map((t) => ({
      id: t?.id,
      title: t?.title,
      slug: t?.slug,
      serverId: t?.serverId,
      channelId: t?.channelId,
      messageCount: t?.messageCount,
      createdAt: t?.createdAt.toISOString(),
      author: t?.author
        ? { id: t.author.id, username: t.author.username, avatar: t.author.avatar }
        : null,
    }));
  }

  // Search messages - use FTS5 if available, otherwise fallback to LIKE
  if (type === "messages" || type === "all") {
    let messageResultList: Array<{
      messages: typeof messages.$inferSelect;
      users: typeof users.$inferSelect | null;
      threads: typeof threads.$inferSelect | null;
    }>;

    if (ftsEnabled) {
      // Use FTS5 for full-text search (much faster for large datasets)
      const ftsQuery = sanitizeFtsQuery(q);
      const serverFilter = serverId ? sql`AND m.server_id = ${serverId}` : sql``;
      const channelFilter = channelId ? sql`AND m.channel_id = ${channelId}` : sql``;

      const ftsResults = await db.all<{
        id: string;
        thread_id: string;
        channel_id: string;
        server_id: string;
        author_id: string;
        content: string;
        content_html: string | null;
        reply_to_id: string | null;
        is_answer: number;
        is_pinned: number;
        is_edited: number;
        edit_count: number;
        reaction_count: number;
        type: number;
        flags: number;
        embeds: string | null;
        components: string | null;
        stickers: string | null;
        mentioned_user_ids: string | null;
        mentioned_role_ids: string | null;
        mentioned_channel_ids: string | null;
        system_message_type: string | null;
        webhook_id: string | null;
        application_id: string | null;
        created_at: number;
        edited_at: number | null;
        deleted_at: number | null;
        rank: number;
      }>(sql`
        SELECT m.*, rank
        FROM messages_fts
        JOIN messages m ON messages_fts.rowid = m.rowid
        WHERE messages_fts MATCH ${ftsQuery}
          AND m.deleted_at IS NULL
          ${serverFilter}
          ${channelFilter}
        ORDER BY rank
        LIMIT ${limit}
      `);

      // Fetch related data for FTS results
      if (ftsResults.length > 0) {
        const messageIds = ftsResults.map((r) => r.id);
        const relatedData = await db
          .select()
          .from(messages)
          .leftJoin(users, eq(messages.authorId, users.id))
          .leftJoin(threads, eq(messages.threadId, threads.id))
          .where(sql`${messages.id} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`);

        messageResultList = relatedData;
      } else {
        messageResultList = [];
      }
    } else {
      // Fallback to LIKE search
      const messageConditions = [isNull(messages.deletedAt), like(messages.content, `%${q}%`)];

      if (serverId) messageConditions.push(eq(messages.serverId, serverId));
      if (channelId) messageConditions.push(eq(messages.channelId, channelId));

      messageResultList = await db
        .select()
        .from(messages)
        .leftJoin(users, eq(messages.authorId, users.id))
        .leftJoin(threads, eq(messages.threadId, threads.id))
        .where(and(...messageConditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
    }

    // Filter by thread visibility
    const filteredMessageResults = messageResultList.filter(
      (r) => r.threads?.visibility === "public"
    );

    const filteredMessages = filterMessagesByConsent(
      filteredMessageResults.map((r) => ({ ...r.messages, author: r.users })),
      filteredMessageResults[0]?.messages.serverId ?? "",
      context
    );

    searchResults.messages = filteredMessages.map((m, i) => ({
      id: m.id,
      content: m.content.slice(0, 200) + (m.content.length > 200 ? "..." : ""),
      createdAt: m.createdAt.toISOString(),
      author: m.author
        ? { id: m.author.id, username: m.author.username, avatar: m.author.avatar }
        : null,
      thread: filteredMessageResults[i]?.threads
        ? {
            id: filteredMessageResults[i]?.threads?.id,
            title: filteredMessageResults[i]?.threads?.title,
            slug: filteredMessageResults[i]?.threads?.slug,
          }
        : null,
    }));
  }

  return c.json({
    query: q,
    searchMethod: ftsEnabled ? "fts5" : "like",
    results: searchResults,
    counts: {
      threads: searchResults.threads.length,
      messages: searchResults.messages.length,
    },
  });
});

export default app;
