<p align="center">
  <img src="packages/www/public/banner.svg" alt="DiscoLink" width="100%">
</p>

<p align="center">
  <b>Your Discord content, anywhere you need it.</b>
</p>

<p align="center">
  <a href="https://github.com/KevinTrinh1227/discolink/stargazers"><img src="https://img.shields.io/github/stars/KevinTrinh1227/discolink?style=for-the-badge&logo=github&color=yellow" alt="Stars"></a>
  <a href="https://github.com/KevinTrinh1227/discolink/releases"><img src="https://img.shields.io/github/v/release/KevinTrinh1227/discolink?style=for-the-badge&logo=github&color=blue" alt="Release"></a>
  <a href="https://discolink.pages.dev/docs"><img src="https://img.shields.io/badge/Docs-Visit-8A2BE2?style=for-the-badge&logo=gitbook&logoColor=white" alt="Documentation"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License"></a>
</p>

---

## 🤔 What is DiscoLink?

DiscoLink syncs your Discord forums and channels to a database you control. Build FAQ pages, knowledge bases, changelogs, or blogs from your Discord content.

```
Discord → Bot syncs content → Database → REST API / Static Export → Your Website
```

**Use it for:**
- 💬 **FAQ Pages** — Turn resolved help threads into searchable FAQs
- 📚 **Knowledge Base** — Organize forum content into documentation
- 📋 **Changelog** — Auto-publish release notes from announcements
- ✍️ **Blog** — Transform discussions into blog posts

---

## ✨ Features

<details>
<summary>🔄 <b>Real-Time Sync</b></summary>
<br>
Discord bot syncs forum posts, text channels, and announcements in real-time. Never miss an update—content is captured the moment it's posted.
</details>

<details>
<summary>🔍 <b>Full-Text Search</b></summary>
<br>
FTS5-powered search indexes all your Discord content. Find threads, messages, and answers instantly with typo-tolerant queries.
</details>

<details>
<summary>🌐 <b>REST API</b></summary>
<br>
Full REST API with endpoints for servers, channels, threads, messages, users, and search. Paginated responses, filtering, and webhooks included.
</details>

<details>
<summary>📦 <b>Static Export</b></summary>
<br>
Export your content to static HTML with the CLI. Deploy anywhere—no server required. Perfect for documentation sites and blogs.
</details>

<details>
<summary>🎨 <b>Official Templates</b></summary>
<br>
Ready-to-use Astro templates for FAQ, Knowledge Base, Changelog, and Blog. Just configure and deploy.
</details>

<details>
<summary>☁️ <b>Edge Deployment</b></summary>
<br>
Deploy to Cloudflare Workers with Turso database for global low-latency access. Or self-host with SQLite locally.
</details>

<details>
<summary>🔒 <b>Privacy Controls</b></summary>
<br>
Consent-based syncing lets users opt out. Self-hosted means your data stays on your infrastructure. No tracking, no data collection.
</details>

---

## 🛠️ Three Ways to Use — All Free

<details>
<summary>🔗 <b>REST API</b> — For custom apps & integrations</summary>
<br>

Build custom applications with full API access. Perfect for dashboards, integrations, and dynamic websites.

- Full CRUD operations
- Webhook notifications
- RSS/Atom feeds
- Rate limiting included

</details>

<details>
<summary>📦 <b>Static Export</b> — No server needed</summary>
<br>

Export to static HTML and host anywhere. Great for simple sites, GitHub Pages, or CDN hosting.

- Zero runtime dependencies
- Fast page loads
- SEO optimized
- Works offline

</details>

<details>
<summary>🎨 <b>Templates</b> — Quick start with pre-built designs</summary>
<br>

Get started in minutes with official templates:

| Template | Description |
|----------|-------------|
| [FAQ](packages/templates/faq) | Searchable FAQ from resolved threads |
| [Knowledge Base](packages/templates/knowledge-base) | Organized documentation |
| [Changelog](packages/templates/changelog) | Release notes timeline |
| [Blog](packages/templates/blog) | Blog posts from discussions |

</details>

---

## 🚀 Quick Start

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

📖 **[Full Setup Guide →](https://discolink.pages.dev/quickstart)**

---

## 📚 Documentation

| Resource | Link |
|----------|------|
| Getting Started | [discolink.pages.dev/quickstart](https://discolink.pages.dev/quickstart) |
| API Reference | [discolink.pages.dev/docs/api](https://discolink.pages.dev/docs/api) |
| CLI Reference | [discolink.pages.dev/docs/cli](https://discolink.pages.dev/docs/cli) |
| Templates | [discolink.pages.dev/templates](https://discolink.pages.dev/templates) |

---

## ⭐ Star History

<a href="https://star-history.com/#KevinTrinh1227/discolink&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=KevinTrinh1227/discolink&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=KevinTrinh1227/discolink&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=KevinTrinh1227/discolink&type=Date" />
 </picture>
</a>

---

## 📄 License & Contributing

**MIT License** — Use it however you want. See [LICENSE](LICENSE) for details.

Contributions welcome! Check out the [Contributing Guide](https://discolink.pages.dev/docs/guides) to get started.
