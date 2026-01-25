# Discord Forum API

API-first Discord forum/FAQ/blog engine that syncs Discord server content to a database and exposes it via REST API.

**Core Flow:** Discord Bot → Database → REST API → Any Frontend

## Features

- **Real-time Sync**: Discord events are instantly reflected in the database
- **Rich Content**: Embeds, stickers, components, attachments, and custom emojis
- **Markdown Parsing**: Discord-flavored markdown converted to HTML
- **Privacy First**: User consent system (public/anonymous/private)
- **Multi-DB Support**: SQLite locally, Turso in production
- **Full-text Search**: FTS5-powered search across threads and messages
- **Response Caching**: Built-in caching for expensive endpoints
- **Comprehensive Stats**: Server analytics, leaderboards, human/bot breakdowns
- **Thread Participants**: Track who participated in each thread

## Project Structure

```
discord-forum-api/
├── packages/
│   ├── db/      # Database schema and client (Drizzle ORM)
│   ├── bot/     # Discord bot (discord.js)
│   ├── api/     # REST API (Hono)
│   └── docs/    # Documentation site (Starlight)
├── docs/        # Legacy markdown docs
├── turbo.json   # Turborepo configuration
└── package.json # Workspace root
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Discord Application (bot token, client ID, client secret)

## Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/KevinTrinh1227/discord-forum-api.git
   cd discord-forum-api
   pnpm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Discord credentials
   ```

3. **Set up database**
   ```bash
   pnpm db:push
   ```

4. **Run development servers**
   ```bash
   pnpm dev
   ```

## API Highlights

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /servers/:id` | Server info |
| `GET /servers/:id/stats` | Comprehensive server statistics |
| `GET /servers/:id/channels` | List forum channels |
| `GET /threads` | List/filter threads |
| `GET /threads/:id` | Full thread with messages |
| `GET /threads/:id/participants` | Thread participants |
| `GET /search` | Full-text search |
| `GET /leaderboard/:serverId` | User leaderboards |
| `GET /users/:id` | User profile with badges |

### Response Features

- Messages include parsed HTML (`contentHtml`)
- Attachments with dimensions and metadata
- Reactions with animated emoji support
- Embeds, stickers, and mentions
- User badges and Nitro status

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in development mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm lint:fix` | Fix auto-fixable lint errors |
| `pnpm db:generate` | Generate database migrations |
| `pnpm db:push` | Push schema changes directly |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm docs:dev` | Start documentation site locally |
| `pnpm docs:build` | Build documentation site |

## Database Support

- **SQLite** - Local development (default)
- **Turso** - Edge-compatible SQLite for production
- **FTS5** - Full-text search support

## Documentation

📚 **[View Full Documentation](https://discord-forum-api-docs.pages.dev)** - Comprehensive guides, API reference, and tutorials

Quick links:
- [Getting Started](https://discord-forum-api-docs.pages.dev/getting-started/introduction)
- [API Reference](https://discord-forum-api-docs.pages.dev/api/overview)
- [Deployment Guides](https://discord-forum-api-docs.pages.dev/deployment)
- [Use Cases](https://discord-forum-api-docs.pages.dev/use-cases)

Legacy markdown docs (being migrated):
- [API Reference](docs/API.md)
- [Development Setup](docs/SETUP.md)
- [Self-Hosting Guide](docs/SELF-HOST.md)
- [Discord Setup](docs/DISCORD-SETUP.md)

## Tech Stack

- **Runtime**: Node.js 20+
- **Package Manager**: pnpm (workspaces)
- **Build System**: Turborepo
- **Database**: Drizzle ORM + SQLite/Turso
- **Bot**: discord.js v14
- **API**: Hono
- **Language**: TypeScript

## License

MIT - See [LICENSE](LICENSE) for details.
