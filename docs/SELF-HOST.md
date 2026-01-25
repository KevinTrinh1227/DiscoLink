# Self-Hosting Guide

Deploy the Discord Forum API on your own infrastructure.

## Deployment Options

### Option 1: Traditional VPS

Deploy on a Linux VPS (DigitalOcean, Linode, AWS EC2, etc.)

#### Requirements

- Node.js 20+
- 512MB+ RAM
- Persistent storage for SQLite (or external database)

#### Steps

1. **Clone and build**
   ```bash
   git clone https://github.com/KevinTrinh1227/discord-forum-api.git
   cd discord-forum-api
   pnpm install
   pnpm build
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit with your values
   ```

3. **Initialize database**
   ```bash
   pnpm db:push
   ```

4. **Run with PM2** (recommended)
   ```bash
   npm install -g pm2

   # Start bot
   pm2 start packages/bot/dist/index.js --name "forum-bot"

   # Start API
   pm2 start packages/api/dist/index.js --name "forum-api"

   # Save and enable startup
   pm2 save
   pm2 startup
   ```

5. **Configure reverse proxy** (nginx)
   ```nginx
   server {
       listen 80;
       server_name api.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Option 2: Docker

#### docker-compose.yml

```yaml
version: '3.8'

services:
  bot:
    build:
      context: .
      dockerfile: Dockerfile.bot
    env_file: .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    env_file: .env
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    depends_on:
      - bot
```

#### Dockerfile.bot

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json packages/db/
COPY packages/bot/package.json packages/bot/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable pnpm

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/db/package.json packages/db/
COPY --from=builder /app/packages/db/dist packages/db/dist
COPY --from=builder /app/packages/bot/package.json packages/bot/
COPY --from=builder /app/packages/bot/dist packages/bot/dist
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/db/node_modules packages/db/node_modules
COPY --from=builder /app/packages/bot/node_modules packages/bot/node_modules

CMD ["node", "packages/bot/dist/index.js"]
```

#### Run

```bash
docker-compose up -d
```

### Option 3: Cloudflare Workers + Turso

Deploy the API to Cloudflare Workers with Turso database.

1. **Set up Turso**
   ```bash
   turso db create discord-forum-api
   turso db tokens create discord-forum-api
   ```

2. **Configure wrangler.toml**
   ```toml
   name = "discord-forum-api"
   main = "packages/api/dist/index.js"
   compatibility_date = "2024-01-01"

   [vars]
   DATABASE_TYPE = "turso"

   [[secrets]]
   name = "TURSO_DATABASE_URL"

   [[secrets]]
   name = "TURSO_AUTH_TOKEN"
   ```

3. **Deploy**
   ```bash
   wrangler secret put TURSO_DATABASE_URL
   wrangler secret put TURSO_AUTH_TOKEN
   wrangler deploy
   ```

Note: The bot must still run on a traditional server since it needs persistent WebSocket connections.

### Option 4: Railway / Render / Fly.io

These platforms support Node.js apps directly:

1. Connect your GitHub repository
2. Configure environment variables
3. Set build command: `pnpm install && pnpm build`
4. Set start command: `node packages/api/dist/index.js` (for API)

Run bot and API as separate services.

## Database Options

### SQLite (Default)

Good for:
- Small to medium deployments
- Single-server setups
- Development

Limitations:
- Single writer at a time
- Not suitable for multi-instance deployments

### Turso

Good for:
- Edge deployments
- Multi-region reads
- Serverless functions

```env
DATABASE_TYPE=turso
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
```

### PostgreSQL (Future)

PostgreSQL support is planned for high-scale deployments.

## Production Checklist

### Security

- [ ] Use HTTPS for API
- [ ] Set secure CORS origins
- [ ] Enable rate limiting
- [ ] Use secrets manager for credentials
- [ ] Regular security updates

### Performance

- [ ] Enable response caching
- [ ] Use CDN for static assets
- [ ] Monitor memory usage
- [ ] Set up database backups

### Monitoring

- [ ] Application logging (stdout/file)
- [ ] Error tracking (Sentry, etc.)
- [ ] Uptime monitoring
- [ ] Database metrics

### Maintenance

- [ ] Automated backups
- [ ] Update strategy
- [ ] Rollback plan

## Environment Variables (Production)

```env
# Required
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
NODE_ENV=production

# Database
DATABASE_TYPE=turso
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# API
API_PORT=3000
CORS_ORIGIN=https://yourdomain.com

# Optional
DISCORD_CLIENT_SECRET=for_oauth
SYNC_BOT_MESSAGES=true
```

## Scaling Considerations

### Single Server

For most use cases, a single server can handle:
- Thousands of threads
- Tens of thousands of messages
- Multiple Discord servers

### Multiple Instances

For high availability:

1. **API**: Can run multiple instances behind a load balancer
2. **Bot**: Run single instance (Discord allows only one connection per token)
3. **Database**: Use Turso or PostgreSQL for shared state

### Caching

The API includes built-in caching for expensive endpoints. For additional caching:

- Use Redis for shared cache across instances
- Configure CDN caching for public endpoints
- Adjust cache TTLs based on your needs

## Backup & Recovery

### SQLite Backup

```bash
# Stop the bot first
pm2 stop forum-bot

# Backup
cp data/discord-forum.db data/discord-forum.db.backup

# Restart
pm2 start forum-bot
```

### Turso Backup

Turso handles backups automatically. For manual exports:

```bash
turso db shell discord-forum-api ".dump" > backup.sql
```

## Troubleshooting

### High Memory Usage

- Check for memory leaks in logs
- Increase Node.js heap size: `NODE_OPTIONS="--max-old-space-size=1024"`
- Consider pagination for large queries

### Database Locked

- Ensure single bot instance
- Check for zombie processes
- Increase busy_timeout in SQLite config

### API Slow Response

- Enable caching
- Check database indexes
- Profile slow queries

### Bot Disconnecting

- Check network stability
- Verify token validity
- Monitor Discord status page
