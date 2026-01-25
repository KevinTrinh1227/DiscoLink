/**
 * Discord Markdown Parser for Bot
 *
 * Converts Discord-flavored markdown to HTML for storage.
 * This is a simplified version that runs during message sync.
 */

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
export function parseDiscordMarkdown(content: string): string {
  const prefix = "discord";

  // Escape HTML
  let html = escapeHtmlChars(content);

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
    `<span class="${prefix}-spoiler">$1</span>`
  );

  // Parse user mentions (<@123456789> or <@!123456789>)
  html = html.replace(/<@!?(\d+)>/g, (_, id) => {
    return `<span class="${prefix}-mention ${prefix}-mention-user" data-user-id="${id}">@user</span>`;
  });

  // Parse channel mentions (<#123456789>)
  html = html.replace(/<#(\d+)>/g, (_, id) => {
    return `<span class="${prefix}-mention ${prefix}-mention-channel" data-channel-id="${id}">#channel</span>`;
  });

  // Parse role mentions (<@&123456789>)
  html = html.replace(/<@&(\d+)>/g, (_, id) => {
    return `<span class="${prefix}-mention ${prefix}-mention-role" data-role-id="${id}">@role</span>`;
  });

  // Parse custom emojis (<:name:123456789> or <a:name:123456789> for animated)
  html = html.replace(/<(a)?:(\w+):(\d+)>/g, (_, animated, name, id) => {
    const ext = animated ? "gif" : "png";
    const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
    return `<img class="${prefix}-emoji" src="${url}" alt=":${escapeHtmlChars(name)}:" title=":${escapeHtmlChars(name)}:">`;
  });

  // Parse timestamp (<t:1234567890:F>)
  html = html.replace(/<t:(\d+)(?::([tTdDfFR]))?>/g, (_, timestamp, format) => {
    const date = new Date(parseInt(timestamp) * 1000);
    const iso = date.toISOString();
    return `<time class="${prefix}-timestamp" datetime="${iso}" data-format="${format || "f"}">${iso}</time>`;
  });

  // Parse headers (limited to 3 levels like Discord)
  html = html.replace(/^### (.+)$/gm, `<h3 class="${prefix}-h3">$1</h3>`);
  html = html.replace(/^## (.+)$/gm, `<h2 class="${prefix}-h2">$1</h2>`);
  html = html.replace(/^# (.+)$/gm, `<h1 class="${prefix}-h1">$1</h1>`);

  // Parse block quotes (> text or >>> multiline)
  html = html.replace(/^&gt;&gt;&gt; ([\s\S]+)$/gm, `<blockquote class="${prefix}-blockquote-multiline">$1</blockquote>`);
  html = html.replace(/^&gt; (.+)$/gm, `<blockquote class="${prefix}-blockquote">$1</blockquote>`);

  // Parse lists
  html = html.replace(/^[\-\*] (.+)$/gm, `<li class="${prefix}-list-item">$1</li>`);
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\n?)+)/g, `<ul class="${prefix}-list">$1</ul>`);

  // Parse bold (**text** or __text__)
  html = html.replace(/\*\*([^*\n]+)\*\*/g, `<strong>$1</strong>`);
  html = html.replace(/__([^_\n]+)__/g, `<strong>$1</strong>`);

  // Parse italic (*text* or _text_) - must come after bold
  html = html.replace(/\*([^*\n]+)\*/g, `<em>$1</em>`);
  html = html.replace(/(?<![\\\/])_([^_\n]+)_(?![\\\/])/g, `<em>$1</em>`);

  // Parse strikethrough (~~text~~)
  html = html.replace(/~~([^~\n]+)~~/g, `<del>$1</del>`);

  // Parse links (auto-link URLs)
  html = html.replace(
    /(?<!href="|src=")(https?:\/\/[^\s<>\[\]]+)/gi,
    `<a class="${prefix}-link" href="$1" target="_blank" rel="noopener noreferrer">$1</a>`
  );

  // Parse masked links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    `<a class="${prefix}-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>`
  );

  // Convert newlines to <br>
  html = html.replace(/\n/g, "<br>");

  // Restore code blocks
  html = html.replace(/\0CODEBLOCK(\d+)\0/g, (_, index: string) => codeBlocks[parseInt(index)] ?? "");
  html = html.replace(/\0INLINECODE(\d+)\0/g, (_, index: string) => inlineCodes[parseInt(index)] ?? "");

  return html;
}
