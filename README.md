# XIV Dye Tools

A comprehensive suite of color and dye tools for **Final Fantasy XIV**, built as a [pnpm](https://pnpm.io/) monorepo with [Turborepo](https://turbo.build/repo).

> **Live site:** [xivdyetools.app](https://xivdyetools.app)

## What's in the box?

### Shared Libraries (`packages/`)

Published to npm under the `@xivdyetools` scope (except `test-utils`, which is workspace-private):

| Package | Version | Description |
|---------|---------|-------------|
| [`@xivdyetools/types`](packages/types/) | 2.0.0 | Branded types (`HexColor`, `DyeId`, etc.) and shared interfaces |
| [`@xivdyetools/logger`](packages/logger/) | 1.3.0 | Multi-runtime logging (browser, Node, CF Workers) with secret redaction |
| [`@xivdyetools/auth`](packages/auth/) | 1.3.0 | JWT verification, HMAC signing, Discord Ed25519 verification, Base64URL/hex encoding (`/encoding`) |
| [`@xivdyetools/worker-kit`](packages/worker-kit/) | 1.0.0 | Worker toolkit: Hono middleware (request ID, logger, rate limit) + sliding-window rate limiting backends (`/rate-limiter`) |
| [`@xivdyetools/core`](packages/core/) | 4.0.0 | Color algorithms, dye database (schema v2), k-d tree matching, 6-language i18n, Universalis client, blending (`/blending`) |
| [`@xivdyetools/svg`](packages/svg/) | 2.0.0 | Pure SVG card generators on the 5.0 frame system (data in → SVG string out) |
| [`@xivdyetools/bot-logic`](packages/bot-logic/) | 2.0.0 | Platform-agnostic command business logic + bot UI translation engine (`/i18n`) |
| [`@xivdyetools/test-utils`](packages/test-utils/) | 1.2.0 | Cloudflare Workers mocks (D1, KV, R2) and test factories — **not published** |

### Applications (`apps/`)

| App | Version | Description |
|-----|---------|-------------|
| [`web-app`](apps/web-app/) | 5.0.0 | Main web app at [xivdyetools.app](https://xivdyetools.app) (Vite + Lit + Tailwind) |
| [`discord-worker`](apps/discord-worker/) | 5.0.0 | Primary Discord bot — 17 slash commands (CF Worker + Hono, HTTP Interactions) |
| [`image-worker`](apps/image-worker/) | 1.0.0 | Photon-backed pixel extraction, service-binding-only (CF Worker) |
| [`moderation-worker`](apps/moderation-worker/) | 1.4.0 | Moderation bot for community presets (CF Worker) |
| [`presets-api`](apps/presets-api/) | 2.0.0 | Community presets REST API + preview-image storage (CF Worker + D1 + R2) |
| [`oauth`](apps/oauth/) | 2.6.0 | Discord OAuth + JWT issuance (CF Worker + D1) |
| [`api-worker`](apps/api-worker/) | 0.6.0 | Public REST API at [data.xivdyetools.app](https://data.xivdyetools.app) + Universalis proxy routes + docs site at [developers.xivdyetools.app](https://developers.xivdyetools.app) (CF Worker + KV) |
| [`og-worker`](apps/og-worker/) | 2.0.0 | Dynamic OpenGraph image generation (CF Worker + WASM) |
| [`stoat-worker`](apps/stoat-worker/) | 0.2.1 | Stoat (Revolt) bot (Node.js + revolt.js, WebSocket, prefix commands) — parked |

### Documentation (`docs/`)

Architecture overviews, API contracts, deployment guides, specifications, and research notes.

## Quick Start

```bash
# Prerequisites: Node.js 22.13+, pnpm 11+
pnpm install           # Install all workspace dependencies
pnpm turbo run build   # Build all packages
pnpm turbo run test    # Run all tests (8,300+ across 328 files)
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
types, logger, auth (incl. /encoding) ───────────────────┐ (Level 0: no internal deps)
worker-kit (→ logger; incl. /rate-limiter) ──────────────┤ (Level 1 — workers only)
core (→ types, logger; incl. /blending) ─────────────────┤ (Level 1)
test-utils (→ auth, types; private) ─────────────────────┤ (Level 1)
svg (→ core, types) ─────────────────────────────────────┤ (Level 2)
bot-logic (→ core, svg, types; incl. /i18n) ─────────────┤ (Level 3)
                                                         │
                    Applications ◄───────────────────────┘
```

### Inter-Worker Communication

Workers communicate via Cloudflare [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) (direct Worker-to-Worker, no HTTP overhead):

```
discord-worker ──► presets-api            (preset CRUD)
discord-worker ──► image-worker           (pixel extraction for /extractor)
discord-worker ──► api-worker             (Universalis market prices for /budget)
moderation-worker ──► presets-api         (approve / reject)
presets-api ──► discord-worker            (submission notifications)
presets-api ──► image-worker              (WebP thumbnails for moderated preview images)
```

All Cloudflare Workers use [Hono](https://hono.dev/) as the HTTP framework and `@xivdyetools/worker-kit` for shared middleware. Persistence is **D1** (SQLite) for `presets-api` (`xivdyetools-presets`, also bound by `discord-worker` / `moderation-worker`) and `oauth` (`xivdyetools-users`), **R2** for preset preview images, and **KV** elsewhere.

## CI/CD

All CI/CD is handled via GitHub Actions:

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| **CI** | Push / PR to `main` | Lint, type-check, test, build (affected packages only) |
| **Deploy** (×11) | Push to `main` with matching path changes | Build → test → deploy to Cloudflare Workers/Pages |
| **Publish Packages** | Manual (workflow_dispatch) | Build → test → publish selected `@xivdyetools/*` package to npm |

Deploy workflows cover `api-worker`, `discord-worker` (+ beta), `image-worker`, `moderation-worker`, `oauth`, `og-worker` (+ beta), `presets-api`, and `web-app` (+ beta). `stoat-worker` has no deploy workflow — it is parked.

### Required GitHub Secrets

| Secret | Used by |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | All deploy workflows |
| `CLOUDFLARE_ACCOUNT_ID` | All deploy workflows |

The publish workflow needs **no secret**. It authenticates to npm with [trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers) using its own GitHub Actions identity via the `id-token: write` permission, which also signs the provenance attestation.

## Tech Stack

- **Runtime:** Node.js 22, Cloudflare Workers
- **Package management:** pnpm 11 with `workspace:*` protocol
- **Build orchestration:** Turborepo 2.10 with dependency-aware caching
- **Language:** TypeScript 5.9 (strict, ES2022, bundler module resolution, `verbatimModuleSyntax`)
- **Testing:** Vitest 4; Playwright for `web-app` E2E
- **Linting:** ESLint 10 flat config with typescript-eslint
- **Formatting:** Prettier 3
- **Localization:** 6 languages (en, ja, de, fr, ko, zh)

## Credits & Acknowledgements

XIV Dye Tools stands on work by others. Thank you to:

| Project | Used for | License |
|---------|----------|---------|
| [XIVAPI](https://xivapi.com/) | Dye names in English, Japanese, German, and French | — |
| [Universalis](https://universalis.app/) | Market board price data | MIT |
| [spectral.js](https://github.com/rvanwijnen/spectral.js) | Kubelka-Munk physical paint mixing | MIT |
| [Hono](https://hono.dev/) | HTTP framework for every Cloudflare Worker | MIT |
| [Lit](https://lit.dev/) | Web component framework for the web app | BSD-3-Clause |
| [resvg](https://github.com/linebender/resvg) | SVG → PNG rasterization (`resvg-wasm` / `resvg-js`) | MPL-2.0 |
| [Photon](https://github.com/silvia-odwyer/photon) | WASM image pixel extraction | Apache-2.0 |
| [revolt.js](https://github.com/revoltchat/revolt.js) | Stoat/Revolt bot client | MIT |

Korean and Chinese dye names are **manually sourced** — XIVAPI does not serve them.

### Fonts

All bundled fonts are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org/):

- [Noto Sans JP / SC / KR](https://fonts.google.com/noto) — CJK glyph coverage (subset for Worker bundles)
- [Onest](https://fonts.google.com/specimen/Onest) — body text
- [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) — display and headings
- [Fragment Mono](https://fonts.google.com/specimen/Fragment+Mono) — numeric and monospace columns

### Research

- Color-vision deficiency simulation uses the transformation matrices from **Brettel, Viénot & Mollon (1997)**, *"Computerized simulation of color appearance for dichromats"*, JOSA A 14(10).
- Perceptual color difference uses **CIE76** and **CIEDE2000** as published by the International Commission on Illumination.

## Connect With Me

**Flash Galatine** | Midgardsormr (Aether)

🎮 **FFXIV**: [Lodestone Character](https://na.finalfantasyxiv.com/lodestone/character/7677106/)
💻 **GitHub**: [@FlashGalatine](https://github.com/FlashGalatine)
🐦 **X/Twitter**: [@AsheJunius](https://x.com/AsheJunius)
📺 **Twitch**: [flashgalatine](https://www.twitch.tv/flashgalatine)
🌐 **BlueSky**: [projectgalatine.com](https://bsky.app/profile/projectgalatine.com)
❤️ **Patreon**: [ProjectGalatine](https://patreon.com/ProjectGalatine)
☕ **Ko-Fi**: [flashgalatine](https://ko-fi.com/flashgalatine)
💬 **Discord**: [Join Server](https://discord.gg/5VUSKTZCe5)

## License

MIT © 2025-2026 Flash Galatine — see [LICENSE](./LICENSE).

Every package and app in this monorepo is MIT licensed and carries its own `LICENSE` file.

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.** All FINAL FANTASY XIV content, including dye names and color values, is the property of Square Enix.
