# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview

This is the **XIV Dye Tools** monorepo: a pnpm workspace using Turborepo containing all shared libraries, Cloudflare Workers, and web applications for the Final Fantasy XIV color/dye toolkit.

## Repository Structure

```
xivdyetools/
├── packages/           # Shared npm libraries (@xivdyetools scope)
│   ├── types/          # Branded types (HexColor, DyeId, etc.) and shared interfaces
│   ├── crypto/         # Base64URL encoding utilities
│   ├── logger/         # Multi-runtime logging with secret redaction
│   ├── auth/           # JWT verification, HMAC signing, Discord Ed25519
│   ├── rate-limiter/   # Sliding window rate limiting (Memory, KV, Upstash)
│   ├── core/           # Color algorithms, 136-dye database, k-d tree, 6-language i18n
│   └── test-utils/     # CF Workers mocks (D1, KV, R2) and test factories
├── apps/               # Applications
│   ├── discord-worker/       # Primary Discord bot (CF Worker + Hono)
│   ├── moderation-worker/    # Moderation bot for presets (CF Worker)
│   ├── presets-api/          # Community presets REST API (CF Worker + D1)
│   ├── oauth/                # Discord OAuth + JWT issuance (CF Worker + D1)
│   ├── universalis-proxy/    # CORS proxy for Universalis market data (CF Worker)
│   ├── og-worker/            # Dynamic OpenGraph image generation (CF Worker)
│   ├── web-app/              # Main web app (Vite + Lit + Tailwind)
│   └── maintainer/           # Local dev tool for dye database (Vite + Vue)
└── docs/               # Architecture, specs, guides, research
```

## Dependency Flow

```
types, crypto, logger ──────────────────────────────────┐ (Level 0: no internal deps)
auth (→ crypto), rate-limiter ──────────────────────────┤ (Level 1)
core (→ types, logger), test-utils (→ types, logger) ──┤ (Level 2)
                                                        │
                    Applications ◄──────────────────────┘
```

## Common Commands

All commands run from the **repository root**:

```bash
pnpm install                          # Install all workspace dependencies
pnpm turbo run build                  # Build all packages
pnpm turbo run test                   # Test all packages
pnpm turbo run type-check             # Type-check all packages
pnpm turbo run lint                   # Lint all packages

# Filter to specific packages/apps
pnpm turbo run build --filter=@xivdyetools/core
pnpm turbo run test --filter=xivdyetools-discord-worker
pnpm turbo run build --filter='./packages/*'
pnpm turbo run test --filter='./apps/*'

# Run single test file
pnpm --filter @xivdyetools/core exec vitest run src/path/to/file.test.ts

# Dev server for an app
pnpm --filter xivdyetools-web-app run dev
pnpm --filter xivdyetools-discord-worker run dev
```

Workers additionally support:
```bash
pnpm --filter xivdyetools-discord-worker run deploy              # Deploy to staging
pnpm --filter xivdyetools-discord-worker run deploy:production   # Deploy to production
```

## Key Technical Details

### Tooling
- **pnpm 10** with `workspace:*` protocol for internal dependencies
- **Turborepo** for task orchestration with dependency-aware caching
- **TypeScript 5.9** with shared `tsconfig.base.json` (strict, ES2022, bundler resolution)
- **Vitest 4** for most packages; oauth and presets-api use **Vitest 3.2** (required by `@cloudflare/vitest-pool-workers`)
- **ESLint 9** flat config with typescript-eslint
- **Prettier 3** for formatting

### Inter-Worker Communication
Workers communicate via Cloudflare **Service Bindings** (direct Worker-to-Worker):
```
discord-worker ──► presets-api
moderation-worker ──► presets-api
presets-api ──► discord-worker (notifications)
```

### Localization
6 languages: `en`, `ja`, `de`, `fr`, `ko`, `zh`
- Core package builds locale JSON from `dyenames.csv` + `localize.yaml`
- CJK text rendering requires subset fonts (Noto Sans SC + Noto Sans KR)

### Facewear Dyes
11 Facewear dyes have synthetic negative IDs (`-1`, `-2`, ...). Always use `dye.itemID > 0` for market board filtering — never null-check.

## Publishing Libraries to npm

```bash
# 1. Make changes in packages/<name>/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/<name>

# 3. Bump version in packages/<name>/package.json
# 4. Publish (or use GitHub Actions workflow_dispatch)
pnpm --filter @xivdyetools/<name> publish --provenance --access public --no-git-checks
```

## CI/CD

- **CI**: Runs lint, type-check, test, build on affected packages (push/PR)
- **Deploy**: Path-filtered workflows per worker (push to main + manual dispatch)
- **Publish**: Manual workflow_dispatch to publish selected npm package
- **Secrets**: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NPM_TOKEN`
