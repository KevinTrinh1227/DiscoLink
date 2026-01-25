import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Discord Forum API',
      description: 'API-first Discord forum/FAQ/blog engine that syncs Discord server content to a database and exposes it via REST API',
      social: {
        github: 'https://github.com/KevinTrinh1227/discord-forum-api',
      },
      customCss: ['./src/styles/custom.css'],
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: false,
      },
      editLink: {
        baseUrl: 'https://github.com/KevinTrinh1227/discord-forum-api/edit/main/packages/docs/',
      },
      sidebar: [
        {
          label: 'Getting Started',
          autogenerate: { directory: 'getting-started' },
        },
        {
          label: 'Guides',
          autogenerate: { directory: 'guides' },
        },
        {
          label: 'API Reference',
          autogenerate: { directory: 'api' },
        },
        {
          label: 'Use Cases',
          autogenerate: { directory: 'use-cases' },
        },
        {
          label: 'Deployment',
          autogenerate: { directory: 'deployment' },
        },
        {
          label: 'Contributing',
          autogenerate: { directory: 'contributing' },
        },
      ],
    }),
  ],
});
