# Deploying DiscoLink API to Cloudflare Workers

This guide explains how to deploy the DiscoLink API to Cloudflare's edge network using Workers and D1.

## Prerequisites

- A Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Authenticated with Cloudflare (`wrangler login`)

## Setup

### 1. Create D1 Database

```bash
# Create the database
pnpm --filter @discolink/api d1:create

# Note the database_id from the output
```

### 2. Configure wrangler.toml

Update `packages/api/wrangler.toml` with your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "discolink"
database_id = "YOUR_DATABASE_ID"  # Replace with actual ID
```

### 3. Apply Migrations

Create migrations from your Drizzle schema and apply them to D1:

```bash
# Generate SQL migrations
pnpm --filter @discolink/db generate

# Apply to D1 (you may need to manually run the SQL)
wrangler d1 execute discolink --file=packages/db/drizzle/0001_initial.sql
```

### 4. Build and Deploy

```bash
# Build the API
pnpm --filter @discolink/api build

# Deploy to Cloudflare Workers
pnpm --filter @discolink/api deploy
```

## Environment Variables

Set secrets using wrangler:

```bash
# API key for authentication (optional)
wrangler secret put API_KEY

# CORS origins (optional)
wrangler secret put CORS_ORIGINS
```

## Environments

The wrangler.toml includes staging and production environments:

```bash
# Deploy to staging
pnpm --filter @discolink/api deploy:staging

# Deploy to production
pnpm --filter @discolink/api deploy:production
```

## Architecture Notes

### Bot Deployment

The Discord bot requires WebSocket connections and cannot run on Workers. Deploy the bot to:

- Railway
- Fly.io
- DigitalOcean
- Any VPS

The bot connects to the same D1 database via Turso (for external access) or directly if self-hosted.

### Recommended Setup

1. **API**: Cloudflare Workers + D1 (edge)
2. **Bot**: Railway or Fly.io (requires persistent connection)
3. **Database**: D1 for API, Turso for bot (same underlying data)

For self-hosted setups, you can use a single SQLite/Turso database shared between API and bot.

## Custom Domain

Add a custom domain in the Cloudflare dashboard:
1. Go to Workers & Pages > your worker > Settings > Domains & Routes
2. Add a custom domain (e.g., `api.discolink.dev`)

## Monitoring

View logs in real-time:

```bash
wrangler tail
```

## Troubleshooting

### Database Connection Issues

Ensure the D1 binding is correctly configured in wrangler.toml and that migrations have been applied.

### CORS Errors

Set the `CORS_ORIGINS` secret to your frontend domain(s), or use `*` for development.

### Rate Limiting

Workers have a limit of 100,000 requests/day on the free plan. Consider the paid plan for production use.
