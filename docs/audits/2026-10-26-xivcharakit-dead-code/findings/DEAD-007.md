# DEAD-007: The facewear-era `dye.itemID <= 0` guard in the swatch matching loops is always false — ~1 lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** web-app · **Semver:** NONE · **Category:** Legacy

## Location
- `apps/web-app/src/components/chara-sheet.ts:163`
- `apps/web-app/src/components/swatch-tool.ts:1869`

## Evidence
- git grep 'itemID\s*(<=|<|>)\s*0' apps/web-app: 2 matching-loop guards (chara-sheet.ts:163 bestDye, swatch-tool.ts:1869 closestDyeTo) + market predicates market-board-service.ts:316, preset-detail.ts:874, budget-tool.ts:625/629/656. Both loops walk dyeService = new CoreDyeService(dyeDatabase) (dye-service-wrapper.ts:22,38), bundled core data only. python over dyes.json: 125 dyes, min legacyItemID 5729, 0 null, min stainID 1. DyeDatabase.ts:206-213: itemID = legacyItemID, else stainID, so always >0. Test mocks (mocks/services.ts min itemID 5729; swatch-tool.test 9100+i) never feed <=0; no test asserts the skip. git log -S: guards added in 0895bb9a/6481d1c8, post-facewear-split copies.
- Every runtime Dye comes from core's bundled dyes.json, whose itemID derives from legacyItemID (min 5729) or stainID (>=1), so the guard can never fire; facewear colors left the dye DB in schema v2. These are nearest-dye matching loops, not market-board predicates, so the guard carries no tradeability meaning. Unpublished app, so semver NONE; worst case of a wrong removal is a cosmetic nearest-dye pick.
- Still live: none

## Fix
- **REMOVE** — 1) apps/web-app/src/components/chara-sheet.ts: delete line 163 `if (dye.itemID <= 0) continue;`. 2) apps/web-app/src/components/swatch-tool.ts:1869: change to `if (isDyeExcluded(this.dyeFiltersConfig, dye)) continue;`. Keep market-board-service.ts:316, preset-detail.ts:874 and budget-tool.ts filters (market predicates). 3) pnpm turbo run build type-check lint test --filter=xivdyetools-web-app (branch-coverage threshold check included). No changelog entry beyond an internal note.
- Cascade: None. No test, script, or doc references these two lines; the market-predicate copies stay.

## Status
OPEN
