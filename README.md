<p align="center">
  <img src="packages/www/public/banner.svg" alt="DiscoLink - Your Discord content, anywhere you need it" width="100%">
</p>

<p align="center">
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://discord.js.org/"><img src="https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white" alt="discord.js"></a>
</p>

# DiscoLink
> **Your Discord content, anywhere you need it.** DiscoLink syncs your Discord forums and channels to a database you control. Build websites, integrate via REST API, or export static files. Your data, your way.

---

## What is DiscoLink?

DiscoLink bridges the gap between Discord and the web. Your community already creates valuable content in Discord—help threads, announcements, tutorials, discussions. DiscoLink captures all of that in real-time and makes it accessible through a REST API, static export, or webhooks.

**The flow is simple:**

```
Discord → Bot syncs content → Database → REST API / Static Export / Webhooks → Your App
```

### Use Cases

- **FAQ & Support** — Turn resolved help threads into searchable FAQ pages
- **Knowledge Base** — Organize forum content into structured documentation
- **Changelog** — Auto-publish release notes and announcements
- **Blog** — Transform discussions into blog posts
- **API Integration** — Build custom apps with full REST API access

---

## Features

| Feature | Description |
|---------|-------------|
| **REST API** | Full REST API for integrating Discord content into any application |
| **Full-Text Search** | FTS5-powered search indexes all your Discord content |
| **Real-Time Sync** | Discord bot syncs new messages instantly |
| **Static Export** | Export to static HTML with the CLI. No server required |
| **Privacy First** | Consent-based syncing respects user privacy |
| **Webhooks** | Get notified when content changes |
| **Multi-DB Support** | SQLite locally, Turso for edge/production |

---

## Project Structure

```
discolink/
├── packages/
│   ├── db/         # Database schema (Drizzle ORM)
│   ├── bot/        # Discord bot (discord.js)
│   ├── api/        # REST API (Hono)
│   ├── cli/        # Static export CLI
│   ├── templates/  # Starter templates
│   ├── docs/       # Documentation (Starlight)
│   └── www/        # Marketing site (Astro)
├── turbo.json      # Turborepo config
└── package.json    # Workspace root
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Discord Application ([setup guide](https://discolink.pages.dev/docs/guides))

### Installation

```bash
# Clone the repo
git clone https://github.com/KevinTrinh1227/discolink.git
cd discolink

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

## API Overview

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

## Documentation

**[View Full Documentation](https://discolink.pages.dev/docs)**

| Section | Description |
|---------|-------------|
| [Getting Started](https://discolink.pages.dev/quickstart) | Installation & setup |
| [API Reference](https://discolink.pages.dev/docs/api) | All endpoints |
| [CLI Reference](https://discolink.pages.dev/docs/cli) | Static export commands |
| [Use Cases](https://discolink.pages.dev/use-cases) | Real-world examples |

---

## Tech Stack

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

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint code |
| `pnpm db:push` | Push schema changes |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm docs:dev` | Run docs locally |

---

## Contributing

Contributions are welcome! See the [Contributing Guide](https://discolink.pages.dev/docs/guides) to get started.

---

## License

MIT — See [LICENSE](LICENSE) for details.

---

<div align="center">

**Disclaimer**

This project is not affiliated with, endorsed by, or connected to Discord Inc.
"Discord" is a trademark of Discord Inc. This is an independent, open-source project.

---

Built with love by [Kevin Trinh](https://github.com/KevinTrinh1227)

</div>
