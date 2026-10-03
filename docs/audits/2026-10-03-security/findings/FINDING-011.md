# FINDING-011: PRIVACY.md 'Your IP address' section omits api-worker's per-isolate in-memory MemoryRateLimiter keyed by client IP (universalis/services/rate-limiter.ts)
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** api-worker + web-app · **Rotation:** NONE · **Policy:** AMEND apps/web-app/PRIVACY.md §Your IP address, and what the servers log — variants: `apps/web-app/PRIVACY.md`, `apps/web-app/PRIVACY.ja.md`, `apps/web-app/PRIVACY.ko.md`, `apps/web-app/PRIVACY.zh.md`, `apps/web-app/PRIVACY.de.md`, `apps/web-app/PRIVACY.fr.md` · **CWE:** CWE-1059
**Reconcile case:** 2 (Step 3a) · **Note:** AMEND (new IP use under 'the whole of what we do'), or minimize by moving the universalis proxy to the native limiter.

## Location
- apps/api-worker/src/universalis/services/rate-limiter.ts:46 — module-scope `const limiter = new MemoryRateLimiter();`, a per-isolate counter map keyed by the identifier it is given
- apps/api-worker/src/universalis/router.ts:131-134 — resolveRateLimitScope returns `{ key: clientIP, config }` for every external caller; the limiter is charged on cache miss at :163; the router is mounted publicly at index.ts:185-186 (data.xivdyetools.app and proxy.* custom domains)
- apps/web-app/PRIVACY.md:136-144 — 'here is the whole of what we do with it' names only Cloudflare's rate-limiting service and the KV fallback (120 s)

## Evidence
- router.ts:131-134: `const clientIP = getClientIp(request); if (clientIP !== 'unknown') { return { key: clientIP, config }; }`
- PRIVACY.md:139-143: 'The counting is done by Cloudflare's own rate-limiting service ... There is a fallback path ... keeps a counter in Cloudflare KV ... for 120 seconds.' The in-memory path is not mentioned anywhere in the file (grep for memory/isolate finds only the image-handling text at :17).
- Route is reachable without login: web-app 'Show Prices' -> GET data.xivdyetools.app/universalis/aggregated/:dc/:ids (PRIVACY.md:61-63 lists that call but not the per-IP counting)

## Fix
- Minimize (no policy edit): rate-limit the market proxy through the same native Cloudflare binding the /v1 API uses, so the existing "Cloudflare's own rate-limiting service" sentence becomes true for every route; drop the module-scope `MemoryRateLimiter`.
- Or AMEND the Abuse-prevention bullet (six files, bump `Last updated`): the market-price proxy also counts requests per IP in the serving instance's memory for one 60-second window, never written to storage and gone when the instance recycles — a new statement under a section that calls itself "the whole of what we do with it".

## Status
OPEN
