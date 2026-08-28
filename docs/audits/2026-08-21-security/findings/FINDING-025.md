# FINDING-025: api-worker hardening — body buffered before the 8 KB cap, icon cache-key aliasing, truncated XIVAPI batches cached for 8 days, routeless dev worker on workers.dev with stack traces

## Severity
**LOW** — resource/cache-efficiency and information-disclosure nits on a public, unauthenticated API; no SSRF, open proxy or cache-poisoning primitive was found. Reviewer IDs: API-2, API-3, API-4, API-5, API-8, API-12, INF-12.

## Category
CWE-400 · CWE-209 Generation of Error Message Containing Sensitive Information

## Location
- `apps/api-worker/src/chara/router.ts:140-155` — `raw.text()` before the 8 KB check (omit `Content-Length` → up to ~100 MB buffered).
- `apps/api-worker/src/chara/router.ts:240-245` + `lib/validation.ts:145` — icon edge-cache key is the raw path; lenient `parseInt` (`41716abc`, `041716`) creates unbounded aliases → 1:1 XIVAPI fetch per request; `:277-283` — upstream `Content-Type` reflected and any 2xx cached 30 d.
- `apps/api-worker/src/chara/xivapi.ts:34, 112, 207-219` + `router.ts:198-202` — single `limit=500` search, `next` ignored → truncated groups cached as partial for ~8 days (PLAUSIBLE).
- `apps/api-worker/wrangler.toml:6-30` + `src/index.ts:191-193` — top-level `-dev` worker has no routes and no `workers_dev` key (implicitly enabled) with `ENVIRONMENT=development`, where 500s include `err.message` + `stack` (only matters if the dev worker is ever deployed).
- `apps/api-worker/src/universalis/router.ts:186-192, 214-220` — upstream `statusText` / raw `Error.message` echoed.

## Recommendation
Check `Content-Length` and stream-limit the body; canonicalise the icon id (`/^\d{1,6}$/`) before keying the cache and pin `image/png`; page through `next` or cap the batch; set `workers_dev = false` on the dev block; generic error messages outside `development`.

## References
- Evidence: `../evidence/review-api-worker.md` (API-2..5, API-8, API-12), `../evidence/review-infra-stoat.md` (INF-12)

## Status
**FIXED 2026-08-21** (api-worker 0.8.0)
- api-worker 0.8.0: API-2 streamed 8 KB body cap (`lib/bounded-body.ts`); API-3 truncated XIVAPI pages not cached; API-4 `iconId` shape-validated + cache key rebuilt; API-12 icon proxy 1 MB cap, PNG-signature check, pinned `image/png` + sandbox CSP; API-5/INF-12 `workers_dev=false` + `preview_urls=false`, no `stack` in any env; API-7 proxy limiter charged on cache misses only; API-8 constant error messages; API-9 `redirect:'error'` + 10 s timeout upstream; API-10 docs-host security headers; API-11 dead `ALLOWED_ORIGINS` / `X-API-Key` removed; API-13 `q` ≤ 100, `page` ≤ 1000, finite floats, `no-store` on ≥ 400. Not done: API-6 second-tier limiter (policy), API-7 discord-worker per-user key forwarding.
