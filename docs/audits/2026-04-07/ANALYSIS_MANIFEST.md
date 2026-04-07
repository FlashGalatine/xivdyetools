# Combined Audit Manifest

- **Project:** xivdyetools monorepo (11 packages + 9 applications)
- **Analysis Date:** 2026-04-07
- **Scope:** Full monorepo — all `packages/` and `apps/` source directories
- **Auditor:** Claude Opus 4.6 (1M context)
- **Audit Type:** Combined Security Audit + Deep-Dive Code Analysis

## Prior Audit Cross-References

| Date | Type | Scope | Findings |
|------|------|-------|----------|
| 2026-03-18 | Deep-Dive | Full monorepo | 39 (18 bugs, 10 refactoring, 6 optimization, 5 architecture) |
| 2026-02-18 | Security | Full monorepo | Security-focused findings |
| 2026-02-06 | Deep-Dive + Security | discord-worker focused | Individual project findings |
| 2026-01-25 | Deep-Dive | core + cross-project | Individual project findings |
| 2026-01-22 | Combined | @xivdyetools/core only | 6 findings (4 security, 2 code quality) |

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
- `api-worker` — Public dye matching API (CF Worker + KV)
- `web-app` — Main web app (Vite + Lit + Tailwind)
- `stoat-worker` — Private Discord bot (Node.js + discord.js)
- `maintainer` — Local dev tool for dye database (Vue 3)

## Key Source Files Read

### Security-Critical Files
- `packages/auth/src/jwt.ts` — JWT creation, verification, algorithm enforcement
- `packages/auth/src/hmac.ts` — HMAC-SHA256, CryptoKey cache, timing-safe comparison
- `packages/auth/src/discord.ts` — Ed25519 Discord interaction verification
- `packages/rate-limiter/src/ip.ts` — IP extraction with CF-Connecting-IP preference
- `packages/rate-limiter/src/backends/upstash.ts` — Atomic Redis rate limiting
- `packages/svg/src/base.ts` — XML escaping for SVG injection prevention
- `apps/oauth/src/handlers/callback.ts` — OAuth callback with state signing
- `apps/oauth/src/handlers/authorize.ts` — PKCE authorization flow
- `apps/oauth/src/utils/state-signing.ts` — HMAC state signing/verification
- `apps/oauth/src/utils/env-validation.ts` — Environment variable validation
- `apps/presets-api/src/middleware/auth.ts` — JWT + bot signature auth
- `apps/presets-api/src/middleware/ban-check.ts` — User ban enforcement
- `apps/presets-api/src/middleware/rate-limit.ts` — Rate limiting middleware
- `apps/presets-api/src/services/validation-service.ts` — Input validation
- `apps/presets-api/src/services/moderation-service.ts` — Profanity filtering
- `apps/discord-worker/src/utils/sanitize.ts` — Text sanitization
- `apps/discord-worker/src/utils/github-verify.ts` — GitHub webhook verification
- `apps/universalis-proxy/src/index.ts` — CORS proxy configuration

### Code Quality Files
- `apps/presets-api/src/services/preset-service.ts` — D1 query patterns, JSON parsing
- `apps/presets-api/src/handlers/presets.ts` — Submission, race condition handling
- `apps/discord-worker/src/services/user-storage.ts` — KV collection storage
- `apps/discord-worker/src/services/budget/` — Budget calculation pipeline
- `apps/moderation-worker/src/index.ts` — Error handling, env validation
- `apps/web-app/src/services/auth-service.ts` — Client-side auth, localStorage
- `apps/web-app/src/components/modal-container.ts` — DOM manipulation
- `apps/web-app/index.html` — Content Security Policy
- All `wrangler.toml` files — Worker configuration, bindings, secrets
- All `tsconfig.json` files — TypeScript strictness settings
- All `vitest.config.ts` files — Test coverage thresholds

## Analysis Methodology

### Security Audit
1. **Dependency scanning** — `pnpm audit` for known vulnerabilities
2. **Authentication review** — JWT, HMAC, Ed25519, OAuth PKCE flows
3. **Injection analysis** — SQL (D1), XSS (SVG/HTML), command injection
4. **CORS & headers** — Origin validation, security headers, Content-Type enforcement
5. **Secret management** — Hardcoded secrets scan, env validation, wrangler.toml review
6. **Rate limiting** — Backend implementations, bypass vectors, IP extraction
7. **Data flow & PII** — User data storage, transit security, access controls
8. **Content moderation** — Profanity filtering, ReDoS prevention

### Deep-Dive Analysis
1. **Prior findings verification** — Status check of all 39 findings from 2026-03-18
2. **Error handling** — Global handlers, stack trace protection, graceful degradation
3. **Type safety** — Strict mode, branded types, assertion usage
4. **Testing coverage** — Framework, file counts, gap identification
5. **Code duplication** — Cross-worker middleware, validation patterns
6. **Performance** — Query patterns, caching, memory management
7. **Configuration** — Worker settings, compatibility flags, deploy triggers

## Findings Summary

### Security Audit
- **Critical:** 0
- **High:** 1 (dependency: rollup path traversal)
- **Medium:** 1 (SEC-001: moderation-worker missing error handler)
- **Low:** 4 (SEC-002 through SEC-005)
- **Overall Posture:** STRONG

### Deep-Dive Analysis
- **New Bugs:** 3 (BUG-001 through BUG-003)
- **Refactoring:** 4 (REFACTOR-001 through REFACTOR-004)
- **Optimization:** 3 (OPT-001 through OPT-003)
- **Testing Gaps:** 3 (TEST-001 through TEST-003)
- **Architecture:** 2 (ARCH-001, ARCH-002)

### Prior Findings Status (2026-03-18)
- **Fixed:** 26 (BUG-001–007, BUG-009–015, BUG-017–018, OPT-003–006, REFACTOR-001/mod-worker, REFACTOR-004/core, REFACTOR-005–010, ARCH-001, ARCH-003)
- **Won't Fix / Accepted Risk:** 1 (BUG-016 — fail-open rate limiting is intentional)
- **Mostly Fixed:** 1 (ARCH-002/smoke-tests — 6/8 deploy workflows done; og-worker and api-docs remain)
- **Still Open:** 11 (BUG-008, REFACTOR-002, REFACTOR-003/thresholds, OPT-001/KV, OPT-002/proxy, ARCH-004, ARCH-005, plus new: BUG-001-new, BUG-002-new, REFACTOR-001-new, REFACTOR-002-new)
