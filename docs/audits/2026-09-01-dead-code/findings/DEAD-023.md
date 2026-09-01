# DEAD-023: api-worker `CacheService.deleteAsync` / `.deleteEntry` — the cache-invalidation pair has no production caller — 18 lines

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/api-worker · **Semver:** NONE (app-internal) · **Category:** Unused Export (test-only class members)

## Location
- `apps/api-worker/src/universalis/services/cache-service.ts:146-155` `deleteEntry`, `:157-164` `deleteAsync`

## Evidence
- `evidence/members.txt` (`members.py … CacheService`): `deleteAsync extSrc=0 unitSrc=0 unitTest=2`, `deleteEntry` reached only from `deleteAsync` at `:162`.
- `git ls-files apps/api-worker | grep -v test | xargs grep -n '\.deleteAsync\|\.deleteEntry'` → the only hits are that internal `:162` call. The live write path is `storeAsync`, called four times (`chara/cache.ts:67,82`, `cached-fetch.ts:121,222`).
- Same survey shows `store` is public but called only by `storeAsync` (`:142`) — an encapsulation nit, not dead code; note it, do not file it.

## Fix
**REMOVE** both methods and the two test cases that only exercise them. If cache invalidation is *wanted* (a stale Universalis or chara entry has no eviction path today other than TTL), that is a product gap to file separately — do not keep an unused method as a placeholder for it.
Gate: `pnpm turbo run build type-check lint test --filter=xivdyetools-api-worker`.

## Status
FIXED 2026-09-01 `2fd2c2a7` — both methods and their two tests removed.

