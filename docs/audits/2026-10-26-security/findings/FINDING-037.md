# FINDING-037: presets-api GET /api/v1/presets `page` has no upper bound: Infinity / >int64 OFFSET reaches the D1 bind
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** n/a

## Location
- `apps/presets-api/src/handlers/presets.ts:249` — presets-api GET /api/v1/presets `page` has no upper bound: Infinity / >int64 OFFSET reaches the D1 bind

## Evidence
- presets.ts:249 `page: Math.max(1, Number.parseInt(page ?? '', 10) || 1),`; preset-service.ts:282 `const offset = (page - 1) * limit;` :288 `LIMIT ? OFFSET ?` :293 `.bind(...params, limit, offset)`; node probe: 400x'9' -> Infinity Infinity; '1e20' -> 1 0; '100000000000000000000' -> 1e20 2e+21
- Reach: Any anonymous client sends GET https://api.xivdyetools.app/api/v1/presets?page=<21+ digits, or 400 nines>. The handler clamps `page` from below only (presets.ts:249), and getPresets computes offset=(page-1)*limit and binds it as `LIMIT ? OFFSET ?` (preset-service.ts:282-293).
- The probe confirms that 400 nines parse to Infinity, giving offset Infinity, and that 21 digits give a 2e21 offset, which does not fit in int64. One sub-claim is wrong: `?page=1e20` parses to 1, because parseInt stops at 'e', so the literal digits are needed. The worst case is a 500 on the caller's own request, which the global onError (index.ts:278-298) returns without internal detail in production; no data is exposed, the per-IP limiter still applies, and an in-range large page only returns an empty page plus one extra COUNT query (preset-service.ts:303-309). Preconditions: None beyond reaching the public endpoint. This review could not run D1, so it is not confirmed whether D1 rejects an Infinity or non-int64 bind with an error (500) or coerces it; in either case only the requester's own response is affected.
- Live state the repo cannot show: How production D1 handles an Infinity or out-of-int64 REAL bind in LIMIT/OFFSET (an error or a coercion).

## Fix
- Cap page with an upper bound (e.g. Math.min(..., MAX_PAGE=1000)) as api-worker does with parseIntParam/MAX_PAGE (routes/dyes.ts:47,289), or reject non-finite/huge values with a 400 validation error; add a test for ?page=<400 nines>.

## Status
OPEN — source prepared in A-PRESETS: bounded pagination before offset arithmetic; [presets evidence](../evidence/remediation-presets-2026-10-27.md). Merge and production acceptance remain pending.
