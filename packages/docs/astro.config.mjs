import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'Threadlink',
      description: 'Transform your Discord forum channels into a powerful REST API. Sync threads, messages, and content to build FAQs, blogs, and knowledge bases.',
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
