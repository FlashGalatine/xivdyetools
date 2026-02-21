# XIV Dye Tools

A comprehensive suite of color and dye tools for **Final Fantasy XIV**, built as a [pnpm](https://pnpm.io/) monorepo with [Turborepo](https://turbo.build/repo).

> **Live site:** [xivdyetools.app](https://xivdyetools.app)

## What's in the box?

### Shared Libraries (`packages/`)

Published to npm under the `@xivdyetools` scope:

| Package | Version | Description |
|---------|---------|-------------|
| [`@xivdyetools/types`](packages/types/) | 1.7.0 | Branded types (`HexColor`, `DyeId`, etc.) and shared interfaces |
| [`@xivdyetools/crypto`](packages/crypto/) | 1.0.0 | Base64URL encoding utilities |
| [`@xivdyetools/logger`](packages/logger/) | 1.1.2 | Multi-runtime logging (browser, Node, CF Workers) with secret redaction |
| [`@xivdyetools/auth`](packages/auth/) | 1.0.2 | JWT verification, HMAC signing, Discord Ed25519 verification |
| [`@xivdyetools/rate-limiter`](packages/rate-limiter/) | 1.3.0 | Sliding window rate limiting (Memory, KV, Upstash backends) |
| [`@xivdyetools/core`](packages/core/) | 1.16.0 | Color algorithms, 136-dye database, k-d tree matching, 6-language i18n |
| [`@xivdyetools/color-blending`](packages/color-blending/) | 1.0.0 | Six color blending algorithms (RGB, LAB, OKLAB, RYB, HSL, Spectral) |
| [`@xivdyetools/svg`](packages/svg/) | 1.0.0 | Platform-agnostic SVG card generators (pure functions: data in → SVG out) |
| [`@xivdyetools/bot-i18n`](packages/bot-i18n/) | 1.0.0 | Bot UI string translations for 6 languages |
| [`@xivdyetools/bot-logic`](packages/bot-logic/) | 1.0.0 | Platform-agnostic command business logic (shared by Discord + Stoat bots) |
| [`@xivdyetools/test-utils`](packages/test-utils/) | 1.1.1 | Cloudflare Workers mocks (D1, KV, R2) and test factories |

### Applications (`apps/`)

| App | Version | Description |
|-----|---------|-------------|
| [`discord-worker`](apps/discord-worker/) | 4.0.1 | Primary Discord bot (CF Worker + Hono, HTTP Interactions) |
| [`stoat-worker`](apps/stoat-worker/) | 0.1.0 | Stoat (Revolt) bot (Node.js + revolt.js, WebSocket, prefix commands) |
| [`moderation-worker`](apps/moderation-worker/) | 1.1.4 | Moderation bot for community presets (CF Worker) |
| [`presets-api`](apps/presets-api/) | 1.4.12 | Community presets REST API (CF Worker + D1) |
| [`oauth`](apps/oauth/) | 2.3.5 | Discord OAuth + JWT issuance (CF Worker + D1) |
| [`universalis-proxy`](apps/universalis-proxy/) | 1.3.5 | CORS proxy for Universalis market data (CF Worker) |
| [`og-worker`](apps/og-worker/) | 1.0.2 | Dynamic OpenGraph image generation (CF Worker + WASM) |
| [`web-app`](apps/web-app/) | 4.1.5 | Main web app at [xivdyetools.app](https://xivdyetools.app) (Vite + Lit + Tailwind) |
| [`maintainer`](apps/maintainer/) | 1.0.1 | Local dev tool for editing the dye database (Vite + Vue) |

### Documentation (`docs/`)

Architecture overviews, API contracts, deployment guides, specifications, and research notes.

## Quick Start

```bash
# Prerequisites: Node.js 22+, pnpm 10+
pnpm install           # Install all workspace dependencies
pnpm turbo run build   # Build all packages
pnpm turbo run test    # Run all tests (~7,800 tests)
```

## Development

```bash
# Work with a specific package or app
pnpm turbo run build --filter=@xivdyetools/core
pnpm turbo run test --filter=xivdyetools-discord-worker

# Run a single test file
pnpm --filter @xivdyetools/core exec vitest run src/path/to/file.test.ts

# Dev servers
pnpm --filter xivdyetools-web-app run dev
pnpm --filter xivdyetools-discord-worker run dev
```

## Architecture

### Dependency Flow

```
types, crypto, logger ──────────────────────────────────┐ (no internal deps)
auth (→ crypto), rate-limiter ──────────────────────────┤
core (→ types, logger), test-utils (→ types, logger) ──┤
color-blending (→ core) ────────────────────────────────┤
svg (→ core, types, color-blending) ────────────────────┤
bot-i18n ───────────────────────────────────────────────┤
bot-logic (→ core, svg, bot-i18n, color-blending) ──────┤
                                                        │
                    Applications ◄──────────────────────┘
```

### Inter-Worker Communication

Workers communicate via Cloudflare [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) (direct Worker-to-Worker, no HTTP overhead):

```
discord-worker ──► presets-api
moderation-worker ──► presets-api
presets-api ──► discord-worker (notifications)
```

## CI/CD

All CI/CD is handled via GitHub Actions:

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| **CI** | Push / PR to `main` | Lint, type-check, test, build (affected packages only) |
| **Deploy** (×7) | Push to `main` with matching path changes | Build → test → deploy to Cloudflare Workers/Pages |
| **Publish Package** | Manual (workflow_dispatch) | Build → test → publish selected `@xivdyetools/*` package to npm |

### Required GitHub Secrets

| Secret | Used by |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | All deploy workflows |
| `CLOUDFLARE_ACCOUNT_ID` | All deploy workflows |
| `NPM_TOKEN` | Publish workflow |

## Tech Stack

- **Runtime:** Node.js 22, Cloudflare Workers
- **Package management:** pnpm 10 with `workspace:*` protocol
- **Build orchestration:** Turborepo with dependency-aware caching
- **Language:** TypeScript 5.9 (strict, ES2022, bundler module resolution)
- **Testing:** Vitest 4 (Vitest 3.2 for `@cloudflare/vitest-pool-workers` apps)
- **Linting:** ESLint 9 flat config with typescript-eslint
- **Formatting:** Prettier 3
- **Localization:** 6 languages (en, ja, de, fr, ko, zh)

## Connect With Me

**Flash Galatine** | Balmung (Midgardsormr)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
📝 **Blog**: [Project Galatine](https://blog.projectgalatine.com/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine
