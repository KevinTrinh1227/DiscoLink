import { Hono } from "hono";
import {
  getDb,
  servers,
  channels,
  threads,
  users,
  eq,
  and,
  isNull,
  desc,
} from "@discolink/db";
import { cacheMiddleware, serverCacheKey } from "../middleware/cache.js";

const app = new Hono();

// Cache feeds for 5 minutes
app.use("/*", cacheMiddleware(300, serverCacheKey));

// Helper to escape XML entities
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Helper to get threads for feed
async function getThreadsForFeed(
  db: ReturnType<typeof getDb>,
  serverId: string,
  channelId?: string,
  limit = 50
) {
  const conditions = [
    eq(threads.serverId, serverId),
    eq(threads.visibility, "public"),
    isNull(threads.deletedAt),
  ];

  if (channelId) {
    conditions.push(eq(threads.channelId, channelId));
  }

  return db
    .select()
    .from(threads)
    .leftJoin(users, eq(threads.authorId, users.id))
    .leftJoin(channels, eq(threads.channelId, channels.id))
    .where(and(...conditions))
    .orderBy(desc(threads.createdAt))
    .limit(limit);
}

// GET /feeds/:serverId/rss - RSS 2.0 feed
app.get("/:serverId/rss", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");
  const channelId = c.req.query("channelId");

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

  const threadList = await getThreadsForFeed(db, serverId, channelId);

  const baseUrl = c.req.url.split("/feeds")[0];
  const feedUrl = c.req.url;
  const lastBuildDate = threadList[0]?.threads.createdAt ?? new Date();

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(server.name)} - DiscoLink</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(server.description ?? `Threads from ${server.name}`)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <generator>DiscoLink</generator>
${threadList
  .map((row) => {
    const thread = row.threads;
    const author = row.users;
    const channel = row.channels;
    const authorName = author?.consentStatus === "anonymous" ? "Anonymous" : (author?.username ?? "Unknown");

    return `    <item>
      <title>${escapeXml(thread.title)}</title>
      <link>${escapeXml(`${baseUrl}/threads/${thread.id}`)}</link>
      <guid isPermaLink="true">${escapeXml(`${baseUrl}/threads/${thread.id}`)}</guid>
      <pubDate>${thread.createdAt.toUTCString()}</pubDate>
      <author>${escapeXml(authorName)}</author>
      <category>${escapeXml(channel?.name ?? "General")}</category>
      <description><![CDATA[Thread in ${escapeXml(channel?.name ?? "Unknown")} with ${thread.messageCount} messages. Status: ${thread.status}]]></description>
    </item>`;
  })
  .join("\n")}
  </channel>
</rss>`;

  c.header("Content-Type", "application/rss+xml; charset=utf-8");
  return c.body(rss);
});

// GET /feeds/:serverId/atom - Atom feed
app.get("/:serverId/atom", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");
  const channelId = c.req.query("channelId");

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

  const threadList = await getThreadsForFeed(db, serverId, channelId);

  const baseUrl = c.req.url.split("/feeds")[0];
  const feedUrl = c.req.url;
  const updatedAt = threadList[0]?.threads.lastActivityAt ?? new Date();

  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(server.name)} - DiscoLink</title>
  <link href="${escapeXml(baseUrl)}" rel="alternate"/>
  <link href="${escapeXml(feedUrl)}" rel="self"/>
  <id>${escapeXml(`${baseUrl}/feeds/${serverId}/atom`)}</id>
  <updated>${updatedAt.toISOString()}</updated>
  <subtitle>${escapeXml(server.description ?? `Threads from ${server.name}`)}</subtitle>
  <generator uri="https://discolink.site">DiscoLink</generator>
${threadList
  .map((row) => {
    const thread = row.threads;
    const author = row.users;
    const channel = row.channels;
    const authorName = author?.consentStatus === "anonymous" ? "Anonymous" : (author?.username ?? "Unknown");

    return `  <entry>
    <title>${escapeXml(thread.title)}</title>
    <link href="${escapeXml(`${baseUrl}/threads/${thread.id}`)}"/>
    <id>${escapeXml(`${baseUrl}/threads/${thread.id}`)}</id>
    <published>${thread.createdAt.toISOString()}</published>
    <updated>${thread.lastActivityAt.toISOString()}</updated>
    <author>
      <name>${escapeXml(authorName)}</name>
    </author>
    <category term="${escapeXml(channel?.name ?? "General")}"/>
    <summary>Thread in ${escapeXml(channel?.name ?? "Unknown")} with ${thread.messageCount} messages. Status: ${thread.status}</summary>
  </entry>`;
  })
  .join("\n")}
</feed>`;

  c.header("Content-Type", "application/atom+xml; charset=utf-8");
  return c.body(atom);
});

// GET /feeds/:serverId/json - JSON Feed
app.get("/:serverId/json", async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");
  const channelId = c.req.query("channelId");

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

  const threadList = await getThreadsForFeed(db, serverId, channelId);

  const baseUrl = c.req.url.split("/feeds")[0];
  const feedUrl = c.req.url;

  const jsonFeed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${server.name} - DiscoLink`,
    home_page_url: baseUrl,
    feed_url: feedUrl,
    description: server.description ?? `Threads from ${server.name}`,
    icon: server.icon ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png` : null,
    items: threadList.map((row) => {
      const thread = row.threads;
      const author = row.users;
      const channel = row.channels;
      const authorName = author?.consentStatus === "anonymous" ? "Anonymous" : (author?.username ?? "Unknown");
      const authorAvatar = author?.consentStatus === "anonymous"
        ? null
        : author?.avatar
          ? `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png`
          : null;

      return {
        id: `${baseUrl}/threads/${thread.id}`,
        url: `${baseUrl}/threads/${thread.id}`,
        title: thread.title,
        content_text: `Thread in ${channel?.name ?? "Unknown"} with ${thread.messageCount} messages. Status: ${thread.status}`,
        date_published: thread.createdAt.toISOString(),
        date_modified: thread.lastActivityAt.toISOString(),
        authors: [
          {
            name: authorName,
            avatar: authorAvatar,
          },
        ],
        tags: [channel?.name ?? "General", thread.status],
        _discolink: {
          thread_id: thread.id,
          channel_id: thread.channelId,
          message_count: thread.messageCount,
          status: thread.status,
          is_archived: thread.isArchived,
          is_locked: thread.isLocked,
          is_pinned: thread.isPinned,
        },
      };
    }),
  };

  c.header("Content-Type", "application/feed+json; charset=utf-8");
  return c.json(jsonFeed);
});

// Channel-specific feeds
// GET /feeds/channels/:channelId/rss
app.get("/channels/:channelId/rss", async (c) => {
  const db = getDb();
  const channelId = c.req.param("channelId");

  // Get channel and its server
  const channelResult = await db
    .select()
    .from(channels)
    .where(and(eq(channels.id, channelId), isNull(channels.deletedAt)))
    .limit(1);

  const channel = channelResult[0];

  if (!channel) {
    return c.json({ error: "Channel not found", code: "NOT_FOUND" }, 404);
  }

  // Redirect to server feed with channel filter
  return c.redirect(`/feeds/${channel.serverId}/rss?channelId=${channelId}`);
});

// GET /feeds/channels/:channelId/atom
app.get("/channels/:channelId/atom", async (c) => {
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

  return c.redirect(`/feeds/${channel.serverId}/atom?channelId=${channelId}`);
});

// GET /feeds/channels/:channelId/json
app.get("/channels/:channelId/json", async (c) => {
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

  return c.redirect(`/feeds/${channel.serverId}/json?channelId=${channelId}`);
});

export default app;
