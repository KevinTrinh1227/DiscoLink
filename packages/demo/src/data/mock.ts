// Mock data for DiscoLink demo site
// This simulates data that would come from the DiscoLink API

export type Role = 'admin' | 'moderator' | 'contributor' | 'member';

export interface Author {
  id: string;
  username: string;
  avatar: string | null;
  role?: Role;
  roleColor?: string;
}

export interface Message {
  id: string;
  content: string;
  createdAt: string;
  author: Author;
}

export interface Thread {
  id: string;
  title: string;
  slug: string;
  status: 'open' | 'resolved' | 'archived';
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
  tags: string[];
  author: Author;
  messages: Message[];
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  publishedAt: string;
  author: Author;
  tags: string[];
  coverImage?: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  slug: string;
  type: 'feature' | 'fix' | 'improvement' | 'breaking';
  content: string;
  publishedAt: string;
}

export interface KBArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  content: string;
  lastUpdated: string;
  author: Author;
}

// Helper to get role color
export function getRoleColor(role?: Role): string {
  switch (role) {
    case 'admin': return '#e91e63';
    case 'moderator': return '#3b82f6';
    case 'contributor': return '#10b981';
    default: return '#888888';
  }
}

// Sample authors with avatars and roles
const authors: Author[] = [
  { id: '1', username: 'helpful_mod', avatar: 'https://i.pravatar.cc/150?u=mod1', role: 'moderator', roleColor: '#3b82f6' },
  { id: '2', username: 'dev_sarah', avatar: 'https://i.pravatar.cc/150?u=sarah', role: 'admin', roleColor: '#e91e63' },
  { id: '3', username: 'community_lead', avatar: 'https://i.pravatar.cc/150?u=lead', role: 'admin', roleColor: '#e91e63' },
  { id: '4', username: 'tech_support', avatar: 'https://i.pravatar.cc/150?u=support', role: 'moderator', roleColor: '#3b82f6' },
  { id: '5', username: 'newbie_coder', avatar: 'https://i.pravatar.cc/150?u=newbie', role: 'member' },
  { id: '6', username: 'senior_dev', avatar: 'https://i.pravatar.cc/150?u=senior', role: 'contributor', roleColor: '#10b981' },
  { id: '7', username: 'curious_user', avatar: 'https://i.pravatar.cc/150?u=curious', role: 'member' },
  { id: '8', username: 'api_wizard', avatar: 'https://i.pravatar.cc/150?u=wizard', role: 'contributor', roleColor: '#10b981' },
];

// FAQ threads (resolved questions) with emoji tags
export const faqThreads: Thread[] = [
  {
    id: '1001',
    title: 'How do I authenticate with the Discord API?',
    slug: 'how-do-i-authenticate-with-discord-api',
    status: 'resolved',
    messageCount: 8,
    createdAt: '2024-10-15T10:30:00Z',
    lastActivityAt: '2024-10-15T14:22:00Z',
    tags: ['🔐 Authentication', '📡 API'],
    author: authors[4],
    messages: [
      { id: 'm1', content: 'I\'m trying to connect to the Discord API but keep getting 401 errors. What am I missing?', createdAt: '2024-10-15T10:30:00Z', author: authors[4] },
      { id: 'm2', content: 'You need to include your bot token in the Authorization header. Format: `Authorization: Bot YOUR_TOKEN`', createdAt: '2024-10-15T10:45:00Z', author: authors[1] },
      { id: 'm3', content: 'Make sure you\'re not sharing your token publicly! If you have, regenerate it immediately.', createdAt: '2024-10-15T11:00:00Z', author: authors[0] },
      { id: 'm4', content: 'That worked! Thanks so much!', createdAt: '2024-10-15T14:22:00Z', author: authors[4] },
    ],
  },
  {
    id: '1002',
    title: 'What\'s the rate limit for Discord webhooks?',
    slug: 'rate-limit-discord-webhooks',
    status: 'resolved',
    messageCount: 5,
    createdAt: '2024-10-18T09:15:00Z',
    lastActivityAt: '2024-10-18T11:30:00Z',
    tags: ['🪝 Webhooks', '⚡ Rate Limits'],
    author: authors[6],
    messages: [
      { id: 'm5', content: 'My webhook keeps getting rate limited. How many messages can I send per minute?', createdAt: '2024-10-18T09:15:00Z', author: authors[6] },
      { id: 'm6', content: 'Webhooks are limited to 30 messages per minute per channel. You should implement exponential backoff.', createdAt: '2024-10-18T09:45:00Z', author: authors[7] },
    ],
  },
  {
    id: '1003',
    title: 'How do I format code blocks in Discord?',
    slug: 'format-code-blocks-discord',
    status: 'resolved',
    messageCount: 4,
    createdAt: '2024-10-20T15:00:00Z',
    lastActivityAt: '2024-10-20T15:30:00Z',
    tags: ['✏️ Formatting', '📝 Markdown'],
    author: authors[4],
    messages: [
      { id: 'm7', content: 'How do I share code snippets that look nice in Discord?', createdAt: '2024-10-20T15:00:00Z', author: authors[4] },
      { id: 'm8', content: 'Use triple backticks with the language name:\n\\`\\`\\`javascript\nconsole.log("Hello!");\n\\`\\`\\`', createdAt: '2024-10-20T15:15:00Z', author: authors[5] },
    ],
  },
  {
    id: '1004',
    title: 'Can I use DiscoLink with Next.js?',
    slug: 'discolink-with-nextjs',
    status: 'resolved',
    messageCount: 6,
    createdAt: '2024-10-22T08:00:00Z',
    lastActivityAt: '2024-10-22T10:45:00Z',
    tags: ['🔗 Integration', '⚛️ Next.js'],
    author: authors[6],
    messages: [
      { id: 'm9', content: 'Has anyone used DiscoLink with a Next.js app? Looking for best practices.', createdAt: '2024-10-22T08:00:00Z', author: authors[6] },
      { id: 'm10', content: 'Yes! Use the REST API in getServerSideProps or route handlers. The API is framework-agnostic.', createdAt: '2024-10-22T09:00:00Z', author: authors[1] },
    ],
  },
  {
    id: '1005',
    title: 'How to set up consent-based syncing?',
    slug: 'setup-consent-based-syncing',
    status: 'resolved',
    messageCount: 10,
    createdAt: '2024-10-25T14:00:00Z',
    lastActivityAt: '2024-10-25T16:30:00Z',
    tags: ['🔒 Privacy', '✅ Consent'],
    author: authors[4],
    messages: [
      { id: 'm11', content: 'I want to only sync messages from users who opt-in. How do I configure this?', createdAt: '2024-10-25T14:00:00Z', author: authors[4] },
      { id: 'm12', content: 'Run /consent enable in your server. Users can then /consent opt-in to have their messages synced.', createdAt: '2024-10-25T14:30:00Z', author: authors[0] },
    ],
  },
  {
    id: '1006',
    title: 'Best way to handle thread archiving?',
    slug: 'handle-thread-archiving',
    status: 'resolved',
    messageCount: 7,
    createdAt: '2024-10-28T11:00:00Z',
    lastActivityAt: '2024-10-28T13:15:00Z',
    tags: ['💬 Threads', '📦 Archiving'],
    author: authors[6],
    messages: [
      { id: 'm13', content: 'Archived threads disappear from my FAQ. Should I unarchive them or is there another way?', createdAt: '2024-10-28T11:00:00Z', author: authors[6] },
      { id: 'm14', content: 'DiscoLink keeps archived threads in the database. Filter by isArchived=false for active only, or include all.', createdAt: '2024-10-28T11:30:00Z', author: authors[7] },
    ],
  },
  {
    id: '1007',
    title: 'How do I deploy DiscoLink to Cloudflare Workers?',
    slug: 'deploy-cloudflare-workers',
    status: 'resolved',
    messageCount: 12,
    createdAt: '2024-11-01T09:00:00Z',
    lastActivityAt: '2024-11-01T12:00:00Z',
    tags: ['🚀 Deployment', '☁️ Cloudflare'],
    author: authors[4],
    messages: [
      { id: 'm15', content: 'The docs mention Cloudflare deployment. What\'s the setup process?', createdAt: '2024-11-01T09:00:00Z', author: authors[4] },
      { id: 'm16', content: 'Run wrangler deploy in the api package. Make sure to set your TURSO_URL and TURSO_AUTH_TOKEN secrets.', createdAt: '2024-11-01T09:30:00Z', author: authors[1] },
    ],
  },
  {
    id: '1008',
    title: 'Can I sync multiple Discord servers?',
    slug: 'sync-multiple-servers',
    status: 'resolved',
    messageCount: 5,
    createdAt: '2024-11-05T16:00:00Z',
    lastActivityAt: '2024-11-05T17:30:00Z',
    tags: ['🖥️ Servers', '🏢 Multi-tenant'],
    author: authors[6],
    messages: [
      { id: 'm17', content: 'I manage 3 Discord servers. Can I use one DiscoLink instance for all of them?', createdAt: '2024-11-05T16:00:00Z', author: authors[6] },
      { id: 'm18', content: 'Yes! Invite the bot to all servers. Each server gets its own data, filtered by serverId in API calls.', createdAt: '2024-11-05T16:30:00Z', author: authors[0] },
    ],
  },
  {
    id: '1009',
    title: 'How to implement search in my FAQ page?',
    slug: 'implement-search-faq',
    status: 'resolved',
    messageCount: 8,
    createdAt: '2024-11-08T10:00:00Z',
    lastActivityAt: '2024-11-08T12:45:00Z',
    tags: ['🔍 Search', '❓ FAQ'],
    author: authors[4],
    messages: [
      { id: 'm19', content: 'The FAQ template has a search box but it doesn\'t work. How do I enable search?', createdAt: '2024-11-08T10:00:00Z', author: authors[4] },
      { id: 'm20', content: 'Use the /search endpoint with your query. It supports FTS5 full-text search with typo tolerance.', createdAt: '2024-11-08T10:30:00Z', author: authors[7] },
    ],
  },
  {
    id: '1010',
    title: 'What message formats does DiscoLink support?',
    slug: 'message-formats-supported',
    status: 'resolved',
    messageCount: 6,
    createdAt: '2024-11-12T14:00:00Z',
    lastActivityAt: '2024-11-12T15:30:00Z',
    tags: ['💬 Messages', '✏️ Formatting'],
    author: authors[6],
    messages: [
      { id: 'm21', content: 'Does DiscoLink preserve embeds, attachments, and reactions?', createdAt: '2024-11-12T14:00:00Z', author: authors[6] },
      { id: 'm22', content: 'Yes to all! Messages include embeds, attachments array, and reactions with counts. Markdown is preserved.', createdAt: '2024-11-12T14:30:00Z', author: authors[1] },
    ],
  },
];

// Blog posts with cover images
export const blogPosts: BlogPost[] = [
  {
    id: 'b1',
    title: 'Introducing DiscoLink v1.0',
    slug: 'introducing-discolink-v1',
    excerpt: 'After months of development, we\'re thrilled to announce the official release of DiscoLink 1.0.',
    coverImage: 'https://picsum.photos/seed/discolink1/800/400',
    content: `After months of development, we're thrilled to announce the official release of DiscoLink 1.0.

## What is DiscoLink?

DiscoLink syncs your Discord forums and channels to a database you control. Build FAQ pages, knowledge bases, changelogs, or blogs from your Discord content.

## Key Features

- **Real-time sync** - Messages appear instantly
- **Full-text search** - Find anything across your content
- **Privacy-first** - Consent-based syncing
- **Self-hosted** - Your data stays yours

## Getting Started

Check out our [quick start guide](/getting-started/quick-start) to begin.`,
    publishedAt: '2024-09-01T10:00:00Z',
    author: authors[1],
    tags: ['📢 Announcement', '🎉 Release'],
  },
  {
    id: 'b2',
    title: 'Building a Community FAQ with DiscoLink',
    slug: 'building-community-faq',
    excerpt: 'Learn how to transform your Discord help threads into a searchable FAQ page.',
    coverImage: 'https://picsum.photos/seed/faq2/800/400',
    content: `Learn how to transform your Discord help threads into a searchable FAQ page.

## Why a FAQ Page?

Your community asks the same questions repeatedly. By surfacing resolved threads as FAQ entries, you:

- Reduce repetitive questions
- Improve SEO for your project
- Give credit to helpful community members

## Implementation

1. Set up DiscoLink with your forum channel
2. Use the FAQ template or build your own
3. Deploy to Vercel, Cloudflare, or any static host

The FAQ template includes search, categories, and JSON-LD for rich search results.`,
    publishedAt: '2024-09-15T14:00:00Z',
    author: authors[2],
    tags: ['📖 Tutorial', '❓ FAQ'],
  },
  {
    id: 'b3',
    title: 'Privacy Best Practices for Discord Data',
    slug: 'privacy-best-practices',
    excerpt: 'How DiscoLink handles user privacy and what you should consider when syncing Discord content.',
    coverImage: 'https://picsum.photos/seed/privacy3/800/400',
    content: `How DiscoLink handles user privacy and what you should consider when syncing Discord content.

## Consent System

DiscoLink includes a built-in consent system:

- Users opt-in with \`/consent opt-in\`
- Only consented users' messages are synced
- Users can opt-out anytime

## Data Handling

- No message content is sent to third parties
- Self-hosted means you control the data
- Respect user privacy preferences

## Recommendations

1. Always enable consent mode for public-facing sites
2. Consider anonymizing usernames in certain contexts
3. Provide a way for users to request data deletion`,
    publishedAt: '2024-10-01T09:00:00Z',
    author: authors[0],
    tags: ['🔒 Privacy', '📘 Guide'],
  },
  {
    id: 'b4',
    title: 'DiscoLink Templates Deep Dive',
    slug: 'templates-deep-dive',
    excerpt: 'Explore all four official templates and learn how to customize them.',
    coverImage: 'https://picsum.photos/seed/templates4/800/400',
    content: `Explore all four official templates and learn how to customize them.

## Available Templates

### FAQ Template
Perfect for support communities. Shows resolved threads with search.

### Blog Template
Turn announcements into blog posts. Great for project updates.

### Changelog Template
Timeline view of releases and updates.

### Knowledge Base Template
Organized documentation from forum categories.

## Customization

All templates are Astro-based and fully customizable:

- Modify styles in the CSS
- Add your own components
- Extend with React, Vue, or Svelte`,
    publishedAt: '2024-10-20T11:00:00Z',
    author: authors[1],
    tags: ['🎨 Templates', '⚙️ Customization'],
  },
  {
    id: 'b5',
    title: 'Scaling DiscoLink for Large Communities',
    slug: 'scaling-large-communities',
    excerpt: 'Tips and best practices for running DiscoLink with thousands of threads.',
    coverImage: 'https://picsum.photos/seed/scaling5/800/400',
    content: `Tips and best practices for running DiscoLink with thousands of threads.

## Database Optimization

For large communities (10k+ threads):

1. Use Turso for edge deployment
2. Enable pagination in API calls
3. Index frequently queried columns

## Caching Strategy

- Use Cloudflare cache for static content
- Implement stale-while-revalidate for API
- Consider ISR for high-traffic pages

## Monitoring

Set up alerts for:
- Sync failures
- Rate limit warnings
- Database size thresholds`,
    publishedAt: '2024-11-10T15:00:00Z',
    author: authors[5],
    tags: ['📈 Scaling', '⚡ Performance'],
  },
];

// Changelog entries
export const changelogEntries: ChangelogEntry[] = [
  {
    id: 'c1',
    version: '1.2.0',
    title: 'Full-text search improvements',
    slug: 'v1-2-0',
    type: 'feature',
    content: `## New Features

- **FTS5 Search Engine** - Blazing fast full-text search with typo tolerance
- **Search Highlighting** - Results show matched terms in context
- **Search Filters** - Filter by channel, author, date range

## Improvements

- 3x faster thread pagination
- Reduced memory usage during sync
- Better error messages for rate limits`,
    publishedAt: '2024-11-15T10:00:00Z',
  },
  {
    id: 'c2',
    version: '1.1.0',
    title: 'Webhook support and CLI improvements',
    slug: 'v1-1-0',
    type: 'feature',
    content: `## New Features

- **Webhook Dispatch** - Send updates to external services
- **CLI Export Command** - Export threads to JSON or HTML
- **Tag Support** - Forum tags are now synced and filterable

## Bug Fixes

- Fixed thread status not updating on resolve
- Fixed avatar URLs for users who changed their avatar`,
    publishedAt: '2024-10-15T10:00:00Z',
  },
  {
    id: 'c3',
    version: '1.0.1',
    title: 'Bug fixes and stability improvements',
    slug: 'v1-0-1',
    type: 'fix',
    content: `## Bug Fixes

- Fixed race condition during initial sync
- Fixed handling of deleted messages
- Fixed timezone issues in date formatting

## Documentation

- Added troubleshooting guide
- Improved API reference examples`,
    publishedAt: '2024-09-10T10:00:00Z',
  },
  {
    id: 'c4',
    version: '1.0.0',
    title: 'Initial release',
    slug: 'v1-0-0',
    type: 'feature',
    content: `## DiscoLink 1.0.0

The first stable release of DiscoLink!

## Features

- Discord bot for real-time sync
- REST API for all content
- Consent-based privacy controls
- Four official templates
- Cloudflare Workers deployment
- SQLite/Turso database support`,
    publishedAt: '2024-09-01T10:00:00Z',
  },
];

// Knowledge base articles
export const kbArticles: KBArticle[] = [
  {
    id: 'kb1',
    title: 'Getting Started with DiscoLink',
    slug: 'getting-started',
    category: '📚 Basics',
    content: `# Getting Started with DiscoLink

DiscoLink syncs your Discord content to a database you control.

## Prerequisites

- Node.js 18+
- A Discord bot token
- A Discord server you manage

## Quick Start

1. Clone the repository
2. Copy \`.env.example\` to \`.env\`
3. Add your Discord bot token
4. Run \`pnpm install && pnpm dev\`

Your content will start syncing automatically.`,
    lastUpdated: '2024-11-01T10:00:00Z',
    author: authors[1],
  },
  {
    id: 'kb2',
    title: 'API Authentication',
    slug: 'api-authentication',
    category: '📡 API',
    content: `# API Authentication

The DiscoLink API supports multiple authentication methods.

## API Keys

Generate an API key from your dashboard:

\`\`\`bash
curl -H "Authorization: Bearer your-api-key" \\
  https://api.example.com/threads
\`\`\`

## Public Access

Some endpoints are public by default for read-only access.`,
    lastUpdated: '2024-10-15T14:00:00Z',
    author: authors[7],
  },
  {
    id: 'kb3',
    title: 'Configuring the Discord Bot',
    slug: 'configuring-discord-bot',
    category: '📚 Basics',
    content: `# Configuring the Discord Bot

Set up the DiscoLink bot in your Discord server.

## Required Permissions

- Read Messages
- Read Message History
- View Channels

## Bot Commands

- \`/status\` - Check sync status
- \`/consent\` - Manage consent settings
- \`/settings\` - Configure channels`,
    lastUpdated: '2024-10-20T11:00:00Z',
    author: authors[0],
  },
  {
    id: 'kb4',
    title: 'Deploying to Cloudflare Workers',
    slug: 'deploying-cloudflare',
    category: '🚀 Deployment',
    content: `# Deploying to Cloudflare Workers

Deploy DiscoLink's API to the edge with Cloudflare Workers.

## Setup

1. Install wrangler: \`npm install -g wrangler\`
2. Login: \`wrangler login\`
3. Configure secrets
4. Deploy: \`wrangler deploy\`

## Environment Variables

Set these in the Cloudflare dashboard:

- \`TURSO_URL\` - Database URL
- \`TURSO_AUTH_TOKEN\` - Auth token`,
    lastUpdated: '2024-11-05T09:00:00Z',
    author: authors[1],
  },
  {
    id: 'kb5',
    title: 'Using the REST API',
    slug: 'using-rest-api',
    category: '📡 API',
    content: `# Using the REST API

Fetch your Discord content via HTTP.

## Endpoints

- \`GET /threads\` - List threads
- \`GET /threads/:id\` - Get thread details
- \`GET /search\` - Full-text search
- \`GET /servers/:id\` - Server info

## Pagination

Use \`cursor\` for pagination:

\`\`\`bash
GET /threads?limit=20&cursor=abc123
\`\`\``,
    lastUpdated: '2024-10-25T16:00:00Z',
    author: authors[7],
  },
  {
    id: 'kb6',
    title: 'Privacy and Consent',
    slug: 'privacy-consent',
    category: '🔒 Privacy',
    content: `# Privacy and Consent

DiscoLink takes privacy seriously.

## Consent Mode

Enable consent mode to only sync opted-in users:

\`\`\`
/consent enable
\`\`\`

Users can then opt-in:

\`\`\`
/consent opt-in
\`\`\`

## Data Handling

- All data stays on your infrastructure
- No third-party analytics
- Users can request deletion`,
    lastUpdated: '2024-11-10T12:00:00Z',
    author: authors[0],
  },
];

// Server info for demo
export const demoServer = {
  id: 'demo-server-123',
  name: 'DiscoLink Demo',
  icon: null,
  description: 'A demo Discord server showcasing DiscoLink features',
};
