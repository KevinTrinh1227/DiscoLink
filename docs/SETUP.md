# Development Setup

This guide covers setting up the Discord Forum API for local development.

## Prerequisites

- **Node.js** 20.x or later
- **pnpm** 9.x or later
- **Discord Application** with bot token

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/KevinTrinh1227/discord-forum-api.git
   cd discord-forum-api
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env`** with your Discord credentials (see [Discord Setup](./DISCORD-SETUP.md))

## Database Setup

### Local SQLite (Default)

SQLite is used by default for development. The database file is created automatically.

```bash
# Push schema to database
pnpm db:push

# Or generate and run migrations
pnpm db:generate
pnpm db:migrate
```

### Turso (Production)

For production, we recommend [Turso](https://turso.tech/) for edge-compatible SQLite.

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create discord-forum-api

# Get credentials
turso db show discord-forum-api --url
turso db tokens create discord-forum-api
```

Update `.env`:
```env
DATABASE_TYPE=turso
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

## Running the Project

### Development Mode

Start all packages in watch mode:

```bash
pnpm dev
```

This starts:
- **Bot** on default Discord gateway
- **API** on `http://localhost:3000`

### Individual Packages

```bash
# Run specific package
pnpm --filter @discordlink/api dev
pnpm --filter @discordlink/bot dev

# Build specific package
pnpm --filter @discordlink/db build
```

## Project Structure

```
discord-forum-api/
├── packages/
│   ├── db/           # Database package
│   │   ├── src/
│   │   │   ├── schema.ts    # Drizzle schema definitions
│   │   │   ├── client.ts    # Database client factory
│   │   │   ├── helpers.ts   # CRUD helper functions
│   │   │   └── index.ts     # Package exports
│   │   └── package.json
│   │
│   ├── bot/          # Discord bot package
│   │   ├── src/
│   │   │   ├── index.ts     # Bot entry point
│   │   │   ├── config.ts    # Environment configuration
│   │   │   ├── events/      # Discord event handlers
│   │   │   ├── commands/    # Slash commands
│   │   │   ├── sync/        # Initial sync logic
│   │   │   └── lib/         # Utilities (markdown parser)
│   │   └── package.json
│   │
│   └── api/          # REST API package
│       ├── src/
│       │   ├── index.ts     # API entry point
│       │   ├── routes/      # Route handlers
│       │   ├── middleware/  # Middleware (cache, auth)
│       │   └── lib/         # Utilities (consent, markdown)
│       └── package.json
│
├── docs/             # Documentation
├── turbo.json        # Turborepo config
├── tsconfig.json     # Base TypeScript config
└── package.json      # Workspace root
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all packages in development mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run ESLint on all packages |
| `pnpm lint:fix` | Fix auto-fixable lint errors |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:push` | Push schema directly (dev only) |
| `pnpm db:studio` | Open Drizzle Studio GUI |

## Environment Variables

See `.env.example` for all available variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token |
| `DISCORD_CLIENT_ID` | Yes | Application client ID |
| `DISCORD_CLIENT_SECRET` | For OAuth | OAuth client secret |
| `DATABASE_TYPE` | No | `sqlite` (default) or `turso` |
| `DATABASE_PATH` | No | SQLite file path |
| `TURSO_DATABASE_URL` | For Turso | Turso database URL |
| `TURSO_AUTH_TOKEN` | For Turso | Turso auth token |
| `API_PORT` | No | API port (default: 3000) |
| `SYNC_BOT_MESSAGES` | No | Sync bot messages (default: true) |

## Debugging

### View Database

```bash
# Open Drizzle Studio
pnpm db:studio
```

### Check Bot Connection

The bot logs connection status on startup. Check for:
```
[INFO] Logged in as BotName#1234
[INFO] Connected to X guilds
```

### API Health Check

```bash
curl http://localhost:3000/health
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage
```

## Common Issues

### "Cannot find module" errors

Run `pnpm build` to compile TypeScript before running.

### Database locked

SQLite can lock if multiple processes access it. Ensure only one bot instance runs locally.

### Bot not receiving events

Check that the bot has proper intents enabled in the Discord Developer Portal:
- `GUILDS`
- `GUILD_MESSAGES`
- `MESSAGE_CONTENT` (privileged)

See [Discord Setup](./DISCORD-SETUP.md) for detailed bot configuration.
