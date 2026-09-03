# review-webapp-v4 — deep-dive 2026-09-02

Unit: `webapp-v4` · Deploy unit: `web-app` (Vite + Lit, Cloudflare Pages)
Repo: worktree at `origin/main` **e7ac4042**. Read-only review; no files modified, no commands run.

---

## 1. Map

| Module | Kind | Role |
|---|---|---|
| `components/v4-layout.ts` | module (fn) | Entry point: RouterService glue, lazy tool `import()`, `navigationSeq` supersede guard, shadow-root injection of `tool-content.css`, telemetry entry/dwell, modal + toast roots |
| `v4/v4-layout-shell.ts` | `<v4-layout-shell>` | Console shell: header + Simple-Settings column + content slot + palette drawer; mobile media query, first-run palette hint, event re-emit hub |
| `v4/v4-app-header.ts` | `<v4-app-header>` | 3A desktop rail (9 chips) / 2B mobile title-menu, chrome cluster (changelog, about, locale, theme, gear) |
| `v4/base-lit-component.ts` | abstract | `baseStyles`, `emit()` (bubbles+composed), `setError()`, `isReady` |
| `v4/config-sidebar.ts` | `<v4-config-sidebar>` | All nine tool config sections rendered at once, `?hidden` by `activeTool`; ConfigController read/write; auth card; market DC/world select |
| `v4/display-options-v4.ts` | `<v4-display-options>` | colorFormats + resultMetadata toggle groups |
| `v4/dye-filters-v4.ts` | `<v4-dye-filters>` | Dye-type + acquisition exclusion toggles |
| `v4/dye-palette-drawer.ts` | `<dye-palette-drawer>` | 125-dye grid, search, type chips, spectrum chips, favourites, custom colour |
| `v4/result-card.ts` | `<v4-result-card>` | 5.0 Ticket: swatch pair, ΔE2000 verdict, numeric matrix, text zone, alternates, context menu + cross-tool hand-offs |
| `v4/preset-tool.ts` | `<v4-preset-tool>` | 8A Gallery: tabs, category rail, search, sort, tombstone reconciliation, vote/save |
| `v4/preset-detail.ts` | `<v4-preset-detail>` | One preset: palette list, cost note, hand-off row, vote/edit/delete |
| `v4/preset-card.ts` | `<v4-preset-card>` | Gallery post card (shot / palette-as-picture, votes, save) |
| `v4/share-button.ts` | `<v4-share-button>` | Validate + generate + copy share URL |
| `v4/theme-modal.ts` / `v4/language-modal.ts` | fn + singleton | Imperative modal content via ModalService |
| `v4/range-slider-v4.ts`, `v4/toggle-switch-v4.ts` | controls | Slider / `role="switch"` toggle |
| `v4/v4-color-wheel.ts` | `<v4-color-wheel>` | Harmony wheel canvas (consumed by `harmony-tool.ts` only) |

Tests present: `__tests__/v4/{config-sidebar,dye-palette-drawer,locale-switch,preset-card,range-slider-v4,result-card,theme-modal,toggle-switch-v4,v4-app-header,v4-layout-shell}.test.ts` + `__tests__/v4-layout.test.ts`.
**No test file exists for `preset-tool.ts`, `preset-detail.ts`, `share-button.ts`, `display-options-v4.ts`, `dye-filters-v4.ts`, `base-lit-component.ts`.**

---

## 2. Candidates

### webapp-v4-01 — BUG — **HIGH** — `apps/web-app/src/components/v4/result-card.ts:1189`

**Claim.** The result card's "Inspect Dye in → Harmony Explorer" hand-off passes an **itemID** on a param the 5.0 grammar resolves as a **stainID**, so it always fails with a user-visible error toast.

**Failing input → wrong outcome.** Any result card → ⋯ → Inspect Dye in → Harmony Explorer. Card navigates to `/harmony/?dyeId=5729`. `harmony-tool.ts:429` reads `params.get('dye') ?? params.get('dyeId')`, and `harmony-tool.ts:524` feeds it to `ShareService.resolveSharedDye`, which (`share-service.ts:329-335`) rejects anything `>= 5729` with `ToastService.error('share.legacyLink')` and returns `null`. Verified in `packages/core/src/data/dyes.json`: **all 125 dyes have `legacyItemID >= 5729`**, and `Dye.itemID` is derived from it (`packages/types/src/dye/dye.ts:51-57`). So the hand-off works for **zero** dyes and always shows "this link uses the old format".

```ts
  private navigateToHarmony(dye: Dye): void {
    // Use itemID for localization-safe deep linking
    RouterService.navigateTo('harmony', { dyeId: String(dye.itemID) });
  }
```

**Why tests miss it.** `result-card.test.ts` mocks `RouterService` to `{ navigateTo: vi.fn() }` and never asserts on it; there is no test that opens the context menu at all (see webapp-v4-16). `harmony-tool.test.ts` does not drive `?dyeId=`.

**Covered by test:** no. **Fix:** `RouterService.navigateTo('harmony', { dye: String(dye.stainID) })` — the same grammar `preset-detail.handoffTargets` already uses; drop the `dyeId` alias from `harmony-tool.ts:429` once no producer emits it.

---

### webapp-v4-02 — BUG — **HIGH** — `apps/web-app/src/components/v4/preset-tool.ts:492-507`

**Claim.** `reconcileTombstones()` treats "not in the page I just fetched" as "deleted by its author" and **persists** that to localStorage; two ordinary conditions make the fetched page incomplete.

**Failing input → wrong outcome.**
(a) *Truncation.* `loadPresets()` asks for `limit: 100` (line 470), but the API clamps to 50 (`apps/presets-api/src/handlers/presets.ts:240` — `Math.min(..., 50)`). Once >50 approved community presets exist, any saved preset outside the current sort's top-50 is marked `deletedByAuthor` and renders the "Removed by its author" chip — or vanishes entirely when `keepDeleted` is off. Cycling the sort (`handleSortNext`) flips which ones.
(b) *Post-boot outage.* `hybridPresetService.getPresets` swallows a failed community fetch (`hybrid-preset-service.ts:315-317`) and returns the curated pool alone; `isAPIAvailable()` is latched at boot (`community-preset-service.ts:174-177`, `hybrid-preset-service.ts:128`), so `this.offline` stays `false`. `live` is then **empty** and *every* saved community preset is tombstoned. `SavedPresetsService.markDeleted` writes through to localStorage (`saved-presets-service.ts:160-167`), so the damage survives a reload. webapp-v4-07 makes this fire on an innocent category-chip click.

```ts
  private reconcileTombstones(): void {
    if (this.offline || this.searchQuery) return;
    const live = new Set(this.presets.filter((p) => p.isFromAPI).map((p) => p.id));
    for (const saved of this.savedList) {
      if (saved.isCurated) continue;
      const gone = !live.has(saved.id);
      if (gone !== Boolean(saved.deletedByAuthor)) SavedPresetsService.markDeleted(saved.id, gone);
```

**Why tests miss it.** There is no `preset-tool` test file at all (webapp-v4-17).

**Covered by test:** no. **Fix:** only reconcile against a demonstrably complete community set — page until the API reports exhaustion, or have `getPresets` return per-call reachability + total so a truncated/failed page skips reconciliation entirely (the existing `offline` guard is the right idea aimed at the wrong signal).

---

### webapp-v4-03 — BUG — **MEDIUM** — `apps/web-app/src/components/v4-layout.ts:708-722`

**Claim.** The BUG-040 supersede guard covers the success path but **not** the `catch`, so a late-rejecting lazy import wipes the newer tool's DOM.

**Failing input → wrong outcome.** Navigate to Harmony (seq 1) while its chunk 404s (stale asset hash — see the 2026-08 Pages asset-cache incident); navigate to Mixer (seq 2), which loads and renders. Seq 1's `import()` then rejects, and the catch — with no `superseded()` check — sets `contentContainer.innerHTML` to the "Failed to load tool" panel over the mounted Mixer, resets `mountedToolId = null` and calls `TelemetryService.endTool()`, closing the wrong dwell window. `activeTool` still points at the live MixerTool with its subscriptions, now orphaned from any DOM.

```ts
  } catch (error) {
    logger.error(`[V4 Layout] Failed to load ${toolId}:`, error);
    mountedToolId = null;                       // no superseded() check
    TelemetryService.endTool();
    contentContainer.innerHTML = `…errors.toolLoadFailed…`;
  }
```

**Why tests miss it.** `v4-layout.test.ts` "Tool Loading" has one test asserting `container.children.length > 0`; nothing rejects an import, and nothing runs two overlapping `loadToolContent` calls (webapp-v4-18).

**Covered by test:** no. **Fix:** `if (superseded()) return;` as the first statement of the catch.

---

### webapp-v4-04 — BUG — **MEDIUM** — `apps/web-app/src/components/v4/dye-palette-drawer.ts:1194-1199`

**Claim.** The dye grid is mouse-only: all 125 swatches are non-focusable `<div>`s with a click handler.

**Failing input → wrong outcome.** Tab through the palette drawer. Focus lands on the search input, filter chips, and each swatch's nested favourite `<button>` — so a keyboard user can *star* a dye but cannot *select* one. No `tabindex`, no `role`, no `keydown`.

```ts
      <div
        class="swatch"
        style="background-color: ${dye.hex}"
        title="${localizedName}"
        @click=${() => this.handleDyeClick(dye)}
      >
```

**Why tests miss it.** `dye-palette-drawer.test.ts` has two tests (category headings via `getCategory()`, and the random-dye telemetry marker); neither touches the swatch element's semantics.

**Covered by test:** no. **Fix:** render the swatch as `<button type="button" aria-label=…>` and move the favourite control out of the button (nested interactives are invalid), e.g. as a sibling in a wrapping `<div class="swatch-cell">`.

---

### webapp-v4-05 — BUG — **MEDIUM** — `apps/web-app/src/components/v4/share-button.ts:292-297` (+ `v4/base-lit-component.ts:124-130`)

**Claim.** A share-validation failure is completely silent — no toast, no visible state, and no log.

**Failing input → wrong outcome.** Any share whose params fail `validateShareParams` (e.g. Harmony with a dye but no `harmony`, `share-service.ts:559-563`). `setError()` writes `hasError`/`errorMessage`, but **no v4 component's `render()` reads either** (grep across `components/`: the only assignments/reads are in `base-lit-component.ts` itself). Line 294 also passes no `Error`, so `setError`'s `if (error) logger.error(...)` is skipped. The Share button visibly does nothing, forever.

```ts
      const errors = ShareService.validateShareParams(shareData);
      if (errors.length > 0) {
        this.setError(`Invalid share params: ${errors.join(', ')}`);   // renders nowhere, logs nothing
        this.isLoading = false;
        return;
      }
```

**Why tests miss it.** No `share-button` test file exists.

**Covered by test:** no. **Fix:** surface via `ToastService.error(LanguageService.t('errors.shareFailed'))` (and pass the `Error` in the `catch` at line 322); either render `hasError`/`errorMessage` in `BaseLitComponent` or delete `setError` as dead API.

---

### webapp-v4-06 — BUG — **MEDIUM** — `apps/web-app/src/components/v4/preset-detail.ts:853,863` (round trip via `share-service.ts:236-238` → `comparison-tool.ts:2469` / `accessibility-tool.ts:2036`)

**Claim.** A **single-element** dye-id array survives the URL as a scalar, and both consumers gate on `Array.isArray`, so one-dye Comparison/Accessibility links open the tool empty and silently.

**Failing input → wrong outcome.** `handoffTargets` builds `?dyes=${ids.slice(0,4).join(',')}`; with one id that is `dyes=45`. `ShareService.parseUrl` (`share-service.ts:399-403`) sees no comma, `parseFloat('45') === 45` and `String(45) === '45'`, so `params.dyes = 45` (number). `comparison-tool.ts:2469` — `if (!params.dyes || !Array.isArray(params.dyes) || …) return false;` — bails. Same at `accessibility-tool.ts:2036`. Reachable from the normal UI too: `validateShareParams` only requires `params.dyes?.length` (`share-service.ts:594`) and `updateShareButton` enables the button at one dye (`comparison-tool.ts:2455`), so a one-dye Comparison share link is producible and dead on arrival.

```ts
      { label: …, url: `/comparison/?dyes=${ids.slice(0, 4).join(',')}` },
      { label: …, url: `/accessibility/?dyes=${ids.slice(0, 4).join(',')}` },
```

**Why tests miss it.** No `preset-detail` test file; the comparison/accessibility suites don't drive a one-dye share URL.

**Covered by test:** no. **Fix:** normalise in `parseUrl` — keep a declared list-valued key as an array regardless of length (or have the consumers coerce with `[params.dyes].flat()`).

---

### webapp-v4-07 — BUG (perf/UX) — **MEDIUM** — `apps/web-app/src/components/v4/preset-tool.ts:366-369` (+ `718-720`)

**Claim.** Every Presets config change — including six that are applied purely client-side — flashes the grid to a spinner and refetches 100 presets from the API.

**Failing input → wrong outcome.** Click a category chip in the rail → `handleCategorySelect` → `configController.setConfig('presets', {category})` → the `subscribe('presets')` callback runs `void this.loadPresets()` → `isLoading = true` (grid → spinner) → network round trip. But `loadPresets` explicitly does **not** send the category (comment at lines 463-466: counts need the unfiltered pool). The same happens for `feedShots`, `feedBlend`, `feedHideUnbuyable`, `savedFirst` and `keepDeleted`, all of which `currentTabPool()` applies locally. Only `sortBy` genuinely needs a refetch. This also multiplies the trigger surface for webapp-v4-02(b).

```ts
    this.configUnsubscribe = this.configController.subscribe('presets', (newConfig) => {
      this.config = newConfig;
      void this.loadPresets();          // unconditional refetch + spinner
    });
```

**Why tests miss it.** No `preset-tool` test file.

**Covered by test:** no. **Fix:** compare `newConfig.sortBy` against the previous value and only refetch on a change; assign `this.config` otherwise.

---

### webapp-v4-08 — BUG — **LOW** — `apps/web-app/src/components/v4/v4-layout-shell.ts:800-802`, `856-858`

**Claim.** Two re-emit handlers omit `e.stopPropagation()`, so `composed: true` lets the original event ALSO cross the shadow boundary — `v4-layout.ts` runs each handler twice per user action.

**Failing input → wrong outcome.** Toggle any control in the Simple-Settings column. `v4-config-sidebar` dispatches `config-change` (bubbles+composed, `base-lit-component.ts:110-118`). The shell's `@config-change` fires and re-emits from the host; then the original keeps bubbling and reaches the host too. `v4-layout.ts:180` fires for both → `activeTool.setConfig({...})` twice. Same for `clear-all-dyes` → `clearDyes()` twice. The sibling handlers get this right (`handleDyeSelected` :848, `handleCustomColorSelected` :865, `handleSimpleSettingsCollapse` :907 all call `stopPropagation`). Currently masked because every tool's `setConfig` guards with `!== this.x` and `clearDyes` is idempotent; the header's `theme-click`/`about-click`/`language-click`/`changelog-click`/`advanced-click` are the same shape and are saved only by each modal's own `if (this.modalId) return` singleton guard.

```ts
  private handleConfigChange(e: CustomEvent): void {
    this.emit('config-change', e.detail);        // no e.stopPropagation()
  }
```

**Why tests miss it.** `v4-layout.test.ts:303-316` is the named test and cannot fail (webapp-v4-15).

**Covered by test:** no. **Fix:** `e.stopPropagation()` in `handleConfigChange` and `handleClearAllDyes` (and the five chrome handlers), matching the three that already do — or drop the re-emit entirely and let the composed event through once.

---

### webapp-v4-09 — BUG (a11y) — **LOW** — `v4/display-options-v4.ts:270-274`, `v4/dye-filters-v4.ts:185-189`, `v4/config-sidebar.ts:448-452`

**Claim.** Collapsed config sections stay in the tab order and the accessibility tree.

**Failing input → wrong outcome.** Collapse "Color Formats" (header reports `aria-expanded="false"`), then Tab. The collapsed content is hidden only by `max-height: 0; opacity: 0; pointer-events: none` under `overflow: hidden` — no `visibility: hidden`, no `hidden`. Its `v4-toggle-switch` controls carry `tabindex="0"` and `role="switch"`, so focus enters an invisible region and a screen reader announces controls the user just closed.

```css
      .option-group-content.collapsed { max-height: 0; opacity: 0; pointer-events: none; }
```

**Covered by test:** no. **Fix:** add `visibility: hidden` (transition-safe) or toggle `hidden` on the content div; `dye-palette-drawer.ts:410-416` already does this correctly with `display: none`.

---

### webapp-v4-10 — BUG (a11y) — **LOW** — `apps/web-app/src/components/v4/dye-palette-drawer.ts:989` + `v4-layout-shell.ts:956-965`

**Claim.** The mobile palette drawer is a modal overlay with none of the modal affordances.

**Failing input → wrong outcome.** On ≤768 px the drawer is `position: fixed` full-height over a `.v4-drawer-overlay` scrim (shell styles :346-353, :173-188). The drawer root is a bare `<aside class="drawer">` — no `role="dialog"`, no `aria-modal`, no focus trap, no focus move on open, no focus restore on close, and no Escape handler (only the scrim's `@click`). Content behind the scrim stays tabbable. The header's tool menu, by contrast, does handle Escape (`v4-app-header.ts:482-486`).

**Covered by test:** no. **Fix:** on mobile, set `role="dialog" aria-modal="true"`, trap focus while open, restore on close, and close on Escape.

---

### webapp-v4-11 — REFACTOR — **LOW** — `apps/web-app/src/components/v4/preset-detail.ts:988`

**Claim.** The four "TAKE THIS PALETTE INTO" buttons force a full document reload of the SPA.

`<button @click=${() => window.location.assign(h.url)}>` re-downloads `index.html`, `vendor-core` (~1.2 MB raw, dye DB + locales), `vendor-lit` and the target tool chunk, and re-runs `initializeServices()`, where `RouterService.navigateTo(tool, params)` would do it client-side. **Fix:** route through `RouterService.navigateTo` with the params object.

---

### webapp-v4-12 — BUG — **LOW** — `apps/web-app/src/components/v4/preset-tool.ts:852-859`

**Claim.** The search debounce timer is never cleared on teardown.

`_searchDebounce` is set in `handleSearchInput` but `disconnectedCallback` (lines 409-421) clears only the five subscriptions. Navigating away from Presets within 300 ms of a keystroke still runs `loadPresets()` — a network request plus `@state` writes on a detached element. **Fix:** `clearTimeout(this._searchDebounce)` in `disconnectedCallback`.

---

### webapp-v4-13 — BUG — **LOW** — `apps/web-app/src/components/v4/preset-detail.ts:722-729`

**Claim.** `handleShare` dereferences `navigator.clipboard` without a guard.

In a non-secure context (`http://` LAN preview, some embedded webviews) `navigator.clipboard` is `undefined`, so `navigator.clipboard.writeText(url)` throws a `TypeError` **synchronously** — the attached `.catch` never runs and no error toast appears. `ShareService.copyToClipboard` (`share-service.ts:465-480`) has a textarea fallback this path bypasses. **Fix:** call `ShareService.copyToClipboard(url)`.

---

### webapp-v4-14 — OPT — **LOW** — `apps/web-app/src/components/v4/config-sidebar.ts:2009-2012`

All nine tool sections render on every update and are merely `?hidden` — nine `<v4-display-options>` and six `<v4-dye-filters>` instances live at once, each with its own `LanguageService.subscribe`. A single display-options change then calls `configController.setConfig` **nine** times (`handleDisplayOptionsChange` :851-870) and `handleDyeFiltersChange` seven times, each fanning out to that config's subscribers. **Fix direction:** render only the active tool's section (a `switch` in `render()`), keeping the ConfigController broadcast.

---

### webapp-v4-15 — UNTESTED — `apps/web-app/src/components/__tests__/v4-layout.test.ts:303-316`

The test named `'should handle config-change event'` asserts `expect(container.children.length).toBeGreaterThan(0)` — true whether the listener ran, threw, or was never registered (the comment even says "Should not throw"). Same shape at :333-337 (`'should render container with layout shell'`).

```ts
      layoutShell?.dispatchEvent(new CustomEvent('config-change', {
        detail: { tool: 'harmony', key: 'showPrices', value: true } }));
      expect(container.children.length).toBeGreaterThan(0);
```

**Behaviour it was supposed to catch:** that a `{tool, key, value}` detail is routed into `activeTool.setConfig({_tool, [key]: value})` **exactly once**. That is why webapp-v4-08's double delivery is invisible. **Fix:** mount a `MockToolWithSetConfig`, dispatch, and assert `setConfig` was called once with `{_tool:'harmony', showPrices:true}`.

---

### webapp-v4-16 — UNTESTED — `apps/web-app/src/components/__tests__/v4/result-card.test.ts:106-147`

Five of the eight tests cannot fail: `expect(ResultCard).toBeDefined()` (:109), `expect(ResultCard.name).toBe('ResultCard')` (:115), `expect(module).toBeDefined()` twice under the headings "should export ResultCardData type" / "should export ContextAction type" (:127, :133 — types are erased at runtime, so nothing about either is asserted), and `prototype instanceof BaseLitComponent` (:145). The three custom-dye tests are real.

**Behaviours left uncovered:** `getDeltaE2000` (whether a non-ciede2000 `matchingMethod` is re-derived rather than displayed raw), `getTierColor` band mapping, `getMarketItemID` on the four external links (mocked to identity at :58, so the 7.5 consolidation claim is untested), `addToTool`/`addToMixer` storage writes and the slot-full modal, and `navigateToHarmony` — which is exactly how webapp-v4-01 shipped.

---

### webapp-v4-17 — UNTESTED — `apps/web-app/src/components/v4/preset-tool.ts`, `preset-detail.ts` (no test files)

`__tests__/v4/` contains no `preset-tool` or `preset-detail` suite (only `preset-card`). 67 KB of the unit's most stateful code is uncovered: `reconcileTombstones` (the localStorage writer behind webapp-v4-02), `handleCardVote` / `handleVote` result handling, `handleDeepLink` local-vs-API resolution, `currentTabPool` / `categoryCount` slicing, `isBuyable`, and `handoffTargets` URL construction (webapp-v4-06). **Fix:** at minimum a `reconcileTombstones` suite proving no tombstone is written when the community fetch returned a truncated or empty pool.

---

### webapp-v4-18 — UNTESTED — `apps/web-app/src/components/v4-layout.ts:514-517` (`navigationSeq`)

No test overlaps two `loadToolContent` calls, so the 2026-07-18 BUG-040 fix has no regression test — and its catch-block hole (webapp-v4-03) is invisible. Neither the shadow-root `#v5-results-grid-style` injection (:347-447, load-bearing per the comment) nor the chunk-failure error panel (:713-721) is exercised. **Fix:** a test that starts `loadToolContent('harmony')` against a deferred import, starts `loadToolContent('mixer')`, resolves harmony's import as a rejection, and asserts the mixer DOM survives.

---

## 3. POSITIVE — do not re-file

- **`locale-switch.test.ts` is mutation-proven.** Its `t()` mock prefixes the locale, and its doc comment explains why one `await updateComplete` is not enough (`isReady` queues a second render that would pick up the locale on its own and make every assertion pass with the subscription deleted). Every v4 component that renders localized text has a matching `LanguageService.subscribe` + teardown.
- **`.config-section[hidden] { display: none }` (`config-sidebar.ts:492`).** Without it the author-level `display: block` at :488 would beat the UA `[hidden]` rule and show all nine tool sections at once.
- **`getDeltaE2000` (`result-card.ts:996-1012`) is correct.** It only trusts `deltaE` when `matchingMethod` is absent or `ciede2000`, and derives from the colour pair otherwise. Every producer checked passes the method (extractor :2156, gradient :1958, harmony :1537, mixer :1968, swatch :2340) or passes a genuine ΔE2000 (comparison :1469, accessibility :1122 via the `cie2000` alias).
- **`sanitizeExampleLink` / `sanitizePreviewImageUrl` are re-applied on both read paths** — API (`preset-tool.ts:538-539`, `hybrid-preset-service.ts:185-186`) and the localStorage snapshot (`preset-tool.ts:561`).
- **`getCategoryIcon` is an `Object.hasOwn` allowlist** (`shared/category-icons.ts:48-50`), so the `unsafeHTML` calls in `preset-detail.ts:894,900` and `preset-card` cannot be reached by API-supplied category ids. All other `unsafeHTML` arguments in the unit are compile-time icon constants.
- **`showSpectrum → card.showConsolidation` is wired in all nine tools**, and `showDeltaE` is a documented dead gate with no UI toggle (`display-options-v4.ts` exposes price/acquisition/hue/stain/spectrum only) — the ΔE verdict being structural is deliberate, not a dropped binding.
- **Teardown is complete across the unit.** Media-query listener (shell :749/:759), `document` keydown (header :81/:90), `document` click+keydown (result-card :1467-1476), and every service subscription (Language/Theme/auth/config/collections/saved) has a matching unsubscribe.
- **`document.documentElement.lang` is kept honest** in `LanguageService.setLocale` (`language-service.ts:110`), and the `<select .value>` + per-option `?selected` double binding defends against Lit committing `.value` before the option ChildPart exists.

---

## 4. REJECTED

- *Trailing-slash hand-off URLs (`/comparison/?dyes=…`) land on the default tool.* — `getToolFromPath` prefix-matches `route.path + '/'` (`router-service.ts:303-305`) and `parseUrl` filters empty path segments, so they resolve correctly.
- *`getLocalizedDyeName(dye.id)` (drawer :1183) looks up the wrong key vs `localizedDyeName(dye.itemID)`.* — `Dye.id` is documented and normalised to equal `itemID` after `DyeDatabase.initialize()` (`packages/types/src/dye/dye.ts:51-57`). A consistency wart (`@shared/dye-name` exists for this), not a defect.
- *`preset-card.ageText` yields "NaN days ago" from a space-separated SQLite `datetime('now')`.* — `createPreset` binds `new Date().toISOString()` (`presets-api/src/services/preset-service.ts:379`), and curated presets return early before the `Date` parse. Only pre-existing DEFAULT-written rows could hit it.
- *`renderEmpty` swaps its two messages (`preset-tool.ts:1000-1006`).* — "No presets found" with a search query and "Try adjusting your filters" without one both read correctly; the glyph pairing matches.
- *`clearContainer` destroys the shell's Lit-rendered `<slot>`.* — `.v4-layout-content-scroll` contains no Lit parts and nothing is ever slotted into `<v4-layout-shell>`, so there is no observable defect (the `@slot` line in the class doc is stale).
- *`toggle-switch-v4` double-fires on Space/Enter (keydown handler on a child of a `@click` wrapper).* — a `div[role="switch"]` produces no synthetic click, so `handleKeyDown → handleToggle` runs once.
- *`dye.stainID ?? 0` in the drawer's favourite toggle (:897-898) can favourite id 0.* — every dye from `initialize()` carries a numeric `stainID`; the `?? 0` is defensive only.
- *`preset-detail` hand-offs to comparison/gradient/accessibility are never parsed (those tools have no `URLSearchParams` call).* — they parse via `ShareService.getShareParamsFromCurrentUrl()` (`comparison-tool.ts:2464`, `gradient-tool.ts:333`, `accessibility-tool.ts:2026`). Only the 1-element-array case breaks; filed as webapp-v4-06.
- *`isBuyable` (`preset-tool.ts:619-624`) inverts consolidated vs unconsolidated.* — could not construct a failing case without the product definition of "market-only"; the two readings are indistinguishable from the code. Flagged for the spec owner, not filed.
- *Owner-only Edit/Delete are gated client-side only (`preset-tool.ts:1047-1050`, `preset-detail.ts:1021`).* — the presets-api enforces ownership server-side; the client gate is presentation.
- *`config-sidebar.loadServerData` fetches without an `AbortSignal` and can set state after disconnect.* — failure path sets empty arrays and the select disables itself (`:1937`); no wrong result.

---

## 5. COVERED — 20 files read

Non-test sources (18): `components/v4-layout.ts`, `components/v4/{v4-layout-shell, v4-app-header, base-lit-component, config-sidebar, display-options-v4, dye-filters-v4, dye-palette-drawer, result-card, preset-tool, preset-detail, preset-card, share-button, theme-modal, language-modal, range-slider-v4, toggle-switch-v4, v4-color-wheel}.ts`.

Tests skimmed (11): `__tests__/v4-layout.test.ts`, `__tests__/v4/{result-card, locale-switch, v4-layout-shell, v4-app-header, dye-palette-drawer, config-sidebar, preset-card, range-slider-v4, toggle-switch-v4, theme-modal}.test.ts`.

Cross-referenced to confirm claims: `services/{router-service, share-service, language-service, hybrid-preset-service, community-preset-service, saved-presets-service}.ts`, `shared/{dye-name, preset-i18n, category-icons, utils}.ts`, `components/{harmony-tool, comparison-tool, gradient-tool, accessibility-tool, mixer-tool, swatch-tool, budget-tool, advanced-options-panel, about-modal, changelog-modal}.ts`, `packages/types/src/dye/dye.ts`, `packages/core/src/data/dyes.json`, `apps/presets-api/{schema.sql, src/handlers/presets.ts, src/services/preset-service.ts}`.
