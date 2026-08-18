# Changelog

All notable changes to `@xivdyetools/worker-kit` (formerly `@xivdyetools/worker-middleware`) will be documented in this file.

## [1.0.0] - 2026-08-16

**New npm package** — first release. Formed in the Monorepo 2.0 Tier 1 package consolidation (2026-07-31) by merging `@xivdyetools/worker-middleware` v1.2.0 and `@xivdyetools/rate-limiter` v1.5.0; both source trees moved verbatim, and neither API changed. `@xivdyetools/worker-kit` has never been published, so nothing below is breaking for an existing consumer — but see the migration notes for the two retired packages.

### Removed (2026-08-18 dead-code audit)

- `formatRateLimitMessage()` (`rate-limiter/headers.ts`) — zero callers; discord-worker's same-named function is a different, Discord-markdown message and is unaffected.
- `UNIVERSALIS_PROXY_LIMITS` preset — zero callers; api-worker's universalis router builds its config from env vars instead.
- `EndpointRateLimitConfig` type — never referenced anywhere, including inside this package.
- `MODERATION_LIMITS` **adopted, not removed**: added a `getModerationLimit(type)` lookup next to `getOAuthLimit`/`getDiscordCommandLimit`; `apps/moderation-worker/src/middleware/rate-limit.ts`'s `RATE_LIMIT_CONFIGS` now derives its numbers from the preset via a small shape adapter (its pre-existing `requestsPerMinute` field vs. the preset's `maxRequests`/`windowMs`) instead of re-declaring them inline.

### ⚠️ Migration from the retired packages

- `import { … } from '@xivdyetools/worker-middleware'` → `import { … } from '@xivdyetools/worker-kit'` (or the `/middleware` subpath).
- `import { … } from '@xivdyetools/rate-limiter'` → `import { … } from '@xivdyetools/worker-kit/rate-limiter'`.
- Backend subpaths keep their names one level down: `@xivdyetools/rate-limiter/{memory,kv,upstash,presets}` → `@xivdyetools/worker-kit/rate-limiter/{memory,kv,upstash,presets}`.
- All eight in-repo Worker consumers were flipped on the branch (`api-worker`, `discord-worker`, `moderation-worker`, `oauth`, `og-worker`, `presets-api`, `stoat-worker`, and the since-absorbed `universalis-proxy`). Full details and the removal checklist live in `DEPRECATIONS.md`.

### Added

- `src/middleware/` — the Hono middleware stack, exported from the package root and `./middleware`: `requestIdMiddleware()` (UUID-validated `X-Request-ID`, log-injection safe), `loggerMiddleware()` (per-request `@xivdyetools/logger` with `serviceName` / env / API-version / user-agent / `sanitizePath` options), `rateLimitMiddleware()` (memoized backend factory, standard `X-RateLimit-*` + `Retry-After` headers, fail-open by default), plus the `getRequestId(c)` / `getLogger(c)` context helpers and the `MiddlewareVariables` type.
- `src/rate-limiter/` — the sliding-window rate-limiting engine at `./rate-limiter`: `MemoryRateLimiter` (per-isolate, LRU-evicted), `KVRateLimiter` (best-effort fixed window on Cloudflare KV) and `UpstashRateLimiter` (distributed sliding window on Upstash Redis) behind the shared `RateLimiter` / `ExtendedRateLimiter` interfaces; `getClientIp(request, options?)` (prefers `CF-Connecting-IP`, never trusts `X-Forwarded-For` unless opted in); `getRateLimitHeaders()` / `formatRateLimitMessage()`; and the presets `OAUTH_LIMITS`, `DISCORD_COMMAND_LIMITS` (incl. `autocomplete`), `MODERATION_LIMITS`, `PUBLIC_API_LIMITS`, `UNIVERSALIS_PROXY_LIMITS` with the `getOAuthLimit()` / `getDiscordCommandLimit()` lookups. Every backend also has its own subpath (`./rate-limiter/{memory,kv,upstash,presets}`) so a Worker bundles only the one it uses.
- `hono` and `@cloudflare/workers-types` are both **optional** peers, so rate-limiter-only consumers (e.g. `stoat-worker`, a Node.js bot) don't need hono at all. `@upstash/redis` and `@xivdyetools/logger` are the only runtime dependencies. `"sideEffects": false` for tree-shaking; `./package.json` is exported.

### Security

- Optional `hono` peer floor raised from `^4.0.0` to `^4.12.34` (2026-08-09 pre-release audit FINDING-001 — the CORS ReDoS advisory in hono < 4.12.34 is reachable on the four Workers that mount `cors()`). Tightening a peer range would normally be a major bump, but the package has never been published, so the floor simply lands in this first release.

### Changed

- **`DISCORD_COMMAND_LIMITS` re-keyed to the 5.0 command roster** — the retired v4 keys (`match`, `match_image`, `favorites`, `collection`, `language`) are gone (they had been silently mis-tiering their replacements: `/extractor image` fell to the 15/min default instead of the 5/min image tier); `extractor`, `gradient`, `swatch`, `contrast`, `preset` (10/min), `preferences` added; new `command:subcommand` convention with `getDiscordCommandLimit(command, subcommand?)` resolving `command:subcommand` → `command` → `default` (`extractor:image` = 5/min)
- Tests: both suites (~2,250 lines across the middleware and rate-limiter modules) came across intact; the 90% lines / functions / branches / statements gate carried over from worker-middleware and now covers the rate-limiter tree too.
- Docs: README rewritten for the merged package (import-path table, middleware option tables, backend comparison, Worker configuration examples, license/legal notice); `CLAUDE.md` synced (incl. the `api-worker` ↔ `universalis-proxy` absorption).

### Operator notes (release day)

- `@xivdyetools/worker-kit` does **not** exist on npm yet. OIDC trusted publishing cannot create a new package: the first version must be published manually by a 2FA-authenticated human, and the trusted-publisher config added on npmjs.com afterwards (checklist in `DEPRECATIONS.md`). Until then, the "Publish Packages to npm" workflow entry for worker-kit will fail.
- `npm deprecate` `@xivdyetools/worker-middleware` and `@xivdyetools/rate-limiter` pointing at this package (manual, needs npm 2FA).

---

## Predecessor history: `@xivdyetools/worker-middleware` (1.0.0 – 1.2.0)

Everything below this line is the changelog of `@xivdyetools/worker-middleware`, the package whose shell was renamed to become worker-kit — it is **not** worker-kit release history. `@xivdyetools/rate-limiter`'s changelog (1.0.0 – 1.5.0) was not carried over; read it from git at `packages/rate-limiter/CHANGELOG.md` before commit `3f73b08` (2026-07-31).

## [1.2.0] - 2026-07-19

### Fixed

- **BUG-061** (2026-07-18 audit): the `backend` factory result is memoized per isolate — passing `(c) => new MemoryRateLimiter()` can no longer construct a fresh empty limiter per request and silently disable rate limiting (constraint documented on the option). The backend-error catch now logs the actual error message instead of swallowing it, making KV outages/misconfigurations diagnosable from logs.

## [1.1.2] — 2026-04-29

### Fixed

- **LINT-FIX** (REFACTOR-003 follow-up): Made `getLogger` and `getRequestId` generic over Hono's `Context<E, P, I>`, with constraint-type defaults (`E extends Env = Env`, `P extends string = string`, `I extends Input = Input`). The 1.1.1 refactor to a bare `Context` parameter caused `@typescript-eslint/no-unsafe-argument` to fire on `presets-api/src/index.ts:61` because that worker extends `MiddlewareVariables` with `& { auth: AuthContext }`, and the resulting intersection prevents TS from reducing the third generic position cleanly. Forwarding generics preserves the caller's exact context shape end-to-end. Defaults use the constraint types themselves (rather than `any`/`{}`) so the helpers comply with `no-explicit-any` and `no-empty-object-type` without disable comments. No behavioral change for any real call site (defaults only matter when a caller explicitly omits inference). Resolves CI run #66700292576 lint failure.

---

## [1.1.1] — 2026-04-29

### Changed

- **REFACTOR-003** (2026-04-28 audit): Replaced `Context<any, any, any>` in `getLogger` and `getRequestId` with Hono's standard `Context` type. The `ContextVariableMap` augmentation in `types.ts` already registers `requestId` and `logger` globally, so the `any` triple was never needed. Callers now retain their narrow `Bindings` / `Variables` typing through both helpers (a typo'd `c.get('reqIdTypo')` will be caught by tsc rather than silently typed `any`).
- **SEC-002** (2026-04-28 audit): Strengthened the `keyExtractor` JSDoc on `RateLimitMiddlewareOptions` with an explicit security warning against deriving keys from client-controlled headers like `X-Forwarded-For`. Cross-references `BUG-018` / 2026-04-07/FINDING-006 (the prior library-layer fix). Pure documentation hardening; no API change.

---

## [1.1.0] — 2026-04-07

### Added

- `rateLimitMiddleware()` — Configurable Hono middleware factory for rate limiting with standardized `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` response headers, `Retry-After` on 429 responses, and fail-open error handling. Adopted by `presets-api` and `api-worker` (resolves REFACTOR-002).
- 15 tests for `rateLimitMiddleware` covering header propagation, 429 format, fail-open, and configuration variants.

### Fixed

- **BUG-003**: Eliminated all `any` types — replaced `Context<any>` with Hono `ContextVariableMap` module augmentation; replaced `Record<string, any>` with `Record<string, unknown>` throughout.

---

## [1.0.0] — 2026-04-07

### Added

- `requestIdMiddleware()` — Configurable Hono middleware for request ID management with optional UUID format validation (enabled by default for log injection prevention). Extracted from 5 worker-local implementations.
- `loggerMiddleware()` — Configurable Hono middleware for per-request structured logging via `@xivdyetools/logger`. Supports environment reading, API version, user-agent logging, and custom path sanitization. Extracted from 4 worker-local implementations.
- `getRequestId()` — Safe context helper with `'unknown'` fallback for error handlers.
- `getLogger()` — Safe context helper with `undefined` fallback for error handlers.
- `MiddlewareVariables` type — Base Hono context variables (`requestId`, `logger`) for workers to extend.

### Motivation

Resolves **REFACTOR-001** from the 2026-04-07 deep-dive audit: ~185 lines of nearly identical request ID and logger middleware were duplicated across discord-worker, presets-api, oauth, moderation-worker, and api-worker. This package provides a single, tested, configurable source of truth.
