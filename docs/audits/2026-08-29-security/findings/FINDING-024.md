# FINDING-024: og-worker `/og/*` edge-cache key is the full request URL — any unknown query parameter is a cache miss and a full resvg render, with no worker-side limiter (WAF rule still an unchecked dashboard item)
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** og-worker · **Rotation:** NONE · **CWE:** CWE-770
Residual of `2026-08-21-security/FINDING-005` (OG-4).

## Location
- `apps/og-worker/src/index.ts:182` — `const cacheKey = new Request(c.req.url, { method: 'GET' })`
- `docs/operations/POST_MERGE_CHECKLIST.md:342` — the OG-4 WAF rate rule is still unticked

## Evidence
- `GET /og/harmony/FF0000?x=1`, `?x=2`, … — every variant misses `caches.default` and renders (CPU-bound; fonts + resvg), so one client turns the cache into a no-op. Param validation and the linear wrap (FINDING-005) keep each render bounded; the count is not.

## Fix
- Canonicalise the cache key from the validated params only (tool, colours, `lang`, `frame`, `algo`) and 404 or 301 unknown params; or add a `[[ratelimits]]` binding to `/og/*`.

## Status
OPEN
