# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/rate-limiter` is a sliding-window rate limiter with three pluggable backends — `MemoryRateLimiter` (per-isolate LRU), `KVRateLimiter` (Cloudflare KV, best-effort fixed window), and `UpstashRateLimiter` (Redis REST, truly atomic). It also ships pre-tuned configurations for OAuth endpoints, Discord bot commands, the moderation bot, the public API, and the Universalis proxy.

The split-backend design lets each Worker pick the right tradeoff: in-memory is free but per-isolate, KV survives isolate restarts but is eventually consistent, and Upstash gives true atomic counters at the cost of an external service. All three implement the same `RateLimiter` interface, so swapping backends is a single-line change.

## Commands

```bash
pnpm build         # tsc -p tsconfig.build.json
pnpm test          # vitest run
pnpm test:watch    # vitest
pnpm test:coverage # vitest run --coverage
pnpm type-check    # tsc --noEmit
pnpm lint          # eslint src
pnpm clean         # rimraf dist
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/rate-limiter
pnpm --filter @xivdyetools/rate-limiter exec vitest run src/backends/memory.test.ts
```

## Architecture

The package separates the algorithm contract (`types.ts`) from concrete backends (`backends/`), with shared utilities for IP extraction, header generation, and ready-made config presets.

### Key Directories

```
src/
├── types.ts             # RateLimiter, ExtendedRateLimiter, RateLimitConfig, RateLimitResult, options
├── backends/
│   ├── memory.ts        # MemoryRateLimiter (in-memory sliding window + LRU eviction)
│   ├── kv.ts            # KVRateLimiter (Cloudflare KV with optimistic concurrency + retries)
│   └── upstash.ts       # UpstashRateLimiter (Redis REST)
├── ip.ts                # getClientIp (prefers CF-Connecting-IP, ignores X-Forwarded-For by default)
├── headers.ts           # getRateLimitHeaders, formatRateLimitMessage
└── presets/
    └── configs.ts       # OAUTH_LIMITS, DISCORD_COMMAND_LIMITS, MODERATION_LIMITS, PUBLIC_API_LIMITS, UNIVERSALIS_PROXY_LIMITS
```

## Public API

### Types

```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
  retryAfter?: number;     // seconds, only when !allowed
  backendError?: boolean;  // true when fail-open was used
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstAllowance?: number;
  failOpen?: boolean;
}

interface EndpointRateLimitConfig { [endpoint: string]: RateLimitConfig; default: RateLimitConfig }

interface RateLimiter {
  check(key, config): Promise<RateLimitResult>;
  reset(key): Promise<void>;
  resetAll(): Promise<void>;
}

interface ExtendedRateLimiter extends RateLimiter {
  checkOnly(key, config): Promise<RateLimitResult>;  // read-only
  increment(key, config): Promise<void>;
}

interface RateLimiterLogger { warn, error }  // structurally compatible with @xivdyetools/logger
interface MemoryRateLimiterOptions { maxEntries?, cleanupInterval? }
interface KVRateLimiterOptions { kv, keyPrefix?, maxRetries?, ttlBuffer?, logger? }
interface UpstashRateLimiterOptions { url, token, keyPrefix?, logger? }
```

### Backends

```typescript
class MemoryRateLimiter  implements RateLimiter         { /* default 10_000 entries, cleanup every 100 reqs */ }
class KVRateLimiter      implements ExtendedRateLimiter { /* prefix 'ratelimit:', 3 retries, 60s TTL buffer */ }
class UpstashRateLimiter implements RateLimiter         { /* Lua script for atomic increments */ }
```

### Utilities

```typescript
interface GetClientIpOptions { trustXForwardedFor?: boolean }  // default false
function getClientIp(request: Request, options?): string;  // 'unknown' fallback, lowercased
function getRateLimitHeaders(result): Record<string, string>;  // X-RateLimit-* + Retry-After
function formatRateLimitMessage(result): string;
```

### Presets

```typescript
const OAUTH_LIMITS;            // /auth/discord 10/min, /auth/callback 20/min, /auth/refresh 30/min
function getOAuthLimit(path: string): RateLimitConfig;

const DISCORD_COMMAND_LIMITS;  // match_image 5/min, harmony 15/min, dye 20/min, about 30/min, etc.
function getDiscordCommandLimit(commandName: string): RateLimitConfig;

const MODERATION_LIMITS;       // command 20/min+5 burst, autocomplete 60/min+10 burst
const PUBLIC_API_LIMITS;       // default 100/min, write 30/min
const UNIVERSALIS_PROXY_LIMITS;// default 100/min
```

## Key Patterns

### Sliding window algorithm

`MemoryRateLimiter.check()` keeps an array of request timestamps per key. On each call:

1. Filter timestamps to those within `now - windowMs`
2. Compare count against `maxRequests + burstAllowance`
3. If allowed, append `now` to the array
4. `resetAt` = oldest-in-window + `windowMs` (or `now + windowMs` if empty)

This is a true sliding window — not a fixed-bucket counter — so a burst at the end of one window plus another at the start of the next still respects the rate.

### Backend selection

| Backend  | Use when |
|----------|----------|
| `MemoryRateLimiter`  | Per-isolate is acceptable (single-region small workers, dev) |
| `KVRateLimiter`      | Distributed across isolates, can tolerate ~eventual consistency, no extra services |
| `UpstashRateLimiter` | Need true atomic increments (high-contention endpoints, multi-region writes) |

The `KVRateLimiter` is **best-effort** (BUG-022/OPT-002, 2026-07-19): KV cannot do atomic read-modify-write, so `increment()` is a plain read→compute→put and concurrent increments can lose updates (limit exceeded by ~concurrency factor). `maxRetries` (default 3) applies only to *thrown* KV errors. After exhausted retries it fails open — the request is allowed and `result.backendError = true` so middleware can warn. For strict limits use Upstash INCR or a Durable Object.

### Key namespacing

KV and Upstash both prepend a `keyPrefix` (default `'ratelimit:'`) to the user-supplied key. When multiple rate-limit policies share the same backend, set distinct prefixes to avoid collisions:

```typescript
new KVRateLimiter({ kv: env.RATE_LIMIT, keyPrefix: 'oauth:ip:' });
new KVRateLimiter({ kv: env.RATE_LIMIT, keyPrefix: 'oauth:user:' });
```

### LRU eviction (PRESETS-BUG-001)

`MemoryRateLimiter` runs cleanup every `cleanupInterval` requests (default 100), removing entries with all-expired timestamps. If the map still exceeds `maxEntries` (default 10_000), `pruneOldestEntries()` sorts entries by last-activity timestamp and drops the oldest 20% — this prevents unbounded memory growth under attack.

### IP extraction security (FINDING-006, SEC-002)

`getClientIp` prefers `CF-Connecting-IP` (set by Cloudflare's edge, unspoofable) and **ignores** `X-Forwarded-For` by default. `X-Forwarded-For` is client-controlled — trusting it without an upstream that scrubs it lets attackers send a fresh `XFF` per request and get unlimited quota. Set `{ trustXForwardedFor: true }` only when your infrastructure overwrites the header before it reaches the worker.

All returned IPs are lowercased for IPv6 case-insensitivity (RFC 5952).

### Fail-open vs fail-closed

`RateLimitConfig.failOpen` (or middleware-level `onError: 'fail-open' | 'fail-closed'` in `@xivdyetools/worker-middleware`) controls behavior when the backend errors. Default is `fail-open` for availability — the request goes through and `result.backendError = true` so the middleware logs a warning. Use `fail-closed` only on truly sensitive endpoints where blocking is preferable to allowing.

### Optional logger

All three backends accept an optional `logger?: RateLimiterLogger` (structurally compatible with `@xivdyetools/logger`). When provided, the backend logs `warn` on fail-open events and `error` on KV failures after retries.

## Consumers

Grepped from `package.json` files in the monorepo:

- Packages: `@xivdyetools/worker-middleware`
- Apps: `xivdyetools-discord-worker`, `xivdyetools-moderation-worker`, `xivdyetools-presets-api`, `xivdyetools-oauth`, `xivdyetools-api-worker`, `xivdyetools-universalis-proxy`, `xivdyetools-stoat-worker`

Most workers consume this *through* `@xivdyetools/worker-middleware`'s `rateLimitMiddleware` factory rather than constructing backends directly.

## Internal Dependencies

- External: `@upstash/redis` (only used by `UpstashRateLimiter`)
- Optional peer: `@cloudflare/workers-types` (`KVNamespace` and `Request` types)

## Publishing

```bash
# 1. Make changes in packages/rate-limiter/
# 2. Build and test
pnpm turbo run build test --filter=@xivdyetools/rate-limiter

# 3. Bump version in packages/rate-limiter/package.json
# 4. Publish
pnpm --filter @xivdyetools/rate-limiter publish --provenance --access public --no-git-checks
```

`prepublishOnly` runs `clean` then `build` automatically.
