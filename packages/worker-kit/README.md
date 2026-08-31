# @xivdyetools/worker-kit

> Shared Cloudflare Worker toolkit for XIV Dye Tools: [Hono](https://hono.dev/) middleware (request ID, structured logger, rate limiting) plus the sliding-window rate limiting engine and backends (Memory, KV, Upstash) it wraps.

[![npm version](https://img.shields.io/npm/v/@xivdyetools/worker-kit)](https://www.npmjs.com/package/@xivdyetools/worker-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Formed in the Monorepo 2.0 Tier 1 consolidation by merging `@xivdyetools/worker-middleware` (v1.2.0) and `@xivdyetools/rate-limiter` (v1.5.0). **Both APIs are unchanged — only the import specifiers moved.** See [`DEPRECATIONS.md`](../../DEPRECATIONS.md) for the migration table.

## Installation

```bash
pnpm add @xivdyetools/worker-kit
```

**Optional peer dependencies:** `hono ^4.12.34` and `@cloudflare/workers-types ^4.0.0`. Both are optional so rate-limiter-only consumers (such as `stoat-worker`, a Node process) never pull in Hono.

## Import Paths

```typescript
// Middleware (root export, or ./middleware)
import {
  requestIdMiddleware, loggerMiddleware, rateLimitMiddleware,
  getRequestId, getLogger,
  type MiddlewareVariables,
} from '@xivdyetools/worker-kit';

// Rate limiter
import {
  MemoryRateLimiter, KVRateLimiter,
  getClientIp, getRateLimitHeaders, PUBLIC_API_LIMITS,
} from '@xivdyetools/worker-kit/rate-limiter';

// Single backend, for the leanest possible bundle
import { UpstashRateLimiter } from '@xivdyetools/worker-kit/rate-limiter/upstash';
```

The root export re-exports both modules; the subpaths (`./middleware`, `./rate-limiter`, `./rate-limiter/{memory,kv,upstash,presets}`) keep bundles lean.

## Middleware

```typescript
import {
  requestIdMiddleware,
  loggerMiddleware,
  rateLimitMiddleware,
  getRequestId,
  getLogger,
} from '@xivdyetools/worker-kit';
import type { MiddlewareVariables } from '@xivdyetools/worker-kit';

// Extend with your app's variables
type Variables = MiddlewareVariables & {
  auth: AuthContext;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Canonical order: requestId → logger → rateLimit (each reads the previous one's context)
app.use('*', requestIdMiddleware());

app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-presets-api',
  readApiVersionFromEnv: true,
}));

// In handlers:
app.get('/api/example', (c) => {
  const logger = c.get('logger');
  logger.info('Processing request');
  return c.json({ ok: true });
});

// In error handlers:
app.onError((err, c) => {
  const requestId = getRequestId(c);
  const logger = getLogger(c);
  logger?.error('Unhandled error', err);
  return c.json({ error: 'Internal error', requestId }, 500);
});
```

### `requestIdMiddleware(options?)`

Generates or preserves an `X-Request-ID` header for distributed tracing.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `validateFormat` | `boolean` | `true` | Validate an incoming `X-Request-ID` against UUID format. Malformed values are replaced via `crypto.randomUUID()` — a log-injection defense. |

### `loggerMiddleware(options)`

Creates a per-request structured logger (via `@xivdyetools/logger`) and logs request start/completion with timing.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serviceName` | `string` | *required* | Service name for log aggregation. |
| `readEnvironmentFromEnv` | `boolean` | `true` | Read `ENVIRONMENT` from `c.env`. When `false`, defaults to `'production'`. |
| `readApiVersionFromEnv` | `boolean` | `false` | Read `API_VERSION` from `c.env`. |
| `logUserAgent` | `boolean` | `false` | Include `User-Agent` in the "Request started" log. |
| `sanitizePath` | `(path: string) => string` | — | Redact sensitive URL segments before logging. |

### `rateLimitMiddleware(options)`

Wires a `RateLimiter` backend into the request path, sets standard headers, and returns `429` when exhausted.

- **Backend memoization** — the `backend` factory's result is cached per isolate. Never construct a `MemoryRateLimiter` inside the factory, or every request gets a fresh empty window.
- **Fail-open by default** — backend errors let requests through (and log). Pass `onError: 'fail-closed'` to return `429` instead.
- **Standard headers** — `X-RateLimit-Limit` / `-Remaining` / `-Reset` on every response; `Retry-After` on a `429`.

### Helpers and types

| Export | Description |
|--------|-------------|
| `getRequestId(c)` | Extract the request ID from Hono context. Returns `'unknown'` if the middleware hasn't run. |
| `getLogger(c)` | Extract the logger from Hono context. Returns `undefined` if the middleware hasn't run. |
| `MiddlewareVariables` | `{ requestId: string; logger: ExtendedLogger }` — extend with your app-specific variables. |

## Rate Limiter (`/rate-limiter`)

A sliding-window rate limiting engine with three interchangeable backends.

```typescript
import { KVRateLimiter, getClientIp, getRateLimitHeaders, PUBLIC_API_LIMITS }
  from '@xivdyetools/worker-kit/rate-limiter';

const limiter = new KVRateLimiter({ kv: env.RATE_LIMIT, keyPrefix: 'api:ip:' });
const result = await limiter.check(getClientIp(c.req.raw), PUBLIC_API_LIMITS);

if (!result.allowed) {
  return c.json({ error: 'Rate limited' }, 429, getRateLimitHeaders(result));
}
```

### Backends

| Backend | Subpath | Use when |
|---------|---------|----------|
| `MemoryRateLimiter` | `/rate-limiter/memory` | Single isolate, tests, local dev. Not shared across isolates. |
| `KVRateLimiter` | `/rate-limiter/kv` | Cloudflare KV. Eventually consistent — good enough for abuse prevention. |
| `UpstashRateLimiter` | `/rate-limiter/upstash` | Upstash Redis. A real distributed sliding window; the strictest option. |

### Utilities

| Export | Description |
|--------|-------------|
| `getClientIp(request, options?)` | Prefers `CF-Connecting-IP`. **Never** trusts `X-Forwarded-For`, which is spoofable (SEC-002). |
| `getRateLimitHeaders(result)` | Builds the `X-RateLimit-*` / `Retry-After` header set. |

### Presets (`/rate-limiter/presets`)

Shared limit configurations so every worker enforces the same policy:

`OAUTH_LIMITS`, `getOAuthLimit()`, `DISCORD_COMMAND_LIMITS`, `getDiscordCommandLimit()`, `MODERATION_LIMITS`, `getModerationLimit()`, `PUBLIC_API_LIMITS`.

### Types

`RateLimitResult`, `RateLimitConfig`, `RateLimiter`, `ExtendedRateLimiter`, `MemoryRateLimiterOptions`, `KVRateLimiterOptions`, `UpstashRateLimiterOptions`, `RateLimiterLogger`.

## Worker Configuration Examples

```typescript
// discord-worker — no ENVIRONMENT env var, no user agent
app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-discord-worker',
  readEnvironmentFromEnv: false,
}));

// presets-api — has ENVIRONMENT + API_VERSION
app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-presets-api',
  readApiVersionFromEnv: true,
}));

// moderation-worker — custom URL sanitizer
import { sanitizeUrl } from './utils/url-sanitizer.js';
app.use('*', requestIdMiddleware());
app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-moderation-worker',
  readEnvironmentFromEnv: false,
  sanitizePath: sanitizeUrl,
}));
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@xivdyetools/logger` | `ExtendedLogger`, `createRequestLogger` |
| `@upstash/redis` | Upstash rate-limiter backend |
| `hono` | Optional peer — needed only for the middleware module |
| `@cloudflare/workers-types` | Optional peer — Workers type definitions |

## Consumers

All eight backend apps: [`discord-worker`](../../apps/discord-worker/), [`moderation-worker`](../../apps/moderation-worker/), [`presets-api`](../../apps/presets-api/), [`oauth`](../../apps/oauth/), [`api-worker`](../../apps/api-worker/), [`og-worker`](../../apps/og-worker/) and [`image-worker`](../../apps/image-worker/) (middleware only), and [`stoat-worker`](../../apps/stoat-worker/) (declared for the planned rate-limiter backend). The web app does not consume it.

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

## Legal Notice

**FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.**
**FINAL FANTASY XIV © SQUARE ENIX CO., LTD.**

XIV Dye Tools is an unofficial fan project and is **not affiliated with, endorsed by, or sponsored by Square Enix Co., Ltd.**
