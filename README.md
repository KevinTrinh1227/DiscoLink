# 🧵 Threadlink

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white)](https://discord.js.org/)

> **Transform your Discord forum channels into a powerful REST API.** Automatically sync threads, messages, and user content from Discord to a database—then query it all through a clean API. Perfect for building FAQs, blogs, knowledge bases, and support portals powered by your community's conversations.

---

## ✨ What is Threadlink?

Threadlink bridges the gap between Discord and the web. Your community already creates valuable content in Discord forum channels—help threads, announcements, tutorials, discussions. Threadlink captures all of that in real-time and exposes it through a REST API, so you can build anything on top of it.

**The flow is simple:**

```
Discord Forum → 🤖 Bot syncs content → 🗄️ Database → 🌐 REST API → Your App
```

### 🎯 Use Cases

- **📖 Community FAQ** — Turn resolved help threads into searchable FAQ pages
- **📝 Developer Blog** — Publish announcements from Discord to your website
- **📚 Knowledge Base** — Organize forum content into structured documentation
- **💬 Support Portal** — Showcase support history with contributor leaderboards
- **📢 Changelog** — Auto-publish release notes and updates

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| ⚡ **Real-time Sync** | Discord events instantly reflected in the database |
| 🎨 **Rich Content** | Embeds, stickers, attachments, reactions, custom emojis |
| 📝 **Markdown Parsing** | Discord-flavored markdown converted to HTML |
| 🔒 **Privacy First** | User consent system (public/anonymous/private) |
| 🗄️ **Multi-DB Support** | SQLite locally, Turso for edge/production |
| 🔍 **Full-text Search** | FTS5-powered search across threads and messages |
| 📊 **Analytics** | Server stats, leaderboards, participation tracking |
| ⚙️ **Caching** | Built-in response caching for performance |

---

## 📦 Project Structure

```
threadlink/
├── packages/
│   ├── db/      # 🗄️ Database schema (Drizzle ORM)
│   ├── bot/     # 🤖 Discord bot (discord.js)
│   └── api/     # 🌐 REST API (Hono)
├── turbo.json   # ⚡ Turborepo config
└── package.json # 📋 Workspace root
```

> **Note:** Documentation site lives in a separate repository: [threadlink-docs](https://github.com/KevinTrinh1227/threadlink-docs)

---

## 🛠️ Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Discord Application ([setup guide](https://threadlink.pages.dev/guides/discord-bot-setup))

### Installation

```bash
# Clone the repo
git clone https://github.com/KevinTrinh1227/threadlink.git
cd threadlink

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your Discord credentials

# Set up database
pnpm db:push

# Start development
pnpm dev
```

---

## 🔌 API Overview

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /servers/:id` | Server info |
| `GET /servers/:id/stats` | Server statistics |
| `GET /servers/:id/channels` | Forum channels |
| `GET /threads` | List/filter threads |
| `GET /threads/:id` | Thread with messages |
| `GET /search` | Full-text search |
| `GET /leaderboard/:serverId` | User leaderboards |
| `GET /users/:id` | User profile |

### Example Response

```json
{
  "threads": [
    {
      "id": "111222333",
      "title": "How do I implement OAuth?",
      "status": "resolved",
      "messageCount": 8,
      "author": { "username": "curious_dev" }
    }
  ]
}
```

---

## 📚 Documentation

📖 **[View Full Documentation](https://threadlink.pages.dev)**

| Section | Description |
|---------|-------------|
| [Getting Started](https://threadlink.pages.dev/getting-started/introduction) | Installation & setup |
| [API Reference](https://threadlink.pages.dev/api/overview) | All endpoints |
| [Deployment](https://threadlink.pages.dev/deployment) | Vercel, Railway, Docker |
| [Use Cases](https://threadlink.pages.dev/use-cases) | Real-world examples |

---

## 🧰 Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Node.js 20+ |
| **Language** | TypeScript |
| **Bot** | discord.js v14 |
| **API** | Hono |
| **Database** | Drizzle ORM + SQLite/Turso |
| **Build** | Turborepo |
| **Docs** | Starlight (Astro) |

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint code |
| `pnpm db:push` | Push schema changes |
| `pnpm db:studio` | Open Drizzle Studio |

---

## 🤝 Contributing

Contributions are welcome! See the [Contributing Guide](https://threadlink.pages.dev/contributing/development-setup) to get started.

---

## 📄 License

MIT — See [LICENSE](LICENSE) for details.

---

<div align="center">

**⚠️ Disclaimer**

This project is not affiliated with, endorsed by, or connected to Discord Inc.
"Discord" is a trademark of Discord Inc. This is an independent, open-source project.

---

Built with ❤️ by [Kevin Trinh](https://github.com/KevinTrinh1227)

</div>
