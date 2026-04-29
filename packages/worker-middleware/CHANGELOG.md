# Changelog

All notable changes to `@xivdyetools/worker-middleware` will be documented in this file.

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
