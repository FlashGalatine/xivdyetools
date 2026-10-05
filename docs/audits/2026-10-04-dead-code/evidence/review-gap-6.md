# review-gap-6: C5 cascade (EMPTY_STATE_PRESETS, state icons, emptyStates.* keys)

## Commands and results
1. `git grep -n -w -E 'ICON_STATE_COINS|ICON_STATE_ALERT|ICON_STATE_WAIT_ANIMATED|ICON_DETAIL_EXTRACTOR' -- apps/web-app` -> only state-icons.ts:29,32,44,57 (defs) and empty-state.ts:16-20 (import), 71,88,96,105 (uses in presets). No other consumer.
2. `git grep -n -w EMPTY_STATE_PRESETS -- apps/web-app` -> empty-state.ts:52 (def), empty-state.test.ts (many), harmony-tool.ts:60,1300 (PROD: `EMPTY_STATE_PRESETS.noHarmonyResults(...)`). CORRECTION to C5: the object is NOT test-only; only 6 of 7 presets are.
3. `git grep -n -E 'EMPTY_STATE_PRESETS\.(noSearchResults|allFilteredOut|noPriceData|noImage|error|loading)'` excluding __tests__ -> 0 prod hits. Those six are test-only.
4. `git grep -n 'emptyStates\.'` in src -> only empty-state.ts:55-107 (no other file, no scripts/e2e/tests). Dynamic-prefix grep for `emptyStates` outside locales/CHANGELOG -> none.
5. dye-grid.ts:88-95 read: builds getEmptyStateHTML itself with ICON_STATE_SEARCH/ICON_STATE_FUNNEL and dyeSelector.noResults / noResultsHint / noDyesInCategory / tryCategoryHint. It uses NO emptyStates.* key and not the four icons. So dye-grid is not a consumer; the caveat is resolved: keys are orphaned once the presets go.
6. `git grep -n priceUnavailable` -> only empty-state.ts:72 plus 6 locale files; no dynamic `marketBoard.${` use. marketBoard.priceUnavailable also orphans with noPriceData.
7. errors.somethingWentWrong / errors.tryAgain also used by base-component.ts:361,385 -> stay (live).
8. Locale parity: all 6 locales hold emptyStates = {filteredOut, loading, noHarmony, noImage, noPrice, noSearchResults}; marketBoard.priceUnavailable present in all 6.
9. Glyph names 'coins','alert' only appear in packages/svg tool-icons.ts type union (published API); not in scope for deletion.
10. state-icons.ts consumers otherwise: dye-grid (SEARCH, FUNNEL), collection-manager-modal (FOLDER), v4/preset-tool (PRESETS_EMPTY, SEARCH), empty-state.ts (HARMONY live via noHarmonyResults). All live.

## Candidates
- cand-gap6-01: six test-only presets in empty-state.ts:52-109 (keep noHarmonyResults) + test cases in empty-state.test.ts (lines ~113-125, 258-312 for those presets).
- cand-gap6-02: four icons in state-icons.ts (COINS 29, ALERT 32, EXTRACTOR 44, WAIT_ANIMATED 57-~75 incl. inline keyframes); orphaned once cand-01 lands; knip would flag them after (no tags).
- cand-gap6-03: locale keys emptyStates.{noSearchResults,filteredOut,noPrice,noImage,loading}.* + marketBoard.priceUnavailable in all 6 locales (i18n-orphans test will enforce removal together). Keep emptyStates.noHarmony.

## Rejected
- Deleting EMPTY_STATE_PRESETS wholesale: live via harmony-tool.ts:1300.
- ICON_STATE_SEARCH/FUNNEL, ICON_DETAIL_HARMONY, errors.* keys: live.
- Note: if the 'error' preset is dropped, the web-app has no remaining use of ICON_STATE_ALERT; if product intends an error empty state later, that is the only judgment call.
