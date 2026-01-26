# DiscoLink FAQ Template

A ready-to-use FAQ template powered by DiscoLink API.

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

- Displays resolved Discord threads as FAQ items
- Client-side search filtering
- JSON-LD FAQPage schema for SEO
- Dark mode support
- Mobile responsive
- RSS feed support

## Customization

- Edit `src/layouts/BaseLayout.astro` to customize the global styles
- Edit `src/components/FAQItem.astro` to change the FAQ card design
- Edit `src/pages/index.astro` to modify the FAQ list page
