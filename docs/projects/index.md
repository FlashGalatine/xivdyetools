# Projects Overview

**Deep-dive documentation for each project in the XIV Dye Tools ecosystem**

---

## Project Comparison Matrix

| Project | Type | Platform | Key Technologies | Primary Purpose |
|---------|------|----------|------------------|-----------------|
| [@xivdyetools/core](core/overview.md) | npm library | Node.js / Browser | TypeScript, k-d tree, K-means++ | Color algorithms, 136-dye database |
| [xivdyetools-web-app](web-app/overview.md) | Web app | Cloudflare Pages | Lit, Vite, Tailwind CSS | 9 interactive color tools |
| [xivdyetools-discord-worker](discord-worker/overview.md) | Discord bot | Cloudflare Workers | Hono, HTTP Interactions, resvg-wasm | 17 slash commands |
| [xivdyetools-moderation-worker](moderation-worker/overview.md) | Discord bot | Cloudflare Workers | Hono, HTTP Interactions | Preset moderation commands |
| [xivdyetools-oauth](oauth/overview.md) | OAuth provider | Cloudflare Workers | Hono, PKCE, JWT | Discord authentication |
| [xivdyetools-presets-api](presets-api/overview.md) | REST API | Cloudflare Workers | Hono, D1 SQLite | Community presets |
| [xivdyetools-universalis-proxy](universalis-proxy/overview.md) | CORS Proxy | Cloudflare Workers | Hono, KV | Market data caching |
| [xivdyetools-og-worker](og-worker/overview.md) | OpenGraph | Cloudflare Workers | Hono, resvg-wasm | Social media previews |
| [@xivdyetools/types](types/overview.md) | npm library | Universal | TypeScript | Shared type definitions |
| [@xivdyetools/logger](logger/overview.md) | npm library | Universal | TypeScript | Multi-environment logging |
| [@xivdyetools/test-utils](test-utils/overview.md) | npm library | Test | TypeScript, Vitest | Testing utilities and mocks |

---

## Architecture Layers

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              Consumer Applications                                        │
│  ┌──────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │ xivdyetools-web-app  │  │xivdyetools-discord-worker│  │xivdyetools-moderation-worker│  │
│  │ ──────────────────── │  │─────────────────────────│  │─────────────────────────────│  │
│  │ Vite + Lit web app   │  │ Discord bot (public)    │  │ Discord bot (moderators)    │  │
│  │ 9 interactive tools  │  │ 17 slash commands       │  │ Preset moderation           │  │
│  │ 12 themes, PWA       │  │ SVG/PNG rendering       │  │ User ban management         │  │
│  └──────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Backend Services                                  │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐    │
│  │ xivdyetools-oauth │  │xivdyetools-presets│  │xivdyetools-universalis│    │
│  │ ───────────────── │  │       -api        │  │        -proxy         │    │
│  │ Discord OAuth     │  │ ───────────────── │  │ ───────────────────── │    │
│  │ PKCE + JWT        │  │ Community presets │  │ Universalis CORS proxy│    │
│  │ timeout protection│  │ D1 + moderation   │  │ Dual-layer caching    │    │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Core Library                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        @xivdyetools/core                                ││
│  │                        ─────────────────                                ││
│  │     136-dye database │ Color conversion │ Accessibility simulation      ││
│  │     K-d tree matching │ Color harmonies │ K-means++ palette extraction  ││
│  │     Facewear support │ 6-language localization │ Preset palettes        ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Shared Foundation                                  │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ │
│  │  @xivdyetools/types  │ │ @xivdyetools/logger  │ │@xivdyetools/test-utils│ │
│  │  ──────────────────  │ │ ──────────────────── │ │────────────────────── │ │
│  │  Type definitions    │ │ Multi-env logging    │ │ Mocks & factories     │ │
│  │  Facewear ID support │ │ Secret redaction     │ │ CF binding mocks      │ │
│  └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Links by Category

### For Using the Library

If you want to integrate XIV Dye Tools into your own project:

| Document | Description |
|----------|-------------|
| [Core Library Overview](core/overview.md) | Installation, quick start, features |
| [Core Services](core/services.md) | ColorService, DyeService, APIService |
| [Core Types](core/types.md) | Type system and branded types |
| [Core Algorithms](core/algorithms.md) | k-d tree, K-means++, harmony generation |

### For Understanding the Web App

| Document | Description |
|----------|-------------|
| [Web App Overview](web-app/overview.md) | Architecture, toolset, features |
| [Web App Tools](web-app/tools.md) | Detailed guide to all 9 tools |
| [Web App Components](web-app/components.md) | Lit component architecture |
| [Web App Theming](web-app/theming.md) | 12 themes, CSS variables |

### For Understanding the Discord Bots

| Document | Description |
|----------|-------------|
| [Discord Worker Overview](discord-worker/overview.md) | HTTP Interactions architecture |
| [Discord Commands](discord-worker/commands.md) | All 17 commands documented |
| [Discord Interactions](discord-worker/interactions.md) | Button, modal, autocomplete handlers |
| [Discord Rendering](discord-worker/rendering.md) | SVG generation, PNG output |
| [Moderation Worker Overview](moderation-worker/overview.md) | Moderator-only bot architecture |

### For Understanding Authentication

| Document | Description |
|----------|-------------|
| [OAuth Overview](oauth/overview.md) | Worker architecture |
| [PKCE Flow](oauth/pkce-flow.md) | Security flow explained |
| [JWT Structure](oauth/jwt.md) | Token format and verification |

### For Understanding the Presets System

| Document | Description |
|----------|-------------|
| [Presets API Overview](presets-api/overview.md) | API architecture |
| [Presets Endpoints](presets-api/endpoints.md) | Full API reference |
| [Presets Moderation](presets-api/moderation.md) | Content filtering pipeline |
| [Presets Database](presets-api/database.md) | D1 schema documentation |

### For Understanding the Universalis Proxy

| Document | Description |
|----------|-------------|
| [Proxy Overview](universalis-proxy/overview.md) | Architecture and features |
| [Caching Strategy](universalis-proxy/caching.md) | Dual-layer caching deep dive |
| [Deployment Guide](universalis-proxy/deployment.md) | KV setup and deployment |

---

## Version Summary

| Project | Version | Last Updated |
|---------|---------|--------------|
| @xivdyetools/core | v1.15.1 | January 2026 |
| xivdyetools-web-app | v4.1.1 | January 2026 |
| xivdyetools-discord-worker | v2.3.4 | January 2026 |
| xivdyetools-moderation-worker | v1.0.1 | January 2026 |
| xivdyetools-oauth | v2.2.2 | December 2025 |
| xivdyetools-presets-api | v1.4.7 | January 2026 |
| xivdyetools-universalis-proxy | v1.3.0 | January 2026 |
| xivdyetools-og-worker | v1.0.0 | January 2026 |
| @xivdyetools/types | v1.7.0 | January 2026 |
| @xivdyetools/logger | v1.1.0 | January 2026 |
| @xivdyetools/test-utils | v1.1.0 | January 2026 |

See [Version Matrix](../versions.md) for detailed version history.

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - How projects interconnect
- [Developer Guides](../developer-guides/index.md) - Setup and contribution guides
- [Specifications](../specifications/index.md) - Feature specifications
