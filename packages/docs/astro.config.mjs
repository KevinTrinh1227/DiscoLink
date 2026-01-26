import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'DiscoLink',
      description: 'Sync your Discord content to a database you control. Build websites, integrate via REST API, or export static files. Your data, your way.',
      social: {
        github: 'https://github.com/KevinTrinh1227/discolink',
      },
      customCss: ['./src/styles/custom.css'],
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: false,
      },
      editLink: {
        baseUrl: 'https://github.com/KevinTrinh1227/discolink/edit/main/packages/docs/',
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
