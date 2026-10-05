# Review: webapp-tools-a1 (swatch-tool.ts 3146 lines, gradient-tool.ts 2755 lines)

Branch preview/integration-2026-10-04 @80262a2f. Both files are in changed-src-since-79a69d1f; neither is touched by an open PR, so every origin is MAIN.

## Map
| Module | Role | Notes |
|---|---|---|
| swatch-tool.ts SwatchTool | Swatch Matcher: palette grid, forward match (colour to dyes), reverse match (dye/hex to swatches), .chara views, share, SEND TO | In V4 `leftPanel === rightPanel === mainPanel`, `drawerContent: null` (v4-layout.ts:703-708) |
| swatch renderLeftPanel / renderDrawerContent | Race/category/market panels | renderLeftPanel output is cleared by renderRightPanel (same element); drawer never exists in V4 |
| swatch setConfig / setMarketConfig | ConfigController subscription target (full config on every notification) | root of candidates 01, 02, 06 |
| swatch loadColors | BUG-093 versioned load | correct |
| swatch pickCharaSlot / onCharaSession | THIS CHARACTER slot to selection | candidate 03 |
| gradient-tool.ts GradientTool | Gradient Builder, 4C pin rail | |
| gradient calculateInterpolation | piecewise ramp, pins as anchors, dedupe, filters | candidate 05 |
| gradient setConfig | sidebar + market config | candidate 06 |
| gradient selectDye / selectCustomColor / activeEndpoint | palette drawer hand-in | |
| gradient renderLeftPanel / renderDrawerContent | dead in V4 (same element cleared), still built and leaked | candidates 08, 14 |

## Candidates

### webapp-tools-a1-01 BUG HIGH swatch-tool.ts:466-472 (+ shared/tool-config-types.ts:489-491, swatch-tool.ts:158-163)
Claim: ConfigController's stored swatch default (`colorSheet 'hairColors'`, race `SeekerOfTheSun`, gender `Female`) differs from the tool's own defaults (`eyeColors`, `Midlander`, `Male`), and the tool treats every notification as authoritative.
Failing input: fresh profile opens Swatch (shows Eye palette, Midlander/Male). The user changes max results, matching method, a display option, or the global display toggles in the sidebar (each calls `controller.setConfig('swatch', ...)`, which notifies the FULL merged config, config-controller.ts:322-334). `setConfig` sees `colorSheet !== colorCategory`, race and gender differing too.
Wrong outcome: the palette jumps to Hair, tribe becomes Seeker of the Sun / Female, the selection is cleared (line 521) and all three values are persisted over the user's stored choices. Also happens when a .chara loads (`ConfigController.onCharaSession` -> `setConfig('swatch', {})`).
Related, same root cause: the palette rail chips and `pickCharaSlot` call the tool-local `setConfig({colorSheet})` (lines 1587, 1796, 1825) and never write ConfigController, and the 10A sidebar has no colorSheet control any more (git grep: nothing else writes `colorSheet`). So after clicking "Lip" the controller still says hair, and the next sidebar touch flips the palette back to Hair. The rail comment at 1753 ("Chips drive the same colorSheet config as the sidebar") is false.
Tests miss it: swatch-tool.test.ts calls `tool.setConfig(...)` directly with partial configs and mocks the services; no test goes sidebar -> ConfigController -> tool. Covered: no. Origin: MAIN (defaults date from the monorepo migration, 79e945ac).
Excerpt:
```
if (config.colorSheet !== undefined && config.colorSheet !== this.colorCategory) {
  this.colorCategory = config.colorSheet as ColorCategory;
  StorageService.setItem(STORAGE_KEYS.colorCategory, config.colorSheet);
  needsReload = true;
```
Fix: make ConfigController the single owner. Seed the tool's state from `getConfig('swatch')` in the constructor, and have the rail / slot pick call `ConfigController.getInstance().setConfig('swatch', { colorSheet })` instead of the local method. Align the default table with the tool defaults (or drop colorSheet from SwatchConfig).

### webapp-tools-a1-02 BUG MEDIUM swatch-tool.ts:520-529
Claim: the `needsReload` branch of `setConfig` (sidebar race/gender change, rail chip) nulls `selectedColor` but leaves `matchedDyes`, `selectionContext`, the share button and the result cards in place. The in-tool selects (lines 1087-1090, 1212-1215) correctly call `clearSelection()`.
Failing input: click a grid cell (cards appear), then change tribe in the sidebar or click another palette chip.
Wrong outcome: `updateEmptyState` (1612-1633) shows "no colour selected" and hides the header, but `matchResultsContainer` still holds the old cards, SEND TO chips (2310) carry the old dyes' stainIDs, and the share button stays enabled with the old `slot/i` (updateShareButton never runs).
Tests miss it: setConfig tests only assert storage writes. Covered: no. Origin: MAIN.
Fix: call `this.clearSelection()` in the reload `.then` (as the select handlers do), keeping the reverse state.

### webapp-tools-a1-03 BUG MEDIUM swatch-tool.ts:1579-1595, 2310-2318
Claim: picking a THIS CHARACTER slot sets `selectionContext` to the slot but leaves `selectedColor` / `matchedDyes` from an earlier grid click.
Failing input: click grid cell A (cards for A), then click the Hair slot card.
Wrong outcome: the selection card and the reverse list describe the slot's hex, while CLOSEST DYES still shows A's matches, the grid outline stays on A (updateSwatchSelection is not called), the share button shares A, and SEND TO uses `matchedDyes` first (the "carry its closest dye when the forward matcher has nothing" fallback at 2315 never fires because matchedDyes is not empty).
Tests miss it: no test sequences a grid pick then a slot pick. Covered: no. Origin: MAIN.
Fix: in `pickCharaSlot`, clear the forward selection (selectedColor, matchedDyes, outline) before `selectCustomColor`, or make the handoff row prefer the slot's closest dye when `source === 'slot'`.

### webapp-tools-a1-04 BUG MEDIUM swatch-tool.ts:2807-2820 (and 1981-1988)
Claim: with any dye filter active the tool asks core for `min(maxResults * 3, 136)` candidates and filters afterwards, so strong filters return fewer than `maxResults` (or none) although plenty of allowed dyes exist (same pattern as the fixed `/v1/match/within-distance` bug). `closestDyeTo` (the verdict sentence and the slot-pick SEND TO dye) ignores filters entirely, so the verdict can name a dye the forward list excludes.
Failing input: maxResults 3 (nine candidates), exclude coffers + metallic + cosmic for a colour whose nine nearest dyes are mostly in those sets.
Wrong outcome: 0-2 cards although the user asked for 3 and 100+ dyes qualify; verdict sentence names an excluded dye.
Tests miss it: the dyeFilters tests (swatch-tool.test.ts:723-733) assert only `not.toThrow()`. Covered: no. Origin: MAIN.
Fix: request all dyes (`count: dyeService.getAllDyes().length`) when filters are active, filter, then slice; route `closestDyeTo` through the same filter.

### webapp-tools-a1-05 BUG MEDIUM gradient-tool.ts:1809, 1840, 1888-1897
Claim: `usedDyeIds` is seeded with only the two endpoints; a pinned dye is added when the loop reaches the pinned index, so any earlier middle step can match the pinned dye and is not deduplicated. The comment at 1887 says pins "never count as duplicates", but the reverse (a free step duplicating a pin) is what happens.
Failing input: 8-step ramp, preventDuplicates on (default); pin step 5 (dye X). On re-run step 4 interpolates toward X's hex (anchor), its closest dye is X.
Wrong outcome: step 4 and pinned step 5 are both X (asymmetric: step 6 is deduplicated). The ramp shows the same dye twice with preventDuplicates on.
Tests miss it: gradient-tool.test.ts has no pin-behaviour test (only a label test at line 544). Covered: no. Origin: MAIN (2a0e1f4e).
Excerpt:
```
const usedDyeIds = new Set<number>([this.startDye.id, this.endDye.id]);
...
if (this.preventDuplicates && matchedDye && usedDyeIds.has(matchedDye.id)) {
```
Fix: seed `usedDyeIds` with every pinned dye id before the loop.

### webapp-tools-a1-06 BUG MEDIUM gradient-tool.ts:365-384, 434-436, 517-545 (swatch-tool.ts:3014-3024 same shape)
Claim: share-link settings (`steps`, `interpolation`, `algo`; swatch: `slot`, `algo`, `limit`, race, gender) are applied to tool-local state only. ConfigController and the sidebar never learn them (no code writes share params into the controller), and the next gradient/swatch config notification carries the controller's values, which `setConfig` applies as authoritative.
Failing input: open `/gradient/?start=..&end=..&steps=12&interpolation=oklch`, then toggle any display option (or any sidebar control).
Wrong outcome: steps snaps back to the controller value (8), `pinnedSteps.clear()` runs (line 522), colour space reverts; until then the sidebar shows values that do not match the ramp on screen.
Tests miss it: share-load tests run with a mocked ConfigController. Covered: no. Origin: MAIN.
Fix: after applying share params, write them through `ConfigController.setConfig('gradient'|'swatch', ...)`.

### webapp-tools-a1-07 BUG LOW swatch-tool.ts:405 (base-component.ts:156)
Claim: the resize listener is registered with `this.on(window, 'resize', ...)` in `onMount`, but `BaseComponent.update()` (run on every language change, swatch line 369) calls `unbindAllEvents()`, then `render()` and the empty `bindEvents()`. `onMount` does not run again.
Failing input: switch language, then rotate a phone / cross 768px.
Wrong outcome: `updateSwatchLayout` never runs again (grid stays at the old cell size, row/column layout stuck) until the tool is reopened.
Tests miss it: the re-render test (swatch-tool.test.ts:816) checks text only. Covered: no. Origin: MAIN.
Fix: register the listener in `bindEvents()`, or via `subs`.

### webapp-tools-a1-08 BUG LOW swatch-tool.ts:345-347, 958-1036 / gradient-tool.ts:397-399, 635-691 (market-board.ts:35)
Claim: in V4 the left panel renders into the same element the right panel then clears, yet every `update()` (language switch) builds a fresh CollapsiblePanel + MarketBoard (swatch) / + DyeSelector (gradient) and overwrites the fields without `destroy()` on the old ones. MarketBoard holds a `languageUnsubscribe` and a settings listener that only `destroy()` releases.
Failing input: switch language N times.
Wrong outcome: N detached MarketBoards/DyeSelectors keep subscribing to LanguageService and re-render into detached DOM; `this.showPrices = this.marketBoard.getShowPrices()` (swatch 1033) reads a never-displayed instance.
Tests miss it: no leak assertion. Covered: no. Origin: MAIN.
Fix: destroy the previous children at the top of `renderLeftPanel`, or stop rendering the left panel in V4 (dead-code audit owns the removal).

### webapp-tools-a1-09 BUG LOW swatch-tool.ts:2341
Claim: SEND TO uses `window.location.assign(url)`, a full document load. The loaded .chara lives in memory only (CharaSessionService; web-app CLAUDE.md: "a reload clears it").
Failing input: load a .chara, pick a slot, click SEND TO > Harmony.
Wrong outcome: the loaded character is discarded; back in Swatch the file card is empty. (The Glamour cross-link at 1552 uses `RouterService.navigateTo`.)
Tests miss it: chips are asserted by URL only. Covered: no. Origin: MAIN.
Fix: use `RouterService` / `handoffTo` (shared/tool-handoff.ts), which keeps the SPA and the session.

### webapp-tools-a1-10 BUG LOW gradient-tool.ts:1990-1999, 2075-2077
Claim: the result card's "Set as Start/End" and `transform-gradient` write the dye without the same-dye guard `selectDye` has. Cards are rendered for the endpoint rows too (every step).
Failing input: click "Set as End" on the card of the Start row.
Wrong outcome: start === end; the ramp is flat, the middle steps are matched against an identical anchor, and the share link carries `start=X&end=X`.
Tests miss it: none. Covered: no. Origin: MAIN.
Fix: reuse the swap/warn logic from `selectDye`, or disable the slot picker on endpoint cards.

### webapp-tools-a1-11 BUG LOW gradient-tool.ts:262-270, 301-304
Claim: custom-colour endpoints are persisted by their synthetic negative id; on reload `getDyeById` returns null and `.filter` drops them, so the remaining dye slides into the Start slot.
Failing input: Start = custom #FF0000, End = Dye X, reload.
Wrong outcome: Start = X, End empty (roles flip; the persisted list is never rewritten).
Tests miss it: none. Covered: no. Origin: MAIN.
Fix: do not persist custom dyes (or persist hex) and keep positional slots.

### webapp-tools-a1-12 BUG LOW swatch-tool.ts:2424 / gradient-tool.ts:2106
Claim: `navigator.clipboard.writeText(...).then(toast)` has no rejection handler.
Failing input: clipboard permission denied / insecure context.
Wrong outcome: unhandled rejection, no feedback to the user.
Covered: no. Origin: MAIN. Fix: `.catch(() => ToastService.error(...))`.

### webapp-tools-a1-13 UNTESTED MEDIUM swatch-tool.test.ts:723-733, 795, 553 / gradient-tool.test.ts:955, 973
Behaviour the tests were meant to catch: dye filters applied to matches (fails with candidate 04), the reverse match re-running after a sheet change (the test name says so; the body is `not.toThrow()` then `await flush()`), and display-option merge ("a second partial update must not wipe the first" asserts only not.toThrow). Origin: MAIN.

### webapp-tools-a1-14 REFACTOR P3 swatch-tool.ts (3146 lines), gradient-tool.ts (2755 lines)
Size hides the correctness risks above: desktop/mobile selectors are duplicated (swatch 1041-1227 vs 2515-2692; gradient 696-965 vs 2240-2497), with two copies of state sync that already drift (the mobile steps input skips `pinnedSteps.clear()`, gradient 2428-2439). Every V4 consumer passes `drawerContent: null` and clears the left panel, so a large share of both files is built and discarded (candidate 08). The dead-code audit owns removal; the live-code risk is the leak and the divergence. Mojibake literal at gradient-tool.ts:825 (a mis-encoded bullet in a runtime string, plus about ten comments): only reachable through the dead left panel today, but it would render garbage if that panel returned.

## POSITIVE
- BUG-093 request versioning in `loadColors` (swatch 238, 2702, 2741) is correct, including the stale branch returning early.
- `findClosestDyes` clamps count <= 0 (core BUG-056), so a corrupted `maxResults` cannot throw.
- The 5.0 share grammar (`slot` + `i`, stainID `start/end`, hex fallback slots, `resolveSharedEndpoint`) is consistent; no itemID leaks into share URLs.
- Dyes in the SEND TO chips are stainIDs (swatch 2311), matching the receivers.
- Gradient pins: endpoint/out-of-range pins dropped (1792), cleared on endpoint change (1785) and step-count change (522, 903); endpoint rows are hard-wired to drift 0.
- `.chara` character names are never read or rendered in either file; slot labels come from `charaSlotLabel`.
- Shadow-DOM styles: gradient injects its `<style>` into `right` (line 998), so it scopes inside the shell root.
- `destroy()` in both files releases child components, and via BaseComponent the subscriptions and timers.

## REJECTED
- Custom-dye id collisions in gradient (`d.id !== dye.id`, `endpointsKey`): `makeCustomDye` mints unique ids (`-(Date.now() + ++seq)`, custom-dye.ts:36).
- `activeEndpoint` never resets after a pick (gradient 2649-2677): the comment says "next pick" but sticky arming may be intended; cannot make it fail without a spec.
- Swatch `loadFromShareUrl` early `return` on a bad hex (3057) skipping the UI refresh: needs a malformed `hex` on top of a sheet change, and the constructor's load repaints anyway.
- Stale price fetch overwriting results (swatch `fetchPrices`, gradient `fetchPricesForDisplayedDyes`): both write a keyed cache and re-render from current state; no stale result wins.
- Swatch constructor persisting the file's tribe/gender over stored preferences (322-327): documented intent (CharaSessionService pin).
- `parseInt(... || '-1')` on `data-index` (swatch 703, 2783): values are produced by this file; NaN cannot arise.
- Prototype-key lookups: `SUBRACE_TO_CLAN_KEY[subrace]` is driven by `<option>` values built from RACE_GROUPS; share params are checked against a whitelist first.

## COVERED
2 files read in full: apps/web-app/src/components/swatch-tool.ts, apps/web-app/src/components/gradient-tool.ts.
Also read for confirmation: services/config-controller.ts (setConfig/notify/pin), components/base-component.ts (update/on/unbindAllEvents), components/v4/config-sidebar.ts (swatchConfig, handleConfigChange), shared/tool-config-types.ts defaults, shared/custom-dye.ts, shared/dye-filter-utils.ts, core CharacterColorService.findClosestDyes, v4-layout.ts tool construction, tool-handoff.ts head. Tests skimmed: swatch-tool.test.ts, gradient-tool.test.ts (grep + targeted reads).
