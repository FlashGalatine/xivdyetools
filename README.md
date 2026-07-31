# XIV Dye Tools

A comprehensive suite of color and dye tools for **Final Fantasy XIV**, built as a [pnpm](https://pnpm.io/) monorepo with [Turborepo](https://turbo.build/repo).

> **Live site:** [xivdyetools.app](https://xivdyetools.app)

## What's in the box?

### Shared Libraries (`packages/`)

Published to npm under the `@xivdyetools` scope:

| Package | Version | Description |
|---------|---------|-------------|
| [`@xivdyetools/types`](packages/types/) | 1.15.0 | Branded types (`HexColor`, `DyeId`, etc.) and shared interfaces |
| [`@xivdyetools/logger`](packages/logger/) | 1.3.0 | Multi-runtime logging (browser, Node, CF Workers) with secret redaction |
| [`@xivdyetools/auth`](packages/auth/) | 1.3.0 | JWT verification, HMAC signing, Discord Ed25519 verification, Base64URL/hex encoding |
| [`@xivdyetools/worker-kit`](packages/worker-kit/) | 1.0.0 | Worker toolkit: Hono middleware (request ID, logger, rate limit) + rate limiting backends |
| [`@xivdyetools/core`](packages/core/) | 2.8.0 | Color algorithms, 136-dye database, k-d tree matching, 6-language i18n, blending (`/blending`) |
| [`@xivdyetools/svg`](packages/svg/) | 1.2.1 | Platform-agnostic SVG card generators (pure functions: data in → SVG out) |
| [`@xivdyetools/bot-logic`](packages/bot-logic/) | 1.4.0 | Platform-agnostic command business logic + bot i18n engine (shared by Discord + Stoat bots) |
| [`@xivdyetools/test-utils`](packages/test-utils/) | 1.1.8 | Cloudflare Workers mocks (D1, KV, R2) and test factories |

### Applications (`apps/`)

| App | Version | Description |
|-----|---------|-------------|
| [`discord-worker`](apps/discord-worker/) | 4.7.0 | Primary Discord bot (CF Worker + Hono, HTTP Interactions) |
| [`stoat-worker`](apps/stoat-worker/) | 0.2.0 | Stoat (Revolt) bot (Node.js + revolt.js, WebSocket, prefix commands) |
| [`moderation-worker`](apps/moderation-worker/) | 1.3.0 | Moderation bot for community presets (CF Worker) |
| [`presets-api`](apps/presets-api/) | 1.6.0 | Community presets REST API (CF Worker + D1) |
| [`oauth`](apps/oauth/) | 2.5.0 | Discord OAuth + JWT issuance (CF Worker + D1) |
| [`api-worker`](apps/api-worker/) | 0.5.0 | Public REST API for dyes & color matching at [data.xivdyetools.app](https://data.xivdyetools.app) (CF Worker + KV) |
| [`api-docs`](apps/api-docs/) | 0.1.0 | API reference site at [developers.xivdyetools.app](https://developers.xivdyetools.app) (VitePress) |
| [`universalis-proxy`](apps/universalis-proxy/) | 1.5.0 | CORS proxy for Universalis market data (CF Worker) |
| [`og-worker`](apps/og-worker/) | 1.4.0 | Dynamic OpenGraph image generation (CF Worker + WASM) |
| [`web-app`](apps/web-app/) | 4.12.0 | Main web app at [xivdyetools.app](https://xivdyetools.app) (Vite + Lit + Tailwind) |
| [`maintainer`](apps/maintainer/) | 1.0.3 | Local dev tool for editing the dye database (Vite + Vue) |

### Documentation (`docs/`)

Architecture overviews, API contracts, deployment guides, specifications, and research notes.

## Quick Start

```bash
# Prerequisites: Node.js 22.13+, pnpm 11+
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
auth ───────────────────────────────────────────────────┤
core (→ types, logger), test-utils (→ types, logger) ──┤
svg (→ core, types) ────────────────────────────────────┤
bot-logic (→ core, svg) ────────────────────────────────┤
worker-kit (→ logger) ──────────────────────────────────┤
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

The publish workflow needs **no secret**. It authenticates to npm with [trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers) using its own GitHub Actions identity via the `id-token: write` permission, which also signs the provenance attestation.

## Tech Stack

- **Runtime:** Node.js 22, Cloudflare Workers
- **Package management:** pnpm 11 with `workspace:*` protocol
- **Build orchestration:** Turborepo with dependency-aware caching
- **Language:** TypeScript 5.9 (strict, ES2022, bundler module resolution)
- **Testing:** Vitest 4 (Vitest 3.2 for `@cloudflare/vitest-pool-workers` apps)
- **Linting:** ESLint 9 flat config with typescript-eslint
- **Formatting:** Prettier 3
- **Localization:** 6 languages (en, ja, de, fr, ko, zh)

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

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
