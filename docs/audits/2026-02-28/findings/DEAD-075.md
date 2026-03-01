# DEAD-075: @xivdyetools/rate-limiter — 14 Unused Exported Symbols

## Category
Unused Exports

## Location
- File(s): `packages/rate-limiter/src/index.ts`, `packages/rate-limiter/src/types.ts`, `packages/rate-limiter/src/headers.ts`, `packages/rate-limiter/src/presets/configs.ts`
- Symbol(s): See table below

## Evidence
Cross-referenced every import of `@xivdyetools/rate-limiter` across the monorepo:

**Consumed (9):** `MemoryRateLimiter`, `KVRateLimiter`, `UpstashRateLimiter`, `getClientIp`, `RateLimitConfig`, `RateLimiter`, `OAUTH_LIMITS`, `PUBLIC_API_LIMITS`, `getDiscordCommandLimit`

**Unconsumed (14):**
| Symbol | Type | Notes |
|--------|------|-------|
| `RateLimitResult` | interface | Return type of `check()` — consumers infer it |
| `EndpointRateLimitConfig` | interface | Extended config type — unused |
| `ExtendedRateLimiter` | interface | Extended interface with `checkOnly`/`increment` — unused |
| `MemoryRateLimiterOptions` | interface | Options type — consumers use inline objects |
| `KVRateLimiterOptions` | interface | Options type — consumers use inline objects |
| `UpstashRateLimiterOptions` | interface | Options type — consumers use inline objects |
| `RateLimiterLogger` | interface | Logger protocol type — unused |
| `GetClientIpOptions` | interface | Options for `getClientIp` — consumers use defaults |
| `getRateLimitHeaders` | function | Returns rate-limit response headers — consumers build their own |
| `formatRateLimitMessage` | function | Human-readable rate limit message — unused |
| `getOAuthLimit` | function | Get limit config by path — oauth uses `OAUTH_LIMITS` directly |
| `DISCORD_COMMAND_LIMITS` | const | Raw limits object — discord-worker uses `getDiscordCommandLimit()` |
| `MODERATION_LIMITS` | const | Moderation limits — moderation-worker uses `KVRateLimiter` with inline config |
| `UNIVERSALIS_PROXY_LIMITS` | const | Proxy limits — universalis-proxy uses `MemoryRateLimiter` with inline config |

Consumers found:
- `apps/universalis-proxy/src/services/rate-limiter.ts` → `MemoryRateLimiter`
- `apps/presets-api/src/services/rate-limit-service.ts` → `MemoryRateLimiter`, `getClientIp`, `PUBLIC_API_LIMITS`
- `apps/moderation-worker/src/middleware/rate-limit.ts` → `KVRateLimiter`
- `apps/oauth/src/services/rate-limit.ts` → `MemoryRateLimiter`, `getClientIp`, `OAUTH_LIMITS`, `RateLimitConfig`
- `apps/discord-worker/src/services/rate-limiter.ts` → `UpstashRateLimiter`, `KVRateLimiter`, `RateLimiter`, `getDiscordCommandLimit`

## Why It Exists
The rate-limiter package is designed as a standalone, reusable library. The types expose the full API contract, and the helper functions (`getRateLimitHeaders`, `formatRateLimitMessage`) provide convenience for standard rate-limit response patterns.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM for functions, LOW for types — types are part of the API contract |
| **Blast Radius** | LOW — removing from barrel only |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Possible: the preset constants may be consumed when new apps adopt the rate-limiter |

## Recommendation
**KEEP** — Intentional public API surface

### Rationale
- This is a reusable library; its types and utilities form a coherent API
- `getRateLimitHeaders` and `formatRateLimitMessage` are standard rate-limit patterns that apps *should* adopt
- The preset constants (`MODERATION_LIMITS`, `UNIVERSALIS_PROXY_LIMITS`) may not be directly imported but represent the **intended** configuration — apps may be using inline copies
- `RateLimitResult`, `RateLimitConfig`, and options types are structurally essential to the class APIs
- Total package is ~1,200 source lines — manageable and well-tested
- Consider filing a cleanup task to have `moderation-worker` and `universalis-proxy` import their preset constants instead of inlining
