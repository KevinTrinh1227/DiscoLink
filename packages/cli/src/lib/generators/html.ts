interface Thread {
  id: string;
  title: string;
  slug: string;
  status: string;
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
  isArchived: boolean;
  isLocked: boolean;
  isPinned: boolean;
  tags: Array<{ id: string; name: string; emoji: string | null }>;
  author: {
    id: string;
    username: string;
    avatar: string | null;
  } | null;
  messages: Array<{
    id: string;
    content: string;
    contentHtml: string | null;
    createdAt: string;
    editedAt: string | null;
    isEdited: boolean;
    isAnswer: boolean;
    isPinned: boolean;
    author: {
      id: string;
      username: string;
      avatar: string | null;
      isBot: boolean;
    } | null;
    attachments: Array<{
      id: string;
      filename: string;
      url: string;
      contentType: string | null;
      width: number | null;
      height: number | null;
      isImage: boolean;
      isVideo: boolean;
    }>;
    reactions: Array<{
      emoji: string;
      emojiName: string | null;
      count: number;
      isCustom: boolean;
    }>;
  }>;
}

interface Server {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
}

interface GeneratorOptions {
  baseUrl?: string;
  server?: Server;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getAvatarUrl(userId: string, avatar: string | null): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
  }
  return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 5}.png`;
}

export function generateHtml(
  thread: Thread,
  template: string,
  options: GeneratorOptions
): string {
  const baseUrl = options.baseUrl ?? "";
  const serverName = options.server?.name ?? "DiscoLink";

  // Generate JSON-LD schema based on template
  const jsonLd = generateJsonLd(thread, template, options);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(thread.title)} - ${serverName}</title>
  <meta name="description" content="${escapeHtml(thread.messages[0]?.content.slice(0, 160) ?? thread.title)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${baseUrl}/threads/${thread.slug}.html">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(thread.title)}">
  <meta property="og:description" content="${escapeHtml(thread.messages[0]?.content.slice(0, 160) ?? thread.title)}">
  <meta property="og:url" content="${baseUrl}/threads/${thread.slug}.html">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(thread.title)}">
  <meta name="twitter:description" content="${escapeHtml(thread.messages[0]?.content.slice(0, 160) ?? thread.title)}">

  <!-- JSON-LD -->
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <style>
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f3f4f6;
      --bg-tertiary: #e5e7eb;
      --text-primary: #111827;
      --text-secondary: #6b7280;
      --accent: #5865F2;
      --accent-hover: #4752c4;
      --border: #e5e7eb;
      --success: #10b981;
      --warning: #f59e0b;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #1f2937;
        --bg-secondary: #111827;
        --bg-tertiary: #374151;
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
    .container { max-width: 900px; margin: 0 auto; padding: 2rem; }

    /* Header */
    header { margin-bottom: 2rem; }
    .breadcrumb {
      color: var(--text-secondary);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    .breadcrumb a { color: var(--accent); text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .thread-meta {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      color: var(--text-secondary);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    .tags { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .tag {
      background: var(--bg-tertiary);
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85rem;
    }
    .status-badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .status-open { background: #fef3c7; color: #92400e; }
    .status-resolved { background: #d1fae5; color: #065f46; }
    .status-locked { background: #fee2e2; color: #991b1b; }

    /* Messages */
    .messages { display: flex; flex-direction: column; gap: 1rem; }
    .message {
      background: var(--bg-primary);
      border-radius: 8px;
      padding: 1.5rem;
      border: 1px solid var(--border);
    }
    .message.answer { border-left: 4px solid var(--success); }
    .message.pinned { border-left: 4px solid var(--warning); }
    .message-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }
    .author-info { flex: 1; }
    .author-name { font-weight: 600; }
    .author-name.bot::after {
      content: 'BOT';
      background: var(--accent);
      color: white;
      font-size: 0.65rem;
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
      margin-left: 0.5rem;
      vertical-align: middle;
    }
    .message-time { color: var(--text-secondary); font-size: 0.85rem; }
    .message-content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .message-content p { margin-bottom: 1rem; }
    .message-content p:last-child { margin-bottom: 0; }
    .message-content code {
      background: var(--bg-tertiary);
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }
    .message-content pre {
      background: var(--bg-tertiary);
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    .message-content pre code {
      background: none;
      padding: 0;
    }

    /* Attachments */
    .attachments {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .attachment-image {
      max-width: 100%;
      max-height: 400px;
      border-radius: 6px;
    }
    .attachment-file {
      background: var(--bg-tertiary);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .attachment-file a { color: var(--accent); text-decoration: none; }

    /* Reactions */
    .reactions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .reaction {
      background: var(--bg-tertiary);
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.9rem;
    }

    /* Footer */
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
      <nav class="breadcrumb">
        <a href="${baseUrl}/">${serverName}</a> &gt; ${escapeHtml(thread.title)}
      </nav>
      <h1>${escapeHtml(thread.title)}</h1>
      <div class="thread-meta">
        <span class="status-badge status-${thread.status}">${thread.status}</span>
        <span>${thread.messageCount} messages</span>
        <span>Started ${formatDate(thread.createdAt)}</span>
        ${thread.author ? `<span>by ${escapeHtml(thread.author.username)}</span>` : ""}
      </div>
      ${
        thread.tags.length > 0
          ? `<div class="tags">${thread.tags.map((t) => `<span class="tag">${t.emoji ?? ""}${escapeHtml(t.name)}</span>`).join("")}</div>`
          : ""
      }
    </header>

    <main class="messages">
${thread.messages.map((msg) => generateMessageHtml(msg)).join("\n")}
    </main>

    <footer>
      <p>Powered by <a href="https://discolink.dev">DiscoLink</a></p>
      <p>Last updated: ${formatDate(thread.lastActivityAt)}</p>
    </footer>
  </div>
</body>
</html>`;
}

function generateMessageHtml(msg: {
  id: string;
  content: string;
  contentHtml: string | null;
  createdAt: string;
  editedAt: string | null;
  isEdited: boolean;
  isAnswer: boolean;
  isPinned: boolean;
  author: {
    id: string;
    username: string;
    avatar: string | null;
    isBot: boolean;
  } | null;
  attachments: Array<{
    id: string;
    filename: string;
    url: string;
    contentType: string | null;
    width: number | null;
    height: number | null;
    isImage: boolean;
    isVideo: boolean;
  }>;
  reactions: Array<{
    emoji: string;
    emojiName: string | null;
    count: number;
    isCustom: boolean;
  }>;
}): string {
  const classes = ["message"];
  if (msg.isAnswer) classes.push("answer");
  if (msg.isPinned) classes.push("pinned");

  const authorName = msg.author?.username ?? "Unknown";
  const avatarUrl = msg.author
    ? getAvatarUrl(msg.author.id, msg.author.avatar)
    : getAvatarUrl("0", null);

  return `      <article class="${classes.join(" ")}" id="message-${msg.id}">
        <div class="message-header">
          <img src="${avatarUrl}" alt="${escapeHtml(authorName)}" class="avatar" loading="lazy">
          <div class="author-info">
            <span class="author-name${msg.author?.isBot ? " bot" : ""}">${escapeHtml(authorName)}</span>
            <div class="message-time">
              ${formatDate(msg.createdAt)} at ${formatTime(msg.createdAt)}
              ${msg.isEdited ? `<span title="Edited ${msg.editedAt ? formatDate(msg.editedAt) : ""}">(edited)</span>` : ""}
            </div>
          </div>
          ${msg.isAnswer ? '<span class="status-badge status-resolved">Answer</span>' : ""}
        </div>
        <div class="message-content">
          ${msg.contentHtml ?? escapeHtml(msg.content).replace(/\n/g, "<br>")}
        </div>
        ${
          msg.attachments.length > 0
            ? `<div class="attachments">
          ${msg.attachments
            .map((att) =>
              att.isImage
                ? `<img src="${att.url}" alt="${escapeHtml(att.filename)}" class="attachment-image" loading="lazy">`
                : `<div class="attachment-file"><a href="${att.url}" download>${escapeHtml(att.filename)}</a></div>`
            )
            .join("\n          ")}
        </div>`
            : ""
        }
        ${
          msg.reactions.length > 0
            ? `<div class="reactions">
          ${msg.reactions.map((r) => `<span class="reaction">${r.emoji} ${r.count}</span>`).join("\n          ")}
        </div>`
            : ""
        }
      </article>`;
}

function generateJsonLd(
  thread: Thread,
  template: string,
  options: GeneratorOptions
): object {
  const baseUrl = options.baseUrl ?? "";

  if (template === "faq") {
    // FAQ Page schema
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: thread.title,
          acceptedAnswer: {
            "@type": "Answer",
            text:
              thread.messages.find((m) => m.isAnswer)?.content ??
              thread.messages[0]?.content ??
              "",
          },
        },
      ],
    };
  }

  // Default to Article schema
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: thread.title,
    datePublished: thread.createdAt,
    dateModified: thread.lastActivityAt,
    author: thread.author
      ? {
          "@type": "Person",
          name: thread.author.username,
        }
      : undefined,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: thread.messageCount,
    },
    url: `${baseUrl}/threads/${thread.slug}.html`,
  };
}
