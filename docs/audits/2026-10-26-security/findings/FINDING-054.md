# FINDING-054: A stale api-worker dev script (deployed 2026-08-10) is still public on workers.dev; the repo's `workers_dev = false` pin never reached the live script
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** api-worker (live script `xivdyetools-api-worker-dev`) · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-489
**Supersedes:** 2026-08-21-security/FINDING-025 (its `workers_dev = false` half — marked FIXED in the repo, config-only on the live account until now) · **Found by:** the live-state pass (read-only Cloudflare query) and an independent Opus verifier

## Location
- `apps/api-worker/wrangler.toml:18-19` — `workers_dev = false`, `preview_urls = false` (pin landed in `6e23014d`, 2026-08-21)
- `docs/operations/OPEN_ITEMS.md:74-75` — the open box "dev workers are not reachable over `*.workers.dev` … confirm once in the dashboard"
- Live: worker `xivdyetools-api-worker-dev`, `modified_on` 2026-08-10, `workers.dev` subdomain **enabled**, previews enabled

## Evidence
- Cloudflare API 2026-10-26 ([evidence](../evidence/live-state-cloudflare-2026-10-26.md)): subdomain `{enabled: true, previews_enabled: true}`; bindings are KV `RATE_LIMIT` plus plain vars only (no native limiters, no chara or telemetry bindings), so the build predates every later api-worker fix. `HEAD https://xivdyetools-api-worker-dev.<account>.workers.dev/` → **200 JSON**, `X-API-Version: v1` ([capture](../evidence/live-headers-http-and-retired.txt)). The sibling `presets-api-dev` and `discord-worker-dev` hosts answer 404; `og-worker-dev` has workers.dev off.
- Wrangler applies `workers_dev` only when that script is deployed; the dev script has not been deployed since 2026-08-10 and nothing binds it, so the pin stayed config-only. The 2026-08-29 review read the config as "test-guarded".
- Reach: any unauthenticated client that knows the account subdomain, which appears in a tracked historical document (`docs/historical/20251214-CodeAudit/09-SHARED-PACKAGES-TODO.md`). The old build runs `ENVIRONMENT=development`: an unhandled throw returns `err.message` plus `stack` (`src/index.ts:156-187` at `7c5edce6`), it relays Universalis on `/universalis` and `/api/v2` with CORS `*`, a per-isolate limiter and raw upstream error text. No secrets and no user data are reachable, so the effect is a second, weaker Universalis/XIVAPI relay and path disclosure.

## Fix
- Delete the script (`wrangler delete --name xivdyetools-api-worker-dev`, or in the dashboard); nothing binds it. Alternative: a bare `pnpm --filter xivdyetools-api-worker run deploy` so wrangler applies the two pins.
- Tick `OPEN_ITEMS.md:74-75` with the HEAD probe as evidence, and add a `*.workers.dev` reachability probe for every worker name to the live-origin checklist: the same drift can hide on any worker whose last deploy predates its pin.

## Status
OPEN
