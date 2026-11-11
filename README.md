# Brandly — AI-Powered Brand Content Platform

A production-ready Next.js app for internal marketing teams to build Brand DNA profiles, generate on-brand social content, schedule posts, and automate publishing.

> **Product direction:** the plan for turning this prototype into a multi-user SMB platform is in [docs/PRODUCT_SCOPE.md](docs/PRODUCT_SCOPE.md). Start there.

## Features

- **Brand Intelligence** — Crawl website, Instagram, and PDF catalogues (raster + vector) to auto-build a Brand DNA profile
- **AI Composer** — Generate full post packages (caption, hashtags, image prompt, CTA, best time) for Instagram, Facebook, LinkedIn, and X/Twitter
- **Visual Calendar** — Monthly and weekly calendar views with scheduling, drag-to-reschedule, and status tracking
- **Automation** — RSS feed triggers, recurring post schedules, and product update watchers

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **AI**: Anthropic Claude (claude-opus-4-5) via `@anthropic-ai/sdk`
- **State**: Zustand with localStorage persistence
- **Styling**: Tailwind CSS
- **PDF Processing**: PDF.js (browser-side page rasterisation — captures raster images AND vector layers)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Get your key at: https://console.anthropic.com

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
brandly/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── onboarding/page.tsx         # Brand Intelligence (5-step flow)
│   ├── composer/page.tsx           # AI Content Composer
│   ├── calendar/page.tsx           # Visual Calendar + Scheduling
│   ├── automation/page.tsx         # Automation rules
│   └── api/
│       ├── analyse-brand/route.ts  # Brand DNA synthesis
│       ├── analyse-pdf/route.ts    # PDF Vision analysis
│       ├── generate-post/route.ts  # Full post package generation
│       └── automation/route.ts     # Trigger execution
├── components/
│   ├── layout/                     # Sidebar, AppShell
│   ├── composer/                   # PlatformPreview
│   └── ui/                         # Button, Input, Card, Chip, etc.
├── lib/
│   ├── types.ts                    # All TypeScript types
│   ├── claude.ts                   # Anthropic SDK wrapper
│   ├── store.ts                    # Zustand global state
│   └── templates.ts                # Content templates + platform config
```

## PDF Processing

Brandly handles both types of PDF content:

- **Raster images** (embedded JPEGs/PNGs) — captured via PDF.js canvas rendering
- **Vector / layered content** (shapes, illustrations, text overlays, gradients) — captured by rasterising the full page at 1.8x scale

Pages are sent to Claude Vision as base64 JPEGs. Up to 8 pages are analysed per PDF.

## Production Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import in Vercel
3. Add `ANTHROPIC_API_KEY` to environment variables
4. Deploy

### Persistence

Currently uses Zustand + localStorage for state. For production multi-user use, replace with:
- **Supabase** (PostgreSQL + Auth + Storage) — recommended
- **PlanetScale** or **Neon** for DB only

See `.env.example` for Supabase config placeholders.

## Roadmap (Phase 2+)

- [ ] Media library with AI image generation (DALL-E / Midjourney)
- [ ] Team collaboration + approval flows
- [ ] Social API connections (Meta Graph, LinkedIn, X API)
- [ ] Analytics dashboard
- [ ] Ecommerce integrations (Shopify, WooCommerce)
- [ ] White-label / multi-workspace
