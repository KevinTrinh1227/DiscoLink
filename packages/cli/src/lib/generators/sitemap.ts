interface ThreadSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
}

interface SitemapOptions {
  baseUrl: string;
}

export function generateSitemap(
  threads: ThreadSummary[],
  options: SitemapOptions
): string {
  const { baseUrl } = options;

  const urls = [
    // Index page
    {
      loc: baseUrl,
      lastmod: threads[0]?.lastActivityAt ?? new Date().toISOString(),
      changefreq: "daily",
      priority: "1.0",
    },
    // Thread pages
    ...threads.map((thread) => ({
      loc: `${baseUrl}/threads/${thread.slug}.html`,
      lastmod: thread.lastActivityAt,
      changefreq: getChangeFrequency(thread),
      priority: getPriority(thread),
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod.split("T")[0]}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;
}

function getChangeFrequency(thread: ThreadSummary): string {
  const lastActivity = new Date(thread.lastActivityAt);
  const now = new Date();
  const daysSinceActivity = Math.floor(
    (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceActivity < 1) return "hourly";
  if (daysSinceActivity < 7) return "daily";
  if (daysSinceActivity < 30) return "weekly";
  if (daysSinceActivity < 365) return "monthly";
  return "yearly";
}

function getPriority(thread: ThreadSummary): string {
  // Higher priority for resolved threads (more useful as references)
  // and threads with more messages (more engagement)
  let priority = 0.5;

  if (thread.status === "resolved") {
    priority += 0.2;
  }

  if (thread.messageCount > 10) {
    priority += 0.1;
  }

  if (thread.messageCount > 50) {
    priority += 0.1;
  }

  return Math.min(priority, 0.9).toFixed(1);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
