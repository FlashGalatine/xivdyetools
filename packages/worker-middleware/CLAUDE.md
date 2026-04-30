# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/worker-middleware` is the shared Hono middleware stack used by every Cloudflare Worker in the ecosystem. It provides three middleware factories — `requestIdMiddleware`, `loggerMiddleware`, and `rateLimitMiddleware` — each returning a Hono `MiddlewareHandler`. It also augments Hono's `ContextVariableMap` so `c.get('requestId')` and `c.get('logger')` are typed without per-app boilerplate.

The package was extracted under REFACTOR-001 / REFACTOR-002 to consolidate previously-duplicated middleware across 5 workers. By centralizing it, fixes to UUID-format validation, log-injection prevention, and rate-limit fail-open behavior land in one place and propagate via `workspace:*`.

## Commands

```bash
pnpm build         # tsc -p tsconfig.build.json
pnpm test          # vitest run
pnpm test:watch    # vitest
pnpm test:coverage # vitest run --coverage
pnpm type-check    # tsc --noEmit
pnpm lint          # eslint src
pnpm clean         # rimraf dist coverage
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/worker-middleware
pnpm --filter @xivdyetools/worker-middleware exec vitest run src/request-id.test.ts
```

## Architecture

Three middleware files plus a `types.ts` that augments Hono. Everything is exported from a single barrel `index.ts` (no subpaths — the package is small enough that grouping by file isn't needed).

### Key Directories

```
src/
├── request-id.ts   # requestIdMiddleware, getRequestId
├── logger.ts       # loggerMiddleware, getLogger
├── rate-limit.ts   # rateLimitMiddleware
├── types.ts        # MiddlewareVariables + Hono module augmentation
└── index.ts        # Barrel re-export
```

## Public API

### Request ID middleware

```typescript
interface RequestIdOptions {
  validateFormat?: boolean;  // default true — rejects malformed X-Request-ID
}

function requestIdMiddleware(options?: RequestIdOptions): MiddlewareHandler;
function getRequestId<E, P, I>(c: Context<E, P, I>): string;  // 'unknown' fallback
```

### Logger middleware

```typescript
interface LoggerMiddlewareOptions {
  serviceName: string;                       // required
  readEnvironmentFromEnv?: boolean;          // default true — reads c.env.ENVIRONMENT
  readApiVersionFromEnv?: boolean;           // default false — reads c.env.API_VERSION
  logUserAgent?: boolean;                    // default false
  sanitizePath?: (path: string) => string;   // optional URL redactor
}

function loggerMiddleware(options: LoggerMiddlewareOptions): MiddlewareHandler;
function getLogger<E, P, I>(c: Context<E, P, I>): ExtendedLogger | undefined;
```

### Rate limit middleware

```typescript
interface RateLimitMiddlewareOptions {
  backend: RateLimiter | ((c: Context) => RateLimiter);   // factory for lazy-binding KV
  keyExtractor: (c: Context) => string;                   // use getClientIp(c.req.raw), NOT XFF
  config: RateLimitConfig | ((c: Context) => RateLimitConfig);
  onError?: 'fail-open' | 'fail-closed';                  // default 'fail-open'
  formatError?: (c: Context, retryAfter: number) => Response;  // custom 429 body
}

function rateLimitMiddleware(options: RateLimitMiddlewareOptions): MiddlewareHandler;
```

### Hono context typing

```typescript
type MiddlewareVariables = {
  requestId: string;
  logger: ExtendedLogger;
};

// Module augmentation in types.ts adds these to Hono's ContextVariableMap globally,
// so importing the package once is enough — no per-app `Variables` extension needed
// for these two keys.
```

## Key Patterns

### Middleware factory pattern

Each middleware is a factory: call it once at app setup with options, get back a `MiddlewareHandler` ready for `app.use(...)`. This lets each Worker tune behavior (service name, validation strictness, env-var sources) without subclassing or copy-pasting.

### Hono context augmentation (BUG-003)

`types.ts` declares:

```typescript
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    logger: ExtendedLogger;
  }
}
```

This means once any Worker imports from `@xivdyetools/worker-middleware`, every Hono `Context` in that Worker — even ones with custom `Variables` — has `requestId` and `logger` typed correctly. Workers that need additional context (like `auth`) extend their own `Variables` type as usual:

```typescript
type Variables = MiddlewareVariables & { auth: AuthContext };
const app = new Hono<{ Bindings: Env; Variables: Variables }>();
```

### Request ID handling (security-conscious)

`requestIdMiddleware` accepts `X-Request-ID` from upstream callers but **validates UUID v4 format by default** to prevent log injection. Malformed IDs are silently replaced with a fresh `crypto.randomUUID()`. The pattern is:

```
/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
```

Set `{ validateFormat: false }` only if you trust upstream (rare). The middleware also writes the final ID back into the response as `X-Request-ID` for client correlation.

### Logger middleware behavior

`loggerMiddleware` requires `requestIdMiddleware` to have run first (it calls `c.get('requestId')`). It:

1. Reads `c.env.ENVIRONMENT` (and optionally `c.env.API_VERSION`)
2. Constructs an `ExtendedLogger` via `createRequestLogger` from `@xivdyetools/logger/worker`
3. Stores it on `c` as `'logger'`
4. Logs `"Request started"` with `{ method, path }` (and optionally `userAgent`)
5. Awaits `next()`
6. Logs `"Request completed"` with `{ method, path, status, durationMs }`

`sanitizePath` runs on `pathname + search` before logging, so it can strip `?token=...` query parameters.

### Rate limit middleware wiring

`rateLimitMiddleware` is the most-configured of the three because each Worker has its own backend, key strategy, and config:

- **`backend`** can be a `RateLimiter` instance or a factory `(c) => RateLimiter`. Use the factory form when the backend needs request-time bindings (e.g., `new KVRateLimiter({ kv: c.env.RATE_LIMIT })`).
- **`keyExtractor`** must use `getClientIp(c.req.raw)` from `@xivdyetools/rate-limiter` — never derive from `X-Forwarded-For`. `getClientIp` prefers `CF-Connecting-IP` which Cloudflare's edge sets unspoofably (SEC-002).
- **`config`** can be static or per-request (e.g., different limits per path).
- **`onError`** defaults to `'fail-open'` so backend errors don't take the service down. Errors are logged to `c.get('logger')` if available.

The middleware always sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on every response. On 429, `Retry-After` is also set.

### Wiring it all up

The canonical worker setup is:

```typescript
import { Hono } from 'hono';
import {
  requestIdMiddleware,
  loggerMiddleware,
  rateLimitMiddleware,
  type MiddlewareVariables,
} from '@xivdyetools/worker-middleware';
import { MemoryRateLimiter, getClientIp, PUBLIC_API_LIMITS } from '@xivdyetools/rate-limiter';

type Variables = MiddlewareVariables;
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('*', requestIdMiddleware());                                // 1st: assigns requestId
app.use('*', loggerMiddleware({ serviceName: 'my-worker' }));       // 2nd: depends on requestId
app.use('/api/*', rateLimitMiddleware({                              // 3rd: optional, depends on logger
  backend: new MemoryRateLimiter(),
  keyExtractor: (c) => getClientIp(c.req.raw),
  config: PUBLIC_API_LIMITS.default,
}));
```

Order matters: `loggerMiddleware` reads `requestId`, and `rateLimitMiddleware` reads `logger` for warning output.

### Forwarding generics on getters

`getRequestId` and `getLogger` use forwarding generics over `Context<E, P, I>` rather than a bare `Context`. This preserves the caller's exact context shape — including app-specific `Variables` extensions — so `@typescript-eslint/no-unsafe-argument` doesn't fire on narrowly-typed callers (REFACTOR-003 + LINT-FIX 2026-04-29).

## Consumers

Grepped from `package.json` files in the monorepo:

- Apps: `xivdyetools-discord-worker`, `xivdyetools-presets-api`, `xivdyetools-oauth`, `xivdyetools-moderation-worker`, `xivdyetools-api-worker`, `xivdyetools-og-worker`, `xivdyetools-universalis-proxy`

Every Cloudflare Worker in the monorepo uses this — it's effectively the standard middleware bundle. Non-worker apps (web-app, stoat-worker) don't.

## Internal Dependencies

- `@xivdyetools/logger` — `ExtendedLogger` type, `createRequestLogger` from `/worker` subpath
- `@xivdyetools/rate-limiter` — `RateLimiter`, `RateLimitConfig`, `RateLimitResult`, `getRateLimitHeaders`
- Peer: `hono` (^4.0.0)

## Publishing

```bash
# 1. Make changes in packages/worker-middleware/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/worker-middleware

# 3. Bump version in packages/worker-middleware/package.json
# 4. Publish
pnpm --filter @xivdyetools/worker-middleware publish --provenance --access public --no-git-checks
```

`prepublishOnly` runs `clean` then `build` automatically. Because every Worker depends on this, breaking changes here require coordinated bumps across all consumers — prefer additive options on the existing factories where possible.
