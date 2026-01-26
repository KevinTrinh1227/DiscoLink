interface ThreadSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
  author: {
    id: string;
    username: string;
    avatar: string | null;
  } | null;
}

interface Server {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
}

interface RssOptions {
  baseUrl: string;
  server?: Server;
}

export function generateRss(
  threads: ThreadSummary[],
  options: RssOptions
): string {
  const { baseUrl, server } = options;
  const title = server?.name ?? "DiscordLink";
  const description = server?.description ?? "Discord forum threads";
  const now = new Date().toUTCString();

  const items = threads.slice(0, 50).map((thread) => {
    const pubDate = new Date(thread.createdAt).toUTCString();
    const author = thread.author?.username ?? "Unknown";

    return `    <item>
      <title>${escapeXml(thread.title)}</title>
      <link>${baseUrl}/threads/${thread.slug}.html</link>
      <guid isPermaLink="true">${baseUrl}/threads/${thread.slug}.html</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(author)}</author>
      <description>${escapeXml(`Thread with ${thread.messageCount} messages. Status: ${thread.status}`)}</description>
    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${baseUrl}</link>
    <description>${escapeXml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items.join("\n")}
  </channel>
</rss>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
