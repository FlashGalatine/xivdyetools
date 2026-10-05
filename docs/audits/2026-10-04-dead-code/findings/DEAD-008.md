# DEAD-008: empty-state.ts: 6 of the 7 EMPTY_STATE_PRESETS factories are test-only — 54 source + 53 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/web-app/src/components/empty-state.ts:53` — EMPTY_STATE_PRESETS.noSearchResults/allFilteredOut/noPriceData/noImage/error/loading

## Evidence
- Production reads only EMPTY_STATE_PRESETS.noHarmonyResults (harmony-tool.ts:1300), and there is no computed access. The six other factories are called only from empty-state.test.ts, and four icons plus the emptyStates.* and marketBoard.priceUnavailable keys survive only through them.
  - Commands: git grep EMPTY_STATE_PRESETS|noSearchResults|allFilteredOut|noPriceData over apps: production finds harmony-tool.ts:60,1300 only; dye-grid uses getEmptyStateHTML with inline options.; git grep -w ICON_STATE_COINS|ALERT|WAIT_ANIMATED|ICON_DETAIL_EXTRACTOR: only empty-state.ts and state-icons.ts.; The emptyStates.{noSearchResults,filteredOut,noPrice,noImage,loading} keys and marketBoard.priceUnavailable have no caller outside empty-state.ts.
- Origin: git grep EMPTY_STATE_PRESETS\. at 8ecb878f (excluding tests) finds only harmony-tool.ts:1300 noHarmonyResults. empty-state.ts and state-icons.ts are untouched in 8ecb878f..HEAD.

## Fix
**REMOVE WITH CAUTION.** Keep errors.somethingWentWrong and errors.tryAgain (base-component.ts:361,385) and keep emptyStates.noHarmony. dye-grid uses its own dyeSelector.* keys, not emptyStates.filteredOut. Locale cost is separate: about 24 lines per locale x 6.

Steps: 1) apps/web-app/src/components/empty-state.ts: delete the factories at 53-76 and 87-108. From the import at 13-21 drop ICON_STATE_COINS, ICON_STATE_ALERT, ICON_STATE_WAIT_ANIMATED and ICON_DETAIL_EXTRACTOR, and also ICON_STATE_SEARCH and ICON_STATE_FUNNEL: the deleted factories were their only users in this file, and web-app's tsconfig sets noUnusedLocals. ICON_STATE_SEARCH/FUNNEL stay exported from state-icons.ts, since dye-grid.ts:7/89/96 and v4/preset-tool.ts:19/1145 use them. 2) empty-state.test.ts: trim the preset list at 117-123 to noHarmonyResults and delete the describes at 257-281 and 291-313. 3) In the same pull request, as separate commits: DEAD-009 (the four icons) and DEAD-010 (the locale strings). 4) pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app && pnpm dead-code:check.

## Status
OPEN
