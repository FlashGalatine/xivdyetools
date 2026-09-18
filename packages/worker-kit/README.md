# @xivdyetools/worker-kit

> Shared Cloudflare Worker toolkit for XIV Dye Tools: [Hono](https://hono.dev/) middleware (request ID, structured logger, rate limiting), request-body guards, magic-byte image sniffing, plus the sliding-window rate limiting engine and backends (Cloudflare, Memory, KV, Upstash) it wraps.

[![npm version](https://img.shields.io/npm/v/@xivdyetools/worker-kit)](https://www.npmjs.com/package/@xivdyetools/worker-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Formed in the Monorepo 2.0 Tier 1 consolidation by merging `@xivdyetools/worker-middleware` (v1.2.0) and `@xivdyetools/rate-limiter` (v1.5.0). **Both APIs are unchanged — only the import specifiers moved.** See [`DEPRECATIONS.md`](../../DEPRECATIONS.md) for the migration table.

## Installation

```bash
pnpm add @xivdyetools/worker-kit
```

**Optional peer dependencies:** `hono ^4.13.5` and `@cloudflare/workers-types ^4.0.0`. Both are optional so a consumer that only needs the rate-limiter engine, not the middleware, never pulls in Hono — no current in-repo consumer is rate-limiter-only (see Consumers below).

## Import Paths

```typescript
// Middleware (root export, or ./middleware)
import {
  requestIdMiddleware, loggerMiddleware, rateLimitMiddleware,
  getRequestId, getLogger,
  type MiddlewareVariables,
} from '@xivdyetools/worker-kit';

// Request body guards (./body-guards only — it imports hono/body-limit at runtime)
import { bodyGuards } from '@xivdyetools/worker-kit/body-guards';

// Magic-byte image sniffing (root export, or ./image-sniff) — no Hono needed
import { detectImageFormat, sniffImageType } from '@xivdyetools/worker-kit/image-sniff';

// Rate limiter
import {
  MemoryRateLimiter, KVRateLimiter,
  getClientIp, getRateLimitHeaders, PUBLIC_API_LIMITS,
} from '@xivdyetools/worker-kit/rate-limiter';

// Single backend, for the leanest possible bundle
import { UpstashRateLimiter } from '@xivdyetools/worker-kit/rate-limiter/upstash';
```

The root export re-exports every module except `./body-guards` (subpath-only, see below); the subpaths (`./middleware`, `./body-guards`, `./image-sniff`, `./rate-limiter`, `./rate-limiter/{memory,kv,upstash,cloudflare,presets}`) keep bundles lean.

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

## Body Guards (`/body-guards`)

Two middleware from one factory: a streaming request-body size cap (SEC-004) and a JSON depth / prototype-pollution check (SEC-003). The factory never writes a response body — every rejection is rendered by a caller-supplied responder, so two Workers with different error envelopes share one implementation without either changing a byte of what it returns.

```typescript
import { bodyGuards } from '@xivdyetools/worker-kit/body-guards';

const { bodySizeLimit, jsonDepthLimit } = bodyGuards<{ Bindings: Env }>({
  maxSize: 10 * 1024,
  onTooLarge: (c) =>
    c.json({ error: 'Payload too large', message: 'Request body too large' }, 413),
  onInvalidJson: (c, message) =>
    c.json({ success: false, error: 'Invalid request body', message }, 400),
});

app.use('/auth/*', bodySizeLimit);
app.use('/auth/*', jsonDepthLimit);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSize` | `number` | *required* | Default body cap in bytes. |
| `maxDepth` | `number` | `10` | Maximum JSON nesting depth. The budget is inclusive — a leaf at `maxDepth` is accepted, one at `maxDepth + 1` is not. |
| `onTooLarge` | `(c) => Response` | *required* | Response for an oversized body. |
| `onInvalidJson` | `(c, message) => Response` | *required* | Response for unparseable JSON (`'Invalid JSON syntax'`), a depth violation (`` `JSON nesting exceeds maximum depth of ${maxDepth}` ``) or a pollution key (`'Invalid JSON structure'`). |
| `exempt` | `{ match, maxSize, onTooLarge }` | — | One request shape that gets a different cap **and** skips the JSON check entirely — e.g. a binary upload route. |

- **`bodySizeLimit`** wraps Hono's `bodyLimit`, which decides on `Content-Length` alone when the header is present and otherwise counts the stream and cuts it at the cap — a header that understates the body is trusted, so a route that must not be lied to keeps its own post-read backstop.
- **`jsonDepthLimit`** inspects `POST` / `PATCH` / `PUT` requests whose `Content-Type` includes `application/json`. A non-JSON content type, an empty body, and a body that cannot be read all pass through untouched. It rejects an own `__proto__`, `constructor` or `prototype` key at any level.
- **`exempt.match`** is asked once per request by each middleware, so a route that is allowed a large binary body never pays for a JSON parse it cannot use.

```typescript
// The one route allowed a large, non-JSON body — its own cap, its own error.
exempt: {
  match: (c) => c.req.method === 'POST' && UPLOAD_PATH.test(c.req.path),
  maxSize: 5 * 1024 * 1024,
  onTooLarge: (c) =>
    c.json({ success: false, error: 'VALIDATION_ERROR', message: 'Image must be at most 5 MB' }, 400),
}
```

Types: `BodyGuardsOptions`, `BodyGuardMiddleware`, `BodyGuardExemption`, `BodyGuardResponder`, `InvalidJsonResponder`.

## Image Sniffing (`/image-sniff`)

Magic-byte format detection for PNG, JPEG, GIF, WebP and BMP. No Hono, no Workers types — a plain `Uint8Array` in, a format out, so an upload route can decide on content rather than on a `Content-Type` header a client controls.

```typescript
import { detectImageFormat, sniffImageType } from '@xivdyetools/worker-kit/image-sniff';

detectImageFormat(bytes);                          // 'png' | … | undefined
sniffImageType(bytes, ['png', 'jpeg', 'webp']);    // 'png' | 'jpeg' | 'webp' | null
```

| Export | Description |
|--------|-------------|
| `ImageFormat` | `'png' \| 'jpeg' \| 'gif' \| 'webp' \| 'bmp'` |
| `IMAGE_MAGIC_BYTES` | The leading-byte table, keyed by format. `webp`'s entry is the RIFF prefix only. |
| `detectImageFormat(bytes)` | The format, or `undefined`. |
| `sniffImageType(bytes, accept?)` | The format when it is on `accept`, otherwise `null`. The return type narrows to the accepted list. |

Both require **at least 12 bytes** and return nothing for a shorter buffer: the WebP check reads offsets 8–11, so a short buffer starting with `RIFF` would otherwise be decided on bytes that are not there. `RIFF` alone is never WebP — WAV and AVI share the container.

## Rate Limiter (`/rate-limiter`)

A sliding-window rate limiting engine with four interchangeable backends.

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
| `CloudflareRateLimiter` | `/rate-limiter/cloudflare` | **Preferred per-client limiter** (FINDING-003). Native `[[ratelimits]]` bindings, tiered; counts atomically per colo with no storage writes. |
| `MemoryRateLimiter` | `/rate-limiter/memory` | Single isolate, tests, local dev. Not shared across isolates. |
| `KVRateLimiter` | `/rate-limiter/kv` | Cloudflare KV. Eventually consistent — **cannot throttle a fast client** (1 write/s/key, swallowed put failures); a fallback only. |
| `UpstashRateLimiter` | `/rate-limiter/upstash` | Upstash Redis. A real distributed sliding window; the strictest option. |

`CloudflareRateLimiter` trades exactness for atomicity and is documented as such:
`remaining` reports `limit - 1` while allowed and `0` when denied (the binding
does not expose a count), `checkOnly()` consumes a slot while `increment()` is a
no-op, `reset()` / `resetAll()` are no-ops, and counters are per-colo rather
than global.

### Utilities

| Export | Description |
|--------|-------------|
| `getClientIp(request, options?)` | Prefers `CF-Connecting-IP`. **Never** trusts `X-Forwarded-For`, which is spoofable (SEC-002). |
| `getRateLimitHeaders(result)` | Builds the `X-RateLimit-*` / `Retry-After` header set. |

### Presets (`/rate-limiter/presets`)

Shared limit configurations so every worker enforces the same policy:

`OAUTH_LIMITS`, `getOAuthLimit()`, `DISCORD_COMMAND_LIMITS`, `getDiscordCommandLimit()`, `MODERATION_LIMITS`, `getModerationLimit()`, `PUBLIC_API_LIMITS`.

### Types

`RateLimitResult`, `RateLimitConfig`, `RateLimiter`, `ExtendedRateLimiter`, `MemoryRateLimiterOptions`, `KVRateLimiterOptions`, `UpstashRateLimiterOptions`, `CloudflareRateLimiterOptions`, `CloudflareRateLimitTier`, `RateLimitBinding`, `RateLimiterLogger`, `GetClientIpOptions`.

Middleware types (root / `./middleware`): `MiddlewareVariables`, `RequestIdOptions`, `LoggerMiddlewareOptions`, `RateLimitMiddlewareOptions`.

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

All seven backend apps: [`discord-worker`](../../apps/discord-worker/), [`moderation-worker`](../../apps/moderation-worker/), [`presets-api`](../../apps/presets-api/), [`oauth`](../../apps/oauth/), [`api-worker`](../../apps/api-worker/), [`og-worker`](../../apps/og-worker/) and [`image-worker`](../../apps/image-worker/) (middleware only). [`stoat-worker`](../../apps/stoat-worker/) does not depend on this package — it was dropped along with `svg`/`core` (it renders no cards and needs no Workers-only middleware) — and the web app never has.

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
