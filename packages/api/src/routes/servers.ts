import { Hono } from "hono";
import {
  getDb,
  servers,
  channels,
  tags,
  threads,
  messages,
  reactions,
  users,
  threadParticipants,
  scheduledEvents,
  eq,
  and,
  isNull,
  sql,
} from "@discolink/db";
import { cacheMiddleware, serverCacheKey } from "../middleware/cache.js";

const app = new Hono();

// Cache stats for 60 seconds per server
app.use("/:serverId/stats", cacheMiddleware(60, serverCacheKey));

// GET /servers/:serverId
app.get("/:serverId", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");

  const serverResult = await db
    .select()
    .from(servers)
    .where(and(eq(servers.id, serverId), eq(servers.isActive, true)))
    .limit(1);

  const server = serverResult[0];

  if (!server) {
    return c.json({ error: "Server not found", code: "NOT_FOUND" }, 404);
  }

  return c.json({
    id: server.id,
    name: server.name,
    icon: server.icon,
    description: server.description,
    memberCount: server.memberCount,
  });
});

// GET /servers/:serverId/channels
app.get("/:serverId/channels", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");

  // Verify server exists
  const serverResult = await db
    .select()
    .from(servers)
    .where(and(eq(servers.id, serverId), eq(servers.isActive, true)))
    .limit(1);

  if (serverResult.length === 0) {
    return c.json({ error: "Server not found", code: "NOT_FOUND" }, 404);
  }

  const channelList = await db
    .select()
    .from(channels)
    .where(and(eq(channels.serverId, serverId), isNull(channels.deletedAt)))
    .orderBy(channels.position);

  return c.json({
    channels: channelList.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      topic: ch.topic,
      position: ch.position,
      parentId: ch.parentId,
    })),
  });
});

// GET /servers/:serverId/tags
app.get("/:serverId/tags", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");

  // Get all tags from channels in this server
  const tagList = await db
    .select()
    .from(tags)
    .innerJoin(channels, eq(tags.channelId, channels.id))
    .where(and(eq(channels.serverId, serverId), isNull(channels.deletedAt)));

  return c.json({
    tags: tagList.map((row) => ({
      id: row.tags.id,
      name: row.tags.name,
      emoji: row.tags.emoji,
      channelId: row.channels.id,
      channelName: row.channels.name,
    })),
  });
});

// GET /servers/:serverId/stats
app.get("/:serverId/stats", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DbClient union doesn't support .select({}) with custom fields
  const qb = db as any;

  // Thread counts - single query with CASE WHEN aggregation
  const threadStatsRows: Array<{ total: number; open: number; resolved: number; archived: number }> = await qb
    .select({
      total: sql<number>`COUNT(*)`,
      open: sql<number>`SUM(CASE WHEN ${threads.status} = 'open' THEN 1 ELSE 0 END)`,
      resolved: sql<number>`SUM(CASE WHEN ${threads.status} = 'resolved' THEN 1 ELSE 0 END)`,
      archived: sql<number>`SUM(CASE WHEN ${threads.isArchived} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(threads)
    .where(and(eq(threads.serverId, serverId), isNull(threads.deletedAt)));

  const ts = threadStatsRows[0];
  const totalThreads = Number(ts?.total ?? 0);
  const openThreads = Number(ts?.open ?? 0);
  const resolvedThreads = Number(ts?.resolved ?? 0);
  const archivedThreads = Number(ts?.archived ?? 0);

  // Message counts - single query with JOIN for human/bot split
  const messageStatsRows: Array<{ total: number; byHumans: number; byBots: number }> = await qb
    .select({
      total: sql<number>`COUNT(*)`,
      byHumans: sql<number>`SUM(CASE WHEN ${users.isBot} = 0 OR ${users.isBot} IS NULL THEN 1 ELSE 0 END)`,
      byBots: sql<number>`SUM(CASE WHEN ${users.isBot} = 1 THEN 1 ELSE 0 END)`,
    })
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.serverId, serverId), isNull(messages.deletedAt)));

  const ms = messageStatsRows[0];
  const totalMessages = Number(ms?.total ?? 0);
  const humanMessages = Number(ms?.byHumans ?? 0);
  const botMessages = Number(ms?.byBots ?? 0);

  // Channel count
  const channelCountRows: Array<{ count: number }> = await qb
    .select({ count: sql<number>`COUNT(*)` })
    .from(channels)
    .where(and(eq(channels.serverId, serverId), isNull(channels.deletedAt)));
  const channelCount = Number(channelCountRows[0]?.count ?? 0);

  // Unique participant counts
  const participantStatsRows: Array<{ humans: number; bots: number }> = await qb
    .select({
      humans: sql<number>`COUNT(DISTINCT CASE WHEN ${threadParticipants.isBot} = 0 THEN ${threadParticipants.userId} END)`,
      bots: sql<number>`COUNT(DISTINCT CASE WHEN ${threadParticipants.isBot} = 1 THEN ${threadParticipants.userId} END)`,
    })
    .from(threadParticipants)
    .innerJoin(threads, eq(threadParticipants.threadId, threads.id))
    .where(and(eq(threads.serverId, serverId), isNull(threads.deletedAt)));

  const ps = participantStatsRows[0];
  const uniqueHumanParticipants = Number(ps?.humans ?? 0);
  const uniqueBotParticipants = Number(ps?.bots ?? 0);

  // Reaction stats
  const reactionStatsRows: Array<{ total: number; uniqueEmojis: number }> = await qb
    .select({
      total: sql<number>`COALESCE(SUM(${reactions.count}), 0)`,
      uniqueEmojis: sql<number>`COUNT(DISTINCT ${reactions.emoji})`,
    })
    .from(reactions)
    .innerJoin(messages, eq(reactions.messageId, messages.id))
    .where(and(eq(messages.serverId, serverId), isNull(messages.deletedAt)));

  const rs = reactionStatsRows[0];
  const totalReactions = Number(rs?.total ?? 0);
  const uniqueEmojis = Number(rs?.uniqueEmojis ?? 0);

  // Top 5 contributors - GROUP BY with ORDER BY
  const topContributorsResult: Array<{
    userId: string;
    username: string;
    avatar: string | null;
    isBot: boolean | null;
    consentStatus: string | null;
    messageCount: number;
  }> = await qb
    .select({
      userId: messages.authorId,
      username: users.username,
      avatar: users.avatar,
      isBot: users.isBot,
      consentStatus: users.consentStatus,
      messageCount: sql<number>`COUNT(*)`,
    })
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.serverId, serverId), isNull(messages.deletedAt)))
    .groupBy(messages.authorId)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(10);

  const topContributors = topContributorsResult
    .filter((c) => c.consentStatus !== "private")
    .slice(0, 5);

  // Top 5 most active channels - GROUP BY with message counts
  const topChannelsResult: Array<{
    channelId: string;
    channelName: string;
    threadCount: number;
    messageCount: number;
  }> = await qb
    .select({
      channelId: threads.channelId,
      channelName: channels.name,
      threadCount: sql<number>`COUNT(DISTINCT ${threads.id})`,
      messageCount: sql<number>`COALESCE(SUM(${threads.messageCount}), 0)`,
    })
    .from(threads)
    .innerJoin(channels, eq(threads.channelId, channels.id))
    .where(and(eq(threads.serverId, serverId), isNull(threads.deletedAt)))
    .groupBy(threads.channelId)
    .orderBy(sql`SUM(${threads.messageCount}) DESC`)
    .limit(5);

  // Calculate average messages per thread
  const avgMessagesPerThread = totalThreads > 0 ? Math.round(totalMessages / totalThreads) : 0;

  return c.json({
    serverId: server.id,
    serverName: server.name,
    stats: {
      threads: {
        total: totalThreads,
        open: openThreads,
        resolved: resolvedThreads,
        archived: archivedThreads,
      },
      messages: {
        total: totalMessages,
        byHumans: humanMessages,
        byBots: botMessages,
        avgPerThread: avgMessagesPerThread,
      },
      participants: {
        unique: uniqueHumanParticipants + uniqueBotParticipants,
        humans: uniqueHumanParticipants,
        bots: uniqueBotParticipants,
      },
      channels: channelCount,
      reactions: {
        total: totalReactions,
        uniqueEmojis: uniqueEmojis,
      },
    },
    topContributors: topContributors.map((c) => ({
      userId: c.consentStatus === "anonymous" ? "anonymous" : c.userId,
      username: c.consentStatus === "anonymous" ? "Anonymous" : c.username,
      avatar: c.consentStatus === "anonymous" ? null : c.avatar,
      isBot: c.isBot,
      messageCount: c.messageCount,
    })),
    mostActiveChannels: topChannelsResult,
    lastSyncAt: server.lastSyncAt?.toISOString() ?? null,
  });
});

// GET /servers/:serverId/events - List scheduled events
app.get("/:serverId/events", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");

  // Verify server exists
  const serverResult = await db
    .select()
    .from(servers)
    .where(and(eq(servers.id, serverId), eq(servers.isActive, true)))
    .limit(1);

  if (serverResult.length === 0) {
    return c.json({ error: "Server not found", code: "NOT_FOUND" }, 404);
  }

  const eventsList = await db
    .select()
    .from(scheduledEvents)
    .where(eq(scheduledEvents.serverId, serverId))
    .orderBy(scheduledEvents.scheduledStartTime);

  return c.json({
    events: eventsList.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      scheduledStartTime: e.scheduledStartTime.toISOString(),
      scheduledEndTime: e.scheduledEndTime?.toISOString() ?? null,
      entityType: e.entityType,
      status: e.status,
      channelId: e.channelId,
      location: e.location,
      userCount: e.userCount,
      image: e.image,
    })),
  });
});

export default app;
