import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { resolve, join } from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { ApiClient } from "../lib/api-client.js";
import { generateHtml } from "../lib/generators/html.js";
import { generateSitemap } from "../lib/generators/sitemap.js";
import { generateRss } from "../lib/generators/rss.js";

interface ExportOptions {
  server?: string;
  thread?: string;
  channel?: string;
  output: string;
  template: string;
  baseUrl?: string;
  apiUrl: string;
  clean: boolean;
}

export const exportCommand = new Command("export")
  .description("Export Discord content to static HTML files")
  .option("-s, --server <id>", "Server ID to export")
  .option("-t, --thread <id>", "Single thread ID to export")
  .option("-c, --channel <id>", "Channel ID to export")
  .option("-o, --output <dir>", "Output directory", "./dist")
  .option("--template <name>", "Template to use (faq, changelog, kb, blog)", "faq")
  .option("--base-url <url>", "Base URL for generated links")
  .option("--api-url <url>", "DiscoLink API URL", "http://localhost:3000")
  .option("--clean", "Clean output directory before export", false)
  .action(async (options: ExportOptions) => {
    const spinner = ora("Starting export...").start();

    try {
      // Validate options
      if (!options.server && !options.thread) {
        spinner.fail("Either --server or --thread is required");
        process.exit(1);
      }

      const outputDir = resolve(options.output);
      const client = new ApiClient(options.apiUrl);

      // Clean output directory if requested
      if (options.clean && existsSync(outputDir)) {
        spinner.text = "Cleaning output directory...";
        await rm(outputDir, { recursive: true });
      }

      // Create output directory
      await mkdir(outputDir, { recursive: true });

      if (options.thread) {
        // Export single thread
        spinner.text = `Fetching thread ${options.thread}...`;
        const thread = await client.getThread(options.thread);

        spinner.text = "Generating HTML...";
        const html = generateHtml(thread, options.template, {
          baseUrl: options.baseUrl ?? "",
        });

        await writeFile(join(outputDir, "index.html"), html);
        spinner.succeed(`Exported thread to ${outputDir}/index.html`);
      } else if (options.server) {
        // Export entire server
        spinner.text = `Fetching server ${options.server}...`;
        const server = await client.getServer(options.server);

        spinner.text = "Fetching threads...";
        const threads = await client.getAllThreads(options.server, options.channel);

        spinner.text = `Generating ${threads.length} thread pages...`;

        // Create threads directory
        const threadsDir = join(outputDir, "threads");
        await mkdir(threadsDir, { recursive: true });

        // Generate individual thread pages
        for (const threadSummary of threads) {
          const thread = await client.getThread(threadSummary.id);
          const html = generateHtml(thread, options.template, {
            baseUrl: options.baseUrl ?? "",
            server,
          });
          await writeFile(join(threadsDir, `${thread.slug}.html`), html);
        }

        // Generate index page
        spinner.text = "Generating index page...";
        const indexHtml = generateIndexHtml(server, threads, {
          baseUrl: options.baseUrl ?? "",
        });
        await writeFile(join(outputDir, "index.html"), indexHtml);

        // Generate sitemap
        spinner.text = "Generating sitemap...";
        const sitemap = generateSitemap(threads, {
          baseUrl: options.baseUrl ?? `https://${server.name.toLowerCase().replace(/\s+/g, "-")}.discolink.dev`,
        });
        await writeFile(join(outputDir, "sitemap.xml"), sitemap);

        // Generate RSS feed
        spinner.text = "Generating RSS feed...";
        const rss = generateRss(threads, {
          baseUrl: options.baseUrl ?? `https://${server.name.toLowerCase().replace(/\s+/g, "-")}.discolink.dev`,
          server,
        });
        await writeFile(join(outputDir, "feed.xml"), rss);

        // Generate robots.txt
        const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${options.baseUrl ?? ""}/sitemap.xml
`;
        await writeFile(join(outputDir, "robots.txt"), robotsTxt);

        spinner.succeed(
          chalk.green(`Exported ${threads.length} threads to ${outputDir}`)
        );
        console.log(`
${chalk.bold("Generated files:")}
  - index.html
  - threads/*.html (${threads.length} pages)
  - sitemap.xml
  - feed.xml
  - robots.txt
`);
      }
    } catch (error) {
      spinner.fail(
        `Export failed: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

function generateIndexHtml(
  server: { name: string; description?: string | null },
  threads: Array<{ id: string; title: string; slug: string; status: string; messageCount: number; createdAt: string }>,
  options: { baseUrl: string }
): string {
  const baseUrl = options.baseUrl;
  const resolvedThreads = threads.filter((t) => t.status === "resolved");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${server.name} - DiscoLink</title>
  <meta name="description" content="${server.description ?? `Community content from ${server.name}`}">
  <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="${baseUrl}/feed.xml">
  <style>
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f3f4f6;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --accent: #5865F2;
      --border: #e5e7eb;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #1f2937;
        --bg-secondary: #111827;
        --text-primary: #f9fafb;
        --text-secondary: #9ca3af;
        --border: #374151;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-secondary);
      color: var(--text-primary);
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
    header { text-align: center; margin-bottom: 3rem; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .subtitle { color: var(--text-secondary); font-size: 1.1rem; }
    .stats { display: flex; gap: 2rem; justify-content: center; margin-top: 1rem; }
    .stat { text-align: center; }
    .stat-value { font-size: 1.5rem; font-weight: bold; color: var(--accent); }
    .stat-label { color: var(--text-secondary); font-size: 0.9rem; }
    .threads { display: grid; gap: 1rem; }
    .thread-card {
      background: var(--bg-primary);
      border-radius: 8px;
      padding: 1.5rem;
      border: 1px solid var(--border);
      transition: box-shadow 0.2s;
    }
    .thread-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .thread-card a { color: inherit; text-decoration: none; }
    .thread-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
    .thread-meta { color: var(--text-secondary); font-size: 0.9rem; }
    .status-badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .status-open { background: #fef3c7; color: #92400e; }
    .status-resolved { background: #d1fae5; color: #065f46; }
    .status-locked { background: #fee2e2; color: #991b1b; }
    footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    footer a { color: var(--accent); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${server.name}</h1>
      <p class="subtitle">${server.description ?? "Community knowledge base powered by Discord"}</p>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${threads.length}</div>
          <div class="stat-label">Topics</div>
        </div>
        <div class="stat">
          <div class="stat-value">${resolvedThreads.length}</div>
          <div class="stat-label">Resolved</div>
        </div>
      </div>
    </header>

    <main class="threads">
${threads
  .map(
    (t) => `      <article class="thread-card">
        <a href="${baseUrl}/threads/${t.slug}.html">
          <h2 class="thread-title">${escapeHtml(t.title)}</h2>
          <div class="thread-meta">
            <span class="status-badge status-${t.status}">${t.status}</span>
            &middot; ${t.messageCount} messages
            &middot; ${new Date(t.createdAt).toLocaleDateString()}
          </div>
        </a>
      </article>`
  )
  .join("\n")}
    </main>

    <footer>
      <p>Powered by <a href="https://discolink.dev">DiscoLink</a></p>
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
