# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/worker-kit` is the shared Cloudflare Worker toolkit, formed in the Monorepo 2.0 Tier 1 consolidation by merging `@xivdyetools/worker-middleware` (v1.2.0) and `@xivdyetools/rate-limiter` (v1.5.0). Both APIs are unchanged — only the import specifiers moved.

Two modules:

- **`src/middleware/`** — the Hono middleware stack used by every CF Worker: `requestIdMiddleware`, `loggerMiddleware`, `rateLimitMiddleware` factories, plus `MiddlewareVariables` and Hono `ContextVariableMap` augmentation (`c.get('requestId')` / `c.get('logger')` typed globally).
- **`src/rate-limiter/`** — the sliding-window rate limiting engine: `RateLimiter` interface, `MemoryRateLimiter` / `KVRateLimiter` / `UpstashRateLimiter` backends, `getClientIp` (SEC-002: prefers `CF-Connecting-IP`, never trust `X-Forwarded-For`), `getRateLimitHeaders`, and shared limit presets (`PUBLIC_API_LIMITS`, …).

## Import Paths

```typescript
import { requestIdMiddleware, loggerMiddleware, rateLimitMiddleware,
         type MiddlewareVariables } from '@xivdyetools/worker-kit';           // or /middleware
import { MemoryRateLimiter, KVRateLimiter, getClientIp,
         PUBLIC_API_LIMITS } from '@xivdyetools/worker-kit/rate-limiter';
import { UpstashRateLimiter } from '@xivdyetools/worker-kit/rate-limiter/upstash'; // single backend
```

The root export re-exports both modules; subpaths keep bundles lean (rate-limiter-only consumers like `stoat-worker` never touch hono — both `hono` and `@cloudflare/workers-types` are optional peers).

## Commands

```bash
pnpm turbo run build --filter=@xivdyetools/worker-kit
pnpm --filter @xivdyetools/worker-kit exec vitest run src/middleware/request-id.test.ts
pnpm --filter @xivdyetools/worker-kit run test
```

## Key Patterns (carried over — see git history of the two predecessor packages for full detail)

- **Middleware factory pattern** — each middleware is a factory returning a Hono `MiddlewareHandler`; canonical order is requestId → logger → rateLimit (each reads the previous one's context).
- **Request-ID validation** — upstream `X-Request-ID` accepted only if UUID-v4-shaped (log-injection defense); otherwise replaced via `crypto.randomUUID()`.
- **Rate-limit backend memoization (BUG-061)** — a `backend` factory's result is cached per isolate; never construct `MemoryRateLimiter` inside the factory.
- **Fail-open default** — backend errors let requests through (logged); `onError: 'fail-closed'` opts into 429.
- **`getClientIp` only** for keys (SEC-002) — `X-Forwarded-For` is spoofable.
- **Standard headers** — `X-RateLimit-Limit/Remaining/Reset` on every response; `Retry-After` on 429.

## Consumers

All eight backend apps: discord-worker, moderation-worker, presets-api, oauth, api-worker (incl. its absorbed universalis routes), og-worker and image-worker (middleware only — request ID + logger, no rate limiting) and stoat-worker (declares it for the rate-limiter — the Upstash backend is still *planned*, nothing is imported yet). web-app does not consume it.

## Internal Dependencies

- `@xivdyetools/logger` — `ExtendedLogger`, `createRequestLogger` (from `/worker` subpath)
- External: `@upstash/redis`; optional peers `hono`, `@cloudflare/workers-types`

## Publishing

Publishing goes through the **Publish Packages to npm** workflow (OIDC trusted publishing). ⚠️ **First-publish caveat:** as a brand-new npm package, `@xivdyetools/worker-kit` needs its trusted-publisher config created on npmjs.com AND its first version published manually by a 2FA-authenticated human — OIDC cannot create a package that doesn't exist yet (see root `CLAUDE.md` and `DEPRECATIONS.md`).
