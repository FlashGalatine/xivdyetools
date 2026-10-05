# Review: webapp-tools-b (comparison, extractor, accessibility, dye picker pieces, image zoom, preset edit form)

All paths are under `apps/web-app/src/components/`. All origin = MAIN (`git diff 8ecb878f HEAD` is empty for these files; the open PRs do not touch the slice).
Verification note: items marked "read" were established by reading only (no test run); nothing in the slice was executed.

## Map

| Module | Lines | Role |
|---|---|---|
| comparison-tool.ts | 2519 | 2-4 dye duel: pair chips, verdict, 7 readouts, share/export, mobile drawer |
| extractor-tool.ts | 2368 | image to K-means palette, loupe picks, shared-palette restore (`?colors=`), export/share |
| accessibility-tool.ts | 2037 | 5 vision lenses, pair readout, share (`dyes` + `vision`) |
| dye-selector.ts | 749 | search box + grid + favorites; I18N-008 localized category sort (changed) |
| dye-grid.ts | 539 | dye buttons, favorites/collection, roving-focus keyboard |
| dye-search-box.ts | 319 | search/sort/category chips, debounced `search-changed` |
| image-zoom-controller.ts | 887 | canvas zoom/pan/sample/loupe events; left-button guard (changed) |
| preset-edit-form.ts | 896 | owner edit modal; BUG-030 diff-baseline fix (changed) |

Tests skimmed: extractor (strong, incl. share round-trip), comparison, accessibility (weak, many `typeof fn` checks), dye-grid, dye-selector, image-zoom, preset-edit-form.

## Candidates

### webapp-tools-b-01 BUG MEDIUM - comparison-tool.ts:211-220, 452-526, 842-848
Language switch while dyes are selected blanks the results and leaks the previous selector tree.
- `LanguageService.subscribe` calls `update()` (226-232), which is unbind + `render()` + `bindEvents()` only (base-component.ts:148-163). `onMount` is not re-run.
- `renderRightPanel` rebuilds every section hidden (`display:none`) with the empty state visible, and nothing calls `updateResults()` afterwards.
- `renderLeftPanel` builds a new `DyeSelector` (545) and never calls `setSelectedDyes(this.selectedDyes)`, so the selector is empty while `this.selectedDyes` still holds 2-4 dyes.
- The old `dyeSelector`, `dyeSelectorPanel`, `optionsPanel`, `marketBoard` and `marketPanel` are replaced without `destroy()`. The sibling accessibility tool already does this (BUG-070, accessibility-tool.ts:485-490), and comparison's own `renderDrawerContent` does (2055-2066).
- Failing state: Comparison open with 3 dyes, user switches language. The right panel shows the "select at least two dyes" empty state, the left list still lists the 3 dyes, and the Export/Share row is hidden. The next `selection-changed` replaces `this.selectedDyes` with the empty selector's selection, silently dropping the old 3.
- Each switch also leaks one DyeSelector, DyeGrid, DyeSearchBox, CollapsiblePanel and MarketBoard set of service subscriptions.
- Tests miss it: comparison-tool.test.ts has no language-change case (extractor-tool.test.ts:1915 has one). Covered: no.
```ts
renderContent(): void { this.renderLeftPanel(); this.renderRightPanel(); ... }   // :211
this.dyeSelector = new DyeSelector(selectorContainer, {...});                   // :545, old one not destroyed
```
- Fix: destroy the old left-panel components first (BUG-070 pattern), call `setSelectedDyes(this.selectedDyes)` after building the selector, and end `renderContent` with `updateResults()` when `selectedDyes.length > 0`.

### webapp-tools-b-02 BUG MEDIUM - accessibility-tool.ts:247-256, 726-750, 477-519
Same defect for the Accessibility Checker: after a language change the right panel shows the empty state although dyes are selected.
- `renderLeftPanel` restores `selectedDyes` from localStorage, but its own comment says results are updated "in onMount() after right panel containers exist" (576). `onMount` does not run on `update()`, so `updateResults()` never runs.
- `renderRightPanel` builds `selectedDyesSection`, `lensSection` and `pairSection` hidden, and `emptyStateContainer` visible.
- Extra loss: custom colours (negative synthetic ids) are not in storage and are dropped by the restore at 568-570. `this.selectedDyes` is overwritten with only the restorable subset.
- Failing state: 2 dyes + a lens selected, switch language. The lens grid, pair readout and cards disappear until the user touches the selection. Share and Export stay reachable only after that.
- Covered: no (accessibility-tool.test.ts has no `update`/language test).
- Fix: call `this.updateResults()` at the end of `renderContent` when `selectedDyes.length > 0`.

### webapp-tools-b-03 BUG MEDIUM - comparison-tool.ts:1190-1196 vs 1911-1930
The tier word in the verdict and the per-method readout disagree for ΔE2000 when the match slider is below 5.
- `tierFor()` (the verdict, pair chips and badge): for `ciede2000`, `value < matchThreshold` gives 0; otherwise `classifyBandTier(...)`, and a 0 is bumped to 1 ("never SAME unless under the user's line").
- `buildSevenReadouts` (1914-1915) does `tier = classifyBandTier(...)` then `if (value < threshold) tier = 0`. It has no bump.
- The default SAME cut is 5 (`band-vocabulary.ts` match.ciede2000 `[5,10,20]`); the slider range is 1..15 (comparison-tool.ts:185, 361).
- Failing input: matchThreshold = 2, pair ΔE2000 = 3.0. Verdict/chips say CLOSE (tier 1). The ΔE2000 row in "seven readouts" classifies 3.0 < 5 as tier 0 and prints SAME in the same view.
- Tests miss it: nothing in comparison-tool.test.ts references `matchThreshold`. Covered: no.
```ts
// 1914-1915
let tier = classifyBandTier(value, method, 'match');
if (method === 'ciede2000' && value < this.matchThreshold) tier = 0;
```
- Fix: route the readout rows through `this.tierFor(value)` (parameterised by method) so one function owns the rule.

### webapp-tools-b-04 BUG MEDIUM - dye-grid.ts:381-437, 265, 112-114
A dye button reached by Tab cannot be selected with Enter or Space, and Enter/Space on the nested favourite/collection buttons is swallowed.
- Every dye button is a Tab stop (see the NOTE at 112-114), but `focusedIndex` is only set by arrow/Home/End navigation (`setFocusedIndex`). There is no focus listener.
- `handleKeydown` is attached to the grid wrapper (265) for every key from any descendant. On Enter/Space it runs `event.preventDefault()` (433), which cancels the native click, and then selects `dyes[focusedIndex]` only if `focusedIndex >= 0` (434).
- Failing state: Tab onto a dye, press Enter. `focusedIndex` is -1, so the default click is cancelled and nothing is selected. If an earlier arrow-key pass left `focusedIndex = 5`, Enter on a Tab-focused dye 20 selects dye 5.
- Same for the `.favorite-btn` / `.collection-btn` inside each card: Enter/Space bubbles to the wrapper and is cancelled, so the buttons cannot be activated from the keyboard. The 'f' / 'c' shortcuts need `focusedIndex >= 0` too.
- Tests miss it: dye-grid.test.ts:285-288 and :303-306 pre-dispatch `Home` ("initially -1") before Enter/Space, steering around the broken path. Covered: no (UNTESTED aspect: the tests are written to dodge the defect).
- Fix: on `focusin`, set `focusedIndex` from the focused `.dye-select-btn`. In `handleKeydown` return early for Enter/Space when `event.target` is not the dye button (or is inside `.favorite-btn, .collection-btn`) and do not `preventDefault` there.

### webapp-tools-b-05 BUG LOW - accessibility-tool.ts:686-698, 1783-1798
The BUG-096 reconciliation lives only in `setConfig` (454-457). Toggling a vision type off through the tool's own checkbox does not repoint `activeVision`.
- Desktop panel handler (686) and mobile-drawer handler (1783) delete from `enabledVisionTypes` and call `updateResults()`.
- `visibleVisions()` then drops the active tab, but `renderLensGrid`, `renderPairReadout` and `renderSelectedDyeCards` still paint through the disabled lens with no tab to leave it.
- Neither handler pushes the change to ConfigController, so the sidebar toggle also drifts.
- Failing state: Protanopia lens active, uncheck Protanopia in the drawer. Grid stays protanopia-simulated with no active tab. LOW because the primary toggle surface is the sidebar and the in-tool panels may not be shown (leftPanel is `mainPanel`, v4-layout.ts:601).
- Covered: no.
- Fix: extract the reconcile block into a helper and call it from both checkbox handlers.

### webapp-tools-b-06 BUG LOW - comparison-tool.ts:2437-2455; accessibility-tool.ts:1927-1946
The Share button stays enabled when the selection holds only custom colours (no stainID), and silently drops custom colours from a mixed share.
- `getShareParams` filters `stainID !== null`, so all-custom gives `{ dyes: [] }` (comparison) or `{ dyes: [], vision }` (accessibility). `disabled` is computed from `selectedDyes.length === 0` instead.
- A click then fails `validateShareParams` (share-service.ts:668-672: "Missing required parameter: dyes"). The extractor fixed this exact trap for itself (`'colors' in params`).
- A mixed [real, custom] selection shares a 1-dye link with no hint.
- Fix: `disabled = (params.dyes as number[] | undefined)?.length === 0` or not in params.
- Covered: no.

### webapp-tools-b-07 BUG LOW - extractor-tool.ts:2037-2048, 2055-2088; comparison-tool.ts:259-276
The market-error badge path is dead.
- `fetchPricesForRoll` expects `fetchPricesForDyes` to throw and maps the error to `lastMarketError` (H429/NCON/...), which feeds `cardData.marketError` (2020-2021).
- `MarketBoardService.fetchPricesForDyes` catches every failure and returns an empty Map (market-board-service.ts:399-410, `_lastFetchOutcome = 'error'`). It never throws, so `parseMarketError` and `lastMarketError` are unreachable.
- Harmony and Budget were fixed for this under BUG-075 (read `lastFetchOutcome`, harmony-tool.ts:1749-1757); extractor and comparison were not.
- Failing state: Universalis proxy down while prices are on. Extractor cards show a server name and no price and no error code; comparison shows no error at all.
- Fix: after the await, read `marketBoardService.lastFetchOutcome === 'error'` and set `lastMarketError` from it (or delete the dead parser).
- Covered: only by tests that mock the service to throw.

### webapp-tools-b-08 BUG LOW - comparison-tool.ts:1236-1247
`ensureActivePair` validates only index range, so removing a dye shifts what the stored indices point at.
- State: 4 dyes [A,B,C,D], active pair [1,2] = (B,C). Remove A. List becomes [B,C,D], pair [1,2] is still in range and now shows (C,D) with no user action.
- Fix: store the active pair by dye id (`dye.id`) and resolve to indices at render, or reset when the removed dye precedes either index.
- Covered: no.

### webapp-tools-b-09 BUG LOW - dye-selector.ts:288-295
The global `/` and Ctrl+F shortcut guard only checks `document.activeElement?.tagName !== 'INPUT'`.
- Tools render inside the shell's shadow root, where `document.activeElement` is the shadow host (not INPUT). A `/` typed in the dye search box, or any shadow-root text field beside a DyeSelector, is `preventDefault`ed.
- A TEXTAREA or contenteditable in light DOM is not excluded either.
- Contrast: extractor's paste handler uses `composedPath()[0]` (extractor-tool.ts:348).
- Impact is small (dye names have no `/`; Ctrl+F is a deliberate hijack), hence LOW. Verified by reading only.
- Fix: test `event.composedPath()[0]` against `input, textarea, select, [contenteditable]`.

### webapp-tools-b-10 BUG LOW - dye-selector.ts:680-683 vs 588-590
`updateFavoritesPanel` hardcodes `grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8`. Initial `createFavoritesPanel` honours `compactMode` (`grid grid-cols-3`).
- In every compact tool panel (comparison, accessibility, ...), the first favourite toggle reflows the favourites strip to 8 columns on lg.
- Fix: share one `favoritesGridClass()`.
- Covered: no.

### webapp-tools-b-11 BUG LOW - image-zoom-controller.ts:710-764
A pinch gesture ends with a spurious colour sample.
- `touchstart` sets `isDragging = true` on the first finger. A second finger's `touchstart` returns early (`touches.length !== 1`) without clearing it.
- On release `touchend` runs with `isDragging` still true and calls `sampleColorAtArea(changedTouches[0])`, so lifting the fingers moves the loupe and changes the hint colour.
- `touch-action: none` on the card means pinch is the natural gesture on mobile.
- Fix: in `touchstart` with `touches.length > 1` set `isDragging = false` and emit `loupe-end` if needed.
- Covered: no.

### webapp-tools-b-12 BUG LOW - image-zoom-controller.ts:357-372 vs 607-616
Ctrl/Cmd-drag pan jumps the image when it is centred.
- Resting margin when `isCentered` is `max(0,(container-scaled)/2) + panOffset`.
- During the pan, `mousemove` sets margin to `panOffsetX + dx` (no centering term), so the first move after Fit/auto-fit drops the centring offset and the image jumps by the centring amount. `mouseup` then sets `isCentered = false`, so it stays shifted.
- Cosmetic. Covered: no.

### webapp-tools-b-13 BUG LOW - comparison-tool.ts:1472-1479, 1968-1980 vs market-board-service.ts:97, 297
Comparison gates the price row on its own persisted flag, not the service's.
- `comparisonOptions.showMarketPrices` defaults to true (line 115). The service's `showPrices` defaults to false (market-board-service.ts:97; `tool-config-types.ts:414`).
- `fetchPricesForDyes` returns nothing when the service flag is off (`shouldFetchPrice`, 297). Cards still render `showPrice = true` with `marketServer` set and no price, so a fresh visit appears to show a market row that can never fill.
- The extractor uses `displayOptions.showPrice && this.showPrices` (1989) for the same reason.
- Marked LOW because the exact card rendering of "server, no price" was not run. Verify before filing.

### webapp-tools-b-14 UNTESTED LOW - accessibility-tool.test.ts:438-445, 459-473, 533-545
Many tests assert only that a method exists (`should have setConfig method`, `should have selectDye method`) or that `destroy()` does not throw.
- They would pass with every behaviour in 02 and 05 broken. The meaningful ones (`selectDye`, `clearDyes`, `setConfig lenses`, 588-835) cover add/clear/toggle state, never language rebuild or lens reconcile.
- Behaviour that should be pinned: results survive `update()`; disabling the active lens through the checkbox moves the lens.

## POSITIVE

- Extractor share restore (`restoreFromShareLink`, extractor-tool.ts:2270-2344) is careful and well tested (extractor-tool.test.ts:623-780): list-param arity (BUG-015), 5-colour cap, dedupe, junk-entry warnings, `algo` normalisation, picks excluded from the link, URL query stripped on first real image (1268-1272), and the `hasPalette()` generalisation covers setConfig, render and bar.
- BUG-030 fix in preset-edit-form.ts:695-724 is correct: baseline is the resolved stainID list, a no-edit Save sends no `dyes`, the refusal does not block other fields, and the double-toast is avoided via `dyesRefused`.
- I18N-008 category sort (dye-selector.ts:440-454) uses localized labels with the locale passed to `localeCompare`.
- Price lookups key on the original `dye.itemID`, and the service fans consolidated prices out to those ids (market-board-service.ts:371-387), so the consolidated-lookup regression pattern holds in all three tools.
- Listener hygiene in extractor/zoom: panel listeners are unbound before rebuild (extractor-tool.ts:1439), `setImage` clears prior document key listeners (image-zoom-controller.ts:85), and `ImageZoomController` is destroyed before `renderImageCanvas` rebuilds.
- `loadPersistedDyes` self-heals stale ids (BUG-042); BUG-096 reconciliation is in place on the config path.

## REJECTED

- Extractor `extractPalette` stale write after `clearImage` during the rAF yield: only a ~16 ms window and the result lands in a hidden flow; no visible effect.
- Extractor re-rendering after `restoreFromShareLink` before `renderContent` completes: `init()` renders before `onMount`, so the panel exists.
- `parseSharedPaletteColor` numeric branch dropping leading-zero hexes: `parseListParam` keeps non-round-tripping parts as strings, so only already-canonical all-digit hexes arrive as numbers and stringify back correctly.
- Shared palette shows 33/33/33 (sum 99) - cosmetic and the legend says it is a shared palette.
- Extractor share link omits dye filters / preventDuplicates, so the recipient may see different dyes: design limitation, the comment only promises the matching method.
- Huge-dimension image decompression bomb: `MAX_USER_FILE_BYTES` caps the file; an oversize canvas yields no pixels and the existing `noPixelsToAnalyze` error path fires.
- `DyeSelector` hue comparator non-transitive (1-degree dead band): sort order only, harmless on 125 items.
- `DyeGrid` constructor subscribing before `init()` (leak if init fails): init failure is not reachable in practice.
- `preset-edit-form` min-dye guard when one stored id is unresolvable (user must add a dye, whose change is then refused): odd UX but the name/description edit still saves; not a data-loss path.
- `DyeSearchBox` clear-button lookup via a translated `aria-label` selector: breaks only if a locale string contains a double quote; none do.
- Accessibility `shareVisionType` may become `normal` via a link, which is absent from the share select (`select.value=''`): cosmetic only.

## COVERED

8 non-test source files read in full or in all logic regions:
- apps/web-app/src/components/comparison-tool.ts (1-1000 selectively, 1100-2519 fully; 1000-1100 is empty-state markup)
- apps/web-app/src/components/extractor-tool.ts (80-2368 fully; 1-80 imports)
- apps/web-app/src/components/accessibility-tool.ts (fully)
- apps/web-app/src/components/dye-selector.ts (fully)
- apps/web-app/src/components/dye-grid.ts (fully)
- apps/web-app/src/components/dye-search-box.ts (fully)
- apps/web-app/src/components/image-zoom-controller.ts (fully)
- apps/web-app/src/components/preset-edit-form.ts (1-200, 284-440 selectively, 330-897 fully)

Supporting reads: base-component.ts (update/on/onCustom), share-service.ts (parse/validate/parseSharedPaletteColor), market-board-service.ts (fetch/fan-out/shouldFetchPrice), band-vocabulary.ts, custom-dye.ts, collection-service.ts (subscribeFavorites).
