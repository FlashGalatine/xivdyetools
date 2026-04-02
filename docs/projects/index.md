# Projects Overview

**Deep-dive documentation for each project in the XIV Dye Tools ecosystem**

---

## Project Comparison Matrix

| Project | Type | Platform | Key Technologies | Primary Purpose |
|---------|------|----------|------------------|-----------------|
| [@xivdyetools/core](core/overview.md) | npm library | Node.js / Browser | TypeScript, k-d tree, K-means++ | Color algorithms, 136-dye database |
| [xivdyetools-web-app](web-app/overview.md) | Web app | Cloudflare Pages | Lit, Vite, Tailwind CSS | 9 interactive color tools |
| [xivdyetools-discord-worker](discord-worker/overview.md) | Discord bot | Cloudflare Workers | Hono, HTTP Interactions, resvg-wasm | 20 slash commands |
| [xivdyetools-moderation-worker](moderation-worker/overview.md) | Discord bot | Cloudflare Workers | Hono, HTTP Interactions | Preset moderation commands |
| [xivdyetools-oauth](oauth/overview.md) | OAuth provider | Cloudflare Workers | Hono, PKCE, JWT | Discord authentication |
| [xivdyetools-api-worker](api-worker/overview.md) | Public API | Cloudflare Workers | Hono, KV | Dye database & color matching |
| [xivdyetools-presets-api](presets-api/overview.md) | REST API | Cloudflare Workers | Hono, D1 SQLite | Community presets |
| [xivdyetools-universalis-proxy](universalis-proxy/overview.md) | CORS Proxy | Cloudflare Workers | Hono, KV | Market data caching |
| [xivdyetools-og-worker](og-worker/overview.md) | OpenGraph | Cloudflare Workers | Hono, resvg-wasm | Social media previews |
| xivdyetools-stoat-worker | Node.js bot | Node.js | discord.js | Private Discord Stoat bot |
| xivdyetools-maintainer | Dev tool | Local | Vue 3, Vite | Dye database editor |
| [@xivdyetools/types](types/overview.md) | npm library | Universal | TypeScript | Shared type definitions |
| [@xivdyetools/auth](auth/overview.md) | npm library | Universal | TypeScript | JWT, HMAC, Ed25519 verification |
| [@xivdyetools/crypto](crypto/overview.md) | npm library | Universal | TypeScript | Base64URL encoding |
| [@xivdyetools/logger](logger/overview.md) | npm library | Universal | TypeScript | Multi-environment logging |
| [@xivdyetools/rate-limiter](rate-limiter/overview.md) | npm library | Universal | TypeScript | Sliding window rate limiting |
| [@xivdyetools/svg](svg/overview.md) | npm library | Universal | TypeScript | SVG template rendering |
| [@xivdyetools/bot-logic](bot-logic/overview.md) | npm library | Universal | TypeScript | Shared Discord bot business logic |
| [@xivdyetools/bot-i18n](bot-i18n/overview.md) | npm library | Universal | TypeScript | Bot localization strings |
| [@xivdyetools/color-blending](color-blending/overview.md) | npm library | Universal | TypeScript | RGB color blending algorithms |
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
│  │ 9 interactive tools  │  │ 20 slash commands       │  │ Preset moderation           │  │
│  │ 12 themes, PWA       │  │ SVG/PNG rendering       │  │ User ban management         │  │
│  └──────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘  │
│  ┌──────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │ xivdyetools-oauth    │  │ xivdyetools-presets-api │  │xivdyetools-universalis-proxy│  │
│  │ ──────────────────── │  │─────────────────────────│  │─────────────────────────────│  │
│  │ Discord OAuth        │  │ Community presets       │  │ Universalis CORS proxy      │  │
│  │ PKCE + JWT           │  │ D1 + moderation         │  │ Dual-layer caching          │  │
│  └──────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘  │
│  ┌──────────────────────┐  ┌─────────────────────────┐                                    │
│  │ xivdyetools-og-worker│  │xivdyetools-stoat-worker │                                    │
│  │ ──────────────────── │  │─────────────────────────│                                    │
│  │ OG image generation  │  │ Private Stoat bot       │                                    │
│  │ Social media previews│  │ Node.js + discord.js    │                                    │
│  └──────────────────────┘  └─────────────────────────┘                                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         Core + Feature Libraries                                         │
│  ┌─────────────────────┐ ┌──────────────────┐ ┌───────────────────┐ ┌─────────────────┐ │
│  │  @xivdyetools/core  │ │ @xivdyetools/svg │ │@xivdyetools/      │ │@xivdyetools/    │ │
│  │  ─────────────────  │ │ ──────────────── │ │  bot-logic         │ │  bot-i18n       │ │
│  │  136-dye database   │ │ SVG templates    │ │───────────────────│ │─────────────────│ │
│  │  Color algorithms   │ │ PNG rendering    │ │ Bot business logic│ │ Bot localization │ │
│  │  6-language i18n    │ │                  │ │                   │ │                 │ │
│  └─────────────────────┘ └──────────────────┘ └───────────────────┘ └─────────────────┘ │
│  ┌──────────────────────────┐                                                            │
│  │@xivdyetools/color-blending│                                                            │
│  │──────────────────────────│                                                            │
│  │ RGB color blending       │                                                            │
│  └──────────────────────────┘                                                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           Shared Foundation                                               │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────┐ │
│  │ @xivdyetools/    │ │ @xivdyetools/    │ │ @xivdyetools/    │ │ @xivdyetools/        │ │
│  │   types           │ │   logger         │ │   auth           │ │   test-utils          │ │
│  │ ──────────────── │ │ ──────────────── │ │ ──────────────── │ │ ──────────────────── │ │
│  │ Type definitions │ │ Multi-env logging│ │ JWT, HMAC, Ed25519│ │ Mocks & factories    │ │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────────┘ │
│  ┌──────────────────┐ ┌──────────────────────┐                                            │
│  │ @xivdyetools/    │ │ @xivdyetools/        │                                            │
│  │   crypto          │ │   rate-limiter        │                                            │
│  │ ──────────────── │ │ ──────────────────── │                                            │
│  │ Base64URL encode │ │ Sliding window limits│                                            │
│  └──────────────────┘ └──────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
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
| [Discord Commands](discord-worker/commands.md) | All 20 commands documented |
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

### Applications

| Project | Version | Last Updated |
|---------|---------|--------------|
| @xivdyetools/core | v2.0.1 | March 2026 |
| xivdyetools-web-app | v4.3.1 | March 2026 |
| xivdyetools-discord-worker | v4.1.2 | March 2026 |
| xivdyetools-moderation-worker | v1.1.8 | March 2026 |
| xivdyetools-oauth | v2.3.8 | March 2026 |
| xivdyetools-presets-api | v1.4.15 | March 2026 |
| xivdyetools-universalis-proxy | v1.4.3 | March 2026 |
| xivdyetools-og-worker | v1.0.6 | March 2026 |
| xivdyetools-stoat-worker | v0.1.3 | March 2026 |
| xivdyetools-maintainer | v1.0.2 | March 2026 |

### Shared Libraries

| Package | Version | Last Updated |
|---------|---------|--------------|
| @xivdyetools/types | v1.9.0 | March 2026 |
| @xivdyetools/crypto | v1.1.0 | February 2026 |
| @xivdyetools/logger | v1.2.2 | March 2026 |
| @xivdyetools/auth | v1.1.1 | March 2026 |
| @xivdyetools/rate-limiter | v1.4.3 | March 2026 |
| @xivdyetools/svg | v1.1.2 | March 2026 |
| @xivdyetools/bot-logic | v1.1.2 | March 2026 |
| @xivdyetools/bot-i18n | v1.1.0 | March 2026 |
| @xivdyetools/color-blending | v1.0.1 | February 2026 |
| @xivdyetools/test-utils | v1.1.5 | March 2026 |

See [Version Matrix](../versions.md) for detailed version history.

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - How projects interconnect
- [Developer Guides](../developer-guides/index.md) - Setup and contribution guides
- [Specifications](../specifications/index.md) - Feature specifications
