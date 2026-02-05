<p align="center">
   <a href="https://discolink.site/"><img src="https://github.com/user-attachments/assets/e45ad81d-050a-40da-b7ae-06cd4fc7d332" alt="Stars"></a><br/>
  <a href="https://github.com/KevinTrinh1227/discolink/stargazers"><img src="https://img.shields.io/github/stars/KevinTrinh1227/discolink?style=for-the-badge&logo=github&color=yellow" alt="Stars"></a>
  <a href="https://github.com/KevinTrinh1227/discolink/releases"><img src="https://img.shields.io/github/v/release/KevinTrinh1227/discolink?style=for-the-badge&logo=github&color=blue" alt="Release"></a>
  <a href="https://discolink.site"><img src="https://img.shields.io/badge/Docs-Visit-8B5CF6?style=for-the-badge&logo=gitbook&logoColor=white" alt="Documentation"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License"></a>
</p>

<p align="center">
  <a href="https://discolink.site/getting-started/quick-start">Quick Start</a> -
  <a href="https://discolink.site/api/overview">API Reference</a> -
  <a href="https://demo.discolink.site">Live Demo</a> -
  <a href="https://discolink.site/contributing/development-setup">Contributing</a>
</p>

---

## What is DiscoLink?

DiscoLink syncs your Discord forums and channels to a database you control. Build FAQ pages, knowledge bases, changelogs, or blogs from your Discord content.

```
Discord --> Bot syncs content --> Database --> REST API / Static Export --> Your Website
```

**Use it for:**
- **FAQ Pages** - Turn resolved help threads into searchable FAQs
- **Knowledge Base** - Organize forum content into documentation
- **Changelog** - Auto-publish release notes from announcements
- **Blog** - Transform discussions into blog posts

<details>
<summary><b>Why I built this</b></summary>
<br>

I'm working on a project called [CoogCasa](https://github.com/KevinTrinh1227/CoogCasa) where I wanted to integrate heavily with Discord - but in a specific way. I needed certain threads and content from Discord to be pulled and displayed on a custom app I was building, fully SEO optimized.

I couldn't find an existing tool that did exactly what I needed. Most solutions were either too rigid, didn't offer the level of control I wanted, or weren't designed for custom integrations. So I decided to build my own.

While there are other amazing tools out there that sync Discord content, DiscoLink was built differently:
- **You own your data** - Self-hosted with your own database
- **Flexible output** - REST API, static export, or webhooks - your choice
- **Privacy focused** - Consent-based syncing with full user control
- **Developer first** - Built for integration into custom apps, not just standalone sites

</details>

---

## Features

- **Real-Time Sync** - Discord bot syncs forum posts, text channels, and announcements instantly
- **Full-Text Search** - FTS5-powered search with typo-tolerant queries
- **REST API** - Full API with endpoints for servers, channels, threads, messages, and users
- **Static Export** - Export to static HTML with the CLI, deploy anywhere
- **Official Templates** - Ready-to-use Astro templates for FAQ, KB, Changelog, and Blog
- **Webhooks** - Real-time event delivery with HMAC signing, retries, and dead letter queues
- **Polls & Events** - Sync Discord polls, scheduled events, and Nitro boost data
- **Edge Deployment** - Deploy to Cloudflare Workers with Turso, or self-host with SQLite
- **Privacy Controls** - Consent-based syncing, self-hosted, no tracking

---

## Three Ways to Use - All Free

- **REST API** - Build custom apps, dashboards, and integrations with full API access
- **Static Export** - Export to static HTML and host anywhere, no server needed
- **Templates** - Get started in minutes with pre-built FAQ, KB, Changelog, or Blog templates

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/KevinTrinh1227/discolink.git
cd discolink && pnpm install

# Configure
cp .env.example .env
# Add your Discord bot token and credentials

# Run
pnpm db:push && pnpm dev
```

**[Full Setup Guide](https://discolink.site/getting-started/quick-start)**

---

## Documentation & Links

- [Getting Started](https://discolink.site/getting-started/introduction)
- [API Reference](https://discolink.site/api/overview)
- [Deployment Guides](https://discolink.site/deployment)
- [Live Demos](https://demo.discolink.site)
- [Contributing Guide](https://discolink.site/contributing/development-setup)

---

## Star History

<a href="https://star-history.com/#KevinTrinh1227/discolink&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=KevinTrinh1227/discolink&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=KevinTrinh1227/discolink&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=KevinTrinh1227/discolink&type=Date" />
 </picture>
</a>

---

Built by [Kevin Trinh](https://kevintrinh.dev) | MIT License
