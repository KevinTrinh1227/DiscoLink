# DiscoLink Knowledge Base Template

A documentation-style knowledge base template powered by DiscoLink API.

## Setup

1. Set environment variables:
   ```
   DISCOLINK_API_URL=http://localhost:3000
   DISCOLINK_SERVER_ID=your-server-id
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

- Sidebar navigation with categories
- Full-text search
- Related articles
- Breadcrumb navigation
- Popular and recent articles on homepage
- Dark mode support
- Mobile responsive

## Customization

- Edit `src/components/Sidebar.astro` to customize navigation
- Modify `src/lib/discolink.ts` `groupByCategory` function for custom categorization
- Update `src/layouts/BaseLayout.astro` for global styles
