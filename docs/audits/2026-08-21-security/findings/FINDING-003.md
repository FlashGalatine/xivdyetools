# FINDING-003: KV-backed rate limiter cannot throttle a fast client and fails open — effectively no per-IP rate limiting on api-worker `/v1/*`, oauth, moderation-worker

## Severity
**MEDIUM** — the only abuse control on several public endpoints is ineffective against the exact pattern it exists for (one fast client). Reviewer IDs: API-1 (+ PKG-9, PAPI-8, API-7, DW-15, OAUTH-18 as supporting detail). Coordinator-verified in `kv.ts`.

## Category
CWE-770 Allocation of Resources Without Limits or Throttling · CWE-636 Not Failing Securely

## Location
- `packages/worker-kit/src/rate-limiter/backends/kv.ts:193-252` — `increment()` is a read-modify-write `get`→`put` per request; failed `put`s are swallowed after `maxRetries`.
- `packages/worker-kit/src/rate-limiter/backends/kv.ts:161-181` — `check()` fails open on any KV error (`failOpen !== false`).
- Consumers: `apps/api-worker/src/middleware/rate-limit.ts:24-34` (60 + 5 burst / 60 s, `failOpen: true`), `apps/oauth/src/services/rate-limit.ts:55-60` (KV limiter whenever the KV binding is present — i.e. production), `apps/moderation-worker/src/middleware/rate-limit.ts:103`, `apps/discord-worker/src/services/rate-limiter.ts:83` (fallback when Upstash is not configured).
- `packages/worker-kit/src/rate-limiter/ip.ts:53-79` — service-binding callers carry no `CF-Connecting-IP`, so all bot-originated traffic shares one `unknown` bucket (API-7, PAPI-8).

## Description
Cloudflare KV permits **one write per second per key** (further writes fail with 429 — documented). The counter key is `<prefix><ip>|<window>`, so a single client sending >1 req/s makes most `put`s fail; because the failures are swallowed, the counter advances at most ≈1/s ≈ 60 per 60 s window, which never reaches the 65 (60 + 5 burst) threshold. Reads are eventually consistent (~60 s), and any KV error or exhausted daily write quota is treated as "allowed".

## Evidence
```ts
// kv.ts — "plain read-modify-write, honestly best-effort. KV cannot do atomic increments…"
await this.kv.put(kvKey, JSON.stringify(entry), { expirationTtl: ttl });  // 429 beyond 1 write/s/key
…
} catch (error) { /* logged on last attempt; the request was already allowed by check() */ }
```

## Impact
Unlimited request rate against `data.xivdyetools.app/v1/*` (incl. `/v1/chara/resolve`, which fans out to XIVAPI), the oauth token/refresh endpoints (brute-force/abuse protection relies on it), and moderation-worker interactions. Upstream Universalis/XIVAPI quota exhaustion is shared fate for the web app and `/budget`.

## Recommendation
- Replace the KV backend for per-IP limiting with Cloudflare's native **Rate Limiting binding** (`[[ratelimits]]` → `env.LIMITER.limit({ key })`: atomic, per-colo, no KV writes) or a Durable Object counter; keep KV only for coarse, low-frequency quotas (per-user per-day).
- If KV stays: default `failOpen` to `false` on auth endpoints and document the "≈1 increment/s/key" ceiling so limits are chosen with it in mind.
- Forward the real client IP over service bindings (or key bot traffic by Discord user ID rather than IP).

## References
- Cloudflare KV limits ("1 write per second to the same key"); Workers Rate Limiting binding docs
- Evidence: `../evidence/review-api-worker.md` (API-1, API-7), `../evidence/review-packages.md` (PKG-9)

## Status
**FIXED 2026-08-21** — `fix(worker-kit,api-worker,oauth,presets-api,moderation-worker): native rate-limit bindings (FINDING-003)`: `@xivdyetools/worker-kit` 1.1.0 adds `CloudflareRateLimiter` (tiered `[[ratelimits]]` backend); api-worker 0.8.0 (`API_RATE_LIMITER`), presets-api 2.1.0 (`RL_PUBLIC`), oauth 2.7.0 (`RL_AUTH_10/20/30`), moderation-worker 1.5.0 (`RL_COMMAND`/`RL_AUTOCOMPLETE`) use it with KV/memory only as fallbacks; discord-worker warns once when it falls back from Upstash to KV. Residual (documented): counters are per-colo; service-binding callers still share an IP bucket on presets-api (PAPI-8).
