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
  eq,
  and,
  isNull,
} from "@discord-forum-api/db";
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

  // Get thread counts using COUNT(*) for efficiency
  const totalThreadsResult = await db
    .select()
    .from(threads)
    .where(and(eq(threads.serverId, serverId), isNull(threads.deletedAt)));
  const totalThreads = totalThreadsResult.length;

  const openThreadsResult = await db
    .select()
    .from(threads)
    .where(and(eq(threads.serverId, serverId), eq(threads.status, "open"), isNull(threads.deletedAt)));
  const openThreads = openThreadsResult.length;

  const resolvedThreadsResult = await db
    .select()
    .from(threads)
    .where(and(eq(threads.serverId, serverId), eq(threads.status, "resolved"), isNull(threads.deletedAt)));
  const resolvedThreads = resolvedThreadsResult.length;

  const archivedThreadsResult = await db
    .select()
    .from(threads)
    .where(and(eq(threads.serverId, serverId), eq(threads.isArchived, true), isNull(threads.deletedAt)));
  const archivedThreads = archivedThreadsResult.length;

  // Get message count
  const totalMessagesResult = await db
    .select()
    .from(messages)
    .where(and(eq(messages.serverId, serverId), isNull(messages.deletedAt)));
  const totalMessages = totalMessagesResult.length;

  // Get human vs bot message counts
  const messagesByType = await db
    .select()
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.serverId, serverId), isNull(messages.deletedAt)));

  const humanMessages = messagesByType.filter((r) => !r.users.isBot).length;
  const botMessages = messagesByType.filter((r) => r.users.isBot).length;

  // Get channel count
  const channelCountResult = await db
    .select()
    .from(channels)
    .where(and(eq(channels.serverId, serverId), isNull(channels.deletedAt)));
  const channelCount = channelCountResult.length;

  // Get unique participant counts
  const participantResults = await db
    .select()
    .from(threadParticipants)
    .innerJoin(threads, eq(threadParticipants.threadId, threads.id))
    .where(and(eq(threads.serverId, serverId), isNull(threads.deletedAt)));

  const uniqueHumanParticipants = new Set(
    participantResults.filter((r) => !r.thread_participants.isBot).map((r) => r.thread_participants.userId)
  ).size;
  const uniqueBotParticipants = new Set(
    participantResults.filter((r) => r.thread_participants.isBot).map((r) => r.thread_participants.userId)
  ).size;

  // Get reaction stats
  const reactionResults = await db
    .select()
    .from(reactions)
    .innerJoin(messages, eq(reactions.messageId, messages.id))
    .where(and(eq(messages.serverId, serverId), isNull(messages.deletedAt)));

  const totalReactions = reactionResults.reduce((sum, r) => sum + (r.reactions.count ?? 0), 0);
  const uniqueEmojis = new Set(reactionResults.map((r) => r.reactions.emoji)).size;

  // Get top 5 contributors (by message count)
  const contributorMessages = await db
    .select()
    .from(messages)
    .innerJoin(users, eq(messages.authorId, users.id))
    .where(and(eq(messages.serverId, serverId), isNull(messages.deletedAt)));

  const contributorMap = new Map<string, { user: typeof contributorMessages[0]["users"]; count: number }>();
  for (const row of contributorMessages) {
    const authorId = row.messages.authorId;
    const existing = contributorMap.get(authorId);
    if (existing) {
      existing.count++;
    } else {
      contributorMap.set(authorId, { user: row.users, count: 1 });
    }
  }

  const topContributors = [...contributorMap.entries()]
    .map(([userId, data]) => ({
      userId,
      username: data.user.username,
      avatar: data.user.avatar,
      isBot: data.user.isBot,
      consentStatus: data.user.consentStatus,
      messageCount: data.count,
    }))
    .filter((c) => c.consentStatus !== "private")
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 5);

  // Get top 5 most active channels
  const channelThreads = await db
    .select()
    .from(threads)
    .innerJoin(channels, eq(threads.channelId, channels.id))
    .where(and(eq(threads.serverId, serverId), isNull(threads.deletedAt)));

  const channelStatsMap = new Map<string, { name: string; threadCount: number; messageCount: number }>();
  for (const row of channelThreads) {
    const channelId = row.threads.channelId;
    const existing = channelStatsMap.get(channelId);
    if (existing) {
      existing.threadCount++;
    } else {
      channelStatsMap.set(channelId, { name: row.channels.name, threadCount: 1, messageCount: 0 });
    }
  }

  // Get message counts per channel
  const channelMessageResults = await db
    .select()
    .from(messages)
    .where(and(eq(messages.serverId, serverId), isNull(messages.deletedAt)));

  for (const row of channelMessageResults) {
    const channelId = row.channelId;
    const existing = channelStatsMap.get(channelId);
    if (existing) {
      existing.messageCount++;
    }
  }

  const topChannels = [...channelStatsMap.entries()]
    .map(([channelId, stats]) => ({
      channelId,
      channelName: stats.name,
      threadCount: stats.threadCount,
      messageCount: stats.messageCount,
    }))
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 5);

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
    mostActiveChannels: topChannels,
    lastSyncAt: server.lastSyncAt?.toISOString() ?? null,
  });
});

export default app;
