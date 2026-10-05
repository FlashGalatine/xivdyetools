# Review: webapp-tools-a2 (mixer-tool, harmony-tool, budget-tool)

Branch `preview/integration-2026-10-04` @80262a2f. All three files appear in `changed-src-since-79a69d1f.txt`, and none is touched by an open PR, so every candidate is origin MAIN.
Paths are relative to `apps/web-app/src/`.

## Map

| Module | Lines | Role |
|---|---|---|
| `components/budget-tool.ts` | 1910 | 9C Ledger: target dye, match line, Universalis-priced tier groups, verdict, swap record |
| `components/harmony-tool.ts` | 2033 | Harmony Explorer: type rail, colour wheel, result cards, share/deep link, five wheels |
| `components/mixer-tool.ts` | 2165 | Dye Mixer: two-dye blend, 6x5 mixing field, matched results, share/export |

All three are `BaseComponent`s mounted by `components/v4-layout.ts` with `leftPanel === rightPanel` and `drawerContent: null`.
Language change calls `BaseComponent.update()`, which re-runs `renderContent()`. `onMount()` is not re-run, and only `gradient-tool.ts:466` defines `onUpdate`.

## Candidates

### webapp-tools-a2-01 BUG HIGH harmony-tool.ts:313-315 (render 1048-1137)
- **Claim:** a language switch blanks the Harmony result cards.
- **Repro:** select a dye (results shown), then switch language.
  - `LanguageService.subscribe` calls `update()`, which calls `renderContent()` and then `renderRightPanel()`.
  - That builds a fresh, empty `harmonyGridContainer` (1119-1122) and a visible `resultsSection`.
  - Nothing calls `generateHarmonies()` afterwards, and `HarmonyTool` has no `onUpdate`.
  - Outcome: only the wheel redraws (from retained `slotDyes`), and the results area is an empty grid under an enabled Share button. Results only come back on the next interaction.
- **Evidence the author knew:** `handleDeepLink` calls `this.update()` and then `this.generateHarmonies()` explicitly (605-608). `gradient-tool.ts:466` has an `onUpdate` for exactly this reason.
- **Tests miss it:** `harmony-tool.test.ts:127` mocks `LanguageService.subscribe` as a no-op, so the language path never runs. Covered: no. Origin: MAIN.
- **Excerpt:**
  ```ts
  this.subs.add(LanguageService.subscribe(() => { this.update(); }));   // 312-316
  // renderRightPanel(): this.harmonyGridContainer = createElement(...); no generateHarmonies()
  ```
- **Fix:** add `onUpdate(): void { if (this.selectedDye) this.generateHarmonies(); }`. Alternatively end `renderContent()` with a regenerate when a dye is selected.

### webapp-tools-a2-02 BUG HIGH mixer-tool.ts:607-611 (render 1424-1426)
- **Claim:** same defect in the Mixer. A language switch hides the matched-dye results.
- **Repro:** with two dyes mixed, switch language.
  - `update()` runs `renderRightPanel()`, which creates `resultsSection` with `display: none` (1424-1426) and an empty `resultsGridContainer`.
  - `renderCraftingUI` and `renderMixingField` repopulate from state, but nothing calls `renderResultsGrid()` or `showEmptyState(false)`.
  - Outcome: the slots and field show a blend, but the "Matching dyes" section, Export and Share are gone until the next interaction.
- **Tests miss it:** `mixer-tool.test.ts:130` has `subscribe` as a no-op. Covered: no. Origin: MAIN.
- **Fix:** add `onUpdate()`: if `selectedDyes[0] && selectedDyes[1]`, call `findMatchingDyesInternal(); showEmptyState(false); renderResultsGrid()`.

### webapp-tools-a2-03 BUG HIGH mixer-tool.ts:188-205 (and budget-tool.ts:201-235)
- **Claim:** persisted dye filters are ignored at mount by Mixer and Budget.
- **Repro:**
  - The sidebar persists `dyeFilters` into every tool's config and `global` (`v4/config-sidebar.ts:885-908`). `ConfigController.subscribe` does not replay.
  - Turn on "Exclude metallic" and then open Mixer or Budget (or reload).
  - Their `dyeFiltersConfig` stays `DEFAULT_DYE_FILTERS` until the next filter change (mixer 154, 935-944; budget 179, 399-407).
  - Outcome: `findMatchingDyes` and `filterDyes` return metallic dyes while the sidebar shows them excluded.
- **Contrast:** Harmony loads them in `onMount` (`harmony-tool.ts:339`). Mixer's constructor reads `maxResults`, `mixingMode`, `displayOptions` and `matchingMethod`, but not `dyeFilters`.
- **Tests miss it:** neither test file mentions `dyeFilters`. Covered: no. Origin: MAIN. (Same class as `review-webapp-tools-a1.md:54` for Swatch.)
- **Fix:** seed `this.dyeFiltersConfig = config.dyeFilters ?? DEFAULT` in the Mixer constructor and in Budget's `onMount` or constructor. Filter before the first `findMatchingDyesInternal` / `findAlternatives`.

### webapp-tools-a2-04 BUG MEDIUM budget-tool.ts:201-235
- **Claim:** Budget also ignores the persisted global display options at mount. It reads only its own `v3_budget_show_*` keys.
- **Repro:**
  - Uncheck "Hex" in the sidebar while in Harmony. The sidebar broadcasts `displayOptions` to the `budget` config (`config-sidebar.ts:860-876`), but Budget is not mounted, so its own keys are never written.
  - Open Budget: the target card still shows Hex.
  - `showHue`, `showStain` and `showSpectrum` have no local key at all and always start `true` (173-176).
  - The comment "ConfigController replays them" (173) is false: `subscribe` never replays.
- **Tests miss it:** Covered: no. Origin: MAIN.
- **Fix:** in the constructor or `onMount`, call `applyDisplayOptions` against `ConfigController.getConfig('budget').displayOptions`. Alternatively replay `setConfig(getConfig('budget'))` once after `subscribe`.

### webapp-tools-a2-05 BUG MEDIUM budget-tool.ts:546-615 (rows write 582-598)
- **Claim:** `findAlternatives` has no run guard, so a stale run can overwrite a newer ledger.
- **Repro:**
  - The slider `input` event fires `findAlternatives()` per tick (991-998). The captured `target` and `threshold` are used after `await fetchPrices`.
  - If run 1's request resolves after run 2 has finished, `MarketBoardService` discards run 1's prices (`market-board-service.ts:359-365`, outcome `superseded`).
  - Run 1's continuation still executes and writes `this.rows` for the old threshold or target, then calls `renderVerdict()` and `renderLedger()`.
  - Outcome: the ledger and verdict show the old match line or old target while the slider and target card show the new one.
  - Differing candidate sets produce different batch keys (`APIService.ts:987`), so reordering is plausible. `selectDye` has the same hazard: it can show the previous target's rows.
  - A superseded run also sets `isLoading = false` while a newer run is still loading.
- **Tests miss it:** `budget-tool.test.ts` has no concurrent-call test. Covered: no. Origin: MAIN.
- **Fix:** `const run = ++this.runId;` at the top, and `if (run !== this.runId) return;` after `await fetchPrices` (also in `catch` and `finally`). Optionally debounce the slider.

### webapp-tools-a2-06 BUG MEDIUM budget-tool.ts:328-342 (in-page slider 991-998)
- **Claim:** the in-page match-line slider and the sidebar `maxDeltaE` are two sources of truth, and the controller value wins on any later broadcast.
- **Repro:**
  - Drag the in-page slider to 14. It writes only `v5_budget_match_line`, not `ConfigController` (still 8, `config-sidebar.ts:212`).
  - Then toggle any sidebar display option or change the matching method. `setConfig('budget', ...)` notifies the full merged config (`config-controller.ts:311-334`) with `maxDeltaE: 8`.
  - `setConfig` then clamps and applies it: `line (8) !== matchLine (14)` resets the match line to 8, persists it and refetches.
  - Outcome: the user's match line silently reverts. Only `textContent` is updated, so the in-page slider thumb stays at 14.
- **Tests miss it:** `budget-tool.test.ts:696-709` call `setConfig({maxDeltaE})` alone, never a full-config broadcast after a slider move. Covered: no. Origin: MAIN.
- **Fix:** have the in-page slider call `ConfigController.getInstance().setConfig('budget', { maxDeltaE })`, as Mixer does at `mixer-tool.ts:524`. Alternatively ignore `maxDeltaE` unless it changed against the previous config.

### webapp-tools-a2-07 BUG MEDIUM budget-tool.ts:1229-1237
- **Claim:** "Save swap" records an arbitrary cheapest dye rather than the closest cheap one.
- **Repro:**
  - Pick a Wide or Coffer target. Every Standard (tier A) candidate has `gil = 216`.
  - `reduce` keeps the first minimum under strict `<`, and `this.rows` is in database order (candidates come from `getAllDyes()`), not sorted by ΔE.
  - Outcome: the swap record stores the first Standard dye in the pool, possibly 19 ΔE away, even when one at ΔE 1.5 qualifies.
- **Tests miss it:** Covered: no. Origin: MAIN.
- **Fix:** tie-break on `de`, i.e. `(gil, de)` lexicographic, or take the best `perPoint`.
- **Excerpt:**
  ```ts
  (best, r) => r.price.gil != null && r.dye.stainID !== null &&
    (best?.price.gil == null || r.price.gil < best.price.gil) ? r : best
  ```

### webapp-tools-a2-08 BUG MEDIUM budget-tool.ts:428-435 (router-service.ts:105,188-191; result-card.ts:1215-1220)
- **Claim:** Budget's `?dye=` deep link overrides the target the user just chose.
- **Repro:**
  - Open `/harmony?dye=5&v=1` (share link or hand-off).
  - On a Harmony card choose "Inspect in Budget". `setAsBudgetTarget` stores the card's dye in `v3_budget_target` and calls `navigateTo('budget')`.
  - `navigateTo` copies the preserved `dye` param (`PRESERVED_PARAMS`), so Budget's `handleDeepLink` resolves `dye=5` and replaces the target.
  - Outcome: Budget opens on dye 5, not the dye the user clicked.
  - Harmony's `inspect-harmony` is immune because it goes through `handoffTo` with an explicit `dye`.
- **Tests miss it:** Covered: no. Origin: MAIN.
- **Fix:** make `setAsBudgetTarget` use `handoffTo('budget', dye)`. That needs `budget: 'dye'` in `HANDOFF_PARAM`. Or have the router drop a preserved `dye` when the destination is given an explicit one.

### webapp-tools-a2-09 BUG MEDIUM harmony-tool.ts:454-458, 582-614 (router-service.ts:105)
- **Claim:** a stale preserved `dye` replaces the user's later base-dye pick when returning to Harmony.
- **Repro:**
  - Arrive via `/harmony?dye=5&...`, pick dye 9 in the palette, go to Mixer and back.
  - Harmony never writes the URL, so `navigateTo` preserves `dye=5` the whole way.
  - On return, a bare `?dye=5` (not a share link) hits `handleDeepLink` and overrides the persisted selection 9.
  - The code comment at 544-548 acknowledges the preserved-dye path but assumes the URL value is current.
- **Tests miss it:** the BUG-005 test (`harmony-tool.test.ts:1161`) only checks the spy fires. Covered: no. Origin: MAIN.
- **Fix:** keep the URL in sync with the base dye via `replaceRoute` on selection, or ignore a bare `dye` when it equals the already-consumed value.

### webapp-tools-a2-10 BUG MEDIUM budget-tool.ts:442-448
- **Claim:** `?maxDelta=` deep link updates `matchLine` but not the slider or value readout.
- **Repro:**
  - `BaseComponent.init()` runs `render()` and then `onMount()` (`base-component.ts:126-136`).
  - `handleDeepLink` runs in `onMount`, after `renderMatchLineSection` built the slider from the stored `matchLine`.
  - Open `/budget?dye=..&maxDelta=14`: the ledger uses 14, while the slider and its label show the stored value (default 8).
  - Dragging the slider then jumps the line.
- **Tests miss it:** Covered: no. Origin: MAIN.
- **Fix:** after applying the param, update `matchLineValueDisplay`, `mobileMatchLineValueDisplay` and the slider `.value`, or call `renderMain()`.

### webapp-tools-a2-11 BUG LOW harmony-tool.ts:1067-1068
- **Claim:** a media-query listener leaks per re-render.
- **Repro:**
  - `renderRightPanel()` creates a new `matchMedia('(max-width: 768px)')` list and adds `onRailBreakpoint` on every render.
  - `update()` runs on every language change, and `destroy()` removes only the latest list's listener (435).
  - After N language changes, N lists keep firing `renderTypeRail()` on a destroyed tool at every breakpoint crossing.
  - Budget's `narrowMql` is created once in `onMount`, so it is fine.
- **Tests miss it:** Covered: no. Origin: MAIN.
- **Fix:** create the list once in `onMount`, or remove the old listener before re-adding.

### webapp-tools-a2-12 BUG LOW budget-tool.ts:292 (overlaps v4-shell review)
- **Claim:** Budget forces `market.showPrices = true` globally and never restores it.
- **Repro:**
  - `setShowPrices(true)` writes the persisted ConfigController market config (`market-board-service.ts:251-257`).
  - A user who had prices off now has them on in Harmony, Mixer, Comparison and the sidebar after visiting Budget.
  - `review-webapp-v4-shell.md:20` notes the sidebar toggle desync. This file adds the persistence.
  - It is arguably by design ("Prices are core"), hence LOW.
- **Fix:** do not write the preference. Fetch prices irrespective of `showPrices`, or restore it on `destroy`.

### webapp-tools-a2-13 BUG LOW budget-tool.ts:503-518, 1316-1318
- **Claim:** theme-dependent inline colours are chosen at render time, with no theme subscription.
- **Repro:**
  - `tierRamp()`, `accent()` and the verdict greens/ambers read `ThemeService.isDarkMode()` once per render.
  - `ThemeService.subscribe` is used only by the header and theme modal.
  - Switching theme while Budget is open leaves dark-ramp tier colours (e.g. `#5bbd68`) on light cards, and the reverse, until the next interaction. The theme modal is a modal, so the tool stays open behind it.
  - Mixer's `spreadTone` (1144-1155) has the same hazard.
- **Tests miss it:** Covered: no. Origin: MAIN.
- **Fix:** `this.subs.add(ThemeService.subscribe(() => this.renderLedger()...))`.

### webapp-tools-a2-14 BUG LOW mixer-tool.ts:1271-1277
- **Claim:** a field cell with no eligible match prints `0.0`, which reads as an exact match.
- **Repro:** with filters excluding every dye except the two inputs, `findMatchingDyesEngine(...)[0]?.distance ?? 0` gives 0, so each of the 30 cells shows ΔE 0.0.
- **Tests miss it:** Covered: no. Origin: MAIN. Latent today and visible once filters are actually applied (see -03).
- **Fix:** render an em dash when no match exists.

### webapp-tools-a2-15 BUG LOW mixer-tool.ts:213-231
- **Claim:** `loadSelectedDyes` keeps a legacy third slot, so a pre-cut 3-dye pair blends three ways.
- **Repro:**
  - Stored `v4_mixer_selected_dyes = [a, b, c]` from a pre-2026-08-08 build.
  - `hexColors` then includes c (226, 625), giving an equal-weight 3-way `blendColors`, ignoring `mixRatio`.
  - A share link that sets only dyeA/dyeB (677-684) inherits c, so the field is suppressed by `this.selectedDyes[2]` (1164).
  - Current code never writes slot 3.
- **Tests miss it:** Covered: no. Origin: MAIN.
- **Fix:** force `this.selectedDyes[2] = null` after load.

### webapp-tools-a2-16 OPT LOW harmony-tool.ts:406-416
- **Claim:** a market config change fetches prices twice.
- **Detail:**
  - `generateHarmonies()` fires `fetchPricesForDisplayedDyes()` itself (1541-1544), and the handler then calls it again when `config.showPrices` is true.
  - The second call supersedes the first (version bump), so a request is wasted per toggle.
  - Mixer's field cell click renders the field twice (1305-1313, since `updateCraftingUI()` already calls `renderMixingField()` at 1827).
  - Each field render is 30 full 125-dye scans plus about 11 blends.
- **Fix:** drop the redundant call.

## POSITIVE

- `harmony-tool.ts` selection runs through core `generateHarmonySlots`. `isKnownHarmonyType` and `parseColorWheelId` use `Object.hasOwn`, so there is no prototype-key hole (HarmonySelector.ts:158).
- Harmony wheel-change pin clearing and the share-link wheel rule (554-571) are consistent. Ratio direction is consistent across `blendColorsInternal` (260), the field (1266) and core (`ColorService.mixColorsRgb` doc: ratio toward hex2).
- Budget pricing rules are consistent: coffer dyes read no vendor gil, `dye.itemID > 0` filtering, and the board price fan-out through `fetchPricesForDyes`. The BUG-074/075 world-change and outcome fixes are present.
- `MarketBoardService` superseded and offline handling is used correctly via `lastFetchOutcome`.
- Custom dyes get unique synthetic ids and are excluded from hand-offs, share (`hex`/`hexA`) and market fetch (`itemID <= 0`).
- `RouterService.subscribe` and `ConfigController` subscriptions are registered through `this.subs`, so they are torn down in `destroy()`.

## REJECTED

- Pinned (hand-swapped) harmony dyes surviving a filter change: core states a pin wins its slot outright (HarmonySelector.ts:241-245). Design decision.
- Sparse `slotDyes` misaligning wheel nodes: `.map` preserves holes, and `harmonyColors[index]` stays index-aligned with `nodeAngles`.
- Harmony `companionDyesCount` clobber via the drawer slider: `drawerContent` is `null` in v4-layout, so the drawer slider is never rendered, and core tolerates NaN or out-of-range counts (`companionCount > 0`).
- The harmony `case 'budget'` sending `base=<hex>`, which nobody reads: ResultCard emits only the non-legacy menu actions (`result-card.ts:1192`), so it is unreachable. Dead-code audit owns it.
- Budget `findAlternatives` repeated fetches per slider tick as OPT: `APIService.getPricesForDataCenter` caches and coalesces identical batches (APIService.ts:947-997).
- Budget `perPoint`, `classifyBandTier` ramp index and tier `×N` math: bounded, with `Math.max(de, 0.1)` guarding division.
- Mixer `handleContextAction` slot replace compacting dyes: both slots are always filled when results exist.
- Mixer `ShareService` `mode`/`ratio` validation: whitelisted and range-checked.

## COVERED

3 files read in full: `components/budget-tool.ts`, `components/harmony-tool.ts`, `components/mixer-tool.ts`.

Read for confirming claims:
- `base-component.ts`
- `market-board-service.ts`
- `config-controller.ts`
- `v4-layout.ts`
- `router-service.ts`
- `config-sidebar.ts`
- `result-card.ts`
- `mixer-blending-engine.ts`
- `custom-dye.ts`
- core `HarmonySelector.ts`, `ColorService.ts` and `APIService.ts`

Tests skimmed: the three `*-tool.test.ts` files, by grep (3,015 lines).
