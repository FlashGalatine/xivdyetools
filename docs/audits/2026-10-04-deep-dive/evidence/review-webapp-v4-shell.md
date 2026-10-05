# Review: webapp-v4-shell (config-sidebar, V4LayoutShell, palette drawer, app header, colour wheel)

Branch preview/integration-2026-10-04 @80262a2f. No open PR touches these five files (`git diff --stat 8ecb878f HEAD -- apps/web-app/src/components/v4/` is empty), so every candidate is MAIN.

## Map

| Module | Lines | Role |
|---|---|---|
| v4-layout-shell.ts | 1152 | Shell host: header, inline Options column, content slot, palette drawer, two FABs, mobile scrims, first-run hint. Re-emits child events to v4-layout. |
| config-sidebar.ts | 2101 | Options panel. One section per tool, all rendered, `?hidden` by activeTool. Local copy of every ToolConfig, written through ConfigController. |
| dye-palette-drawer.ts | 1315 | Right drawer: search, category chips, spectrum chips, custom colour, favourites, swatch grid. Emits dye-selected / custom-color-selected / clear-all-dyes. |
| v4-app-header.ts | 696 | Console bar: 10-chip rail (desktop), title menu (mobile), chrome cluster. |
| v4-color-wheel.ts | 565 | Harmony wheel: ring paint, node positions from `nodeAngles`, hub button. |

## Candidates

### webapp-v4-shell-01 (BUG, MEDIUM) config-sidebar.ts:676-690 (and 751-769)
Claim: the sidebar loads every config once and then follows only `swatch` and `harmony`. The shell stays mounted across tool switches, so the other controls go stale whenever something other than the sidebar writes ConfigController.
Failing input to wrong outcome:
- Market toggle: open Budget with the sidebar Market toggle off. `budget-tool.ts:292` calls `setShowPrices(true)`, which writes `market.showPrices`. The sidebar still shows "Enable market board" off while prices are on. `comparison-tool.ts:818` and `market-board.ts:309` do the same.
- Mixer mode: open a Mixer share link with `mode=spectral`. `mixer-tool.ts:692` writes `mixer.mixingMode`. The sidebar select (`.value=${this.mixerConfig.mixingMode}`) still shows RYB.
- Reset settings: `advanced-options-panel.ts:239-240` calls `resetAllConfigs()` and dispatches `settings-reset`. Nothing listens (`git grep settings-reset` finds only the dispatch, its test, and a comment), so the sidebar keeps showing the old values for every tool except harmony and swatch, and for global display options, dye filters and market.
- Not defended elsewhere: ConfigController does notify these keys, but the sidebar never subscribes.
Why tests miss it: only `config-sidebar.mixing-mode.test.ts` and `config-sidebar.wheel.test.ts` exist. Neither writes the controller from outside the sidebar. Covered by a test: no.
Origin: MAIN.
```ts
this.swatchConfigUnsubscribe = this.configController?.subscribe('swatch', ...)
this.harmonyConfigUnsubscribe = this.configController?.subscribe('harmony', ...)
// no subscribe for extractor/accessibility/comparison/gradient/mixer/presets/budget/market/global
```
Fix direction: subscribe to every key in `loadConfigsFromController()` and refresh the local copy, with one unsubscribe list. Alternatively, have the shell listen for `settings-reset` and re-run the load.

### webapp-v4-shell-02 (BUG, MEDIUM) v4-layout-shell.ts:141
Claim: the host is `height: 100vh; overflow: hidden`, and `git grep dvh` finds no match in `src`. On a phone with a visible browser toolbar, 100vh is the large viewport. The bottom 56-100px of the host sits under the toolbar. The only scroller is the inner `.v4-layout-content-scroll`, so the last rows of tool content cannot be scrolled into view.
Failing state: iOS Safari or Chrome Android, URL bar showing, any tall tool (Presets list, Accessibility matrix). Last content is clipped.
Why tests miss it: jsdom and Playwright mobile emulation have no dynamic toolbar. Covered: no. Not verified in a real mobile browser.
Origin: MAIN.
Fix direction: `height: 100dvh` with a `100vh` fallback declared first.

### webapp-v4-shell-03 (BUG, MEDIUM) dye-palette-drawer.ts:1194-1231 (and 1125, 1238)
Claim: the drawer is the app-wide dye picker, but a swatch is a `<div @click>` with no `role`, `tabindex` or key handler, so a keyboard-only user cannot pick a dye from it. The nested favourite star is a focusable button, but it is `opacity: 0` until `.swatch:hover` (CSS 492, 505) with no `:focus-visible` or `:focus-within` rule, so a focused star is invisible. On touch the star is hover-only: the first tap on a swatch selects the dye, and only then does the star appear. The Favourites and Custom colour section headers (1125, 1238) are also click-only divs.
Why tests miss it: `dye-palette-drawer.test.ts` has no keyboard or focus assertion. Covered: no.
Origin: MAIN (unchanged since 79e945ac).
Fix direction: render the swatch as a `<button>` (or `role=button` plus `tabindex=0` plus Enter/Space), show the star on `:focus-within` and `@media (hover: none)`, and make the headers buttons.

### webapp-v4-shell-04 (BUG, LOW) dye-palette-drawer.ts:782-785
Claim: the Metallic chip matches `d.name.toLowerCase().includes('metallic')`, which selects 14 dyes. The monorepo decision (2026-07-30, `packages/core/src/config/dye-vocabulary.ts:63-70`) is that metallic means the Stain-sheet gloss set (`METALLIC_STAIN_IDS`, 16), which also includes Gunmetal Black (92) and Pearl White (93). `Dye.isMetallic` already carries it, and the dye-filters exclusion uses it.
Failing input: tap Metallic. Gunmetal Black and Pearl White are missing, while "Exclude metallic" in the Options panel removes them.
Why tests miss it: the test fixture uses `isMetallic: false` (test line 98). Covered: no.
Origin: MAIN.
```ts
case 'metallic': return dyes.filter((d) => d.name.toLowerCase().includes('metallic'));
```
Fix direction: `dyes.filter((d) => d.isMetallic)`. The same applies to pastel (`isPastel`), though that one agrees today.

### webapp-v4-shell-05 (BUG, LOW) v4-layout-shell.ts:863, 919, 936-962 (with 1003-1011, 1026, 1078)
Claim: BaseLitComponent.emit is `bubbles: true, composed: true` (`base-lit-component.ts:110-117`). The shell re-emits `config-change`, `clear-all-dyes`, `changelog-click`, `theme-click`, `about-click`, `language-click` and `advanced-click` without `stopPropagation`. `handleDyeSelected` and `handleCustomColorSelected` do stop propagation, with a comment saying why. The child's own composed event reaches layoutElement as well, so v4-layout (`v4-layout.ts:180, 228, 262-290`) receives each of these twice: once from the shell's re-emit, once from the original.
Failing input: click What's New, Theme, About, Language or the gear. Change any sidebar control. Press the drawer broom. Each handler runs twice. It is harmless today because the five modal show() calls are guarded (`if (this.modalId) return`), setConfig is idempotent, and clearDyes has no side effect. It is a latent double-fire for the next non-idempotent handler (telemetry, toast).
Why tests miss it: no test counts handler invocations. Covered: no.
Origin: MAIN.
Fix direction: stop the original in each child handler, as `handleDyeSelected` does, or make the children emit non-composed events.

### webapp-v4-shell-06 (BUG, LOW) dye-palette-drawer.ts:861-868
Claim: the Random button draws from `this.allDyes`, not `this.filteredDyes`. Under the Budget default (`selectedSpectra = ['unconsolidated']`, lines 101-108), or with Metallic and a search active, it can hand the tool a dye the user has filtered out. In Budget that is a consolidated dye the tool cannot price (the comment at 96-100 says so).
Why tests miss it: the test only checks the `random` flag (lines 161-180). Covered: no.
Origin: MAIN. Whether random should obey filters is a product call, so LOW.
Fix direction: draw from `filteredDyes`, falling back to `allDyes` when it is empty.

### webapp-v4-shell-07 (BUG, LOW) v4-layout-shell.ts:138-149
Claim: `styles/v4-layout.css:11-22` says print rules for the shell's content live in v4-layout-shell.ts `static styles`, but the shell has no `@media print` rule. Print renders the header, both FABs and the Options column, and `height: 100vh; overflow: hidden` clips the page to one sheet.
Failing input: Ctrl+P on any tool. One clipped page with chrome.
Why tests miss it: no print test. Covered: no. There is no `window.print` call in `src`, so this only affects browser print.
Origin: MAIN.
Fix direction: add `@media print` to the shell styles that hides chrome and sets `height: auto; overflow: visible`.

### webapp-v4-shell-08 (REFACTOR, LOW) config-sidebar.ts:918-1951
Claim: the file is 2101 lines. The `<v4-display-options>` block (11 bindings) is pasted 8 times and `<v4-dye-filters>` (9 bindings) 6 times, so adding a display option needs 8 edits. Divergence is already visible: the Presets section (1663) passes `'harmony'` as the tool, and the accessibility block passes a different `visibleGroups`. All ten sections are rendered at once (`?hidden`), so every sidebar state change diffs about 14 hidden option panels.
Fix direction: extract `renderDisplayOptions(groups)` and `renderDyeFilters()`. Render only the active section.

## POSITIVE
- Every subscription in the five files has teardown (shell `languageUnsubscribe` and media-query listener, sidebar five unsubscribes, drawer favourites and language, header language, theme and document keydown).
- `defaultAngles()` uses `Object.hasOwn(HARMONY_OFFSETS, ...)`, so there is no prototype-key lookup (`v4-color-wheel.ts:302`). `getWheelDescription` normalises the wheel id.
- The `depthFor` inward stepping cannot reach a negative radius: the largest coincident group in `HARMONY_OFFSETS` is 2 (`monochromatic [0]` plus the base), and `42 - depth*13` stays positive for depth up to 3.
- `avatarInitial` replaced a `parseInt(uuid)` that produced `avatars/NaN.png`. It uses code points and locale-aware upper-casing.
- The lazy `import('@components/preset-submission-form')` has a `.catch` (config-sidebar.ts:1766-1777).
- Mobile overlays and FABs are gated on `shouldShowOptions` and `shouldShowPalette`, so a route change under an open panel leaves no stray scrim (shell test 379).
- `ConfigController.setConfig` skips no-op writes, so the 9-way display-option fan-out (config-sidebar.ts:872-874, 906-908) is cheap.

## REJECTED
- Drawer `getLocalizedDyeName` using `dye.id`: `Dye.id` always equals `itemID` after init (`packages/types/src/dye/dye.ts:50-57`), and `getDyeName` is keyed by itemID. Fine.
- `hexToHue` returning 360, or negative `h`: handled by `% 360` in `angles()` and `+= 360`.
- `hueToPosition` and the conic ring direction: both measure clockwise from the top. Consistent.
- Sidebar `.value` on selects whose options render after the binding (market, wheel): every such option has `?selected` as well, so first paint is right.
- Fallback `--v4-header-height` mismatch (48px vs 54px): the variable is defined in `themes.css:59`, so the fallbacks are inert.
- Hidden mobile sidebar still focusable: `visibility: hidden` on `.v4-config-sidebar` handles it.
- `activeTool` attribute versus direct property set on the shell: `setAttribute` with an unchanged value still fires `attributeChangedCallback`, so back-navigation resyncs.
- Custom hex input and `isValidHex`: 3-digit hex is normalised, an invalid value falls back, and the Apply button is disabled. Fine.
- `logout()` async rejection: `performLogout` swallows the revoke error. Fine.
- Event-handler duplication in `handleConfigChange` (shell:863): folded into -05.

## COVERED
5 source files read in full, plus the config-controller, base-lit-component, modal show() guards, v4-layout.ts handler block (lines 150-300), and the test inventory under `components/__tests__/` and `components/__tests__/v4/`:
- apps/web-app/src/components/v4/v4-layout-shell.ts
- apps/web-app/src/components/v4/config-sidebar.ts
- apps/web-app/src/components/v4/dye-palette-drawer.ts (CSS 130-685 skimmed)
- apps/web-app/src/components/v4/v4-app-header.ts (CSS 130-440 skimmed)
- apps/web-app/src/components/v4/v4-color-wheel.ts
