# Deep-Dive Analysis Manifest

- **Project:** xivdyetools monorepo (11 packages + 9 applications)
- **Analysis Date:** 2026-03-18
- **Scope:** Full monorepo — all `packages/` and `apps/` source directories
- **Files Analyzed:** 100+ TypeScript source files across 20 projects
- **Analyzer:** Claude Opus 4.6 Deep-Dive Analysis Skill
- **Audit Type:** First full monorepo deep-dive (prior audits scoped to individual projects)

## Packages Analyzed

### Shared Libraries (`packages/`)
- `@xivdyetools/types` — Branded types, shared interfaces
- `@xivdyetools/crypto` — Base64URL encoding utilities
- `@xivdyetools/logger` — Multi-runtime logging with secret redaction
- `@xivdyetools/auth` — JWT, HMAC, Ed25519 verification
- `@xivdyetools/rate-limiter` — Sliding window rate limiting (Memory, KV, Upstash)
- `@xivdyetools/core` — Color algorithms, 136-dye database, k-d tree, i18n, Universalis API
- `@xivdyetools/svg` — SVG template rendering
- `@xivdyetools/bot-logic` — Discord bot business logic
- `@xivdyetools/bot-i18n` — Bot localization strings
- `@xivdyetools/color-blending` — RGB color blending algorithms
- `@xivdyetools/test-utils` — CF Workers mocks, test factories

### Applications (`apps/`)
- `discord-worker` — Primary Discord bot (CF Worker + Hono)
- `moderation-worker` — Moderation bot for presets
- `presets-api` — Community presets REST API (CF Worker + D1)
- `oauth` — Discord OAuth + JWT issuance
- `universalis-proxy` — CORS proxy for Universalis market data
- `og-worker` — Dynamic OpenGraph image generation
- `web-app` — Main web app (Vite + Lit + Tailwind)
- `stoat-worker` — Private Discord bot (Node.js + discord.js)
- `maintainer` — Local dev tool for dye database (Vue 3)

## Key Source Files Read

### Shared Packages
- `packages/core/src/services/APIService.ts` (590+ lines)
- `packages/core/src/services/dye/DyeDatabase.ts` (360+ lines)
- `packages/core/src/services/dye/DyeSearch.ts`
- `packages/core/src/services/LocalizationService.ts`
- `packages/core/src/utils/index.ts` (LRU cache, helpers)
- `packages/crypto/src/base64.ts`
- `packages/auth/src/hmac.ts`
- `packages/auth/src/jwt.ts`
- `packages/rate-limiter/src/backends/memory.ts`

### Applications
- `apps/presets-api/src/services/preset-service.ts`
- `apps/presets-api/src/handlers/presets.ts`
- `apps/presets-api/src/services/rate-limit-service.ts`
- `apps/oauth/src/utils/state-signing.ts`
- `apps/universalis-proxy/src/index.ts`
- `apps/discord-worker/src/services/budget/universalis-client.ts`
- `apps/web-app/src/components/image-upload-display.ts`
- `apps/stoat-worker/src/router.ts`
- `apps/stoat-worker/src/commands/info.ts`

### Configuration & CI/CD
- Root `package.json`, `turbo.json`, `tsconfig.base.json`
- All package/app `package.json` files (dependency analysis)
- All `vitest.config.ts` files (coverage threshold analysis)
- All `wrangler.toml` files (deployment configuration)
- `.github/workflows/` (CI/CD pipeline analysis)

## Analysis Methodology
- Static code analysis with line-level inspection
- Concurrency/race condition analysis (CF Workers isolate model)
- Cross-worker boundary and service binding review
- CI/CD pipeline and deployment trigger analysis
- Dependency version consistency audit
- Test coverage threshold comparison

## Findings Summary
- **Hidden Bugs:** 18
- **Refactoring Opportunities:** 10
- **Optimization Opportunities:** 6
- **Architecture Concerns:** 5 (documented in executive report)
- **Total Findings:** 39

## Prior Audit Cross-References
- `2026-01-25/` — Deep-dive (core + cross-project)
- `2026-02-06/` — Deep-dive (discord-worker focused)
- `2026-02-06/SECURITY_AUDIT_REPORT.md` — Security audit
- `2026-02-18/` — Security audit (full monorepo)
