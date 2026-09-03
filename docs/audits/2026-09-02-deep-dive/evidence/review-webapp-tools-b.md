# review — webapp-tools-b (deploy unit: web-app)

Repo root: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02` (origin/main e7ac4042).
Read-only review. 14 scope sources read in full + the package entry points and test suites needed to
confirm each claim.

## 1. Map

| Module | Kind | Role |
|---|---|---|
| `apps/web-app/src/components/base-component.ts` | abstract class | Lifecycle (`init/update/destroy`), listener bag, `safeTimeout`, error boundary, `SubscriptionManager` |
| `apps/web-app/src/components/dye-selector.ts` | BaseComponent | Composes DyeSearchBox + DyeGrid + favourites panel; owns selection + filtering/sorting |
| `apps/web-app/src/components/dye-grid.ts` | BaseComponent | Dye cards, roving keyboard nav, favourite/collection buttons |
| `apps/web-app/src/components/dye-search-box.ts` | BaseComponent | Search input (150 ms debounce), sort `<select>`, category chips |
| `apps/web-app/src/components/accessibility-tool.ts` | tool | 6A lens tabs / lens grid / pair readout / result cards + share |
| `apps/web-app/src/components/harmony-tool.ts` | tool | Harmony offsets → slots, colour wheel, market prices, share |
| `apps/web-app/src/components/budget-tool.ts` | tool | 9C ledger: tier groups, per-ΔE column, quick picks, SEND TO row |
| `apps/web-app/src/components/chara-import.ts` | widget | `.chara` parse → THIS CHARACTER sheet + DYES ON THIS GLAMOUR + make-a-palette |
| `apps/web-app/src/components/image-zoom-controller.ts` | BaseComponent | Canvas zoom/pan, loupe drag, pixel/area sampling |
| `apps/web-app/src/components/market-board.ts` | BaseComponent | Server dropdown, show-prices toggle, refresh; delegates to MarketBoardService |
| `apps/web-app/src/components/image-upload-display.ts` | BaseComponent | Drop zone, file/camera inputs, FileReader→data-URL |
| `apps/web-app/src/components/camera-preview-modal.ts` | function | Webcam preview modal + frame capture |
| `apps/web-app/src/components/color-picker-display.ts` | BaseComponent | Hex field, native colour input, EyeDropper |
| `apps/web-app/src/components/advanced-options-panel.ts` | function | Gear slide-over: Data resets, JSON backup, Behaviour toggles |

## 2. Candidates

---

### webapp-tools-b-01 — BUG / HIGH — `apps/web-app/src/components/dye-grid.ts:433`
**Claim** `Enter`/`Space` calls `preventDefault()` before the `focusedIndex` guard, so keyboard activation of a
Tab-focused dye button selects nothing (and, after arrow navigation, selects the wrong dye).

**Failing input → wrong outcome** Load any tool with the dye grid, press Tab until a dye button has focus
(the code comments at `dye-grid.ts:112-114` confirm every button is a Tab stop until `setFocusedIndex()` first
runs), press Enter. `focusedIndex` is still `-1`, so the guard fails — but `preventDefault()` has already
suppressed the browser's synthesized `click`, so the per-button `click` listener at `dye-grid.ts:132` never
fires. **No dye is selected.** After an arrow key has set `focusedIndex`, Shift+Tab to a different button and
press Enter: the stale index selects `this.dyes[focusedIndex]`, not the focused card.

**Why tests miss it** `dye-grid.test.ts:276-306` deliberately presses `Home` first ("First navigate with arrow
to set focusedIndex (initially -1)"), i.e. the tests encode the workaround instead of the user's path. No test
focuses a button and presses Enter, and jsdom does not synthesize a click from Enter, so the suppression is
invisible there.

**Covered by test** no

```ts
case 'Enter':
case ' ':
  event.preventDefault();
  if (this.focusedIndex >= 0 && this.focusedIndex < this.dyes.length) {
    this.selectDye(this.dyes[this.focusedIndex]);
  }
  return;
```

**Fix direction** Derive the index from `document.activeElement` (or the event target's `.dye-select-btn`
ancestor) and only `preventDefault()` when a dye is actually going to be selected.

---

### webapp-tools-b-02 — BUG / HIGH — `apps/web-app/src/components/budget-tool.ts:1160`
**Claim** Budget's SEND TO and context-menu handoffs navigate with `{ dye: dye.name }`, but the receiving tools
resolve `?dye=` as a stainID — Harmony shows an "invalid dye" toast and Comparison silently ignores it.

**Failing input → wrong outcome** Select any target in Budget, click **SEND TO → Harmony**. The URL becomes
`/harmony?dye=Jet%20Black`; `harmony-tool.ts:521` calls `ShareService.resolveSharedDye('Jet Black')`, which does
`parseInt(raw, 10)` → `NaN` → `!Number.isFinite(id)` → `ToastService.error(t('share.invalidDye'))` and returns
`null` (`share-service.ts:319-324`). Harmony opens on whatever was already selected, with an error toast.
Same for **SEND TO → Compare** (`comparison` reads only the plural `dyes` param — `share-service.ts:593`), and
for all four card context actions at `budget-tool.ts:1818/1822/1827` (`add-comparison`, `add-mixer`,
`add-accessibility`, `see-harmonies`). Harmony's own context menu uses a *third*, also-unread grammar
(`{ add: String(dye.itemID) }`, `harmony-tool.ts:1596-1607`); no tool reads `?add=`.

**Why tests miss it** `budget-tool.test.ts` asserts the buttons render and that `navigateTo` was called; nothing
asserts the receiving tool can resolve the value, and no test spans both tools.

**Covered by test** no

```ts
btn(LanguageService.t('budget.handoffHarmony'), () =>
  RouterService.navigateTo('harmony', { dye: dye.name })
),
btn(LanguageService.t('budget.handoffCompare'), () =>
  RouterService.navigateTo('comparison', { dye: dye.name })
),
```

**Fix direction** Send `{ dye: String(dye.stainID) }` (already guarded by the `dye.stainID !== null` branch
above) and use `{ dyes: String(stainID) }` for comparison; delete the dead `add=` grammar in harmony.

---

### webapp-tools-b-03 — BUG / HIGH — `apps/web-app/src/components/accessibility-tool.ts:2010`
**Claim** `updateShareButton()` is wired only to the desktop DyeSelector and the vision `<select>`; every other
selection path leaves the Share button holding stale (or empty) params.

**Failing input → wrong outcome** Open `/accessibility` with nothing selected (`shareButton.disabled = true`,
`shareParams = {}` from `accessibility-tool.ts:830-832`), then pick dyes from the **Color Palette drawer** — the
5.0 primary picker, routed to `AccessibilityTool.selectDye()` by `v4-layout.ts:197-210`. `selectDye()`
(`:361-390`) updates the selectors, results and drawer but never calls `updateShareButton()`, so the Share
button stays **disabled with empty params**. Symmetrically, `clearDyes()` (`:337-352`) and
`removeDyeFromSelection()` (`:1163-1187`) leave it enabled with the *previous* dye list, and the mobile drawer's
`selection-changed` listener (`:1648-1664`) never calls it either — sharing from mobile emits the desktop
selection.

**Why tests miss it** `accessibility-tool.test.ts` drives selection through the mocked DyeSelector's
`selection-changed` event (the one path that *does* refresh the button); no test calls the public
`selectDye()`/`clearDyes()` entry points and then reads `shareParams`.

**Covered by test** no

```ts
public selectDye(dye: Dye): void {
  ...
  this.updateResults();
  this.updateDrawerContent();
  logger.info(`[AccessibilityTool] Selected dye from palette: ${dye.name}`);
}   // no updateShareButton()
```

**Fix direction** Call `updateShareButton()` from `selectDye`, `clearDyes`, `removeDyeFromSelection` and the
drawer listener — or move it into `updateResults()`, which all four already call.

---

### webapp-tools-b-04 — BUG / MEDIUM — `apps/web-app/src/components/dye-grid.ts:454`
**Claim** The `f` and `c` keyboard shortcuts pass `dye.id` (an itemID) into handlers that look the dye up by
`stainID`, so both shortcuts are permanently dead.

**Failing input → wrong outcome** Arrow-navigate to any dye, press `f`. `handleFavoriteToggle(focusedDye.id)` is
called with e.g. `5729`; the handler does `this.dyes.find((d) => d.stainID === dyeId)` (`:272`) and the stainID
range is 1–125 (disjoint from itemIDs ≥ 5729 — `packages/types/src/dye/dye.ts:48-56` states `id` is always equal
to `itemID`), so `dye` is `undefined` and the handler returns. **No favourite is toggled, no toast, no event.**
Identical at `:473` for `c` (add-to-collection). The mouse paths are correct — they read
`data-favorite-dye-id` / `data-collection-dye-id`, which are written from `dye.stainID` (`:157`, `:174`).

**Why tests miss it** see webapp-tools-b-19 — the shared `mockDyes` fixture sets `id === stainID`, so the two
values coincide and `dye-grid.test.ts:417-429` passes on broken code.

**Covered by test** yes, but the test cannot fail (see -19)

```ts
const focusedDye = this.dyes[this.focusedIndex];
this.handleFavoriteToggle(focusedDye.id);      // itemID …
// private handleFavoriteToggle(dyeId: number): void {
//   const dye = this.dyes.find((d) => d.stainID === dyeId);   // … matched against stainID
```

**Fix direction** Pass `focusedDye.stainID` (with a null guard) at both call sites.

---

### webapp-tools-b-05 — BUG / MEDIUM — `apps/web-app/src/components/accessibility-tool.ts:487`
**Claim** `renderLeftPanel()` replaces `this.dyeSelector` / `this.dyePanel` / `this.visionPanel` without
destroying the previous instances, so every language change leaks a DyeSelector, a DyeGrid, and their service
subscriptions — and the orphans keep re-rendering on every subsequent language change.

**Failing input → wrong outcome** Switch language on `/accessibility`. `LanguageService.subscribe` (`:277`)
calls `this.update()` → `BaseComponent.update()` → `renderContent()` → `renderLeftPanel()`, which does
`clearContainer(left)` and then `new CollapsiblePanel(...)` / `new DyeSelector(...)`. The old DyeSelector is
never `destroy()`ed, so its `CollectionService.subscribeFavorites` and its own
`LanguageService.subscribe(() => this.update())` (`dye-selector.ts:458,467`) stay registered. After N language
switches, one switch fans out to N orphaned selectors each running `updateSelectedList()` + `updateGrid()`
(a full 125-dye filter+sort) against a detached container. `renderDrawerContent()` (`:1568-1573`) and
`HarmonyTool.destroyChildComponents()` (`harmony-tool.ts:245-286`, comment: *"CRITICAL: Destroy existing child
components before re-rendering … prevents orphaned components and memory leaks"*) both do it correctly — this is
the one panel that does not.

**Why tests miss it** `accessibility-tool.test.ts` never fires a locale change through a real
`LanguageService.subscribe` callback twice and asserts subscriber counts.

**Covered by test** no

**Fix direction** Mirror `renderDrawerContent()`: destroy `dyeSelector`/`dyePanel`/`visionPanel` at the top of
`renderLeftPanel()` (or add a `destroyChildComponents()` called from `renderContent()`, as HarmonyTool does).

---

### webapp-tools-b-06 — BUG / MEDIUM — `apps/web-app/src/components/dye-selector.ts:709`
**Claim** `DyeSelector.destroy()` cleans up only its own two subscriptions and never destroys the child
`DyeSearchBox` / `DyeGrid`, so each DyeGrid's favourites subscription outlives the component permanently.

**Failing input → wrong outcome** On mobile, open and close the accessibility/comparison config drawer
repeatedly. Each open runs `renderDrawerDyeSelector()` → `new DyeSelector(...)` → `renderContent()` →
`new DyeGrid(gridContainer, {...})`, whose **constructor** registers
`CollectionService.subscribeFavorites` (`dye-grid.ts:43`) into a module-level `Set`
(`collection-service.ts:998-1008`). `accessibility-tool.ts:1581` destroys the DyeSelector, but
`DyeSelector.destroy()` never reaches `this.dyeGrid.destroy()`, so that listener — and the whole detached
grid subtree it closes over — is retained for the session and re-runs `updateFavoriteVisuals()` on every
favourite change. `DyeSearchBox`'s pending 150 ms debounce leaks the same way (its `isDestroyed` never becomes
true, so `safeTimeout` still fires and emits on a detached node).

**Why tests miss it** `dye-selector.test.ts:532-539` asserts only `container.children.length === 0`; the mocked
`subscribeFavorites` returns an unsubscribe function nobody asserts was called.

**Covered by test** no

```ts
override destroy(): void {
  if (this.unsubscribeFavorites) { ... }
  if (this.languageUnsubscribe) { ... }
  super.destroy();          // searchBox / dyeGrid never destroyed
}
```

**Fix direction** `this.searchBox?.destroy(); this.dyeGrid?.destroy();` before `super.destroy()`, and also at the
top of `renderContent()` (it re-creates both on every render).

---

### webapp-tools-b-07 — BUG / MEDIUM — `apps/web-app/src/components/harmony-tool.ts:1386`
**Claim** `matches[0].dye` is dereferenced without a guard; `replaceExcludedDyes()` can legitimately return an
empty array, throwing a TypeError that escapes the config-change listener. The sibling copy of this loop is
already hardened.

**Failing input → wrong outcome** In the config sidebar enable **Exclude vendor dyes** + **Exclude crafted
dyes** + **Exclude cosmic dyes**. Those three cover all 125 dyes (`dyes.json` acquisitions: 85 `Dye Vendor`,
20 `Venture Coffers`, 9 `The Firmament`, 11 `Cosmic Exploration`; `VENDOR_ACQUISITIONS`/`CRAFT_ACQUISITIONS` in
`packages/core/src/services/dye/DyeFilter.ts:19-23`, and all 11 cosmic dyes carry `isCosmic` via
`consolidationType === 'C'`). `replaceExcludedDyes` (`services/harmony-generator.ts:208-257`) finds no
`bestAlternative` for any candidate and returns `[]`. `generateHarmonies()` then throws
`Cannot read properties of undefined (reading 'dye')` after the grid was already cleared, leaving the tool in a
half-rendered state. `fetchPricesForDisplayedDyes()` performs the same computation with `matches[0]?.dye`
(`:1735`, `:1740`), so the divergence is a plain oversight.

**Why tests miss it** `harmony-tool.test.ts` exercises `dyeFilters` only through partial configs that leave
candidates behind.

**Covered by test** no

```ts
} else if (this.preventDuplicates) {
  const uniqueMatch = matches.find((m) => !usedDyeIds.has(m.dye.itemID));
  displayDye = uniqueMatch?.dye ?? matches[0].dye;      // throws on []
```

**Fix direction** Use `matches[0]?.dye` and skip the slot (or render the "no candidates" empty state) when the
match list is empty.

---

### webapp-tools-b-08 — BUG / MEDIUM — `apps/web-app/src/components/harmony-tool.ts:2644`
**Claim** `selectDye()` / `selectCustomColor()` / `clearDyes()` regenerate the results but never refresh the
left panel's "current base dye" display, which is only redrawn from the two `selection-changed` listeners.

**Failing input → wrong outcome** On `/harmony` with no base dye, pick a dye from the Color Palette drawer.
`v4-layout.ts:207` calls `HarmonyTool.selectDye(dye)`, which sets `this.selectedDye`, calls
`this.dyeSelector.setSelectedDyes([dye])` and `generateHarmonies()`. `DyeSelector.setSelectedDyes()`
(`dye-selector.ts:476`) does **not** emit `selection-changed`, so the listener registered at
`harmony-tool.ts:912` never runs and `renderCurrentDyeDisplayInto(displayContainer)` is never called: the Base
Dye panel keeps showing the "Select a dye" placeholder while the wheel and result grid show the new harmony.
`clearDyes()` (`:2620`) has the mirror defect — the panel keeps showing the cleared dye's swatch and name.

**Why tests miss it** `harmony-tool.test.ts` drives selection through the emitted event, never through the
public `selectDye`/`clearDyes` API.

**Covered by test** no

**Fix direction** Keep the `displayContainer` on the instance (as the drawer already does) and call
`renderCurrentDyeDisplayInto` from `selectDye`, `selectCustomColor` and `clearDyes`.

---

### webapp-tools-b-09 — BUG / MEDIUM — `apps/web-app/src/components/budget-tool.ts:625`
**Claim** BudgetTool merges fetch results into its own `priceData` map and never clears it, so a world/DC change
or a failed fetch leaves the previous world's prices in the ledger, attributed to the new world.

**Failing input → wrong outcome** Price a target on *Aether*, then switch the server to *Primal* in the sidebar.
`MarketBoardService` clears its own cache (`market-board-service.ts:150`) and re-fetches; the returned map
contains only the items the new DC actually listed. `fetchPrices()` does
`prices.forEach((data, itemId) => this.priceData.set(itemId, data))` — a merge, never a reset — so any dye with
no Primal listing keeps its **Aether** price, and `getWorldNameForPrice()` labels it with the newly selected
server. The verdict's "cheapest known" and the per-ΔE column are computed from that mixture. The only
`this.priceData.clear()` is in `destroy()` (`:303`).

**Why tests miss it** `budget-tool.test.ts` never changes the server between two fetches with differing result
sets.

**Covered by test** no

**Fix direction** `this.priceData.clear()` at the top of `fetchPrices()` (or on the `market` config
subscription, before `findAlternatives()`).

---

### webapp-tools-b-10 — BUG / MEDIUM — `apps/web-app/src/components/budget-tool.ts:609`
**Claim** A *superseded* price fetch returns an empty Map by design, and both Budget and Harmony read that as
"the market board is offline", showing a false failure banner.

**Failing input → wrong outcome** `MarketBoardService.fetchPricesForDyes()` bumps `requestVersion` and returns
`new Map()` for any response whose version no longer matches (`market-board-service.ts:335-343`). Budget starts
overlapping fetches routinely — dragging the match-line slider fires `void this.findAlternatives()` per `input`
event (`budget-tool.ts:951`), and a sidebar change fires both the `budget` and `market` subscriptions
(`:264`, `:277`). The superseded call then executes `this.marketOnline = prices.size > 0` → `false` and, if it
settles after the winner, `renderVerdict()` paints the amber OFF-BOARD verdict over live prices. Harmony has the
identical read at `harmony-tool.ts:1766` (`this.marketFailed = dyesToFetch.length > 0 && prices.size === 0`) and
its comment states the assumption explicitly: *"'asked for dyes and got nothing' is the only failure signal
there is"* — which is false, because supersession produces the same signal.

**Why tests miss it** both suites mock the service to resolve a single fetch; no test issues two overlapping
fetches.

**Covered by test** no

**Fix direction** Give the service a distinguishable outcome (e.g. resolve `null`/`{ superseded: true }`, or
expose the request version) and only set the offline flag on a genuine empty/failed response.

---

### webapp-tools-b-11 — BUG / MEDIUM — `apps/web-app/src/components/market-board.ts:66`
**Claim** `onMount()`'s `loadServerData()` re-runs `populateServerDropdown()` on the already-populated
`<select>` without clearing it, so every data centre and world is listed twice.

**Failing input → wrong outcome** Open Harmony's Market Board panel. `renderContent()` builds the select and
calls `populateServerDropdown(serverSelect)` (`:117`) — `WorldService` is already initialised because
`initializeServices()` awaits it at app start (`services/index.ts:96`), so the full list lands. `onMount()` then
calls `loadServerData()`, whose `await WorldService.initialize()` resolves immediately and calls
`populateServerDropdown()` again on the *same* element (`:64-67`). `populateServerDropdown` only appends
(`:242-280`) — no `clearContainer` — so the user sees every DC/world twice.

**Why tests miss it** `market-board.test.ts:142-149` asserts `optgroups?.length === 2` **synchronously** after
`init()`; the duplicate append happens one microtask later, after the assertion. The companion test asserts
`options.length` is `> 0`, which passes at 6 or at 12.

**Covered by test** no (the tests assert a value captured before the action)

**Fix direction** `clearContainer(selectElement)` at the top of `populateServerDropdown`, and re-select the
current server afterwards.

---

### webapp-tools-b-12 — BUG / MEDIUM — `apps/web-app/src/components/image-zoom-controller.ts:441`
**Claim** `setImage()` registers `document` `keydown`/`keyup` listeners on every call and never removes the
previous pair, so keyboard zoom steps multiply by the number of images loaded this session.

**Failing input → wrong outcome** In the extractor, load image A, then load image B (drop / replace / paste —
`extractor-tool.ts:1479-1487` is the shared arrival path and calls `setImage()` each time). `setImage()` clears
the container but never calls `unbindAllEvents()`; `setupZoomControls()` then adds a second
`this.on(document, 'keydown', …)` (`:441`) and `keyup` (`:465`). Press `+` with focus on the body: both handlers
run and the zoom jumps **20 %**, while the on-screen `+` button still steps 10 %. Three images → 30 %.
Each stale handler also retains the controller instance.

**Why tests miss it** `image-zoom-controller.test.ts:193-201` calls `setImage()` twice but asserts only
`container.querySelectorAll('canvas')).toHaveLength(1)`. The teardown test at `:685-700` even names the defect
in a comment — *"a leak that stacks one extra handler per image the user loads"* — yet only asserts the
post-`destroy()` case.

**Covered by test** no

**Fix direction** Move the two document listeners out of `setupZoomControls()` into `bindEvents()` (called once
per `init()`), or remove the previous pair at the top of `setImage()`.

---

### webapp-tools-b-13 — BUG / MEDIUM — `apps/web-app/src/components/color-picker-display.ts:184`
**Claim** The hex field accepts 3-digit hex but stores and emits it unexpanded; `input[type=color]` sanitises
`#F00` to `#000000`, and mid-typing a 6-digit value fires a spurious 3-digit selection.

**Failing input → wrong outcome** Type `#F00`. The regex `^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$` matches, so
`selectedColor = '#F00'` and `emit('color-selected', { color: '#F00' })`. `updateDisplay()` then assigns
`colorPicker.value = '#F00'`; per the HTML colour-input value-sanitisation algorithm anything that is not
exactly `#rrggbb` becomes `#000000`, so the native swatch turns **black** beside a red preview, and the next
nudge of that control emits a near-black colour. Separately, typing `#123456` character by character emits
`color-selected` with `#123` after the fourth keystroke, so downstream dye matching runs against a colour the
user never chose. (Core's `hexToRgb` does expand 3-digit forms, so the RGB/HSV read-outs stay right — the
divergence is only between the two controls and the emitted value.)

**Why tests miss it** `color-picker-display.test.ts` asserts `getColor()` after typing a 3-digit value and gets
back exactly what it typed; jsdom's `input[type=color]` does not implement the sanitisation algorithm.

**Covered by test** no

```ts
if (/^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/.test(value)) {
  this.selectedColor = value;          // '#F00' stored raw
```

**Fix direction** Expand 3-digit input to 6 before assigning (`#rgb` → `#rrggbb`), and only accept the short
form on `change`/`blur` rather than on every `input`.

---

### webapp-tools-b-14 — BUG / MEDIUM — `apps/web-app/src/components/advanced-options-panel.ts:220`
**Claim** The Behaviour toggles capture `advancedConfig` once at panel-open time and track their own local
`state`, so a settings reset or import performed in the same open panel makes the next toggle write the negation
of a stale value.

**Failing input → wrong outcome** Open the gear panel with **Enable Analytics = on**. In the *Data* section run
**Reset settings** → `configController.resetAllConfigs()` sets `analyticsEnabled` back to its default.
The Behaviour toggle still paints "on" (`state` was captured at `:367` from the `advancedConfig` read at
`:220`). Tapping it flips `state` to `false` and writes `{ analyticsEnabled: false }` — the user's tap produces
no visible change on the *second* tap either, because `state` and the store are now off by one. The same
sequence via **Import settings** (`:332`) silently overwrites the freshly imported value. Nothing in the panel
subscribes to `ConfigController` for the `advanced` domain.

**Why tests miss it** no test opens the panel and mutates config from inside it.

**Covered by test** no

```ts
const advancedConfig: AdvancedConfig = configController.getConfig('advanced');   // read once
...
toggleRow(..., advancedConfig.analyticsEnabled, (checked) =>
  configController.setConfig('advanced', { analyticsEnabled: checked }))
```

**Fix direction** Read the live value inside the click handler (`configController.getConfig('advanced')`), or
subscribe and repaint the toggles on change.

---

### webapp-tools-b-15 — BUG / MEDIUM — `apps/web-app/src/components/camera-preview-modal.ts:298`
**Claim** The camera modal has no route-change teardown, so an in-app navigation leaves the modal open with a
live `MediaStream`.

**Failing input → wrong outcome** Open the webcam modal from the extractor, then press browser Back (or use the
title menu). `RouterService` notifies its subscribers and `v4-layout.ts:316-322` swaps the tool content, but
`ModalService` holds its stack independently (`services/modal-service.ts:110-162`) and nothing dismisses it on a
route change. The modal's `onClose` — the only path that calls `cameraService.stopStream()` (`:306-311`) — never
runs, so the camera stays live over a different tool. `cameraService` is a module singleton, so a subsequent
`startStream()` from the new tool also contends with it.

**Why tests miss it** `camera-preview-modal.test.ts` drives capture/cancel/close directly; there is no
route-change test.

**Covered by test** no

**Fix direction** Subscribe to `RouterService` while the modal is open (as `advanced-options-panel.ts:395` does)
and dismiss + `stopStream()` on a route change; or have `ModalService` dismiss non-persistent modals on
navigation.

---

### webapp-tools-b-16 — BUG / LOW — `apps/web-app/src/components/base-component.ts:179`
**Claim** `destroy()` sets `isDestroyed = true` *after* `onUnmount?.()`, and the whole body is wrapped in a
catch that swallows — a throwing `onUnmount` leaves a half-destroyed component that still schedules timers and
whose element stays in the DOM.

**Failing input → wrong outcome** Any subclass whose `onUnmount` throws (e.g. a service call that rejects
synchronously). `unbindAllEvents()` and `clearAllTimeouts()` have already run, then the throw skips
`this.isDestroyed = true` and `this.element?.remove()`. `ErrorHandler.log(error)` swallows it, so the caller
believes the teardown succeeded; meanwhile `safeTimeout()` (`:197`) still sees `isDestroyed === false` and
schedules work against a component with no listeners, and the element remains attached.

**Why tests miss it** `base-component.test.ts:241-260` only asserts a *non-throwing* `onUnmount` runs.

**Covered by test** no

```ts
this.subs.unsubscribeAll();
this.onUnmount?.();
this.isDestroyed = true;      // skipped when onUnmount throws
this.element?.remove();
```

**Fix direction** Set `isDestroyed = true` first (or in a `finally`), and wrap `onUnmount?.()` in its own
try/catch.

---

### webapp-tools-b-17 — BUG / LOW — `apps/web-app/src/components/base-component.ts:132`
**Claim** `init()` calls `bindEvents()` unconditionally after `render()`, including when `render()` fell through
to the error-boundary UI — so a subclass whose `bindEvents` assumes its own DOM throws out of `init()` and
defeats the boundary.

**Failing input → wrong outcome** Let a subclass `renderContent()` throw. `render()` → `safeRender()` →
`handleRenderError()` replaces the container with the boundary markup and returns normally. `init()` then runs
`bindEvents()`, which queries selectors that no longer exist; any subclass that dereferences a query result (or
iterates a child list) throws, `init()` re-throws after logging, and the caller sees a hard failure instead of
the boundary's Retry/Reset UI. `handleRetry()` (`:429`) guards this correctly (`if (!this.errorState.hasError)`),
`init()` does not.

**Why tests miss it** `base-component.test.ts` uses a test subclass whose `bindEvents` is a no-op.

**Covered by test** no

**Fix direction** Guard `bindEvents()` in `init()` with `if (!this.errorState.hasError)`, matching `handleRetry`.

---

### webapp-tools-b-18 — BUG / LOW — `apps/web-app/src/components/image-zoom-controller.ts:751`
**Claim** `touchend` samples a colour whenever `isDragging` is set, including when the second finger of a pinch
is lifted — so a two-finger gesture commits an unintended sample.

**Failing input → wrong outcome** Touch the canvas with one finger (`touchstart`, `touches.length === 1` →
`isDragging = true`), add a second finger (`touchstart` returns early at `:714` without clearing `isDragging`),
pinch (`touchmove` returns early at `:736` because `touches.length !== 1`), then lift one finger. `touchend`
fires with `isDragging` still `true`, reads `changedTouches[0]` and calls `sampleColorAtArea()` at the lifted
finger's position — the tool matches a colour the user never picked. `changedTouches[0]` is also dereferenced
without a guard.

**Why tests miss it** the touch tests dispatch single-touch sequences only.

**Covered by test** no

**Fix direction** Clear `isDragging` when a `touchstart` brings `touches.length > 1`, and guard
`changedTouches[0]`.

---

### webapp-tools-b-19 — UNTESTED / HIGH — `apps/web-app/src/__tests__/mocks/services.ts:20`
**Behaviour the tests were supposed to catch** Every `id`-vs-`stainID` confusion in the web app.

**Claim** The shared `mockDyes` fixture inverts the production invariant: it sets `id === stainID` and a
*different* `itemID`, whereas `packages/types/src/dye/dye.ts:48-56` states `Dye.id` is **always equal to
`itemID`** after `DyeDatabase.initialize()` ("not a small sequential index"). Eleven component suites import
this fixture (`accessibility-tool`, `budget-tool`, `comparison-tool`, `dye-grid`, `dye-selector`,
`extractor-tool`, `gradient-tool`, `harmony-tool`, `market-board`, `mixer-tool`, `swatch-tool`,
`share-service`), so any code that passes an `id` where a `stainID` is expected — or the reverse — matches in
tests and fails in production. webapp-tools-b-04 is exactly that: `dye-grid.test.ts:417-429` asserts
`mockAddFavorite` was called and passes, while the production path returns early on every real dye.

```ts
export const mockDyes: Dye[] = [
  { id: 1, itemID: 5729, stainID: 1, name: 'Snow White', ... },
  { id: 2, itemID: 5730, stainID: 2, name: 'Ash Grey',  ... },
```

**Fix direction** Set `id: 5729` (=== `itemID`) for every fixture entry and fix the fallout; add a fixture
invariant test asserting `mockDyes.every(d => d.id === d.itemID && d.stainID !== d.itemID)`.

---

### webapp-tools-b-20 — UNTESTED / MEDIUM — `apps/web-app/src/components/__tests__/market-board.test.ts:142`
**Behaviour the tests were supposed to catch** That the server dropdown is populated exactly once.

**Claim** Both dropdown tests assert synchronously right after `init()`, i.e. **before** the `onMount()` →
`loadServerData()` microtask that appends the second copy (webapp-tools-b-11). The second test's
`expect(options.length).toBeGreaterThan(0)` cannot distinguish 6 options from 12 — no source edit that changes
the option count would turn it red.

```ts
marketBoard.init();
const optgroups = serverSelect?.querySelectorAll('optgroup');
expect(optgroups?.length).toBe(2);        // asserted before the duplicating microtask
...
expect(options.length).toBeGreaterThan(0);  // passes at any non-zero count
```

**Fix direction** `await Promise.resolve()` (or `vi.waitFor`) before asserting, and assert the exact option
count (2 DCs × (1 + 2 worlds) = 6).

---

### webapp-tools-b-21 — UNTESTED / MEDIUM — `apps/web-app/src/components/__tests__/dye-selector.test.ts:532`
**Behaviour the tests were supposed to catch** That `DyeSelector.destroy()` releases its children's service
subscriptions (webapp-tools-b-06).

**Claim** The only lifecycle test asserts `container.children.length === 0` — a property that
`BaseComponent.destroy()`'s `this.element?.remove()` satisfies whether or not the children were torn down. The
suite already owns `mockSubscribeFavorites`, which returns an unsubscribe spy nobody asserts on, so the leak is
observable but unobserved.

```ts
selector.destroy();
expect(container.children.length).toBe(0);
```

**Fix direction** Have `mockSubscribeFavorites` return a `vi.fn()` and assert it was called once per DyeGrid
after `destroy()`.

---

### webapp-tools-b-22 — UNTESTED / LOW — `apps/web-app/src/components/__tests__/image-zoom-controller.test.ts:193`
**Behaviour the tests were supposed to catch** That `setImage()` does not stack document listeners
(webapp-tools-b-12).

**Claim** The test calls `setImage()` twice and then asserts only the canvas count. The suite's own teardown
test names the stacking in a comment but never asserts it; a `+` keydown after the double `setImage` would show
`120.00%` and nothing checks it.

```ts
controller.setImage(image);
controller.setImage(image);
expect(container.querySelectorAll('canvas')).toHaveLength(1);
```

**Fix direction** After the second `setImage()`, dispatch one `+` keydown and assert `110.00%`.

---

### webapp-tools-b-23 — OPT / MEDIUM — `apps/web-app/src/components/accessibility-tool.ts:1225`
**Claim** `this.pairResults` is written and never read; roughly half of `DyeAccessibilityResult` is dead too, so
every `updateResults()` runs a full v2 analysis pass whose output the 6A UI ignores.

**Detail** `pairResults` is assigned at `:1229` and cleared at `:322`; there is no other reference in the file.
Each `analyzePair()` call (`:1914-1990`) performs 4 colour-distance computations, 8 colourblindness
simulations and up to 6 `LanguageService.t()` lookups; with 4 dyes that is 6 pairs ≈ 48 simulations per update.
On `DyeAccessibilityResult`, only `dyeName` (`:1431`, `:1513`) and `colorblindnessSimulations` (`:1278`) are
read — `contrastVsWhite`, `contrastVsBlack` and `warnings` are dead. `updateResults()` runs on every selection
change, vision-type toggle, config change and language change.

**Fix direction** Delete `analyzePair()`/`pairResults` and trim `DyeAccessibilityResult` to `dyeName` +
`colorblindnessSimulations`; the 6A pair readout already recomputes what it needs in `pairValue()`.

---

### webapp-tools-b-24 — BUG / LOW — `apps/web-app/src/components/accessibility-tool.ts:1876`
**Claim** The red-green warning tests two simulated hex strings for exact equality, which is true only for
neutral greys and never for the red/green dyes it is meant to flag. Latent today because
`DyeAccessibilityResult.warnings` is never rendered (webapp-tools-b-23) — it becomes a live wrong result the
moment the warnings are wired back up.

**Failing input → wrong outcome** Both Brettel matrices are row-normalised
(`packages/core/src/constants/index.ts:46-55`: deuteranopia rows sum to 1.0, protanopia rows sum to 1.0), so for
any grey `r=g=b=v` both simulations return exactly `(v,v,v)` and `deuterColor === protanColor` is true — the
"this dye is hard for red-green colourblind users" warning fires on **greys only**. For `#FF0000` the two
simulations are `#9FB300` and `#918E00`; the condition is false and the warning never fires for the actual
red-green confusion cases.

**Covered by test** no

```ts
if (deuterColor === protanColor) {
  warnings.push(LanguageService.t('accessibility.redGreenWarning'));
}
```

**Fix direction** Compare with a perceptual threshold
(`ColorService.getDeltaE(deuterColor, protanColor, 'cie2000') < ε`) against the *original* colour, not string
equality between the two simulations.

---

### webapp-tools-b-25 — BUG / LOW — `apps/web-app/src/components/accessibility-tool.ts:1268`
**Claim** `activeVision` is never reconciled with `enabledVisionTypes`, so disabling the active lens leaves the
workspace painted through a lens that has no tab and no `aria-selected` control.

**Failing input → wrong outcome** Set the lens to Protanopia, then uncheck Protanopia in the vision toggles.
`visibleVisions()` (`:1268`) filters it out of the tab strip, but `renderLensGrid()`, `renderPairReadout()` and
`renderSelectedDyeCards()` keep using `this.activeVision`, so the whole right panel still shows the protanopia
simulation with no tab marked active and no way to tell which lens is in force. The constructor's restore path
(`:230-233`) validates the persisted lens against `VISION_TYPES` but not against `enabledVisionTypes`.

**Covered by test** no

**Fix direction** In `setConfig()` and the toggle handlers, fall back to the first visible vision (or `normal`)
whenever `activeVision` leaves `enabledVisionTypes`.

---

## 3. POSITIVE — do not re-file

- **Consolidated market itemIDs are handled correctly.** `MarketBoardService.fetchPricesForDyes()` fans the
  three consolidated prices (52254/52255/52256) back out to each member dye's own itemID
  (`market-board-service.ts:344-357`), so Budget's `priceOf()` and Harmony's `priceData.get(dye.itemID)` are
  right. The BUG-010/REFACTOR-011 fix is intact.
- **`.chara` character-name privacy holds.** `communityPaletteName()` (`chara-import.ts:1626`) returns only the
  typed draft — never the nickname or the filename — and only `localPaletteName()`/`saveCharacterRecord()` use
  those, into device-local `CollectionService` records. The name input is explicitly not pre-filled.
- **The `.chara` resolve round-trip is race- and abort-clean.** `startResolve()` aborts the previous controller,
  checks both `signal.aborted` and `this.resolved !== resolved` in each settle path, and the service combines the
  caller signal with `AbortSignal.timeout` (`chara-resolve-service.ts:118-119`). `destroy()` aborts.
- **Share-URL dye grammar is stainID-first and fails loudly.** `getShareParams()` in both accessibility and
  harmony writes `stainID` (with a `hex` fallback for custom colours), and `ShareService.resolveSharedDye()`
  rejects legacy itemIDs ≥ 5729 with a toast rather than guessing.
- **Settings import is sanitised.** `ConfigController.importConfigs()` runs `sanitizeConfigPartial` per key
  (`config-controller.ts:339-346`), so a hand-edited backup cannot inject unknown fields.
- **`HarmonyTool.destroyChildComponents()`** is the correct pattern for child-component teardown before
  re-render — the model the accessibility tool's left panel should copy.
- **`pairValue()` rounds to the unit's display precision before tiering** (`accessibility-tool.ts:1289-1298`),
  so a value never scores in a different band than the one shown.
- **`saveLocalPalette()`'s dedup loop trims the base, never the suffix** (`chara-import.ts:1655-1658`) — the
  non-terminating case is already handled.

## 4. REJECTED

- *Wheel listener registered non-passive so `preventDefault()` is a no-op* — `wheel` is passive-by-default only
  on `window`/`document`/`document.body`; `canvasContainerRef` is a `<div>`, so `preventDefault()` works.
  Same for the `touchmove` on the canvas.
- *Pointer-capture never released (image-zoom-controller)* — the controller uses mouse/touch events, not Pointer
  Events; there is no `setPointerCapture` call anywhere in the file.
- *Object URL never revoked (image-upload-display)* — the upload path uses `FileReader.readAsDataURL`, not
  `URL.createObjectURL`; there is no object URL to leak. (Holding a ~27 MB base64 string for a 20 MB image is a
  memory cost, not a leak.)
- *TDZ on `selector` inside `cleanup()` (camera-preview-modal.ts:158)* — `cleanup` can only run from handlers
  registered before `ModalService.show()`, and the `const selector` at `:265` is initialised in the same
  synchronous body, so the temporal dead zone is unreachable.
- *`shouldFetchPrice` uses `!dye.itemID` instead of `> 0` (market-board.ts:394)* — the documented anti-pattern,
  but the service re-checks `dye.itemID <= 0`, so the outcome is identical. Style only.
- *Facewear colours leaking into dye lists* — `DyeSelector.getFilteredDyes()` and `findClosestDyesToHue()` still
  filter `category !== 'Facewear'`, but schema v2 removed facewear from `dyes.json` entirely, so the filters are
  no-ops rather than defects. No facewear entry can reach a dye list.
- *`DyeSearchBox` clear-button lookup by translated `aria-label` (dye-search-box.ts:209-211)* — fragile
  (a locale containing `"` would throw a `SyntaxError` from `querySelector`), but all six current locales are
  quote-free and the element also carries `id="dye-selector-clear-btn"`. Latent only.
- *`URL.revokeObjectURL` called synchronously after `a.click()` (advanced-options-panel.ts:312)* — browser
  dependent; I could not construct a case that fails in a currently supported browser.
- *`DyeGrid.updateSelectionVisuals()` updates only `aria-selected`, not the ring classes* — the callers
  (`DyeSelector.updateGrid`) always call `setDyes()` first, which re-renders, so the visual state is correct in
  practice.

## 5. COVERED — 14 scope files read in full

`apps/web-app/src/components/`: `base-component.ts`, `dye-selector.ts`, `dye-grid.ts`, `dye-search-box.ts`,
`accessibility-tool.ts`, `harmony-tool.ts`, `budget-tool.ts`, `chara-import.ts`, `image-zoom-controller.ts`,
`market-board.ts`, `image-upload-display.ts`, `camera-preview-modal.ts`, `color-picker-display.ts`,
`advanced-options-panel.ts`.

Read to confirm claims: `apps/web-app/src/shared/subscription-manager.ts`, `shared/custom-dye.ts`,
`shared/dye-filter-utils.ts`, `services/market-board-service.ts`, `services/harmony-generator.ts`,
`services/share-service.ts`, `services/router-service.ts`, `services/collection-service.ts`,
`services/world-service.ts`, `services/config-controller.ts`, `services/modal-service.ts`,
`services/index.ts`, `services/chara-resolve-service.ts`, `components/v4-layout.ts`,
`components/v4/v4-layout-shell.ts`, `components/extractor-tool.ts`, `packages/types/src/dye/dye.ts`,
`packages/core/src/services/dye/DyeFilter.ts`, `packages/core/src/services/dye/DyeDatabase.ts`,
`packages/core/src/services/color/ColorConverter.ts`,
`packages/core/src/services/color/ColorblindnessSimulator.ts`, `packages/core/src/constants/index.ts`,
`packages/core/src/data/dyes.json`, `apps/web-app/src/locales/*.json`.

Tests skimmed: `components/__tests__/` — `dye-grid.test.ts`, `dye-selector.test.ts`, `dye-search-box.test.ts`,
`market-board.test.ts`, `image-zoom-controller.test.ts`, `base-component.test.ts`,
`color-picker-display.test.ts`, `harmony-tool.test.ts`, `budget-tool.test.ts`, `accessibility-tool.test.ts`,
`image-upload-display.test.ts`, `camera-preview-modal.test.ts`, `chara-import-*.test.ts`; plus
`src/__tests__/mocks/services.ts`.
