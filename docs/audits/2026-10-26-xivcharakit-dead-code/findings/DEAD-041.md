# DEAD-041: Empty-lookup guards in searchItems and loadRows are reached only by tests
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** api-worker (0.21.0, unpublished app) · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/api-worker/src/chara/xivapi.ts:418`
- `apps/api-worker/src/chara/lookup-loader.ts:69-70`

## Evidence
- git grep -n -w -e searchItems -e loadRows: the only production callers are router.ts:225 (`misses.length > 0 ? loader.loadRows(misses) : null`) and lookup-loader.ts:55 (fetchRows -> searchItems). fetchRows only ever gets the deduped `lookups` list, which is non-empty whenever misses is, or `owned`, which is behind `owned.length > 0` at :86. So neither guard can fire in production. Only lookup-loader.test.ts:115 and xivapi.test.ts:434 reach them. Without the guard, buildResolveQuery([]) (xivapi.ts:104-113) returns `+()` and searchItems would send that malformed query to XIVAPI, spending shared upstream budget. Each guard is 1-2 lines.
- The claim is accurate: the guards are unreachable from production today because router.ts:225 and the loader's own dedupe and owned-length checks already prevent an empty call. They still belong. They are 3 lines in total, they protect public methods of an exported class from sending a malformed `+()` search upstream, and they make the router's guard a convenience rather than the only thing standing in the way. Removing them saves almost nothing and adds risk.

## Fix
- **KEEP** — revisit trigger: Re-check when either of these happens. (1) router.ts drops its `misses.length > 0` check at line 225: the loadRows guard then becomes the live path and must stay. (2) A caller other than lookup-loader.ts:55 starts calling searchItems, or one other than router.ts:225 starts calling loadRows (`git grep -n -w -e searchItems -e loadRows apps/api-worker/src ':!*.test.ts'` shows mor…
- Cascade: Removing them would also remove the empty-set tests at xivapi.test.ts:430-441 and lookup-loader.test.ts:115.

## Status
OPEN
