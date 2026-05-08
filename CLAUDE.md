# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview

This is the **XIV Dye Tools** monorepo: a pnpm workspace using Turborepo containing all shared libraries, Cloudflare Workers, and web applications for the Final Fantasy XIV color/dye toolkit. Each package and app has its own `CLAUDE.md` with project-specific guidance.

## Repository Structure

```
xivdyetools/
├── packages/                # Shared libraries (@xivdyetools scope, published to npm)
│   ├── types/               # Branded types (HexColor, DyeId, etc.) and shared interfaces
│   ├── crypto/              # Base64URL encoding utilities
│   ├── logger/              # Multi-runtime logging with secret redaction
│   ├── auth/                # JWT verification, HMAC signing, Discord Ed25519
│   ├── rate-limiter/        # Sliding window rate limiting (Memory, KV, Upstash)
│   ├── worker-middleware/   # Shared Hono middleware (request ID, logger, rate limit)
│   ├── core/                # Color algorithms, dye database (125 standard + 11 Facewear), k-d tree, 6-language i18n
│   ├── color-blending/      # Six blending algorithms (RGB, LAB, OKLAB, RYB, HSL, Spectral)
│   ├── svg/                 # Pure SVG card generators (data → SVG string)
│   ├── bot-logic/           # Platform-agnostic Discord/Revolt command business logic
│   ├── bot-i18n/            # Bot-facing translation engine (errors, help, status text)
│   └── test-utils/          # CF Workers mocks (D1, KV, R2) and test factories
├── apps/                    # Applications
│   ├── discord-worker/        # Primary Discord bot (CF Worker + Hono, 20 commands)
│   ├── moderation-worker/     # Moderation bot for community presets (CF Worker)
│   ├── presets-api/           # Community presets REST API (CF Worker + D1)
│   ├── oauth/                 # Discord OAuth + JWT issuance (CF Worker + D1)
│   ├── api-worker/            # Public dye/color-matching API (CF Worker)
│   ├── api-docs/              # VitePress docs site for the public API
│   ├── universalis-proxy/     # CORS proxy for Universalis market data (CF Worker)
│   ├── og-worker/             # Dynamic OpenGraph image generation (CF Worker)
│   ├── stoat-worker/          # Revolt chat bot (Node.js + revolt.js, NOT a CF Worker)
│   ├── web-app/               # Main web app with 9 color tools (Vite + Lit + Tailwind)
│   └── maintainer/            # Local dev tool for editing the dye database (Vite + Vue 3)
├── docs/                    # Architecture, specs, deployment guides, research
└── scripts/                 # Repo-level utility scripts
```

## Dependency Flow

```
types, crypto, logger ─────────────────────────────────────────┐ (Level 0: no internal deps)
auth (→ crypto), rate-limiter, bot-i18n (→ types) ─────────────┤ (Level 1)
color-blending (→ types) ──────────────────────────────────────┤
core (→ types, logger), test-utils (→ types, logger) ──────────┤ (Level 2)
svg (→ core), bot-logic (→ core, types) ───────────────────────┤ (Level 3)
worker-middleware (→ logger, rate-limiter) ────────────────────┤
                                                                │
                            Applications ◄─────────────────────┘
```

`stoat-worker` consumes `bot-logic` + `bot-i18n` + `svg` so it shares command logic with `discord-worker` despite running on Node.js + Revolt instead of Cloudflare + Discord.

## Common Commands

All commands run from the **repository root**:

```bash
pnpm install                          # Install all workspace dependencies
pnpm turbo run build                  # Build all packages (respects dependency order)
pnpm turbo run test                   # Test all packages
pnpm turbo run type-check             # Type-check all packages
pnpm turbo run lint                   # Lint all packages

# Filter to specific packages/apps
pnpm turbo run build --filter=@xivdyetools/core
pnpm turbo run test --filter=xivdyetools-discord-worker
pnpm turbo run build --filter='./packages/*'
pnpm turbo run test --filter='./apps/*'

# Run a single test file
pnpm --filter @xivdyetools/core exec vitest run src/path/to/file.test.ts

# Dev servers
pnpm --filter xivdyetools-web-app run dev          # Vite, localhost:5173
pnpm --filter xivdyetools-discord-worker run dev   # Wrangler local
pnpm --filter xivdyetools-api-docs run dev         # VitePress docs site
pnpm --filter xivdyetools-stoat-worker run dev     # tsx watch (Node.js)
```

Workers additionally support:

```bash
pnpm --filter xivdyetools-discord-worker run deploy              # Staging
pnpm --filter xivdyetools-discord-worker run deploy:production   # Production
```

## Key Technical Details

### Tooling
- **pnpm 10.27** with `workspace:*` protocol for internal dependencies
- **Turborepo 2.9** for task orchestration with dependency-aware caching
- **TypeScript 5.9** with shared `tsconfig.base.json` (strict, ES2022, bundler resolution, `verbatimModuleSyntax`)
- **Vitest 4** for all packages and apps; **Playwright** for `web-app` E2E
- **ESLint 10** flat config with typescript-eslint
- **Prettier 3** for formatting

### `verbatimModuleSyntax` Caveat
The base tsconfig enables `verbatimModuleSyntax`, so type-only imports must be explicitly marked: `import type { Foo } from '...'`. A regular `import { Foo }` for something only used as a type is a compile error.

### Inter-Worker Communication
Workers communicate via Cloudflare **Service Bindings** (direct Worker-to-Worker, no HTTP overhead):

```
discord-worker ──► presets-api
moderation-worker ──► presets-api
presets-api ──► discord-worker (notifications)
api-worker ──► (standalone, public-facing)
```

All Cloudflare Workers use **Hono** as the HTTP framework. Persistence is **D1** (SQLite) for `presets-api` and `oauth`.

### Localization
6 languages throughout: `en`, `ja`, `de`, `fr`, `ko`, `zh`
- XIVAPI v2 only serves en/ja/de/fr; Korean and Chinese names are manually sourced
- Locale pipeline: `fetch_dye_names.py` → `dyenames.csv` → `build-locales.ts` → JSON
- CJK rendering needs subset fonts (Noto Sans SC + Noto Sans KR) in SVG generation

### Dye Database Composition
The dye database is **125 standard dyes plus 11 Facewear color entries** = 136 total entries in `colors_xiv.json`.

The 11 Facewear color entries have `itemID: null` in the JSON; `DyeDatabase.initialize()` assigns synthetic **hash-based negative IDs** (e.g. `-1127`, derived from the name's char codes — **not** sequential `-1, -2, ...`). `Dye.itemID` is therefore always a `number` at runtime — never null. For market-board filtering use `dye.itemID > 0`, never a null-check. Facewear entries are excluded from the k-d tree (not market-tradeable).

## Publishing Libraries to npm

```bash
# 1. Make changes in packages/<name>/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/<name>

# 3. Bump version in packages/<name>/package.json
# 4. Publish (or use the GitHub Actions workflow_dispatch)
pnpm --filter @xivdyetools/<name> publish --provenance --access public --no-git-checks
```

`@xivdyetools/core`'s `build` script runs `build:version` → `build:locales` → `tsc` → `copy:locales`. If you've made manual locale fixes, use `--ignore-scripts` when publishing so `build:locales` doesn't overwrite them.

## CI/CD

- **CI**: lint, type-check, test, build on affected packages (push/PR)
- **Deploy**: path-filtered workflows per worker (push to main + manual dispatch)
- **Publish**: manual `workflow_dispatch` to publish a selected npm package
- **Secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NPM_TOKEN`

## Documentation Hub

`docs/` contains architecture overviews, API contracts, deployment guides, and specs — its `CLAUDE.md` indexes all major topics. The public-facing API documentation lives in `apps/api-docs/` (VitePress) and ships separately.
