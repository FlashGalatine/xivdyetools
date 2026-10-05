# DEAD-010: 14 web-app locale keys x 6 locales are read only by the test-only empty-state presets: 24 lines per locale, 144 total
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Orphan i18n · **Origin:** MAIN · **Cascade of:** DEAD-008

## Location
- `apps/web-app/src/locales/en.json:1112` — emptyStates.{noSearchResults,filteredOut,noPrice,noImage,loading}.* and marketBoard.priceUnavailable

## Evidence
- The only t() reads of emptyStates.{noSearchResults,filteredOut,noPrice,noImage,loading}.* and marketBoard.priceUnavailable are in the six test-only presets (empty-state.ts:55-107). dye-grid.ts:88-97 uses dyeSelector.* keys. No dynamic emptyStates/marketBoard prefix and no allow-list entry exists.
  - Commands: git grep -n -E 'marketBoard|emptyStates|priceUnavailable' -- apps packages scripts .github (minus locales/CHANGELOG) -> only empty-state.ts + test mocks of unrelated marketBoard objects; identical/same-english allowlists hold no such key; template t(`...`) survey in web-app src: no emptyStates/marketBoard prefix; python parity check: all 6 locales hold identical emptyStates shape + marketBoard.priceUnavailable
- Origin: At 8ecb878f the only key reads are the same empty-state.ts lines (55-107, 72). The PR locale diffs (8ecb878f..HEAD) touch only preset.privacyNote and swatch.charaHintGlamour, not these keys.

## Fix
**REMOVE.** Land this together with DEAD-008 and DEAD-009 so the i18n orphan and parity gates see a consistent tree. Keep emptyStates.noHarmony.* (live via harmony-tool.ts) and errors.somethingWentWrong/tryAgain (live in base-component.ts).

Steps: 1) In each of apps/web-app/src/locales/{en,ja,de,fr,ko,zh}.json remove emptyStates.noSearchResults (3 leaves), filteredOut (3), noPrice (2), noImage (3) and loading (2). In en.json those are lines 1113-1126 and 1132-1140, about 23 lines; fix the trailing comma so noHarmony is the sole entry. 2) Remove marketBoard.priceUnavailable from all six files (en.json:581). 3) Remove only after the six presets in empty-state.ts are gone (DEAD-008). 4) Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app (this covers the i18n-parity-gate and orphan tests), then pnpm dead-code:check.

Sequencing: Lands in the same pull request as DEAD-008 and DEAD-009. Leaving the strings behind would not fail a gate (the orphan analyzer treats every key ending in `.title`/`.description` as reachable), so re-grep each key before deleting rather than relying on the gate.

Correction from the final adversarial check: Five presets read these keys (noSearchResults, allFilteredOut, noPriceData, noImage, loading); the sixth test-only preset, `error`, reads errors.somethingWentWrong/tryAgain, which stay live.

## Status
OPEN
