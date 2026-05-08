# Architecture Overview

**How the XIV Dye Tools ecosystem interconnects**

This document provides a high-level view of how all projects in the XIV Dye Tools ecosystem work together to deliver dye color tools across web and Discord platforms.

---

## Ecosystem Diagram

```mermaid
graph TB
    subgraph "Shared Foundation"
        TYPES["@xivdyetools/types<br/>v1.14.0<br/>─────────────<br/>Type definitions,<br/>branded types,<br/>Facewear support"]
        LOGGER["@xivdyetools/logger<br/>v1.2.2<br/>─────────────<br/>Multi-environment<br/>logging, secret redaction"]
        AUTH["@xivdyetools/auth<br/>v1.1.2<br/>─────────────<br/>JWT, HMAC,<br/>Discord Ed25519"]
        CRYPTO["@xivdyetools/crypto<br/>v1.1.0<br/>─────────────<br/>Base64URL,<br/>hex utilities"]
        RATELIMIT["@xivdyetools/rate-limiter<br/>v1.4.4<br/>─────────────<br/>Sliding window,<br/>Memory/KV/Upstash"]
        WMW["@xivdyetools/worker-middleware<br/>v1.1.2<br/>─────────────<br/>Shared Hono middleware<br/>(request-ID, logger,<br/>rate-limit)"]
        TEST["@xivdyetools/test-utils<br/>v1.1.7<br/>─────────────<br/>Mocks, factories,<br/>helpers"]
    end

    subgraph "Core + Feature Libraries"
        CORE["@xivdyetools/core<br/>v2.6.0<br/>─────────────<br/>125 standard dyes plus<br/>11 Facewear color entries<br/>(synthetic negative IDs);<br/>color algorithms, Universalis API,<br/>6 languages, K-means++"]
        SVG["@xivdyetools/svg<br/>v1.1.2"]
        BLEND["@xivdyetools/color-blending<br/>v1.0.1"]
        BOTLOGIC["@xivdyetools/bot-logic<br/>v1.2.0"]
        BOTI18N["@xivdyetools/bot-i18n<br/>v1.2.0"]
    end

    subgraph "Consumer Applications"
        WEB["xivdyetools-web-app<br/>v4.10.0<br/>─────────────<br/>9 interactive tools,<br/>12 themes, PWA,<br/>Vite + Lit"]
        DISCORD["xivdyetools-discord-worker<br/>v4.5.0<br/>─────────────<br/>20 slash commands,<br/>SVG/PNG rendering,<br/>HTTP Interactions"]
        STOAT["xivdyetools-stoat-worker<br/>v0.1.4<br/>─────────────<br/>Revolt.js bot,<br/>shared bot-logic"]
    end

    subgraph "Backend Services"
        OAUTH["xivdyetools-oauth<br/>v2.4.0<br/>─────────────<br/>Discord OAuth, PKCE,<br/>JWT issuance,<br/>timeout protection"]
        PRESETS["xivdyetools-presets-api<br/>v1.5.0<br/>─────────────<br/>Community presets,<br/>D1 database,<br/>Moderation pipeline"]
        PROXY["xivdyetools-universalis-proxy<br/>v1.4.5<br/>─────────────<br/>CORS proxy,<br/>Dual-layer caching,<br/>Request coalescing"]
        MODBOT["xivdyetools-moderation-worker<br/>v1.2.0<br/>─────────────<br/>Moderation bot,<br/>Preset review"]
        OG["xivdyetools-og-worker<br/>v1.2.0<br/>─────────────<br/>Localized OpenGraph<br/>metadata, Social previews"]
        APIWORKER["xivdyetools-api-worker<br/>v0.4.0<br/>─────────────<br/>Public REST API,<br/>data.xivdyetools.app,<br/>9 endpoints"]
        APIDOCS["xivdyetools-api-docs<br/>v0.1.0<br/>─────────────<br/>VitePress docs site,<br/>developers.xivdyetools.app"]
    end

    subgraph "External Services"
        DISCORD_API["Discord API"]
        UNIVERSALIS["Universalis API<br/>(Market Prices)"]
        PERSPECTIVE["Perspective API<br/>(Content Moderation)"]
    end

    %% Foundation dependencies
    TYPES --> CORE
    LOGGER --> CORE
    CRYPTO --> AUTH
    LOGGER --> WMW
    RATELIMIT --> WMW
    CORE --> SVG
    CORE --> BLEND
    CORE --> BOTLOGIC
    SVG --> BOTLOGIC
    BLEND --> BOTLOGIC
    BOTI18N --> BOTLOGIC

    %% Core/feature library consumers
    CORE --> WEB
    CORE --> OG
    CORE --> APIWORKER
    BOTLOGIC --> DISCORD
    BOTLOGIC --> STOAT
    WMW -.-> DISCORD
    WMW -.-> MODBOT
    WMW -.-> OAUTH
    WMW -.-> PRESETS
    WMW -.-> PROXY
    WMW -.-> OG
    WMW -.-> APIWORKER

    %% Application relationships
    WEB --> OAUTH
    WEB --> PRESETS
    WEB --> PROXY
    APIDOCS -.->|"documents"| APIWORKER
    DISCORD -.->|"Service Binding"| PRESETS
    MODBOT -.->|"Service Binding"| PRESETS
    PRESETS -.->|"Service Binding"| DISCORD

    %% External API connections
    PROXY -.-> UNIVERSALIS
    DISCORD --> DISCORD_API
    OAUTH --> DISCORD_API
    PRESETS -.-> PERSPECTIVE

    classDef shared fill:#e1f5fe,stroke:#01579b
    classDef core fill:#fff3e0,stroke:#e65100
    classDef app fill:#e8f5e9,stroke:#2e7d32
    classDef backend fill:#fce4ec,stroke:#880e4f
    classDef external fill:#f5f5f5,stroke:#616161

    class TYPES,LOGGER,AUTH,CRYPTO,RATELIMIT,WMW,TEST shared
    class CORE,SVG,BLEND,BOTLOGIC,BOTI18N core
    class WEB,DISCORD,STOAT app
    class OAUTH,PRESETS,PROXY,MODBOT,OG,APIWORKER,APIDOCS backend
    class DISCORD_API,UNIVERSALIS,PERSPECTIVE external
```

---

## Project Relationships

### Dependency Layers

```
Layer 4: External Services
├── Discord API (authentication, interactions)
├── Universalis API (FFXIV market prices)
└── Perspective API (ML content moderation)

Layer 4: External Services
├── Discord API (authentication, interactions)
├── Universalis API (FFXIV market prices)
└── Perspective API (ML content moderation)

Layer 3: Backend Services (Cloudflare Workers)
├── xivdyetools-oauth → JWT issuance
├── xivdyetools-presets-api → Community presets
├── xivdyetools-universalis-proxy → Market data caching
├── xivdyetools-moderation-worker → Preset moderation bot
├── xivdyetools-og-worker → Social media previews
├── xivdyetools-api-worker → Public REST API (data.xivdyetools.app)
└── xivdyetools-api-docs → Developer API docs site (developers.xivdyetools.app)

Layer 2: Consumer Applications
├── xivdyetools-web-app → Browser-based tools (9 tools)
├── xivdyetools-discord-worker → Discord bot (20 commands)
└── xivdyetools-stoat-worker → Revolt bot (shared bot-logic)

Layer 1: Core + Feature Libraries
├── @xivdyetools/core → Color algorithms, dye database (125 + 11)
├── @xivdyetools/svg → SVG card generation
├── @xivdyetools/color-blending → Color blending algorithms
├── @xivdyetools/bot-logic → Platform-agnostic bot commands
└── @xivdyetools/bot-i18n → Bot-specific localization

Layer 0: Shared Foundation
├── @xivdyetools/types → Type definitions, Facewear support
├── @xivdyetools/crypto → Base64URL, hex utilities
├── @xivdyetools/logger → Logging, secret redaction
├── @xivdyetools/auth → JWT, HMAC, Discord Ed25519
├── @xivdyetools/rate-limiter → Sliding window rate limiting
├── @xivdyetools/worker-middleware → Shared Hono middleware (request-ID, logger, rate-limit)
└── @xivdyetools/test-utils → Testing utilities
```

### Data Flow Summary

| Flow | Path | Purpose |
|------|------|---------|
| **Color Matching** | User → Web/Discord → Core → Response | Find closest dye to input color |
| **Market Prices** | Client → Universalis Proxy → Universalis API → Client | Real-time price data with caching |
| **Authentication** | User → OAuth → Discord API → JWT → Consumer | User identity |
| **Preset Submission** | User → Client → Presets API → Moderation → Storage | Community content |
| **Preset Voting** | User → Client → Presets API → Database | Community curation |
| **User Banning** | Moderator → Discord Bot → Presets API → Database | Content moderation |

---

## Project Summaries

### @xivdyetools/core (v2.6.0)

**Purpose**: Core TypeScript library providing color algorithms and the FFXIV dye database (125 standard dyes plus 11 Facewear color entries with synthetic negative IDs — 136 total entries).

**Key Capabilities**:
- Color conversion (RGB, HSV, HSL, LAB, OKLAB)
- Nearest-neighbor dye matching via k-d tree
- Color harmony generation (complementary, triadic, analogous, etc.)
- Colorblindness simulation (Brettel algorithm)
- K-means++ palette extraction from images
- Universalis API integration with LRU cache and metrics
- 6-language localization (en, ja, de, fr, ko, zh)
- Facewear dye support (synthetic IDs ≤ -1000)
- Pre-computed lowercase names for fast search
- LRU cache for `rgbToOklab()` conversions

**v2.0.0 Breaking Change**: All type re-exports removed. Import `Dye`, `RGB`, `HexColor`, etc. from `@xivdyetools/types` directly. 28 symbols marked `@internal`.

**v2.5.0–2.6.0 Patch 7.5 Activation**: `CONSOLIDATED_IDS` populated with real itemIDs (Type-A=52254, Type-B=52255, Type-C=52256); `isConsolidationActive()` returns `true`; `ALLIED_SOCIETY_ACQUISITIONS` removed (vendor categories collapsed by Patch 7.5).

**Consumed By**: Web app, Discord worker, OG worker, API worker, Maintainer

---

### xivdyetools-web-app (v4.10.0)

**Purpose**: Browser-based interactive toolkit for exploring FFXIV dye colors.

**9 Tools**:
1. **Palette Extractor** - Extract colors from images and find matching dyes
2. **Gradient Builder** - Create color gradients between dyes
3. **Color Harmony Explorer** - Discover harmonious dye combinations
4. **Dye Mixer** - RGB color blending between dyes
5. **Swatch Matcher** - Match character colors to dyes
6. **Dye Comparison** - Side-by-side dye analysis
7. **Accessibility Checker** - Colorblindness simulation
8. **Community Presets** - Browse and share dye presets
9. **Budget Suggestions** - Find affordable dye alternatives

**Recent Highlights**:
- **v4.10.0**: Result Card v4 "Spectrum" row (consolidated dye spectrum across Standard / Wide #1 / Wide #2); SEC-001 `auth-button.ts` XSS hardening; "Exclude Allied Society Dyes" filter retired
- **v4.9.0**: Patch 7.5 dye consolidation active end-to-end — Market Board fans 3 consolidated prices to 105 dyes
- **v4.6.0**: Dye Filters v4 web component with 9 toggles
- **v4.3.0**: Pixel sampling (Shift+Click), canvas panning (Ctrl/Cmd+Drag), configurable sample area (1×1 to 16×16)
- **v4.0.0**: Glassmorphism UI, tool renaming, Lit.js web components, 12 themes

**Technology**: Vite 6, Lit web components, Tailwind CSS 4, 12 themes

---

### xivdyetools-discord-worker (v4.5.0)

**Purpose**: Discord bot bringing dye tools to servers via slash commands.

**20 Commands** organized into categories:
- **Color Tools**: `/harmony`, `/extractor`, `/gradient`, `/mixer`, `/swatch`, `/budget`
- **Dye Database**: `/dye search`, `/dye info`, `/dye list`, `/dye random`
- **Analysis**: `/comparison`, `/accessibility`
- **User Data**: `/favorites`, `/collection`
- **Community**: `/preset list`, `/preset show`, `/preset random`, `/preset submit`, `/preset vote`
- **Utility**: `/language`, `/preferences`, `/manual`, `/about`, `/stats`

**v4.x Highlights**:
- Command renaming (`/match`→`/extractor`, `/mixer`→`/gradient`)
- New commands: `/mixer` (RGB blending), `/swatch`, `/budget`, `/preferences`
- Prevent Duplicate Results for extractor
- Budget quick picks with 20 Cosmic dyes
- v4.3.0: `/preferences filters` subcommand group with 9 boolean toggles
- v4.4.0: REFACTOR-001/002 migrated request-ID + logger middleware to `@xivdyetools/worker-middleware`
- v4.5.0: `/preferences set allied_society` slash-command option **removed** (post-Patch 7.5); ARCH-002 consolidation fan-out integration test
- Uses shared packages: @xivdyetools/bot-logic, bot-i18n, svg, color-blending, worker-middleware

**Technology**: Cloudflare Workers, HTTP Interactions, Hono, resvg-wasm, Photon WASM

---

### xivdyetools-oauth (v2.4.0)

**Purpose**: OAuth2 authentication provider for the ecosystem.

**Features**:
- Discord OAuth2 with PKCE flow
- JWT issuance with HS256 signing
- 24-hour refresh token grace period
- Account merging support
- Timeout protection (10s token exchange, 5s user info fetch)
- XIVAuth integration

**Technology**: Cloudflare Workers, Hono, D1 database

**v2.4.0 Highlights**: SEC-003 `jsonDepthLimit` middleware (maxDepth 10, prototype pollution rejection); SEC-004 Hono `bodyLimit` (10 KB) on all `/auth/*`; CORS `maxAge` 24h → 1h; migrated middleware to `@xivdyetools/worker-middleware`.

---

### xivdyetools-presets-api (v1.5.0)

**Purpose**: REST API for community dye preset management.

**Features**:
- CRUD operations for presets
- Voting system with per-user tracking
- Multi-layer moderation pipeline:
  - Local profanity filtering (6 languages)
  - Perspective API ML moderation (5s timeout protection)
  - Manual moderator review queue
- Rate limiting (10 submissions/user/day)
- Dual authentication (bot API key + JWT)
- Standardized API responses
- UTF-8 safe truncation for Discord embeds
- Race condition handling for duplicate detection
- Dynamic category validation (1-min cache)
- Discord notification retries with exponential backoff

**Technology**: Cloudflare Workers, Hono, D1 SQLite database

**v1.5.0 Highlights**: SEC-003 `jsonDepthLimit` middleware (100 KB body, prototype pollution rejection); SEC-004 Hono `bodyLimit` (100 KB) on `/api/*`; migrated to `rateLimitMiddleware()` from `@xivdyetools/worker-middleware` (standardized `X-RateLimit-*` + `Retry-After`); CORS `maxAge` 24h → 1h.

---

### xivdyetools-universalis-proxy (v1.4.5)

**Purpose**: CORS proxy for Universalis API with intelligent caching.

**Features**:
- **Dual-layer caching**:
  - Cloudflare Cache API (edge-level)
  - KV storage (global persistence)
- **Request coalescing** to prevent duplicate upstream requests
- **Stale-while-revalidate** pattern for optimal freshness
- Input validation (100 items max, ID range 1-1,000,000)
- Response size limit (5MB)
- Memory leak protection with 60s entry cleanup
- Cache TTLs: 5 min for prices, 24h for static data

**Technology**: Cloudflare Workers, Hono, KV storage

**v1.4.5 Highlights**: REFACTOR-002 wired `@xivdyetools/worker-middleware` (`requestIdMiddleware` + `loggerMiddleware`); 4 `console.error` call sites replaced with structured `getLogger(c)?.error(...)`.

---

### xivdyetools-moderation-worker (v1.2.0)

**Purpose**: Separate Discord bot for community preset moderation.

**Commands**:
- `/preset moderate [preset_id]` - Review pending presets
- `/preset ban_user <user>` - Ban user from preset system
- `/preset unban_user <user>` - Unban user

**Features**:
- Approve/reject presets with reasons (notifies author)
- Revert flagged edits to previous versions
- Multi-language support (6 languages)
- Full audit logging of moderation actions
- Startup environment validation (v1.1.5)

**Technology**: Cloudflare Workers, Hono

---

### xivdyetools-og-worker (v1.2.0)

**Purpose**: Dynamic OpenGraph metadata for social media previews.

**Features**:
- Crawler detection (Discord, Twitter/X, Facebook, LinkedIn, Slack, Telegram, iMessage)
- Dynamic OG image generation for tools (Harmony, Gradient, Mixer, Swatch, Comparison, Accessibility)
- SVG→PNG rendering via resvg-wasm
- Embedded fonts for text rendering
- NaN validation for dyeId parameters (v1.0.4)
- escapeHtml for themeColor meta tag (v1.0.4)
- **v1.2.0**: OG embed metadata localized via `?lang=` query parameter — all 6 locales preloaded at module init; `harmonyToKey()` kebab-to-camel converter; integrated `@xivdyetools/worker-middleware`

**Routes**: `/og/harmony/*`, `/og/gradient/*`, `/og/mixer/*`, `/og/swatch/*`, `/og/comparison/*`, `/og/accessibility/*`

**Technology**: Cloudflare Workers, Hono, resvg-wasm

---

### xivdyetools-api-worker (v0.4.0)

**Purpose**: Public REST API for the XIV Dye Tools dye database and color matching, deployed to `data.xivdyetools.app`.

**Phase 1 — 9 Public Endpoints**:
- `GET /v1/dyes` — list with filtering (8 type/acquisition booleans), sorting, pagination
- `GET /v1/dyes/:id` — auto-detect ID type (Facewear `<0`, stainID `1-125`, itemID `≥5729`)
- `GET /v1/dyes/stain/:stainId` — explicit stainID lookup
- `GET /v1/dyes/search?q=` — name search (localized via `?locale=`)
- `GET /v1/dyes/categories` — category list with counts
- `GET /v1/dyes/batch?ids=` — multi-ID lookup, max 50
- `GET /v1/dyes/consolidation-groups` — Patch 7.5 consolidation metadata
- `GET /v1/match/closest?hex=` — closest dye (6 distance algorithms)
- `GET /v1/match/within-distance?hex=&maxDistance=` — dyes within ΔE threshold

**Features**:
- Anonymous (no auth, no API key) with permissive CORS
- KV-backed sliding-window rate limiting (60 req/min/IP, +5 burst)
- `localeMiddleware` resolves `?locale=` once per request (OPT-001)
- Structured logging via `@xivdyetools/worker-middleware`

**Technology**: Cloudflare Workers, Hono, KV; documented at the [api-docs](#xivdyetools-api-docs-v010) site.

---

### xivdyetools-api-docs (v0.1.0)

**Purpose**: Developer-facing API documentation site for the api-worker, deployed to `developers.xivdyetools.app`.

**Features**:
- VitePress with Vue 3 custom components
- Quick Start, Responses, Errors, Rate Limits guides
- Full reference for all 9 Phase 1 endpoints
- Inline "Try It" panels firing live requests against `data.xivdyetools.app`
- One-click "Copy as cURL" on every endpoint
- Side-by-side request/response display with HTTP status badges

**Technology**: VitePress, Vue 3, deployed via Cloudflare Pages.

---

### xivdyetools-stoat-worker (v0.1.4)

**Purpose**: Revolt.js bot bringing dye tools to the Revolt platform.

**Features**:
- Shared command logic via @xivdyetools/bot-logic
- Shared i18n via @xivdyetools/bot-i18n
- Prefix-based commands (`!xivdye` / `!xd`)
- 4 commands: ping, help, about, info

**Technology**: Node.js 22+, revolt.js

---

### Shared Packages

| Package | Version | Purpose |
|---------|---------|---------|
| **@xivdyetools/types** | v1.14.0 | Branded types (HexColor, DyeId), Facewear ID support |
| **@xivdyetools/crypto** | v1.1.0 | Base64URL encoding, hex utilities |
| **@xivdyetools/logger** | v1.2.2 | Unified logging, secret redaction patterns |
| **@xivdyetools/auth** | v1.1.2 | JWT verification, HMAC signing, Discord Ed25519 |
| **@xivdyetools/rate-limiter** | v1.4.4 | Sliding window rate limiting (Memory, KV, Upstash) |
| **@xivdyetools/worker-middleware** | v1.1.2 | Shared Hono middleware (request-ID, logger, rate-limit) |
| **@xivdyetools/svg** | v1.1.2 | Platform-agnostic SVG card generators |
| **@xivdyetools/bot-logic** | v1.2.0 | Platform-agnostic bot command logic (193 tests) |
| **@xivdyetools/bot-i18n** | v1.2.0 | Bot-specific internationalization |
| **@xivdyetools/color-blending** | v1.0.1 | Color blending modes (RGB, LAB, OKLAB, Spectral) |
| **@xivdyetools/test-utils** | v1.1.7 | Cloudflare bindings mocks, domain factories, test helpers |

---

## Communication Patterns

### Service Bindings (Worker-to-Worker)

Cloudflare Service Bindings enable zero-latency communication between workers:

```typescript
// Discord Worker calling Presets API
if (env.PRESETS_API) {
  // Service Binding (no HTTP overhead)
  return env.PRESETS_API.fetch(request);
}
// Fallback to HTTP
return fetch(`${env.PRESETS_API_URL}/presets`, options);
```

**Binding Map**:
```
xivdyetools-discord-worker
├── PRESETS_API → xivdyetools-presets-api (Service Binding)
└── KV_STORAGE → Rate limits, user preferences (KV Binding)

xivdyetools-presets-api
├── DB → D1 Database (presets, votes, moderation)
└── KV_CACHE → Response caching (KV Binding)

xivdyetools-universalis-proxy
├── PRICE_CACHE → Price data with 5-min TTL (KV Binding)
└── STATIC_CACHE → Item data with 24h TTL (KV Binding)
```

### REST API Communication

| Caller | Target | Authentication |
|--------|--------|----------------|
| Web App | OAuth Worker | N/A (initiates OAuth flow) |
| Web App | Presets API | JWT Bearer token |
| Discord Worker | Presets API | `BOT_API_SECRET` + user headers |
| Presets API | OAuth Worker | JWT verification (shared secret) |

---

## Deployment Architecture

```
                        ┌─────────────────────────────────────┐
                        │          Cloudflare Edge            │
                        │         (Global Distribution)       │
                        └─────────────────┬───────────────────┘
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
        ▼                                 ▼                                 ▼
┌───────────────────┐         ┌───────────────────┐         ┌───────────────────┐
│  Cloudflare Pages │         │  Cloudflare       │         │  Cloudflare       │
│                   │         │  Workers          │         │  D1 Database      │
│  xivdyetools      │         │                   │         │                   │
│  web-app          │         │  • discord-worker │         │  • presets        │
│  (Static assets)  │         │  • oauth          │         │  • votes          │
│                   │         │  • presets-api    │         │  • users          │
│                   │         │  • universalis-   │         │  • moderation     │
│                   │         │    proxy          │         │                   │
└───────────────────┘         └───────────────────┘         └───────────────────┘
                                          │
                                          │ KV Storage
                                          ▼
                              ┌───────────────────┐
                              │  Cloudflare KV    │
                              │                   │
                              │  • Rate limits    │
                              │  • User prefs     │
                              │  • Response cache │
                              │  • Price cache    │
                              │  • Static cache   │
                              └───────────────────┘
```

---

## Related Documentation

- [Dependency Graph](dependency-graph.md) - Detailed npm and service dependencies
- [Service Bindings](service-bindings.md) - Worker-to-worker communication
- [Data Flow](data-flow.md) - Sequence diagrams for key flows
- [API Contracts](api-contracts.md) - Inter-service API specifications
