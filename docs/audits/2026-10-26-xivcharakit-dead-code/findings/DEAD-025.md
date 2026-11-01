# DEAD-025: Chara row cache's stale-while-revalidate window never revalidates
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** api-worker · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/api-worker/src/chara/cache.ts:20-25,55-64,78-82`
- `apps/api-worker/src/universalis/services/cache-service.ts:130-158,179-182`
- `apps/api-worker/docs/reference/chara.md:82`

## Evidence
- git grep -n -w isStale -- apps/api-worker: only universalis/* (router.ts, cached-fetch.ts, cache-service.ts, types.ts); none in src/chara, so true: getRows/getGlasses (cache.ts:60-64,79-82) treat stale entries as hits, X-Cache HIT (router.ts:280), and retention is about 8 days. But swrWindow is still read: cache-service.ts:135 (age <= ttl+swrWindow) and :179 (max-age=ttl+swr). Setting it to 0 alone would cut retention to 7 days. Serving stale rows without refresh is intended and documented: cache.ts:55 says "(fresh or stale)", chara.md:82 says "one-day stale-serving headroom; no background row refresh", overview.md:68 says the same. CLAUDE.md:198's "Row staleness behavior is unchanged" is accurate. Only the cache.ts:20 comment's "stale-while-revalidate" is misleading.
- The facts check out: CharaRowCache never reads isStale, so nothing revalidates and a stale row comes back as a HIT for up to 8 days. But this is not dead code. swrWindow is live config that sets the extra retention day, and both the public docs and the code docstring describe this stale-serving, no-refresh behavior on purpose. The cascade the reviewer cites (CLAUDE.md:198) is accurate, not stale. The only defect is the one-line comment at cache.ts:20 that says "stale-while-revalidate". Real SWR (background refresh) or a strict 7-day TTL would be a behavior change, and that is the maintainer's call, not a cleanup. Revisit trigger: the next change to CHARA_CACHE_CONFIG or CHARA_ROW_SHAPE_VERSION, or a report of stale item names after a patch that the game-version namespace (BUG-040) did not catch.
- Refuter (PARTIAL verdict): The claim of no revalidation is true, but this is not dead code. The window is load-bearing, because it sets eviction (cache-service.ts:135) and the stored max-age (:179). The 8-day stale-serving behavior is also stated in the public developer docs (chara.md:82). So of the reviewer's two fixes, swrWindow 0 without moving the day into cacheTtl, or isStale as a miss, would silently cut retention to 7 days and contradict the documented contract. The only defect is the misleading 'stale-while-revalidate' comment at cache.ts:20.
- Still live: apps/api-worker/src/universalis/services/cache-service.ts:135 and :179 read swrWindow from CHARA_CACHE_CONFIG through CharaRowCache.storeRows and storeGlasses (cache.ts:74, 89), and the 1-day stale-serving window is documented at apps/api-worker/docs/reference/chara.md:82.

## Fix
- **KEEP** — revisit trigger: The next change to CHARA_CACHE_CONFIG or CHARA_ROW_SHAPE_VERSION, a maintainer decision to add real background revalidation or a strict 7-day TTL, or a report of stale item names that outlived a game patch.
- Cascade: None for removal. Comment-only correction at apps/api-worker/src/chara/cache.ts:20. apps/api-worker/CLAUDE.md:198 needs no change: "Row staleness behavior is unchanged" is accurate. CHANGELOG lines 163 and 706 ("1 d SWR") are historical release notes, so leave them as they are.

## Status
OPEN
