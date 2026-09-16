# Review: webapp-v4 (apps/web-app — Lit + Vite SPA, v4 shell)

## 1. Map

| Module | Role |
|---|---|
| `components/v4-layout.ts` | Entry point: creates `<v4-layout-shell>`, wires all shell events, `loadToolContent` (BUG-040/BUG-065 hardened, `navigationSeq` guard) |
| `components/v4/v4-layout-shell.ts` | `<v4-layout-shell>` — app bar + Options panel + content slot + palette drawer, mobile FAB pair, first-run hint |
| `components/v4/v4-app-header.ts` | `<v4-app-header>` — 3A desktop rail / 2B mobile title-menu, chrome cluster |
| `components/v4/config-sidebar.ts` | `<v4-config-sidebar>` — all 9 tool config sections + market board + presets auth, 2078 lines |
| `components/v4/dye-palette-drawer.ts` | `<dye-palette-drawer>` — search/filter/spectrum/favorites/custom-color swatch picker |
| `components/v4/display-options-v4.ts` / `dye-filters-v4.ts` | Shared toggle groups embedded in config-sidebar per tool |
| `components/v4/range-slider-v4.ts` / `toggle-switch-v4.ts` | Primitive form controls |
| `components/v4/v4-color-wheel.ts` | `<v4-color-wheel>` — harmony ring visualization (display only; slot selection is core's) |
| `components/v4/result-card.ts` | `<v4-result-card>` — the 5.0 Ticket: verdict, matrix, text zone, context menu, hand-off |
| `components/v4/share-button.ts` | `<v4-share-button>` — copy/share UI wrapper around `ShareService` |
| `components/v4/preset-tool.ts` | `<v4-preset-tool>` — 8A Gallery: tabs/search/category/grid, no test suite |
| `components/v4/preset-detail.ts` | `<v4-preset-detail>` — full preset view, votes, market prices, hand-off row, no test suite |
| `components/v4/preset-card.ts` | `<v4-preset-card>` — gallery post card |
| `components/v4/language-modal.ts` / `theme-modal.ts` | Singleton imperative modals (locale / theme picker) |
| `components/v4/base-lit-component.ts` | Shared `LitElement` base (emit/error/lifecycle logging) |
| `services/tool-panel-builders.ts` | `buildMarketPanel()` — shared CollapsiblePanel+MarketBoard builder |
| `services/config-controller.ts` | Singleton per-tool config store, localStorage-backed, cross-tab sync, no-op-write skip (OPT-008) |
| `shared/tool-config-types.ts` | All `ToolConfigMap` interfaces + `DEFAULT_CONFIGS` |
| `shared/tool-handoff.ts` | The one dye-hand-off grammar (`handoffTo`), used only by `result-card.ts` in this unit |

## 2. Candidates

### webapp-v4-19 — BUG — **HIGH** — `apps/web-app/src/components/v4/preset-detail.ts:132-133,626-641,680-710` (render never reads `priceData`)

`fetchPricesIfNeeded()` calls `MarketBoardService.fetchPricesForDyes(dyes)` on every `connectedCallback` and every `preset` change, stores results in `this.priceData`, and a `prices-updated` listener keeps it current — but `render()` (:868-1042) never reads `this.priceData` anywhere; the dye-row price cell only ever shows the static `dye.cost` vendor price (`gilVendor ? formatGil(dye.cost) : notSold`, :958-960). A user with Market Board prices enabled opens any preset and never sees a live price — the network call runs, the state updates, nothing changes on screen.

**Failing input → wrong outcome:** `marketConfig.showPrices = true`, open any preset with a gil-vendor dye whose live market price differs from `dye.cost` → the row still shows the static vendor cost / "not sold", never the fetched Universalis price.

```ts
// fetchPricesIfNeeded() writes here...
const prices = await this.marketBoardService.fetchPricesForDyes(dyes);
for (const [itemId, priceInfo] of prices) { this.priceData.set(itemId, priceInfo); }
this.priceData = new Map(this.priceData);
// ...but render()'s dye-row never reads `this.priceData` — only `dye.cost`.
```

**Why tests miss it:** no test file exists for `preset-detail.ts` (webapp-v4-17). **Covered by test:** no.
**Fix:** either wire `priceData.get(dye.itemID)` into the price cell (preferring live price over static `dye.cost` when present), or remove the dead fetch/subscription if live pricing was deliberately dropped from this view.

---

### webapp-v4-20 — BUG — **MEDIUM** — `apps/web-app/src/components/v4/preset-detail.ts:644-653,658-675` (`updated()` / `checkVoteStatus()` — no request-generation guard)

`updated()` fires `void this.checkVoteStatus()` on every `preset` property change, with no token/sequence check. If the user opens preset A then quickly opens preset B before A's `communityPresetService.hasVoted()` call resolves, A's LATE response still unconditionally sets `this.hasVoted` / `this.currentVoteCount` after the await — overwriting B's already-rendered (and correct) vote state with A's. Same shape as the `loadToolContent` `navigationSeq` fix in `v4-layout.ts`, but not applied here.

**Failing input → wrong outcome:** rapid preset A → preset B navigation where A's vote-status fetch resolves after B's → vote button/count shown for B is actually A's data.

```ts
override updated(changedProperties: Map<PropertyKey, unknown>): void {
  if (changedProperties.has('preset')) {
    this.currentVoteCount = this.preset?.voteCount ?? 0;
    void this.checkVoteStatus();       // no generation guard
    this.priceData.clear();
    void this.fetchPricesIfNeeded();   // same gap
  }
}
```

**Why tests miss it:** no test file exists for `preset-detail.ts`. **Covered by test:** no.
**Fix:** capture a per-call generation counter (bump on every `preset` change) and drop the result if `this.preset` no longer matches the request that started it — the same pattern already used for `navigationSeq` in `v4-layout.ts:516-517`.

---

### webapp-v4-21 — BUG — **MEDIUM** — `apps/web-app/src/components/v4/preset-tool.ts:431-443,886-893` (search-debounce timer has no teardown)

`handleSearchInput` sets `this._searchDebounce = window.setTimeout(() => void this.loadPresets(), 300)`, but `disconnectedCallback` (:431-443) unsubscribes config/auth/saved/collections/language — and never calls `clearTimeout(this._searchDebounce)`. Typing into the search box and navigating to another tool within 300ms lets the timer fire on the now-detached `PresetTool` instance: it runs a wasted `hybridPresetService.getPresets()` network call and, if `this.searchQuery` has since been cleared back to empty, can call `reconcileTombstones()` — which writes to the GLOBAL `SavedPresetsService` (localStorage tombstones) — from state that is no longer what the user is looking at.

**Failing input → wrong outcome:** type in the preset search box, navigate away before 300ms elapses → a network fetch (and possibly a tombstone write) fires against a torn-down component.

```ts
private handleSearchInput(e: Event): void {
  const input = e.target as HTMLInputElement;
  this.searchQuery = input.value;
  clearTimeout(this._searchDebounce);
  this._searchDebounce = window.setTimeout(() => { void this.loadPresets(); }, 300);
}
// disconnectedCallback() never clears this._searchDebounce
```

**Why tests miss it:** no test file exists for `preset-tool.ts` (webapp-v4-17). **Covered by test:** no.
**Fix:** store and clear the timeout in `disconnectedCallback`, mirroring `share-button.ts:258-261`'s `copiedTimeout` cleanup.

---

### webapp-v4-22 — BUG — **MEDIUM** — `apps/web-app/src/components/v4/preset-tool.ts:762-766` + `apps/web-app/src/components/v4-layout.ts:658-668` (preset-detail deep-link push carries no `toolId`)

`handlePresetSelect` does `window.history.pushState({ preset: id }, '', '/presets/<id>')` — the pushed state has no `toolId` key. `RouterService.handlePopState` (`router-service.ts:355-365`, read for confirmation) falls back to parsing the URL path when `state.toolId` is absent, which still resolves to `'presets'`, so on browser Back from a preset detail, `RouterService` notifies `v4-layout.ts`'s subscriber, which calls `loadToolContent('presets')` — and that branch (:658-668) unconditionally does `clearContainer` + `document.createElement('v4-preset-tool')`, i.e. destroys and fully re-mounts the Gallery. The user's active tab, search text, category filter and scroll position are lost, and `connectedCallback` re-fetches from the API — even though nothing about the *tool* actually changed.

**Failing input → wrong outcome:** open Presets, search/filter/scroll, open a preset detail, press the browser Back button → gallery resets to defaults and re-fetches instead of just closing the detail view.

```ts
private handlePresetSelect(e: CustomEvent<{ preset: UnifiedPreset }>): void {
  this.selectedPreset = e.detail.preset;
  const newUrl = `/presets/${this.selectedPreset.id}`;
  window.history.pushState({ preset: this.selectedPreset.id }, '', newUrl); // no toolId
}
```

**Why tests miss it:** no test file exists for `preset-tool.ts`; `v4-layout.test.ts` does not simulate a `/presets/<id>` → `/presets` popstate. **Covered by test:** no.
**Fix:** include `toolId: 'presets'` in the pushed state (or have `PresetTool` listen for `popstate` itself and call its own `handleBack()`-equivalent before `v4-layout`'s router subscriber sees it).

---

### webapp-v4-23 — REFACTOR — LOW — `apps/web-app/src/components/v4/config-sidebar.ts:147-156` vs `apps/web-app/src/shared/tool-config-types.ts:419-428` (dead, disagreeing default)

The `@state() private harmonyConfig` field initializer hardcodes `harmonyType: 'tetradic'`, `strictMatching: false` — but `tool-config-types.ts`'s `DEFAULT_CONFIGS.harmony` says `harmonyType: 'complementary'`, `strictMatching: true`. `connectedCallback()` (:663) immediately overwrites the field from `ConfigController.getConfig('harmony')` before the first render, so the mismatched initializer is never actually visible — but it is a live trap for the next person who "fixes" `loadConfigsFromController()` to be conditional. **Fix:** initialize from `getDefaultConfig('harmony')` (or delete the field initializer and let `connectedCallback` be the only writer) so the two cannot drift again.

---

## 3. POSITIVE — do not re-file

- **`getMarketItemID` external-link grammar is correct** (`result-card.ts:1156-1167`): all four `EXTERNAL_URLS` builders route through `getMarketItemID(dye)`, which only returns a raw (non-consolidated) itemID for `itemID < 0` (Facewear) or non-consolidated dyes — and Facewear colours are confirmed unreachable here (`swatch-tool.ts`'s `matchedDyes` pipeline never includes `facewearColors`, only the 125-dye `dyeDatabase`), so the negative-itemID case this code technically handles is dead but harmless.
- **`handoffTo` (`@shared/tool-handoff.ts`) is the only hand-off path exercised in this unit** — `result-card.ts:1188-1195`'s `navigateToHarmony` uses it correctly (stainID, not itemID; BUG-012 does not recur), and the test at `result-card.test.ts:283-322` proves the emitted id is below the legacy-itemID floor.
- **`loadToolContent`'s BUG-040/BUG-065 hardening is unchanged and still correct** — every tool branch in `v4-layout.ts` re-checks `superseded()` after its dynamic import, including the `catch` block (:716); `webapp-v4-18` (no regression test for the overlap) remains open exactly as filed, risk unchanged.
- **`ConfigController.setConfig`'s no-op-write skip (OPT-008) is sound** — the `JSON.stringify` comparison cannot be fooled by key-order drift because `{...current, ...partial}` never reorders keys already present in `current`.
- **Teardown is thorough everywhere except the two gaps above** — `v4-layout-shell`, `v4-app-header`, `config-sidebar`, `dye-palette-drawer`, `result-card`, `share-button` all pair every `LanguageService.subscribe` / `document.addEventListener` / timer with a matching cleanup in `disconnectedCallback`.

## 4. REJECTED

- *Facewear items reaching `result-card.ts`'s external-link builders with a negative itemID* — checked `swatch-tool.ts`'s `matchedDyes` pipeline (the only producer of `ResultCardData.dye` for arbitrary categories in this app): it matches only against the 125-entry `dyeDatabase`, which excludes `facewearColors` since schema v2. Unreachable.
- *`preset-detail.ts`'s hand-off row (`window.location.assign`, a full page reload instead of SPA nav)* — same pattern used deliberately elsewhere (`swatch-tool.ts`'s handoff chips), and the built URLs match `ShareService`'s own grammar (`dye`/`dyes`/`start`/`end`/`harmony=complementary` all verified against `share-service.ts`'s param interfaces) — a full reload correctly re-parses them on boot. Not a hidden bug, just a different (consistent) navigation choice.
- *`config-sidebar.ts`'s `handleDisplayOptionsChange('harmony', e)` call from `renderPresetsConfig` (wrong tool label)* — the `_tool` parameter is prefixed-unused and never read in the function body (`this.emit(..., { tool: 'global', ... })` ignores it entirely), so the mislabel has zero behavioral effect.
- *`dye-palette-drawer.ts` / `preset-card.ts` hex-color helpers (`hexToHue`, `inkOn`, `inkOver`) on malformed short hex* — `preset-card.ts`'s `inkOver` lacks the length guard `v4-color-wheel.ts`'s `inkOn` has, but `colors[]` is always sourced from real 6-char dye hexes (`resolvePresetDye(id).hex`); no reachable malformed input found.
- *`range-slider-v4.ts`'s unguarded `parseFloat(input.value)`* — the value always comes from a native `<input type="range">`, which cannot emit a non-numeric string.

## 5. COVERED

22 source files read in full (all files in scope):
`components/v4-layout.ts`, `components/v4/v4-layout-shell.ts`, `components/v4/v4-app-header.ts`, `components/v4/config-sidebar.ts`, `components/v4/dye-palette-drawer.ts`, `components/v4/result-card.ts`, `components/v4/share-button.ts`, `components/v4/preset-tool.ts`, `components/v4/preset-detail.ts`, `components/v4/preset-card.ts`, `components/v4/display-options-v4.ts`, `components/v4/dye-filters-v4.ts`, `components/v4/range-slider-v4.ts`, `components/v4/toggle-switch-v4.ts`, `components/v4/language-modal.ts`, `components/v4/theme-modal.ts`, `components/v4/v4-color-wheel.ts`, `components/v4/base-lit-component.ts`, `services/tool-panel-builders.ts`, `services/config-controller.ts`, `shared/tool-config-types.ts`, `shared/tool-handoff.ts`.

Test files skimmed: `components/__tests__/v4-layout.test.ts` (grep), `components/__tests__/v4/result-card.test.ts` (full, 840 lines), plus a listing pass over all other `__tests__/v4/*.test.ts` files to confirm which of the 17 components have a suite (`preset-tool.ts` and `preset-detail.ts` confirmed to have none).

Out-of-scope files read only to verify a specific claim (not counted above, not separately audited): `apps/web-app/src/services/router-service.ts` (popstate/path-parsing, for webapp-v4-22), `apps/web-app/src/services/share-service.ts` (param grammar, grep only), `apps/web-app/src/components/item-links-menu.ts` and `swatch-tool.ts` (facewear reachability, for the REJECTED facewear item), `packages/core/src/config/consolidated-ids.ts` (`getMarketItemID`, for POSITIVE item-links note).
