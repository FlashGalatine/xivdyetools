# Review: webapp-tools-b (web-app tools B — extractor / harmony / accessibility / budget / market / dye-selector family)

Scope: `apps/web-app/src/{components,services,shared}` — extractor, harmony, accessibility, budget,
market-board (+ service), dye-selector/grid/search-box, advanced-options-panel, metric-help,
export-sheet, palette-export, dye-filter-utils, spectrum-filter-utils, image-zoom-controller,
harmony-generator, harmony-icons. All 20 in-scope files appear in
`changed-src-since-e7ac4042.txt` (none previously audited under this shape).

## 1. Map

| File | Role |
|---|---|
| `components/extractor-tool.ts` | Palette Extractor — 4A loupe/bar/sheet flow, K-means, no share |
| `components/image-zoom-controller.ts` | Canvas zoom/pan/sample; emits `image-sampled`/`loupe-move`/`loupe-end` |
| `components/harmony-tool.ts` | Harmony Explorer — wraps core `generateHarmonySlots`, 5 wheels, share |
| `services/harmony-generator.ts` | UI vocabulary only (type ids/icons/names) — no selection logic |
| `shared/harmony-icons.ts` | Glyph shim over `@xivdyetools/svg` |
| `components/accessibility-tool.ts` | 6A Lens: vision sim, pair readout, share |
| `components/budget-tool.ts` | 9C Ledger — consolidation-tier pricing, share |
| `components/market-board.ts` | Server select + show-prices toggle, delegates to service |
| `services/market-board-service.ts` | Singleton price cache, request-versioned race protection |
| `services/world-service.ts` | World/DC lookup singleton |
| `services/pricing-mixin.ts` | Shared market-board DOM-event wiring helper |
| `components/dye-selector.ts` | Search+grid+favorites composite, keyboard shortcut |
| `components/dye-grid.ts` | Dye tile grid, roving tabindex, favorites/collections buttons |
| `components/dye-search-box.ts` | Search/sort/category sub-control (debounced) |
| `components/advanced-options-panel.ts` | Settings slide-over: reset/export/import/toggles |
| `components/metric-help.ts` | Pair-readout / method-switch explainer panels |
| `components/export-sheet.ts` | Modal wrapper over `palette-export` generators |
| `shared/palette-export.ts` | Pure CSS/SCSS/JSON/HEX/Tailwind generators |
| `shared/dye-filter-utils.ts` | Coffer-exclusion overlay on core's filter fns |
| `shared/spectrum-filter-utils.ts` | Consolidation-spectrum (A/B/C/unconsolidated) filter |

## 2. Candidates

### webapp-tools-b-01 — BUG — MEDIUM
`apps/web-app/src/components/extractor-tool.ts` (whole file — no `ShareService` import;
contrast `harmony-tool.ts:1100`, `budget-tool.ts:1189`, `accessibility-tool.ts:836`, all of
which mount a `v4-share-button`).
**Claim**: the 4A Extractor rebuild dropped share-link generation/consumption entirely, while
`og-worker` still serves a dedicated `/og/extractor/:colors.png` card
(`apps/og-worker/src/index.ts:1042-1082`, comment "5.0, net-new") and
`ShareService` still declares `ExtractorShareParams` and title/description strings for
`'extractor'` (`share-service.ts:114-117,285-286,313-314`).
**Failing input → wrong outcome**: open `/extractor`, extract a palette — there is no Share
button anywhere in the workspace (`buildSectionHeader()` only wires Export), so a user cannot
produce the `/extractor?colors=...` link the OG card and the localized embed strings (6
languages, `og-embed.ts:58-60`) exist to serve. The feature is a dead end from the sender side.
**Why tests miss it**: `extractor-tool.test.ts` has no "share" describe block at all (grep hits
are all the unrelated `matcher.imageShare` dominance-bar string).
**Covered by test**: no.
```ts
// extractor-tool.ts — buildSectionHeader(): only these two actions exist
actions.appendChild(this.resultsCountElement);
this.exportBtn = this.createElement('button', { textContent: LanguageService.t('common.export'), ... });
actions.appendChild(this.exportBtn);   // no v4-share-button, anywhere in the file
```
**Fix direction**: either mount a `v4-share-button` (params: extracted hex+share pairs) and a
`loadFromShareUrl()` parallel to the other 3 tools, or remove `ExtractorShareParams` / the
og-worker route / the embed strings as a deliberate deprecation — currently the two halves
disagree silently.

### webapp-tools-b-02 — UNTESTED — priority: name the merge behaviour
`apps/web-app/src/components/__tests__/extractor-tool.test.ts:448-452`
**Claim**: `it('merges displayOptions rather than replacing them', ...)` never exercises what
its name promises.
```ts
it('merges displayOptions rather than replacing them', () => {
  tool = mount();
  expect(() => tool!.setConfig({ displayOptions: { showHex: false } as never })).not.toThrow();
});
```
Only one `setConfig` call, one assertion (`not.toThrow()`), no second partial update, no read of
resulting `displayOptions` state. The behaviour this test was meant to catch — a second partial
`setConfig({ displayOptions: {...} })` call clobbering the fields not present in that call —
is completely unobserved; `tool.setConfig({ displayOptions: { showRgb: true } })` after the
first would pass whether or not `showHex` survived.
**Covered by test**: no (this IS the test, and it cannot fail on the behaviour it names).

### webapp-tools-b-03 — UNTESTED — same pattern, second file
`apps/web-app/src/components/__tests__/accessibility-tool.test.ts:816-821`
```ts
it('merges displayOptions rather than replacing them', () => {
  tool = mount();
  tool.setConfig({ displayOptions: { showHex: true } as never });
  expect(() => tool!.setConfig({ displayOptions: { showRgb: true } as never })).not.toThrow();
});
```
Two `setConfig` calls this time (closer to a real merge scenario) but the assertion is still
only `not.toThrow()` on the second call — nothing reads `cardDisplayOptions` (or any rendered
card's `showHex`) afterward to confirm the first call's `showHex: true` survived the second,
narrower update. `applyDisplayOptions()` merging is exactly the kind of silent-regression risk
(a future refactor that replaces instead of spreads) this test's name claims to guard.
**Covered by test**: no.

### webapp-tools-b-04 — BUG — LOW
`apps/web-app/src/components/image-zoom-controller.ts:579-600` (mousedown) and `:651-682`
(mouseup).
**Claim**: the drag-vs-click gesture never checks `MouseEvent.button`, so a right-click (button
2) also starts the loupe-sampling gesture.
**Failing input → wrong outcome**: right-click on the extractor canvas → `mousedown` sets
`isDragging = true` unconditionally → `mouseup` unconditionally calls
`sampleColorAtArea(coords.x, coords.y)`, updating the loupe/hint chip to a colour the user did
not intend to sample, at the same moment the browser's native context menu opens over the image
— a confusing double effect on an action that should be a no-op for this tool.
**Why tests miss it**: `image-zoom-controller.test.ts` only ever synthesizes default (`button:
0`, left-click) `MouseEvent`s (`test.ts:137`); no test exercises `button: 2`.
**Covered by test**: no.
```ts
this.on(this.canvasRef, 'mousedown', (e: Event) => {
  ...
  const mouseEvent = e as MouseEvent;
  if (mouseEvent.ctrlKey || mouseEvent.metaKey) { /* pan */ return; }
  startClientX = mouseEvent.clientX;   // no `if (mouseEvent.button !== 0) return;` guard
  ...
  isDragging = true;
```
**Fix direction**: bail out at the top of the `mousedown` handler when `mouseEvent.button !== 0`.

### webapp-tools-b-05 — BUG — LOW
`apps/web-app/src/components/market-board.ts:373-379` (`refreshPrices()`).
**Claim**: a raw `setTimeout` bypasses `BaseComponent.safeTimeout()`, so it is never cancelled
on destroy.
```ts
if (statusMsg) {
  statusMsg.textContent = LanguageService.t('marketBoard.pricesRefreshed');
  setTimeout(() => {
    statusMsg.textContent = '';
  }, 3000);
}
```
**Failing input → wrong outcome**: click Refresh, then close the Market Board panel (or navigate
away, destroying the tool) inside the 3-second window. `destroy()` → `unbindAllEvents()` +
`clearAllTimeouts()` only clears timers registered via `safeTimeout`; this one is not tracked,
so it still fires ~3s later and writes to `statusMsg`, a detached `HTMLElement` no longer in the
DOM. No crash and no visible symptom today, but it is exactly the "timer registered without a
teardown path" pattern called out generically, and a future change that makes `statusMsg` refer
to something reused (a pooled node) would silently corrupt it.
**Why tests miss it**: no `market-board.test.ts` case advances fake timers past `destroy()`.
**Covered by test**: no.
**Fix direction**: `this.safeTimeout(() => { statusMsg.textContent = ''; }, 3000)`.

## 3. POSITIVE

- `MarketBoardService.fetchPricesForDyes` — real request-versioning race guard (`requestVersion`
  increments per call, stale responses are dropped even for a *successful* late response), and
  the tri-state `PriceFetchOutcome` (`ok`/`nothing-to-fetch`/`superseded`/`error`) correctly stops
  a superseded fetch from being read as "market offline" (BUG-075) — every consumer
  (budget-tool, harmony-tool, extractor-tool) reads `lastFetchOutcome` rather than `size === 0`.
- Consolidated-dye price fan-out (`market-board-service.ts:367-380`) correctly re-keys a
  shared consolidated-itemID price back onto every original dye's own `itemID`, so
  `budget-tool.priceOf()` / `extractor-tool.applyMarketState()` can look up by `dye.itemID`
  without knowing about consolidation.
- `harmony-tool.ts` and `budget-tool.ts` share-param builders correctly use `dye.stainID` (with
  a `hex` fallback for virtual/custom dyes) — no itemID leaked into a share URL anywhere in this
  unit.
- `dye-grid.ts` and `dye-selector.ts` correctly unsubscribe their `CollectionService` favourites
  subscriptions in `destroy()` (including the composite's own children,
  `dye-selector.ts:709-729`, ordered child-before-`super.destroy()` per the documented BUG-071
  fix) — no favourites-listener leak found in this pass.
- `extractor-tool.ts`'s K-means empty-cluster guard (`.filter((cluster) => cluster.pixelCount >
  0)`, line 2079) correctly drops clusters K-means allocated but never populated; the doc
  comment states the intent and the code matches it.
- `palette-export.ts` is genuinely pure (no DOM/service imports) and its identifier-suffix logic
  (`suffix()`) correctly avoids emitting a stuttering `--dye-1-dye` when only one half of a pair
  is present.

## 4. REJECTED

- *Canvas taint on `getImageData`* (`image-zoom-controller.ts:541,785`; `extractor-tool.ts:2061`)
  — no try/catch around any `getImageData` call. Checked whether this is reachable: every image
  arrival path (`handleDroppedFile`) goes through `FileReader.readAsDataURL()` → `new
  Image().src = dataUrl`, never a remote/cross-origin URL, so the canvas can never be tainted in
  this app. Not a live bug.
- *EXIF orientation* — brief calls this out as an area to check; no EXIF handling exists
  anywhere in scope, but all evergreen browsers auto-apply EXIF orientation at image-decode time
  per the current HTML spec (`image-orientation: from-image` is the default), so the canvas draw
  already gets the corrected pixels. Not a live bug absent a specific broken-browser target.
- *`selectDye` persisting a custom (negative synthetic) dye id to storage*
  (`budget-tool.ts:1887`, `accessibility-tool.ts:365`) — on reload,
  `dyeService.getByStainId`/`getDyeById` simply misses and the tool falls back to no
  restored target/selection. Confirmed this degrades gracefully (empty state), not a crash or
  wrong-dye display.
- *`handleDeepLink` in `harmony-tool.ts`/`budget-tool.ts` reading `maxDeltaParam`/`hexParam` via
  `Number()`/regex* — traced both: `Number('')` → `0` → clamped to the default by
  `clampMatchLine`; hex is regex-validated before use. No NaN reaches a render path.
- *`dyeGrid`'s missing initial roving `tabindex`* — already filed and accepted as a deliberate,
  documented follow-up (`dye-grid.ts:112-114`, DEAD-015, 2026-08-16 audit); not re-filed.

## 5. COVERED

20 source files read in full:
`components/extractor-tool.ts`, `components/image-zoom-controller.ts`,
`components/harmony-tool.ts`, `services/harmony-generator.ts`, `shared/harmony-icons.ts`,
`components/accessibility-tool.ts`, `components/budget-tool.ts`, `components/market-board.ts`,
`services/market-board-service.ts`, `services/world-service.ts`, `services/pricing-mixin.ts`,
`components/dye-selector.ts`, `components/dye-grid.ts`, `components/dye-search-box.ts`,
`components/advanced-options-panel.ts`, `components/metric-help.ts`,
`components/export-sheet.ts`, `shared/palette-export.ts`, `shared/dye-filter-utils.ts`,
`shared/spectrum-filter-utils.ts`.

Also read to confirm claims: `components/base-component.ts`, `shared/custom-dye.ts`,
`services/share-service.ts`, `packages/core/src/services/dye/DyeDatabase.ts` (id/itemID map
keying), `apps/og-worker/src/index.ts` + `services/og-embed.ts` (extractor OG route still
live), `apps/web-app/CHANGELOG.md` (5.8.0 extractor 4A entry).

Test files spot-checked (grep + targeted reads, not full line-by-line): `extractor-tool.test.ts`
(1860 lines), `harmony-tool.test.ts` (1147), `accessibility-tool.test.ts` (850),
`budget-tool.test.ts` (747), `image-zoom-controller.test.ts` (741),
`advanced-options-panel.test.ts` (581), `dye-grid.test.ts` (588), `dye-selector.test.ts` (541),
`dye-search-box.test.ts` (478), `market-board.test.ts` (448), `export-sheet.test.ts` (408),
`metric-help.test.ts` (187) — total 8,576 lines, not exhaustively read line-by-line given the
20-file source scope; the two UNTESTED candidates above were found by grepping for
`merge|persist|restore|sync|combin` test names and reading their bodies, which is the pattern
most likely to hide a not-quite-tested claim per the brief's "tests that cannot fail" guidance.
