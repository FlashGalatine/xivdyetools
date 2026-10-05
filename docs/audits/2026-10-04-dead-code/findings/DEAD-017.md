# DEAD-017: WorldService: 6 test-only lookup methods + orphaned worldByName map — 57 src lines + ~100 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/web-app/src/services/world-service.ts:122` — WorldServiceClass.getWorldById/getWorldByName/getDataCenter/getDataCenterForWorld/isDataCenter/isWorld (getAllWorlds excluded)

## Evidence
- Applies to 6 methods, which only world-service.test.ts calls; production uses getWorldName/getAllDataCenters/getWorldsInDataCenter/initialize/isInitialized. getAllWorlds is not included: it reads this.worlds (live state) and is the init/reset observation for 6 assertions.
  - Commands: git grep -n -w -E 'getWorldById|getWorldByName|getDataCenter|getDataCenterForWorld|isDataCenter|isWorld' -- . : non-test hits only world-service.ts declarations; git grep 'WorldService(\.|\[)' non-test: getWorldName (4 sites), getAllDataCenters/getWorldsInDataCenter market-board.ts:250,269, initialize, isInitialized
- Origin: world-service.ts unchanged between 8ecb878f and HEAD; the same declaration-only hits exist at 8ecb878f.

## Fix
**REMOVE.** Keep getAllWorlds, or delete it too only after moving its init/reset assertions (test :71,:95,:104,:258,:264,:286) to getAllDataCenters/getWorldName. Removing getWorldByName+isWorld orphans the worldByName Map.

Steps: In apps/web-app/src/services/world-service.ts delete getWorldById (117-125), getWorldByName (126-134), getDataCenter (146-154), getDataCenterForWorld (176-189), isDataCenter (190-198) and isWorld (199-207). Also delete the worldByName field (27) and its uses at 83, 88 and 219. In world-service.test.ts delete the its at 130-139, 141-149, 167-175 and 197-210, the 'server type checks' describe at 213-247, and the 'edge cases' describe at 290-312. Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app and pnpm dead-code:check.

## Status
OPEN
