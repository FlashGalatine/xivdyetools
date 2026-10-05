# Review: contract-universalis-limiter (PR #229, api-worker Universalis proxy native rate limiting)

## Map

End-to-end flow (GET `/universalis/aggregated/:dc/:ids` and the `/api/v2` alias, `apps/api-worker/src/index.ts:185-186`):
1. `resolveRateLimitScope` (`src/universalis/router.ts:135-152`): `getClientIp` (worker-kit `ip.ts:52`) reads only `CF-Connecting-IP` (XFF off by default). Present -> scope `ip`, key = lowercased IP, budget `RATE_LIMIT_REQUESTS` (`parseInt || 60`). Absent ("unknown") -> scope `service`, key `svc:universalis`, budget x20.
2. `selectProxyRateLimiter` (`src/universalis/services/rate-limiter.ts:61-90`), built per request before any validation: binding truthy -> `CloudflareRateLimiter` with ONE tier `{limit: maxRequests, period: windowSeconds===10?10:60}`; binding absent -> `KVRateLimiter` on `env.RATE_LIMIT`. Prefixes `universalis:ip:` / `universalis:svc:`.
3. Charged only from `cachedFetch`'s `onMiss` (`cached-fetch.ts:100`), after the Cache API lookup. Stale hits revalidate in the background uncharged (`cached-fetch.ts:79`).
4. `checkRateLimit` always passes `failOpen: true`. Binding key = `prefix + key + ":t<limit>_<period>"` (worker-kit `backends/cloudflare.ts` `check`). Denied -> 429, `Retry-After` from `retryAfter` (epoch-aligned period end).

Deploy states (`apps/api-worker/wrangler.toml`):

| State | ip binding | svc binding | vars |
|---|---|---|---|
| top-level (`-dev`, no routes) | UNIVERSALIS_RATE_LIMITER ns 1008, 60/60 (:75-78) | UNIVERSALIS_SERVICE_RATE_LIMITER ns 1010, 1200/60 (:82-85) | RATE_LIMIT_REQUESTS=60, WINDOW=60 (:40-41) |
| `--env production` | ns 1007, 30/60 (:152-155) | ns 1009, 600/60 (:157-160) | 30 / 60 (:113) |

Namespace ids are unique across the account (api-worker 1001-1010, discord 1041-56, moderation 1031-34, oauth 1021-26, presets 1011-12). `tests/wrangler-config.test.ts:99-127` pins binding limit = vars (x20 for service) per env.
Missing binding in either state: silent fall back to KV (best-effort; worker-kit's own FINDING-003 note says KV cannot throttle a fast client), no log. A bound-but-uncallable value: constructor throws -> 500.
Service-binding caller: discord-worker `universalis-client.ts:126` builds `new Request('https://internal...')` with no CF-Connecting-IP, so it lands in scope `service`. Same detection as `/v1` (`middleware/rate-limit.ts:76`).

## Candidates

### contract-universalis-limiter-01 (BUG, MEDIUM) per-address keying lets an IPv6 client rotate buckets
- `apps/api-worker/src/universalis/router.ts:140` (key = `getClientIp`), `packages/worker-kit/src/rate-limiter/ip.ts:81-83` (no prefix truncation).
- Failing input: one client holding an IPv6 /64 sends cache-missing requests (`/aggregated/Crystal/<varying ids>`) from many addresses in the block. Each address gets a fresh 30/60 s binding key.
- Wrong outcome: the per-client cache-miss budget, the only upstream brake (hits are free, misses are the attack), is unbounded for IPv6 clients; fan-out to universalis.app.
- Tests miss it: every test uses IPv4 `203.0.113.9` (`router.test.ts:173`). Covered: no. Origin: MAIN (key derivation), carried by PR-#229.
- Excerpt: `return { key: clientIP, scope: 'ip', config };`
- Fix direction: collapse IPv6 to its /64 before keying (Universalis scope or an option on `getClientIp`); add a two-addresses-one-/64 test.

### contract-universalis-limiter-02 (UNTESTED, LOW) the x20 service multiplier can drift from the binding with no failing test
- `router.ts:125` (`SERVICE_BINDING_BUDGET_MULTIPLIER = 20`, not exported) vs `tests/wrangler-config.test.ts:90` (its own copy of 20) and `router.test.ts:291-309`.
- On the binding path `config.maxRequests` only feeds the tier's reported `limit` (a single tier is chosen regardless, worker-kit `cloudflare.ts` `selectTier`), so the real ceiling is whatever the toml says. The "still bounds service-binding traffic at 20x" test takes its 20 from `fakeBinding(20)` (a literal in the test); changing the router constant to 1 or 100 still passes. The wrangler test checks the toml against its OWN constant, not the router's.
- Wrong outcome if drifted: `X-RateLimit-Limit` on service 429s lies, and the KV fallback budget silently differs from the binding's.
- Covered: no. Origin: PR-#229. Fix direction: export the constant and assert the toml, the 429 header (600) and the KV budget against it.

### contract-universalis-limiter-03 (BUG, LOW) "misnamed binding -> 500" only holds for a wrong-kind value; a typo'd name silently falls back to KV
- `rate-limiter.ts:46-49,67-69` and comment `:52-53`; test `router.test.ts:374-383`.
- Input: a wrangler name typo -> `env.UNIVERSALIS_RATE_LIMITER` is `undefined` -> `if (binding)` false -> `KVRateLimiter`, no throw, no log. The test injects `{}` (declared but uncallable), a different failure, so the typo case is untested.
- Wrong outcome: production silently runs on best-effort KV and the FINDING-011 fix is a no-op with no signal. Partly defended by the wrangler-config test pinning the toml blocks.
- Covered: no (for the typo). Origin: PR-#229. Fix direction: in production log a warn (or fail) when a binding is absent; correct the comment/test title.

### contract-universalis-limiter-04 (BUG, LOW) beta/dev discord-worker draws on the PRODUCTION api-worker's service bucket
- `apps/discord-worker/wrangler.toml:33-35`: the top-level (beta) `UNIVERSALIS_PROXY` binds `service = "xivdyetools-api-worker"` (production); the `-dev` api-worker has `workers_dev=false` and no routes, so its ns-1010 bucket is only reachable locally.
- Wrong outcome: beta `/budget` traffic consumes prod's 600/60 s ns-1009 budget and prod cache; a beta load test can 429 production `/budget`.
- Origin: MAIN. Possibly intentional; verify intent. Fix direction: document in DEPLOY_ENVIRONMENTS.md or cap beta separately.

## POSITIVE
- Binding limits, periods and the x20 relationship match per environment (ns 1007/1009 prod 30/600, 1008/1010 dev 60/1200); ids unique account-wide; wrangler test parses each env's own vars.
- Single tier plus `periodSeconds` is consistent with `selectTier`; the `maxRequests`-ignored behaviour is acknowledged and pinned.
- Service-scope detection matches `/v1`; discord-worker really sends no CF-Connecting-IP.
- Charge-on-miss, limiter built outside `onMiss`, fail-open logs a `keyScope` not the IP (`router.test.ts:361`).
- Key suffix `:t<limit>_<period>` keeps tiers from sharing a counter.

## REJECTED
- Stale-while-revalidate bypassing the limiter (`cached-fetch.ts:79`): only already-cached (already charged) keys refresh, once per stale window; bounded.
- Public caller forging the service scope by omitting CF-Connecting-IP: Cloudflare sets it on every external request; XFF untrusted by default (`ip.ts:62`).
- Retry-After accuracy: epoch-aligned `periodEnd` vs undocumented binding window alignment; cannot make it fail from code.
- Windows other than 10/60: wrangler test enforces [10,60].
- `parseInt(...)||60` on a bad var: falls to 60, but prod vars are pinned to 30 by test.
- Namespace-id collisions across workers: checked, none.

## COVERED (13 files)
api-worker: src/universalis/router.ts, services/rate-limiter.ts, services/cached-fetch.ts, router.test.ts (165-390), services/rate-limiter.test.ts (outline), src/middleware/rate-limit.ts (outline), src/index.ts (mounts), tests/wrangler-config.test.ts, wrangler.toml; worker-kit: rate-limiter/backends/cloudflare.ts, ip.ts, backends/kv.ts (head); discord-worker: services/budget/universalis-client.ts, wrangler.toml (binding blocks).
