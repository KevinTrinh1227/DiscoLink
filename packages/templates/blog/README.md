# DiscordLink Blog Template

A modern blog template powered by DiscordLink API.

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

- Featured post section
- Author avatars from Discord
- Reading time estimates
- Related posts
- JSON-LD Article schema for SEO
- RSS feed support
- Open Graph and Twitter Cards
- Dark mode support
- Mobile responsive

## Customization

- Edit `src/components/PostCard.astro` to change post card design
- Modify `src/components/Header.astro` for navigation
- Update `src/layouts/BaseLayout.astro` for global styles
- Customize colors in CSS variables
