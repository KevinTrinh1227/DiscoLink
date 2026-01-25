/**
 * Discord Markdown Parser
 *
 * Converts Discord-flavored markdown to HTML.
 * Handles: bold, italic, underline, strikethrough, code blocks,
 * inline code, spoilers, quotes, headers, lists, links,
 * user mentions, channel mentions, role mentions, and custom emojis.
 */

interface ParseOptions {
  /** Callback to resolve user ID to display name */
  resolveUser?: (id: string) => string | null;
  /** Callback to resolve channel ID to name */
  resolveChannel?: (id: string) => string | null;
  /** Callback to resolve role ID to name */
  resolveRole?: (id: string) => string | null;
  /** Whether to escape HTML in the output (default: true) */
  escapeHtml?: boolean;
  /** CSS class prefix for styling (default: "discord") */
  classPrefix?: string;
}

const defaultOptions: ParseOptions = {
  escapeHtml: true,
  classPrefix: "discord",
};

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtmlChars(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Parse Discord markdown to HTML
 */
export function parseDiscordMarkdown(
  content: string,
  options: ParseOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const prefix = opts.classPrefix;

  // Escape HTML if needed
  let html = opts.escapeHtml ? escapeHtmlChars(content) : content;

  // Store code blocks temporarily to prevent processing their content
  const codeBlocks: string[] = [];
  const inlineCodes: string[] = [];

  // Extract code blocks (```language\ncode```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length;
    const langClass = lang ? ` class="${prefix}-code-${escapeHtmlChars(lang)}"` : "";
    codeBlocks.push(`<pre${langClass}><code>${code}</code></pre>`);
    return `\0CODEBLOCK${index}\0`;
  });

  // Extract inline code (`code`)
  html = html.replace(/`([^`\n]+)`/g, (_, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code class="${prefix}-inline-code">${code}</code>`);
    return `\0INLINECODE${index}\0`;
  });

  // Parse spoilers (||text||)
  html = html.replace(
    /\|\|([^|]+)\|\|/g,
    `<span class="${prefix}-spoiler" onclick="this.classList.toggle('${prefix}-spoiler-revealed')">$1</span>`
  );

  // Parse user mentions (<@123456789> or <@!123456789>)
  html = html.replace(/<@!?(\d+)>/g, (_, id) => {
    const name = opts.resolveUser?.(id);
    const displayName = name ? `@${escapeHtmlChars(name)}` : `@User`;
    return `<span class="${prefix}-mention ${prefix}-mention-user" data-user-id="${id}">${displayName}</span>`;
  });

  // Parse channel mentions (<#123456789>)
  html = html.replace(/<#(\d+)>/g, (_, id) => {
    const name = opts.resolveChannel?.(id);
    const displayName = name ? `#${escapeHtmlChars(name)}` : `#channel`;
    return `<span class="${prefix}-mention ${prefix}-mention-channel" data-channel-id="${id}">${displayName}</span>`;
  });

  // Parse role mentions (<@&123456789>)
  html = html.replace(/<@&(\d+)>/g, (_, id) => {
    const name = opts.resolveRole?.(id);
    const displayName = name ? `@${escapeHtmlChars(name)}` : `@role`;
    return `<span class="${prefix}-mention ${prefix}-mention-role" data-role-id="${id}">${displayName}</span>`;
  });

  // Parse custom emojis (<:name:123456789> or <a:name:123456789> for animated)
  html = html.replace(/<(a)?:(\w+):(\d+)>/g, (_, animated, name, id) => {
    const ext = animated ? "gif" : "png";
    const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
    return `<img class="${prefix}-emoji ${prefix}-emoji-custom" src="${url}" alt=":${escapeHtmlChars(name)}:" title=":${escapeHtmlChars(name)}:" draggable="false">`;
  });

  // Parse timestamp (<t:1234567890:F>)
  html = html.replace(/<t:(\d+)(?::([tTdDfFR]))?>/g, (_, timestamp, format) => {
    const date = new Date(parseInt(timestamp) * 1000);
    const iso = date.toISOString();
    let displayText: string;

    switch (format) {
      case "t": // Short time
        displayText = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        break;
      case "T": // Long time
        displayText = date.toLocaleTimeString();
        break;
      case "d": // Short date
        displayText = date.toLocaleDateString();
        break;
      case "D": // Long date
        displayText = date.toLocaleDateString(undefined, { dateStyle: "long" });
        break;
      case "f": // Short date/time
        displayText = date.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
        break;
      case "F": // Long date/time
        displayText = date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
        break;
      case "R": // Relative
        displayText = getRelativeTime(date);
        break;
      default:
        displayText = date.toLocaleString();
    }

    return `<time class="${prefix}-timestamp" datetime="${iso}" data-format="${format || "f"}">${displayText}</time>`;
  });

  // Parse headers (limited to 3 levels like Discord)
  html = html.replace(/^### (.+)$/gm, `<h3 class="${prefix}-h3">$1</h3>`);
  html = html.replace(/^## (.+)$/gm, `<h2 class="${prefix}-h2">$1</h2>`);
  html = html.replace(/^# (.+)$/gm, `<h1 class="${prefix}-h1">$1</h1>`);

  // Parse block quotes (> text or >>> multiline)
  html = html.replace(/^&gt;&gt;&gt; ([\s\S]+)$/gm, `<blockquote class="${prefix}-blockquote ${prefix}-blockquote-multiline">$1</blockquote>`);
  html = html.replace(/^&gt; (.+)$/gm, `<blockquote class="${prefix}-blockquote">$1</blockquote>`);

  // Parse lists
  // Unordered lists (- item or * item)
  html = html.replace(/^[\-\*] (.+)$/gm, `<li class="${prefix}-list-item">$1</li>`);
  // Wrap consecutive li elements in ul
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, `<ul class="${prefix}-list">$1</ul>`);

  // Parse bold (**text** or __text__)
  html = html.replace(/\*\*([^*\n]+)\*\*/g, `<strong class="${prefix}-bold">$1</strong>`);
  html = html.replace(/__([^_\n]+)__/g, `<strong class="${prefix}-bold">$1</strong>`);

  // Parse italic (*text* or _text_) - must come after bold
  html = html.replace(/\*([^*\n]+)\*/g, `<em class="${prefix}-italic">$1</em>`);
  html = html.replace(/(?<![\\\/])_([^_\n]+)_(?![\\\/])/g, `<em class="${prefix}-italic">$1</em>`);

  // Parse underline (__text__) - Discord uses double underscore
  // Note: Already handled as bold above, Discord doesn't distinguish

  // Parse strikethrough (~~text~~)
  html = html.replace(/~~([^~\n]+)~~/g, `<del class="${prefix}-strikethrough">$1</del>`);

  // Parse links (auto-link URLs)
  html = html.replace(
    /(?<!href="|src=")(https?:\/\/[^\s<>\[\]]+)/gi,
    `<a class="${prefix}-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>`
  );

  // Parse masked links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    `<a class="${prefix}-link ${prefix}-link-masked" href="$2" target="_blank" rel="noopener noreferrer">$1</a>`
  );

  // Convert newlines to <br> (but not in code blocks)
  html = html.replace(/\n/g, "<br>");

  // Restore code blocks
  html = html.replace(/\0CODEBLOCK(\d+)\0/g, (_, index: string) => codeBlocks[parseInt(index)] ?? "");
  html = html.replace(/\0INLINECODE(\d+)\0/g, (_, index: string) => inlineCodes[parseInt(index)] ?? "");

  return html;
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}

/**
 * Strip all markdown from text (for plain text extraction)
 */
export function stripDiscordMarkdown(content: string): string {
  let text = content;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`[^`]+`/g, "");

  // Remove spoilers but keep content
  text = text.replace(/\|\|([^|]+)\|\|/g, "$1");

  // Remove formatting
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");

  // Convert mentions to readable form
  text = text.replace(/<@!?\d+>/g, "@user");
  text = text.replace(/<#\d+>/g, "#channel");
  text = text.replace(/<@&\d+>/g, "@role");

  // Remove custom emojis, keep name
  text = text.replace(/<a?:(\w+):\d+>/g, ":$1:");

  // Remove timestamps
  text = text.replace(/<t:\d+(?::[tTdDfFR])?>/g, "[time]");

  // Remove headers
  text = text.replace(/^#{1,3} /gm, "");

  // Remove blockquotes
  text = text.replace(/^>{1,3} /gm, "");

  // Remove list markers
  text = text.replace(/^[\-\*] /gm, "");

  return text.trim();
}

/**
 * Get a preview of the content (first N characters, stripped)
 */
export function getContentPreview(content: string, maxLength = 200): string {
  const stripped = stripDiscordMarkdown(content);
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength).trim() + "...";
}
