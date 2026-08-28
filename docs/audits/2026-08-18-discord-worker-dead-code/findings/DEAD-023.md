# [DEAD-023]: worker-kit — dead `formatRateLimitMessage`, `MODERATION_LIMITS` (re-declared inline by moderation-worker), `UNIVERSALIS_PROXY_LIMITS`, `EndpointRateLimitConfig`

## Category
Unused Export (DEAD / DUPLICATE)

## Location
- `packages/worker-kit/src/rate-limiter/headers.ts:66-81` — `formatRateLimitMessage` (16 lines + ~40 test). Zero callers. discord-worker's same-named `services/rate-limiter.ts:202` is a *different* message (Discord markdown, "You're using this command too quickly") — not a drop-in duplicate, so both cannot simply merge
- `packages/worker-kit/src/rate-limiter/presets/configs.ts:130-145` — `MODERATION_LIMITS` (25 lines + configs.test.ts). `apps/moderation-worker/src/middleware/rate-limit.ts:69` defines its own `RATE_LIMIT_CONFIGS` with the same numbers (20+5 / 60+10) in a `requestsPerMinute` shape — the shared preset was never adopted
- `configs.ts:170-173` — `UNIVERSALIS_PROXY_LIMITS` (8 lines + tests). api-worker's universalis router builds its config from env (`RATE_LIMIT_REQUESTS`)
- `packages/worker-kit/src/rate-limiter/types.ts:81-84` — `EndpointRateLimitConfig` (10 lines) — never referenced anywhere, incl. inside the package
- **KEEP**: `OAUTH_LIMITS`, `DISCORD_COMMAND_LIMITS` (consumed via `getOAuthLimit`/`getDiscordCommandLimit`), all option/ctor types, `MemoryRateLimiter` (3 production imports), `rateLimitMiddleware` (2), the `/middleware` and `/rate-limiter/{memory,kv,upstash,presets}` subpaths (DEPRECATIONS.md: preserved for the rate-limiter migration — package.json only)

## Evidence
`git grep -nw formatRateLimitMessage` outside worker-kit → discord-worker's own function only. `git grep -nw MODERATION_LIMITS|UNIVERSALIS_PROXY_LIMITS|EndpointRateLimitConfig` outside worker-kit → 0. README documents `formatRateLimitMessage`.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW; npm-published (semver-minor for hypothetical external consumers) |
| **Reversibility** | EASY |

## Recommendation
**REMOVE WITH CAUTION** `formatRateLimitMessage`, `UNIVERSALIS_PROXY_LIMITS`, `EndpointRateLimitConfig`; for `MODERATION_LIMITS` prefer **adopt** (make moderation-worker import the preset via a `getModerationLimit` helper) over delete — it is the reason the preset exists.
