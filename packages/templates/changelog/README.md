# DiscordLink Changelog Template

A timeline-style changelog template powered by DiscordLink API.

## Setup

1. Set environment variables:
   ```
   DISCORDLINK_API_URL=http://localhost:3000
   DISCORDLINK_SERVER_ID=your-server-id
   SITE_URL=https://your-domain.com
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run development server:
   ```bash
   pnpm dev
   ```

4. Build for production:
   ```bash
   pnpm build
   ```

## Features

- Timeline view grouped by month
- Type badges (feature, fix, improvement, breaking)
- JSON-LD SoftwareApplication schema
- RSS feed support
- Dark mode support
- Mobile responsive

## Customization

- Edit `src/components/ChangelogEntry.astro` to change entry styling
- Modify badge types in the `getTypeFromTags` function
- Update `src/layouts/BaseLayout.astro` for global styles
