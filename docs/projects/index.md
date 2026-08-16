# Projects Overview

**Deep-dive documentation for each project in the XIV Dye Tools ecosystem**

---

## Project Comparison Matrix

| Project | Type | Platform | Key Technologies | Primary Purpose |
|---------|------|----------|------------------|-----------------|
| [@xivdyetools/core](core/overview.md) | npm library | Node.js / Browser | TypeScript, k-d tree, K-means++ | Color algorithms; the 125-dye database (schema v2) and the 11 Facewear colors |
| [xivdyetools-web-app](web-app/overview.md) | Web app | Cloudflare Pages | Lit, Vite, Tailwind CSS | 9 interactive color tools |
| [xivdyetools-discord-worker](discord-worker/overview.md) | Discord bot | Cloudflare Workers | Hono, HTTP Interactions, resvg-wasm | 17 registered slash commands |
| xivdyetools-image-worker | Image decode | Cloudflare Workers | `@cf-wasm/photon` | Raw RGBA pixel extraction for `discord-worker` (service binding only) |
| [xivdyetools-moderation-worker](moderation-worker/overview.md) | Discord bot | Cloudflare Workers | Hono, HTTP Interactions | Preset moderation commands |
| [xivdyetools-oauth](oauth/overview.md) | OAuth provider | Cloudflare Workers | Hono, PKCE, JWT, D1 | Discord authentication |
| [xivdyetools-api-worker](api-worker/overview.md) | Public API | Cloudflare Workers | Hono, KV, VitePress | Public dye database & color matching at `data.xivdyetools.app`, the Universalis proxy, and the developer docs |
| [xivdyetools-presets-api](presets-api/overview.md) | REST API | Cloudflare Workers | Hono, D1 SQLite | Community presets |
| [xivdyetools-og-worker](og-worker/overview.md) | OpenGraph | Cloudflare Workers | Hono, resvg-wasm | Localized social media preview cards |
| xivdyetools-stoat-worker | Node.js bot | Node.js | revolt.js | Revolt (Stoat) bot — parked |
| [@xivdyetools/types](types/overview.md) | npm library | Universal | TypeScript | Shared type definitions and branded types |
| @xivdyetools/auth | npm library | Universal | TypeScript | JWT, HMAC, Ed25519 verification; Base64URL/hex via `/encoding` |
| [@xivdyetools/logger](logger/overview.md) | npm library | Universal | TypeScript | Multi-environment logging |
| @xivdyetools/worker-kit | npm library | Cloudflare Workers | TypeScript, Hono | Shared request-ID / logger / rate-limit middleware; rate-limit backends via `/rate-limiter` |
| @xivdyetools/svg | npm library | Universal | TypeScript | SVG template rendering |
| @xivdyetools/bot-logic | npm library | Universal | TypeScript | Shared bot business logic; bot i18n via `/i18n` |
| [@xivdyetools/test-utils](test-utils/overview.md) | workspace-private | Test | TypeScript, Vitest | Testing utilities and mocks |

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
│  │ Light + Dark, PWA    │  │ SVG/PNG rendering       │  │ User ban management         │  │
│  └──────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘  │
│  ┌──────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │ xivdyetools-oauth    │  │ xivdyetools-presets-api │  │ xivdyetools-api-worker      │  │
│  │ ──────────────────── │  │─────────────────────────│  │─────────────────────────────│  │
│  │ Discord OAuth        │  │ Community presets       │  │ Public REST API +           │  │
│  │ PKCE + JWT, D1       │  │ D1 + moderation         │  │ /universalis + docs site    │  │
│  └──────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘  │
│  ┌──────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │ xivdyetools-og-worker│  │xivdyetools-image-worker │  │ xivdyetools-stoat-worker    │  │
│  │ ──────────────────── │  │─────────────────────────│  │─────────────────────────────│  │
│  │ OG card generation   │  │ Photon pixel extraction │  │ Revolt bot (parked)         │  │
│  │ Discord + X frames   │  │ service binding only    │  │ Node.js + revolt.js         │  │
│  └──────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                         Core + Feature Libraries                                         │
│  ┌─────────────────────────┐ ┌──────────────────┐ ┌────────────────────────────────────┐ │
│  │  @xivdyetools/core      │ │ @xivdyetools/svg │ │ @xivdyetools/bot-logic             │ │
│  │  ─────────────────────  │ │ ──────────────── │ │ ────────────────────────────────── │ │
│  │ 125-dye DB (schema v2)  │ │ SVG templates    │ │ Bot business logic                 │ │
│  │ + 11 Facewear colours   │ │ (data → string)  │ │ + /i18n translation engine         │ │
│  │ Colour algorithms       │ │                  │ │                                    │ │
│  │ 6-language i18n         │ │                  │ │                                    │ │
│  │ /blending subpath       │ │                  │ │                                    │ │
│  └─────────────────────────┘ └──────────────────┘ └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           Shared Foundation                                               │
│  ┌──────────────────┐ ┌──────────────────┐ ┌───────────────────┐ ┌──────────────────────┐ │
│  │ @xivdyetools/    │ │ @xivdyetools/    │ │ @xivdyetools/     │ │ @xivdyetools/        │ │
│  │   types          │ │   logger         │ │   auth            │ │   test-utils         │ │
│  │ ──────────────── │ │ ──────────────── │ │ ───────────────── │ │ ──────────────────── │ │
│  │ Type definitions │ │ Multi-env logging│ │ JWT, HMAC, Ed25519│ │ Mocks & factories    │ │
│  │                  │ │ secret redaction │ │ + /encoding       │ │ (workspace-private)  │ │
│  └──────────────────┘ └──────────────────┘ └───────────────────┘ └──────────────────────┘ │
│  ┌──────────────────────────────────┐                                                     │
│  │ @xivdyetools/worker-kit          │                                                     │
│  │ ──────────────────────────────── │   Hono middleware (request ID, logger, rate limit)  │
│  │ + /rate-limiter (Memory/KV/      │   consumed by every Cloudflare Worker               │
│  │   Upstash sliding-window)        │                                                     │
│  └──────────────────────────────────┘                                                     │
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
| [Web App Theming](web-app/theming.md) | Light + Dark themes, CSS variables |

### For Understanding the Discord Bots

| Document | Description |
|----------|-------------|
| [Discord Worker Overview](discord-worker/overview.md) | HTTP Interactions architecture |
| [Discord Commands](discord-worker/commands.md) | The registered command roster |
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

### For Understanding Market Data

The standalone `universalis-proxy` was merged into `api-worker` on 2026-07-31. Its behaviour —
dual-layer caching, request coalescing, stale-while-revalidate — now lives behind the
`/universalis` and `/api/v2` compatibility routes.

| Document | Description |
|----------|-------------|
| [API Worker Overview](api-worker/overview.md) | Architecture, including the absorbed proxy routes |
| [API Worker Endpoints](api-worker/endpoints.md) | Full public endpoint reference |

---

## Version Summary

### Applications

| Project | Version |
|---------|---------|
| xivdyetools-web-app | v5.0.0 |
| xivdyetools-discord-worker | v5.0.0 |
| xivdyetools-image-worker | v1.0.0 |
| xivdyetools-moderation-worker | v1.4.0 |
| xivdyetools-oauth | v2.6.0 |
| xivdyetools-presets-api | v2.0.0 |
| xivdyetools-api-worker | v0.6.0 |
| xivdyetools-og-worker | v2.0.0 |
| xivdyetools-stoat-worker | v0.2.1 |

### Shared Libraries

| Package | Version |
|---------|---------|
| @xivdyetools/core | v4.0.0 |
| @xivdyetools/types | v2.0.0 |
| @xivdyetools/auth | v1.3.0 |
| @xivdyetools/logger | v1.3.0 |
| @xivdyetools/worker-kit | v1.0.0 |
| @xivdyetools/svg | v2.0.0 |
| @xivdyetools/bot-logic | v2.0.0 |
| @xivdyetools/test-utils | v1.2.0 |

Versions are read from each project's `package.json`. See [Version Matrix](../versions.md) for
detailed version history, the deprecated-project table, and the release gate for the 5.0 wave.

---

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - How projects interconnect
- [Developer Guides](../developer-guides/index.md) - Setup and contribution guides
- [Specifications](../specifications/index.md) - Feature specifications
