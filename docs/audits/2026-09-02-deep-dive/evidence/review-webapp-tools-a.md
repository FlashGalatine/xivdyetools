# review-webapp-tools-a

Unit: `webapp-tools-a` — five web-app tool components + their base class.
Deploy unit: `web-app` (Vite + Lit, Cloudflare Pages). Worktree: `origin/main` e7ac4042.

## 1. Map

| Module | Lines | Role | Entry points |
|---|---|---|---|
| `apps/web-app/src/components/base-component.ts` | 738 | Abstract base: render/bindEvents/destroy, `this.on()` listener bag, `safeTimeout`, `SubscriptionManager` (`this.subs`), error boundary | read-only (other reviewer files defects) |
| `apps/web-app/src/components/swatch-tool.ts` | 3132 | Character-colour sheet → dye matching; reverse match (dye → swatch); `.chara` import; palette rail; SEND TO handoff | `setConfig`, `setMarketConfig`, `selectDye`, `selectCustomColor`, `clearDyes`, share `?slot=&i=&race=&gender=&algo=&limit=` |
| `apps/web-app/src/components/extractor-tool.ts` | 2803 | Image → palette (K-means) + single-pixel sample → dye matching; loupe/roll; market prices | `setConfig`, drop/paste/camera, `image-sampled`/`loupe-*` events |
| `apps/web-app/src/components/gradient-tool.ts` | 2755 | Two endpoints → interpolated ramp (rgb/hsv/lab/oklch/lch) + pin rail + dual band + export | `setConfig`, `selectDye`, `selectCustomColor`, `clearDyes`, share `?start=&end=&hexStart=&hexEnd=&steps=&interpolation=&algo=` |
| `apps/web-app/src/components/comparison-tool.ts` | 2520 | 1–4 dyes, pair chips, 7C duel (verdict, what-differs, seven readouts) | `setConfig`, `addDye`/`selectDye`, `selectCustomColor`, `clearDyes`, share `?dyes=` |
| `apps/web-app/src/components/mixer-tool.ts` | 2207 | Two-dye blend (6 models × 5 ratios field) → dye matching | `setConfig`, `selectDye`, `selectCustomColor`, `clearDyes`, share `?dyeA=&dyeB=&hexA=&hexB=&ratio=&mode=&algo=` |

Supporting files read to confirm claims: `packages/core/src/services/ColorService.ts`,
`.../PaletteService.ts`, `.../dye/DyeSearch.ts`, `.../dye/DyeDatabase.ts`,
`.../CharacterColorService.ts`, `packages/core/src/config/band-calibration.ts`,
`apps/web-app/src/components/v4/result-card.ts`, `.../v4/share-button.ts`,
`apps/web-app/src/services/market-board-service.ts`, `apps/web-app/src/shared/custom-dye.ts`,
`apps/web-app/src/shared/utils.ts`, `apps/web-app/src/components/image-zoom-controller.ts`.

## 2. Candidates

---

### webapp-tools-a-01 — BUG — **HIGH** — `apps/web-app/src/components/extractor-tool.ts:2089`, `:2094`, `:2155-2156`

**Claim.** The extractor writes a raw **RGB Euclidean** distance (0–441.67) into
`ResultCardData.deltaE` while telling the card the method is `ciede2000`, so every result card
prints an RGB number as a ΔE2000 value and colours its tier from it.

**Failing input → wrong outcome.** Default settings (`matchingMethod = 'ciede2000'`), sample any
pixel. `ColorService.getColorDistance` is `ColorConverter.getColorDistance` — plain Euclidean RGB
(`ColorService.ts:151-153`, docstring "~441.67 for white vs black"), **not** ΔE2000. The card's
guard trusts the supplied number precisely when the method is ciede2000:

```ts
// v4/result-card.ts:998-1000
const { deltaE, matchingMethod, originalColor, matchedColor } = this.data;
if (deltaE !== undefined && (matchingMethod === undefined || matchingMethod === 'ciede2000')) {
  return deltaE;                     // trusted verbatim → printed + tier-coloured
}
```

MATCH cuts are `[5, 10, 20]` (`band-calibration.ts:68`), so an RGB distance of ~35 for a good
match renders "35.00" in the worst tier colour where the true ΔE2000 is ~5. The mis-scaling is
systematic — nearly every extractor card shows an inflated number and an amber/red tier.

```ts
// extractor-tool.ts:2087-2095
const closestDyeWithDistance: DyeWithDistance = {
  ...closestDye,
  distance: ColorService.getColorDistance(hex, closestDye.hex),   // RGB Euclidean
};
const withinDistanceWithCache: DyeWithDistance[] = withinDistance.map((dye) => ({
  ...dye, distance: ColorService.getColorDistance(hex, dye.hex),  // RGB Euclidean
}));
// :2155-2156  deltaE: dye.distance,  matchingMethod: this.matchingMethod,
```

The same hole exists on the auto-extract path: `PaletteService.extractAndMatchPalette` sets
`distance = rgbDistance(ex.color, matchedDye.rgb)` (`PaletteService.ts:463`), and
`extractor-tool.ts:2673-2674` forwards it as `deltaE` with `matchingMethod: this.matchingMethod`.
`deduplicatePaletteResults` repeats it at `:2600`. Ironically the bug **disappears** when the user
picks a non-default method, because the card then recomputes ΔE2000 from the colour pair.

**Why tests miss it.** `extractor-tool.test.ts:1209-1271` only asserts the *method string* reaching
`findClosestDye`; no test reads `data.deltaE`. The export test asserts `delta: expect.any(Number)`
(`:1464`) — true for any scale.

**Covered by test:** no.

**Fix direction.** Compute displayed distances with
`ColorService.getDistanceForMethod(hex, dye.hex, this.matchingMethod)` in `matchColor` /
`deduplicatePaletteResults`, and recompute the palette distance the same way after
`extractAndMatchPalette` (or pass `matchingMethod` and have PaletteService return it in that unit).

---

### webapp-tools-a-02 — BUG — **MEDIUM** — `apps/web-app/src/components/extractor-tool.ts:2391-2393`

**Claim.** Auto-extract never passes `matchingMethod` to `extractAndMatchPalette`, so the palette's
dye choices always use ΔE2000 regardless of the sidebar setting — while `setConfig` re-runs the
whole K-means on a method change for an identical result.

**Failing input → wrong outcome.** Set the algorithm to `redmean` (or `oklab`, `rgb`, …) in the
config sidebar with an image loaded. `setConfig` sets `needsReextract` (`:503-507`) and calls
`extractPalette()` (`:530-531`); the extraction re-runs but the matches are byte-identical because
the option is omitted, while the cards' `matchingMethod` label changes. The control is inert on the
tool's headline path.

```ts
// extractor-tool.ts:2391-2393
const matches = this.paletteService.extractAndMatchPalette(pixels, dyeService, {
  colorCount: this.paletteColorCount,          // no matchingMethod
});
// PaletteService.ts:456-459 — options.matchingMethod ? {...} : undefined → DEFAULT (ciede2000)
```

**Why tests miss it.** The auto-extract suite (`extractor-tool.test.ts:1316-1426`) never inspects
the options passed to `extractAndMatchPalette`; the method tests only exercise the single-sample
path.

**Covered by test:** no.

**Fix direction.** Pass `matchingMethod: this.matchingMethod` in the options object.

---

### webapp-tools-a-03 — BUG — **MEDIUM** — `apps/web-app/src/components/extractor-tool.ts:2098`

**Claim.** The closest dye is prepended to a `findDyesWithinDistance` list that already contains it,
so the top match renders as two identical cards and the count over-reports by one.

**Failing input → wrong outcome.** Sample any pixel with no filters active. `findDyesWithinDistance`
returns dyes within `maxDistance` **sorted ascending, closest first** and does not exclude the
overall closest (`packages/core/src/services/dye/DyeSearch.ts:288-311`); with `maxDistance: 100`
against a ΔE2000 scale that tops out near 100, the nearest dye is always inside the threshold.

```ts
// extractor-tool.ts:2056-2061, 2098
let closestDye = dyeService.findClosestDye(hex, { matchingMethod: this.matchingMethod });
let withinDistance = dyeService.findDyesWithinDistance(hex, { maxDistance: 100, limit: 9, … });
…
this.matchedDyes = [closestDyeWithDistance, ...withinDistanceWithCache];  // dupe at [0] and [1]
```

`renderMatchedResults` then prints `String(this.matchedDyes.length)` = 10 for 9 distinct dyes
(`:2129`). Secondary: `maxDistance: 100` is a ΔE2000-shaped constant applied to every method —
meaningless for `rgb` (0–441), `redmean` (0–765) and `distinguish` (0–100 = "everything").

**Why tests miss it.** `extractor-tool.test.ts:1116` compares `new Set(after)`, which swallows
duplicates; `:1119-1129` only checks `resultCards()[0]`.

**Covered by test:** no.

**Fix direction.** Drop the prepend and rely on the sorted `withinDistance` list (or de-duplicate by
`itemID` before assigning `matchedDyes`); scale `maxDistance` per method.

---

### webapp-tools-a-04 — BUG — **HIGH** — `apps/web-app/src/components/swatch-tool.ts:318-322`

**Claim.** Three independent `loadColors()` calls race on the single `this.colors` field with no
generation token; a slower earlier load resolving last replaces the on-screen palette with the
previous category's colours and repaints the grid.

**Failing input → wrong outcome.** Stored category is `hairColors` (or `skinColors`); open a share
link `/swatch/?…&slot=eyeColors&i=5`.

1. The constructor starts `loadColors()` for **hairColors** → `await getHairColors(...)`, which is a
   lazy `import()` of `hair_colors.json` (`CharacterColorService.ts:164-186, 225-228`) — a real chunk
   fetch.
2. `onMount` → `loadFromShareUrl()` sets `this.colorCategory = 'eyeColors'`, awaits `loadColors()`
   (synchronous branch, resolves on the next microtask), selects cell 5, renders the eye grid and
   runs `findMatchingDyes()`.
3. The hair chunk resolves → `this.colors = <hair colours>` and the constructor callback fires
   `updateColorGrid()`.

Result: the grid shows **hair** swatches under an "Eye Colors — 192" heading, the selection ring is
gone, `buildSelectionExcerpt(5)` (`:2145-2207`) reads the hair array for an eye-sheet address, and
the match cards below still describe the eye colour. The sync-vs-chunk ordering makes this
deterministic, not flaky.

```ts
// swatch-tool.ts:318-322 (constructor)
void this.loadColors().then(() => {
  if (!this.isDestroyed && this.colorGridContainer) {
    this.updateColorGrid();          // no check that colorCategory still matches
  }
});
```

The same unguarded pattern is at `:501-510` (`setConfig` reload), `:591-596` (`handleIncomingDye`)
and in all four selector `change` handlers (`:1068`, `:1113`, `:1193`, `:2561`, `:2606`, `:2684`) —
two fast category switches between hair and skin can also land out of order.

**Why tests miss it.** `swatch-tool.test.ts:224-267` mocks `CharacterColorService` so **every**
getter returns the same `mockColors` array and the async getters resolve immediately — an
out-of-order resolution substitutes an identical array, so no assertion can move.

**Covered by test:** no.

**Fix direction.** Capture a load token (`const token = ++this.loadSeq` plus the category) before
awaiting and drop the result when `token !== this.loadSeq`.

---

### webapp-tools-a-05 — BUG — **MEDIUM** — `apps/web-app/src/components/mixer-tool.ts:1298-1306`

**Claim.** The mixer's share params are only refreshed inside `showEmptyState()`; tapping a mixing-
field cell (or changing the model/algorithm from the sidebar) updates the blend but not the share
button, so Share copies a link that reproduces the *previous* ratio/model/algorithm.

**Failing input → wrong outcome.** Select Ink Blue + Snow White (share params captured:
`ratio: 50, mode: 'ryb', algo: 'ciede2000'`). Tap the field cell **OKLAB / 90-10**. The blend, the
result cards and the crafting slot all update; the copied link still says `ratio=50&mode=ryb`, so the
recipient opens a visibly different colour.

```ts
// mixer-tool.ts:1298-1306 — field cell click
this.on(cell, 'click', () => {
  this.mixingMode = model;  this.mixRatio = r / 100;
  this.blendedColor = blendTwoColors(dyeA.hex, dyeB.hex, model, t);
  this.findMatchingDyesInternal();
  this.updateCraftingUI(); this.renderResultsGrid(); this.renderMixingField();
});                                   // ← no updateShareButton()
```

`updateShareButton()` (`:1933`) has exactly one caller, `showEmptyState()` (`:1856`), and
`ShareButton` reads its stored `shareParams` property at click time
(`v4/share-button.ts:94-95, 286-289`). `setConfig`'s `mixingMode` / `matchingMethod` branches
(`:891-909`, apply block `:939-952`) have the same gap, leaving a stale `mode`/`algo`.

**Why tests miss it.** `mixer-tool.test.ts:731-834` reads `shareParams` only right after
`selectDye`/`selectCustomColor` — i.e. immediately after the one path that does refresh it.

**Covered by test:** no.

**Fix direction.** Call `this.updateShareButton()` from the field-cell handler and from `setConfig`'s
apply block (or make `showEmptyState` no longer the sole owner).

---

### webapp-tools-a-06 — BUG — **MEDIUM** — `apps/web-app/src/components/swatch-tool.ts:2203`, `:2298`, `:1751`; `extractor-tool.ts:1924`; `gradient-tool.ts:1421`, `:1486`; `comparison-tool.ts:1347`, `:1882`

**Claim.** `this.on()` is used inside re-render paths, but `BaseComponent.listeners` is a
never-pruned `Map` keyed by a monotonic counter — every re-render appends entries that hold strong
references to detached DOM nodes until the tool is destroyed.

**Failing input → wrong outcome.** Click 100 swatch grid cells. Each click runs
`selectColor` → `findMatchingDyes` → `updateMatchResults` → `updateHandoffRow` (+4 `this.on`
chips, `:2298`) and `updateSelectionCard` → `buildSelectionExcerpt` (+up to 40 `this.on` cells,
`:2203`); `updateColorGrid` adds 7–9 more via `renderPaletteRail` (`:1751`). ~44 Map entries per
click, each retaining a removed `<button>` and its closure → ~4,400 detached nodes retained. The
extractor adds ~21 per pixel sample (`renderRollStrip`, `:1924` + `renderColorInfoCard`, `:1845`);
gradient adds ~2 per ramp step per `renderPinRail`; comparison re-registers the whole duel
(`:1347`, `:1882`) on every pair-chip click.

```ts
// base-component.ts:605-608 — entries are only removed by unbindAllEvents()
const key = `${eventName}_${++this.listenerCounter}`;
this.listeners.set(key, { target, event: eventName, handler: boundHandler });
// unbindAllEvents() is reached only from update() and destroy()
```

`clearContainer` (`shared/utils.ts:34-49`) removes children but never touches the Map.

**Why tests miss it.** No suite asserts on `listeners.size` or on retained nodes; the
"lifecycle under interaction" blocks only check `destroy()` does not throw.

**Covered by test:** no.

**Fix direction.** For elements rebuilt on every render, use a plain `addEventListener` on the
element (it dies with the node), or give `BaseComponent` a scoped bag that a re-render can clear.

---

### webapp-tools-a-07 — BUG — **LOW** — `apps/web-app/src/components/extractor-tool.ts:2395` / `:2626` / `:2791`

**Claim.** Export publishes the **raw** palette while the grid shows the **de-duplicated** one, so
the exported list can contain a dye the user can see was replaced.

**Failing input → wrong outcome.** `preventDuplicates` on (default) and an image where two clusters
resolve to the same dye: `renderPaletteResults` reassigns its local parameter
(`matches = this.deduplicatePaletteResults(matches)`, `:2626`) but `this.lastPaletteResults` keeps
the raw list (`:2395`). `openPaletteExport()` maps `this.lastPaletteResults` (`:2791`), so the export
lists dye X twice where the grid shows X and its alternative.

**Why tests miss it.** The export test (`extractor-tool.test.ts:1445-1466`) only checks
`entries.length > 0` and the shape of `entries[0]`.

**Covered by test:** no.

**Fix direction.** Store the de-duplicated list (or run the same dedupe inside `openPaletteExport`).

---

### webapp-tools-a-08 — BUG — **LOW** — `apps/web-app/src/components/gradient-tool.ts:261-269`

**Claim.** A custom-colour START endpoint is dropped on reload and the END dye is silently promoted
into the START slot.

**Failing input → wrong outcome.** Pick a custom colour as START (`makeCustomDye` mints a negative
synthetic id, `shared/custom-dye.ts:40-44`) and a real dye as END, then reload.
`saveSelectedDyes()` persists `[-1756…, 48227]`; `loadSelectedDyes()` maps through `getDyeById`
(null for the synthetic id) and `.filter(dye => dye !== null)` collapses the positional array to
`[48227]` — the END dye reopens as the START. The share path documents and accepts the same
collapse (`:357-361`); the storage path does it silently.

**Why tests miss it.** `gradient-tool.test.ts:714-747` exercises `selectCustomColor` in-session
only; there is no reload round-trip through `loadSelectedDyes`.

**Covered by test:** no.

**Fix direction.** Persist `null` placeholders (as `mixer-tool` does with its
`[number|null, number|null, number|null]` tuple) so slots keep their position.

---

### webapp-tools-a-09 — BUG — **LOW** — `apps/web-app/src/components/extractor-tool.ts:1505-1515`

**Claim.** `handleDroppedFile` registers neither `reader.onerror` nor `img.onerror`, so a corrupt or
undecodable image arriving by drop, Ctrl+V, the file dialog or the camera fails completely silently.

**Failing input → wrong outcome.** Drop a `.png` whose bytes are truncated: the `FileReader`
succeeds, `img.onload` never fires, nothing is rendered and no toast appears — the drop zone just
sits there. (The left-panel `ImageUploadDisplay` path does emit an `error` event, handled at
`:303-307`; this shared path does not.)

```ts
// extractor-tool.ts:1505-1515
const reader = new FileReader();
reader.onload = (e) => { const img = new Image(); img.onload = () => {…}; img.src = dataUrl; };
reader.readAsDataURL(file);            // no reader.onerror, no img.onerror
```

**Why tests miss it.** `extractor-tool.test.ts:758-881` stubs a successful decode only.

**Covered by test:** no.

**Fix direction.** Add `reader.onerror` / `img.onerror` handlers raising
`ToastService.error(LanguageService.t('errors.imageLoadFailed'))`.

---

### webapp-tools-a-10 — BUG — **LOW** — `apps/web-app/src/components/swatch-tool.ts:293`/`:392`, `comparison-tool.ts:173`/`:326`

**Claim.** Two `destroy()` cleanup hooks are declared and invoked but never assigned — the cleanup
they advertise does not exist.

**Failing input → wrong outcome.** `grep` over both files shows exactly two occurrences each:
`private resultsPanelMediaQueryCleanup: (() => void) | null = null;` (`swatch-tool.ts:293`) and
`this.resultsPanelMediaQueryCleanup?.();` (`:392`); likewise `marketBoardEventCleanup`
(`comparison-tool.ts:173`, `:326`). Both are permanently `null`, so the optional call is a no-op.
Latent: it reads as "the media-query listener / market-board subscription is torn down" when nothing
registers one. (The 2026-09-01 dead-code sweep could not see these — knip does not analyse class
members.)

**Why tests miss it.** Dead fields produce no observable behaviour.

**Covered by test:** no.

**Fix direction.** Delete both fields and their calls, or wire the assignment they imply.

---

### webapp-tools-a-11 — BUG — **LOW** — `apps/web-app/src/components/gradient-tool.ts:1512-1513`

**Claim.** The "avg drift" summary averages over the two endpoint steps, whose distance is forced to
`0`, so the headline number is systematically diluted.

**Failing input → wrong outcome.** `stepCount = 3` with one middle step at ΔE 12 reports
`avg 4.0` (`(0 + 12 + 0) / 3`). Endpoints resolve to themselves at distance 0 by construction
(`:1815-1823`), so they carry no information about how well the ramp is realised.

```ts
// gradient-tool.ts:1512-1513
const drifts = this.currentSteps.filter((s) => s.matchedDye).map((s) => s.distance);
const avgRaw = drifts.length ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0;
```

The MAX line beside it (`:1529`) is unaffected and carries the honest signal.

**Why tests miss it.** `gradient-tool.test.ts:544-571` asserts the label *key* and that a number is
present, never the arithmetic.

**Covered by test:** no.

**Fix direction.** Exclude `i === 0 || i === last` from the average (or label it "avg middle drift").

---

### webapp-tools-a-12 — BUG — **LOW** — `apps/web-app/src/components/comparison-tool.ts:1236-1247`

**Claim.** `activePair` holds array indices, and `ensureActivePair` only bounds-checks them, so
removing an *earlier* dye silently re-points the duel at a different pair.

**Failing input → wrong outcome.** Select A, B, C, D; click the A×B chip (`activePair = [0, 1]`);
remove A. `selectedDyes` becomes `[B, C, D]`; `0 < 3 && 1 < 3 && 0 !== 1` all hold, so the pair is
judged valid and the duel now shows **B×C** — a pair the user never picked — rather than falling
back to the closest pair as the code intends.

**Why tests miss it.** No test removes a dye while a non-default pair is active.

**Covered by test:** no.

**Fix direction.** Key `activePair` by dye `id` (or re-resolve indices from the ids on every
mutation) instead of by position.

---

### webapp-tools-a-13 — UNTESTED — **MEDIUM** — `apps/web-app/src/components/__tests__/*.test.ts`

**Claim.** A cluster of tool tests whose names promise behaviour their assertions cannot observe:
the guarded `not.toThrow()` / constant-mock shapes from the brief's checklist. 81 `not.toThrow()`
or `typeof === 'function'` assertions across the five suites (swatch 23, mixer 23, gradient 14,
extractor 12, comparison 9). The ones where the name and the assertion actually diverge:

| Test | Behaviour it claims to protect | Why it cannot fail |
|---|---|---|
| `mixer-tool.test.ts:880-886` "recomputes the blend when the mode changes with two inputs set" | `setConfig` re-blends on `mixingMode` | asserts only `not.toThrow()`; deleting the whole `mixingMode` branch (`mixer-tool.ts:891-902`) keeps it green |
| `mixer-tool.test.ts:895-898` "accepts a matchingMethod change" | re-match on algorithm change | `not.toThrow()` only |
| `gradient-tool.test.ts:968-973` "recomputes against the new settings when endpoints are set" | `setConfig` re-interpolates | `not.toThrow()` only |
| `swatch-tool.test.ts:710-717` "re-runs the reverse match when the sheet changes underneath it" | reverse highlights follow the palette | `not.toThrow()` only; the whole `if (this.reverseDyeHex) performReverseMatch()` (swatch-tool.ts:1916-1918) could be deleted |
| `extractor-tool.test.ts:1414-1425` "may repeat a dye once deduplication is switched off" | `preventDuplicates: false` reaches the dedupe pass | asserts `resultCards().length > 0`, true either way |
| `swatch-tool.test.ts:224-267` (mock) | every colour sheet is distinct data | all nine getters return the **same** `mockColors` array — a wrong-sheet render is unobservable (this is what hides `-04`) |

**Fix direction.** Give each of these a real observation point: assert the options object reaching
the mocked matcher, assert the grid's rendered hexes against a per-category fixture, and give the
`CharacterColorService` mock a distinct array per sheet.

---

### webapp-tools-a-14 — OPT — **P3** — `apps/web-app/src/components/mixer-tool.ts:1264-1270`

**Claim.** `renderMixingField()` runs a full 125-dye match for each of the 30 grid cells (plus 15
pairwise distances in `modelSpread`, `:1123-1133`) on every render — and it is re-rendered on every
cell click, every `setConfig` and every `updateCraftingUI()`.

30 × `findMatchingDyesEngine` ≈ 30 full CIEDE2000 linear scans (~0.4 ms each locally, ~5× that in
CI) ≈ 12–60 ms of blocking main-thread work per interaction, all of it recomputed identically
whenever only the *selection ring* changed.

**Fix direction.** Memoise per `(dyeA.hex, dyeB.hex, matchingMethod, dyeFilters)` — the 30 cell
values are invariant across ratio/model selection changes, which are the common re-render triggers.

---

### webapp-tools-a-15 — REFACTOR — **P3** — `apps/web-app/src/components/mixer-tool.ts:1133`

`modelSpread` ends `return Number.isFinite(widest) ? widest : null;` but `widest` starts at `0` and
only ever takes values that passed `d > widest`, so it is always finite — the `null` branch is
unreachable and every caller's `spread !== null` guard (`:1201`) is dead. Return `number` and drop
the guard.

---

## 3. POSITIVE (do not re-file)

- **`gradient-tool` gets the metric vocabulary exactly right**: every displayed drift is
  `ColorService.getDistanceForMethod(..., this.matchingMethod)` (`:1870-1879`, `:1903`), including
  the filtered-substitute path, with the reasoning recorded in a comment. It is the model the
  extractor should follow.
- **`comparison-tool` is deliberate about ΔE2000 vs the active method**: the duel cards pass a real
  ΔE2000 with `matchingMethod` left `undefined` (`:1454-1469`), which is the one shape the result
  card's guard handles correctly; the seven readouts recompute per method (`:1912-1932`).
- **Consolidated-itemID price fan-out is correct end to end** — `MarketBoardService.fetchPricesForDyes`
  re-keys the three shared market IDs back onto each original `itemID`
  (`market-board-service.ts:349-360`), so swatch/extractor/mixer lookups by `dye.itemID` hit. No
  regression of the 2026-07-18 BUG-010.
- **`loadPersistedDyes` filters with `!= null`, not `!== undefined`**, and self-heals the stored list
  (`comparison-tool.ts:281-299`) — BUG-042 stays fixed.
- **Share grammar is stainID-first everywhere**: `getShareParams` emits `stainID` and falls back to
  the declared bare-colour slots (`hexA`/`hexStart`) for custom dyes rather than an invalid `0`
  (`gradient:1678-1693`, `mixer:1916-1927`, `comparison:2444-2446`).
- **`normalizeMatchingMethod` is applied at every ingress** (config seed, share `algo`) in all four
  tools that carry a method, so retired 4.x spellings migrate instead of reaching the matcher.
- **HSV/OKLCH/LCH hue interpolation wraps correctly** through the ±180 shortest-arc adjustment
  (`gradient-tool.ts:1731-1734`, `:1750-1755`, `:1761-1766`) — no 360 discontinuity.
- **The image pipeline needs no object-URL revoke**: the canvas is created at the image's natural
  size (`image-zoom-controller.ts:91-102`) and images travel as data URLs held in memory only
  (FINDING-009), so there is no `URL.createObjectURL` to leak.

## 4. REJECTED

- *`saveSelectedDyes` writes `d.id` but `loadSelectedDyes` reads via `getDyeById`* — not a mismatch:
  `DyeDatabase` maps both `id` and `itemID` into `dyesByIdMap` and `id === itemID` after
  normalization (`DyeDatabase.ts:325-336`).
- *Swatch pin badges keyed by array position vs `data-index` keyed by `color.index`* — the shipped
  data has `index === array position` for all sheets (verified: eye 0..191, lip-dark 0..95,
  tattoo 0..191), so the two agree.
- *`getImageData` on a tainted canvas* — the whole extraction is inside a `try/catch` that toasts
  `errors.paletteExtractionFailed` (`extractor-tool.ts:2377`, `:2425-2427`); images only ever arrive
  as same-origin data URLs anyway.
- *K-means with fewer pixels than k* — `PaletteService.extractPalette` clamps `colorCount` to
  `[1, 10]` and logs (`PaletteService.ts:366-371`); `extractor-tool` also bails with a toast when the
  sampled pixel list is empty (`:2385-2388`).
- *`samplePixelsForPalette` step arithmetic off-by-one* — `Math.max(1, floor(sqrt(w·h/100_000)))`
  is correct at both ends (step 1 below 100 k px; ~102 k samples at 4K).
- *Missing EXIF orientation handling* — modern browsers apply EXIF orientation to `HTMLImageElement`
  by default, and `drawImage` uses the oriented bitmap, so no rotation is lost.
- *Gradient `stepCount` at the 2 / max boundaries* — the constructor clamps stored values and
  `loadFromShareUrl` range-checks to `[3, 12]`; `calculateInterpolation` handles `steps === 1` and
  `steps === 2` without an index error.
- *`updateFocusHeader` clearing the summary cluster leaks the export/share buttons* — both are held
  as fields and re-appended (`gradient-tool.ts:1121-1133`, `:1572-1579`), with the listener bound
  once at construction.
- *Comparison `hueDiff` reads 0 for achromatic pairs* — that is the HSV convention, and the row is
  labelled HUE beside an L\* row that carries the real difference.
- *`swatch-tool` mobile/desktop selector duplication causing double `loadColors`* — the two selects
  are mutually exclusive per viewport and each `change` handler syncs the other by value, which does
  not re-fire `change`.

## 5. COVERED

**11 files read in full or in the depth the claims required.**

In scope (read in full):
1. `apps/web-app/src/components/base-component.ts` (738)
2. `apps/web-app/src/components/swatch-tool.ts` (3132)
3. `apps/web-app/src/components/extractor-tool.ts` (2803)
4. `apps/web-app/src/components/gradient-tool.ts` (2755)
5. `apps/web-app/src/components/comparison-tool.ts` (2520)
6. `apps/web-app/src/components/mixer-tool.ts` (2207)

Tests sampled: `__tests__/extractor-tool.test.ts`, `swatch-tool.test.ts`, `gradient-tool.test.ts`,
`comparison-tool.test.ts`, `mixer-tool.test.ts` (5 files).

Read to confirm specific claims (not audited): `packages/core/src/services/ColorService.ts`,
`PaletteService.ts`, `dye/DyeSearch.ts`, `dye/DyeDatabase.ts`, `CharacterColorService.ts`,
`config/band-calibration.ts`, `apps/web-app/src/components/v4/result-card.ts`,
`v4/share-button.ts`, `image-zoom-controller.ts`, `apps/web-app/src/services/market-board-service.ts`,
`apps/web-app/src/shared/custom-dye.ts`, `apps/web-app/src/shared/utils.ts`,
`apps/web-app/src/shared/subscription-manager.ts`, `apps/web-app/src/shared/constants.ts`,
`packages/core/src/data/character_colors/shared/*.json`.
