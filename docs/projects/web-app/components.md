# Web App Component Architecture

XIV Dye Tools web app (v5.0.0) is built with **Lit 3** web components plus a family of imperative `BaseComponent` tools, organised as: a console shell (`v4-layout-shell`), tool components mounted into it, shared UI primitives, a modal set on the 16A shell, and a service layer of static-class and instance singletons. Everything lives under `apps/web-app/src/` — `components/` (imperative + Lit), `components/v4/` (Lit shell and primitives), `services/`, `shared/`. Component names below are real files; anything not listed here does not exist any more (`tool-banner`, `palette-exporter`, `PaletteService`, `settings-modal`, `auth-modal`, `dye-card`, `dye-search`, `sidebar-panel` were all removed or never had those names).

---

## The #1 gotcha: tool content lives in a shadow root

`v4-layout-shell` is a Lit element with a shadow root. `src/components/v4-layout.ts` `loadToolContent()` mounts every tool by querying `layoutElement.shadowRoot.querySelector('.v4-layout-content-scroll')` and appending the tool container **inside that shadow root** — the shell's `<slot>` is not used for tools. Consequences (verified in `v4-layout.ts` and `v4-layout-shell.ts`):

- Nothing in `styles/globals.css`, `styles/v4-layout.css` or the document-level Tailwind build reaches tool content. Tailwind utility class names still appear in tool markup but only take effect where a rule happens to be injected; **inline styles are load-bearing** in the tool components (their headers say so — `budget-tool.ts`: "Tool content renders inside v4-layout-shell's shadow DOM — inline styles only").
- The two shared tool rules — the centred `.v5-results-grid` (3-up desktop / 2-up mobile) and the empty-state sizing — are injected once by `v4-layout.ts` as a `<style id="v5-results-grid-style">` into the shell's shadow root. A rule that must apply to tool content belongs there or inline; putting it in a page stylesheet is a silent no-op (that is how the Harmony empty state once drew its 62 px glyph at 437 px).
- Lit children (`<v4-result-card>`, `<v4-preset-tool>`, `<v4-share-button>`…) carry their own `static styles`, so they are unaffected. Empty-state glyphs embed their CSS inside the SVG for the same reason.
- Modals are the opposite: `ModalContainer` renders into `#modal-container` in light DOM and injects the 16A stylesheet into `document.head` (it used to inject into the container, which is cleared when the last modal closes — every modal after the first rendered unstyled).
- The keyboard typing guard uses `composedPath()[0]` so digits typed into a shadow-DOM search box do not switch tools.

---

## BaseComponent (imperative tools) and BaseLitComponent

**`components/base-component.ts`** — abstract base for the eight imperative tools and most legacy panels. `constructor(container)`; `init()` → `render()` + `bindEvents()` + `onMount?()`; `update()` unbinds all events, re-renders, rebinds, calls `onUpdate?()`; `destroy()` unbinds, clears `safeTimeout` timers, runs `this.subs.unsubscribeAll()`, `onUnmount?()`, removes the element.

| Method | Purpose |
|--------|---------|
| `renderContent()` / `bindEvents()` | Abstract; subclasses implement these and never override `render()`. |
| `safeRender()` | Try/catch around `renderContent()`; failures go to `handleRenderError()`. |
| `renderError()` | Fallback UI with retry (`MAX_RETRY_COUNT = 3`) and reset. |
| `safeAsync(op)` | Async wrapper routing errors through the same boundary; returns `null` on failure. |
| `safeTimeout()` / `clearSafeTimeout()` | Timers that are cancelled on destroy. |
| `emit(name, detail)`, `on()`/`onCustom()` | Event helpers; `unbindAllEvents()` on update/destroy. |
| `subs: SubscriptionManager` | Every service subscription goes through `this.subs.add(Service.subscribe(...))`; cleanup is guaranteed by the base class. |

**`shared/subscription-manager.ts`** — `add(unsub)`, `addAll(...unsubs)`, `unsubscribeAll()`. Lit components use it the same way in `disconnectedCallback`.

**`components/v4/base-lit-component.ts`** — abstract `LitElement` base for the `v4/` components: shared `baseStyles`, `emit()` (bubbles + composed), `isReady` after `firstUpdated`, `setError()` / `clearError()`.

---

## The console shell

| Component | File | Role |
|-----------|------|------|
| `v4-layout-shell` | `components/v4/v4-layout-shell.ts` | Top-level layout: `<v4-app-header>` over a `.v4-layout-main` row of Simple-Settings column (desktop only) + `main.v4-layout-content` + `<dye-palette-drawer>`; palette FAB; first-run mobile palette hint (`colorPalette.mobileHint`, `STORAGE_KEYS.PALETTE_HINT_SEEN`). Fires `tool-change`, `dye-selected`, `custom-color-selected`, `clear-all-dyes`, `config-change`, and bubbles `changelog-click` / `theme-click` / `language-click` / `about-click` / `advanced-click`. Handles `open-palette-drawer` from tools (Harmony's hub button). |
| `v4-app-header` | `components/v4/v4-app-header.ts` | The 54 px console bar: brand, tool switcher, chrome cluster (What's New · About · locale · theme sun/moon · Advanced gear). **Desktop (> 768 px): the 3A tool rail** — nine 38 px icon chips, active chip accent-filled with its short name (`tools.<id>.shortName`: Harmony, Extractor, Vision, Compare, Gradient, Presets, Budget, Swatch, Mixer), the others unroll their name on hover/focus, `aria-current="page"`; the wordmark yields between 769–919 px. **Mobile (≤ 768 px): the 2B title-menu** — tapping the current tool opens a two-column menu of all nine with one-liners (`data-tool` hooks). Both are rendered; a media query decides. 3F locale chrome: globe + code on desktop, code only on mobile. Fires `tool-select`. |
| `v4-config-sidebar` | `components/v4/config-sidebar.ts` | "Simple Settings": all per-tool config sections in one element, shown/hidden by `active-tool`; two-way bound to `ConfigController` (subscribes to `swatch` and `harmony` so tool-driven changes reflect). `embedded` attribute strips the column chrome so it can be hosted inside the Advanced Options panel on mobile. Contains the matching-method select, `<v4-display-options>`, `<v4-dye-filters>`, market-board section, and the presets auth section (sign-in / "+ Submit Preset"). |
| `dye-palette-drawer` | `components/v4/dye-palette-drawer.ts` | 320 px right drawer: favorites, search, filter chips, category-grouped swatch grid, random dye, and the **Custom Color** section (`TOOLS_WITH_CUSTOM_COLOR`: harmony, gradient, mixer, swatch, accessibility, comparison, budget). Hidden for `extractor` and `presets` (`TOOLS_WITHOUT_PALETTE`). Docked on desktop; full-height overlay on mobile that starts closed and closes when the viewport crosses into the mobile layout. Fires `dye-selected`, `custom-color-selected`, `drawer-toggle`, `clear-all-dyes`. |
| Advanced Options | `components/advanced-options-panel.ts` (`showAdvancedOptionsPanel()`) | 392 px right slide-over on the 16A `panel` variant (`variant: 'panel', panelWidth: 392`, eyebrow `advanced.eyebrow` "SETTINGS"), opened by the header gear. Collapsible section cards: **Data** (DEVICE badge — five destructive resets confirmed through 16A alerts, not `window.confirm`), **Backup** (JSON export/import of configs), **Behaviour** ("Performance Mode", "Enable Analytics" → `AdvancedConfig`). On mobile (≤ 768 px) it also embeds `<v4-config-sidebar embedded>` for the active tool — the one route to per-tool config at phone width. |
| `v4-layout.ts` | `components/v4-layout.ts` | Not a component: `initializeV4Layout()` creates the shell, wires `RouterService` → `loadToolContent()`, routes drawer events to the active tool (`selectDye` / `addDye` / `selectCustomColor`), mounts `ModalContainer` + `ToastContainer`, opens the theme / language / about / changelog / advanced surfaces, injects the shared shadow-root stylesheet, and prompts the per-tool tour on first visit. Guards overlapping navigations with a sequence counter. |

Layout tokens (`styles/themes.css`): `--v4-header-height: 54px`, `--v4-sidebar-width: 252px` (Simple-Settings column), `--v4-content-padding: 24px`, `--v4-result-card-width: 280px`, `--glyph-accent` (#EA4133 dark / #CE2222 light, kept in sync by `ThemeService`). The drawer is `--v4-drawer-width` (320 px). Mobile breakpoint is `(max-width: 768px)` throughout the shell.

---

## Tool components

One per `ToolId`; lazy-imported by `v4-layout.ts` (see [Tools](tools.md) for what each does).

| ToolId | Class / tag | File | Kind |
|--------|-------------|------|------|
| `harmony` | `HarmonyTool` | `components/harmony-tool.ts` | BaseComponent |
| `extractor` | `ExtractorTool` | `components/extractor-tool.ts` | BaseComponent |
| `accessibility` | `AccessibilityTool` | `components/accessibility-tool.ts` | BaseComponent |
| `comparison` | `ComparisonTool` | `components/comparison-tool.ts` | BaseComponent |
| `gradient` | `GradientTool` | `components/gradient-tool.ts` | BaseComponent |
| `mixer` | `MixerTool` | `components/mixer-tool.ts` | BaseComponent |
| `budget` | `BudgetTool` | `components/budget-tool.ts` | BaseComponent |
| `swatch` | `SwatchTool` | `components/swatch-tool.ts` | BaseComponent |
| `presets` | `<v4-preset-tool>` | `components/v4/preset-tool.ts` | Lit (`BaseLitComponent`) |

Every BaseComponent tool exposes `selectDye(dye)` and/or `selectCustomColor(hex)` for the drawer, subscribes to `ConfigController` for its config and to `market` for server/price changes, and renders one main flow (`leftPanel === rightPanel` in the shell).

**Tool-owned subcomponents (imperative, `components/`)**: `dye-selector.ts` (dye picker/multi-select used by harmony/gradient/mixer/accessibility/comparison), `dye-search-box.ts`, `dye-grid.ts`, `dye-card-renderer.ts`, `dye-action-dropdown.ts`, `add-to-collection-menu.ts`, `collapsible-panel.ts`, `market-board.ts` (+ `services/tool-panel-builders.ts` `buildMarketPanel`), `harmony-result-panel.ts`, `harmony-type.ts`, `color-wheel-display.ts`, `color-picker-display.ts`, `image-upload-display.ts`, `image-zoom-controller.ts`, `recent-colors-panel.ts`, `info-tooltip.ts`, `metric-help.ts` (5.0 — the pair-readout / methods explainer for accessibility, comparison, budget), `chara-import.ts` (5.0 — the 10A `.chara` file card and THIS CHARACTER sheet), `preset-card.ts` / `preset-detail.ts` (Lit, `v4/`), `preset-category-selector.ts` (1 primary + 2 secondary), `preset-submission-form.ts`, `preset-edit-form.ts`.

---

## Shared UI primitives (`components/v4/`, Lit)

| Tag | File | Purpose |
|-----|------|---------|
| `v4-result-card` | `result-card.ts` | The **5B ticket**: verdict stub (swatch pair, hyphenating name, structural ΔE2000 in tier colour via core `classifyBandTier`, HUE OFF + STAIN readouts) over a perforation; two-column HEX / RGB / HSV / LAB (+ CMYK opt-in) matrix; SPEC / SOURCE / COST text zone with MARKET after a dashed rule; `alternates` swatch-dot row; `compact` variant for the `.v5-results-grid`. Props: `data: ResultCardData` (`dye`, `originalColor`, `matchedColor`, `deltaE`, `hueDeviance`, `matchingMethod`, `marketServer`, `price`, `vendorCost`, `marketError`, `alternates`), `show*` flags mirroring `DisplayOptionsConfig`, `primaryActionLabel` (default `common.selectDye`), `primaryOpensMenu`, `showSlotPicker`, `selected`, `compact`. Fires `card-select` and `context-action` (`ContextAction`: `inspect-*`, `transform-*`, `external-*` — external links resolve consolidated dyes through `getMarketItemID()`). Verdict is always ΔE2000; the card carries `lang` and `overflow-wrap: anywhere` so German never truncates. |
| `v4-share-button` | `share-button.ts` | Generates + copies the deep link from `shareParams`; public `share()` used by Shift+S. |
| `v4-color-wheel` | `v4-color-wheel.ts` | The 1A dial: conic-gradient ring with tappable slot pucks and the hub button. |
| `v4-display-options` | `display-options-v4.ts` | Toggle set bound to `DisplayOptionsConfig`. |
| `v4-dye-filters` | `dye-filters-v4.ts` | Toggle set bound to `DyeFiltersConfig` (incl. 5.0 `excludeCoffers`). |
| `v4-range-slider` / `v4-toggle-switch` | `range-slider-v4.ts` / `toggle-switch-v4.ts` | Config controls used by the sidebar. |
| `v4-preset-card` / `v4-preset-detail` | `preset-card.ts` / `preset-detail.ts` | 8A picture-led post card with vote / save pills; detail as a palette list with PALETTE COST and the TAKE THIS PALETTE INTO row. |

**Shared surfaces outside `v4/`:** `export-sheet.ts` (`openExportSheet(payload)` — one 16A sheet with CSS custom properties / SCSS / JSON / HEX / Tailwind `@theme`, live preview, Copy primary + Download; formatting is pure in `shared/palette-export.ts`); `empty-state.ts` (`EmptyStateOptions` — icon must be a compile-time SVG string); `toast-container.ts`; `offline-banner.ts`; `tutorial-spotlight.ts`; `shortcuts-panel.ts` (`?`).

**Icons.** Every glyph is a string constant from `@xivdyetools/svg` via thin shims: `shared/tool-icons.ts` (`ICON_TOOL_*`), `shared/harmony-icons.ts`, `shared/category-icons.ts`, `shared/state-icons.ts` (empty-state / status: `ICON_STATE_SEARCH`, `ICON_STATE_FUNNEL`, `ICON_STATE_COINS`, `ICON_STATE_ALERT`, `ICON_STATE_FOLDER`, `ICON_STATE_WAIT_ANIMATED` (CSS embedded in the SVG; reduced-motion pauses it), `ICON_STATE_PRESETS_EMPTY`, `ICON_DETAIL_HARMONY` / `ICON_DETAIL_EXTRACTOR`), `shared/ui-icons.ts` (chrome, `ICON_STAR` / `ICON_STAR_FILLED`), `shared/social-icons.ts`, `shared/app-logo.ts`. Glyphs are fluid (CSS sizes them), `currentColor` ink, and `shared/glyph-accent.ts` `themedAccent()` paints the single accent element with `--glyph-accent`.

---

## Modals — the 16A shell

`services/modal-service.ts` (`ModalService.show(config)`, `showConfirm()`, `dismissTop()`, max 3 stacked) + `components/modal-container.ts` (renders into `#modal-container`, injects `m16-*` styles into `document.head`). `ModalConfig`:

| Field | Meaning |
|-------|---------|
| `type`, `title`, `content`, `size`, `closable`, `closeOnBackdrop`, `closeOnEscape`, `onClose`, `onConfirm`, `confirmText`, `cancelText` | 4.x fields, unchanged |
| `onCancel` | footer secondary does real work before dismiss (Welcome's "Take the tour") |
| `variant` | `sheet` (default: bottom sheet with grab handle + drag-to-close on mobile, centred 560 px on desktop) · `panel` (right slide-over, default 480 px, pinned below the app bar) · `card` (centred, 600 px) · `alert` (compact; `type: 'confirm'` defaults here) |
| `eyebrow`, `subtitle` | mono eyebrow above / subtitle under the title |
| `sheetHeight` | `content` · `tall` (≈ 60 %) · `full` (88 %, camera) — the old 60vh cap is gone |
| `destructive` | destructive convention: OUTLINED accent confirm, wide Cancel |
| `lightScrim` | reduced backdrop for live-preview modals (theme picker) |
| `panelWidth` | panel variant width in px |

Initial focus falls back to the dialog; body overflow is restored to its prior value; theme tokens replace hardcoded greys.

| Modal | File | Notes |
|-------|------|-------|
| Welcome (W2) | `components/welcome-modal.ts` | Four colour-in/colour-out leads (Harmony, Extractor, Mixer, Gradient) + mono row for the other five; "Get started" lands on `RouterService.getDefaultTool()`; no `dontShowAgain` checkbox. |
| Changelog (C2) | `components/changelog-modal.ts` | One layout for the auto-popup and the header button: current release open, earlier releases as collapsible rows. |
| About | `components/about-modal.ts` | VERSION / BUILD / DYES mono cells (`__BUILD_DATE__` define), seven 44 px icon links from core `SOCIAL_LINKS`, dev-API disclosure, boxed attribution. |
| Theme picker | `components/v4/theme-modal.ts` | Three-band swatch cards for `standard-dark` / `standard-light`, live-apply, `lightScrim: true`, "Done" footer. |
| Language | `components/v4/language-modal.ts` | Six locales, "Done" footer; `LanguageService.setLocale` also sets `document.documentElement.lang`. |
| Tour prompt | `services/tutorial-service.ts` + `components/tutorial-spotlight.ts` | First-visit prompt per tool (start / skip / disable all), then the coach-mark overlay. |
| Camera preview | `components/camera-preview-modal.ts` | `sheetHeight: 'full'`, explicit dismissal. |
| Sign-in (8S) | `components/signin-modal.ts` | `panelWidth: 460`; gates table + Discord / XIVAuth. |
| Submit preset (8S) | `components/preset-submission-form.ts` | `panelWidth: 560`; HOW IT WILL LOOK band, category selector, preview image, example link, 3–6 dyes. |
| My Submissions (8S) | `components/my-submissions-modal.ts` | `panelWidth: 620`; LIVE / IN REVIEW / NOT PUBLISHED rows, per-status actions, delete uses `destructive: true`. |
| Edit preset | `components/preset-edit-form.ts` | Owner-only; PATCH sends only what changed. |
| Collections | `components/collection-manager-modal.ts` | Manage `CollectionService` collections. |
| Advanced Options | `components/advanced-options-panel.ts` | `variant: 'panel'`, 392 px (see shell). |
| Export sheet | `components/export-sheet.ts` | Shared palette export (see primitives). |
| Keyboard shortcuts | `components/shortcuts-panel.ts` | `?`. |

Keyboard (`services/keyboard-service.ts`, initialised in `initializeServices()`): `1`–`9` tools in `ROUTES` order, `Shift+T` theme, `Shift+L` language, `Shift+S` share, `?` help.

---

## Service Layer

Two shapes coexist. **Static-class services** are used directly (`ThemeService.subscribe(...)`, `LanguageService.t(key)`, `RouterService.navigateTo(id)`, `ModalService.show()`, `ToastService.success()`, `CollectionService.createCollection()`, `ShareService.generateUrl()`, `StorageService`, `TooltipService`, `AnnouncerService`, `TutorialService`, `KeyboardService`, `SavedPresetsService`). **Instance singletons** expose `getInstance()` / `resetInstance()` or a pre-built export (`ConfigController.getInstance()`, `MarketBoardService.getInstance()` / `getMarketBoardService()`, `dyeService`, `apiService`, `cameraService`, `indexedDBService`, `communityPresetService`, `hybridPresetService`, `authService`, `presetSubmissionService`, `WorldService`). Everything is re-exported from `services/index.ts`; `initializeServices()` there runs the boot order: LanguageService → (Dye/Storage/API/Toast/Modal/Tooltip ready) → `KeyboardService.initialize()` → `WorldService.initialize()` → `cameraService.initialize()` → `hybridPresetService.initialize()` → `authService.initialize()`. `ThemeService` self-initialises on module load (and migrates retired 4.x theme names to Light/Dark).

| Service | File | Responsibility |
|---------|------|----------------|
| `StorageService` | `storage-service.ts` | localStorage with JSON, `appStorage` namespaces, `SecureStorage` |
| `IndexedDBService` | `indexeddb-service.ts` | Extractor image persistence (`STORES`) |
| `AnnouncerService` | `announcer-service.ts` | ARIA live-region announcements |
| `LanguageService` | `language-service.ts` | Wraps core `LocalizationService`; `t`, `tInterpolate`, `setLocale`, `subscribe`, `getDyeName` / `getCurrency` / `getRace`…; loads exactly one locale chunk (`en ja de fr ko zh`) |
| `ThemeService` | `theme-service.ts` | `standard-light | standard-dark` (`ThemeName`), `setTheme`, `toggleDarkMode`, `isDarkMode`, `subscribe`, `--glyph-accent` |
| `RouterService` | `router-service.ts` | History-API routing, `ROUTES`, `LEGACY_ROUTE_REDIRECTS`, `navigateTo` / `replaceRoute` / `subscribe` |
| `ConfigController` | `config-controller.ts` | Per-tool config (below) |
| `DyeService` / `dyeService` | `dye-service-wrapper.ts` | Core `DyeDatabase` wrapper; `getByStainId`, `resolvePresetDye()` |
| `MarketBoardService` | `market-board-service.ts` | Universalis prices via api-worker `/universalis`; `formatPrice`; reads `market` config |
| `WorldService` | `world-service.ts` | Data centres / worlds |
| `APIService` | `api-service-wrapper.ts` | HTTP wrapper |
| `ToastService` / `ModalService` / `TooltipService` | `toast-service.ts` / `modal-service.ts` / `tooltip-service.ts` | Ephemeral UI |
| `KeyboardService` | `keyboard-service.ts` | Global shortcuts |
| `TutorialService` | `tutorial-service.ts` | Per-tool tours + first-visit prompt |
| `ShareService` | `share-service.ts` | Deep-link generation/parsing, `resolveSharedDye`, `parseSharedHex`, client-side share analytics |
| `CollectionService` | `collection-service.ts` | The one saved-things store (schema 2.0.0): favorites + collections with `kind: 'palette' | 'swap' | 'character'`, stainID refs, tombstones, `exportAll` / `importData`, migrates the retired PaletteService store on init |
| `SavedPresetsService` | `saved-presets-service.ts` | 8A saved shelf: local snapshots, tombstones for author-removed presets, capped 200 |
| `HybridPresetService` / `CommunityPresetService` / `PresetSubmissionService` | `hybrid-preset-service.ts` / `community-preset-service.ts` / `preset-submission-service.ts` | Curated + API presets, votes, submissions (presets-api worker) |
| `AuthService` | `auth-service.ts` | Discord OAuth via the oauth worker; `consumeReturnTool` |
| `CameraService` | `camera-service.ts` | Extractor camera capture |
| `DyeSelectionContext` | `dye-selection-context.ts` | Shared selection state across tools |
| `HarmonyGenerator` | `harmony-generator.ts` | `HARMONY_OFFSETS`, `findHarmonyDyes`, hue/perceptual matching |
| `MixerBlendingEngine` | `mixer-blending-engine.ts` | `blendColors`, `findMatchingDyes` over `@xivdyetools/core/blending` |
| helpers | `display-options-helper.ts`, `price-utilities.ts`, `pricing-mixin.ts`, `tool-panel-builders.ts` | `applyDisplayOptions` / `getCardDisplayOptions`, price formatting, `buildMarketPanel` |

---

## ConfigController

`services/config-controller.ts` is the reactive per-tool configuration store; the shapes live in `shared/tool-config-types.ts`.

- **Type-safe by key:** `ToolConfigMap` maps each `ToolId` plus `global`, `market`, `advanced` to its interface (`ConfigKey`). `getConfig('harmony')` returns `HarmonyConfig`.
- **Lazy load + merge:** on first access `loadFromStorage()` reads `xivdyetools_v4_config_<key>`, spreads it over `DEFAULT_CONFIGS[key]` (so new fields such as `showHue` / `showStain` / `showSpectrum` default on and unknown keys are ignored) and normalises any `matchingMethod` through core's `normalizeMatchingMethod` (retired `hyab` / `oklch-weighted` / `euclidean` → `ciede2000`).
- **Two-way:** tools push (`setConfig('harmony', { matchingMethod })` from a share link, `setConfig('swatch', { fileProvided: true })` from a `.chara` load) and the sidebar subscribes; the sidebar pushes and tools subscribe.
- **Persistence:** every `setConfig` writes back immediately; `resetConfig` / `resetAllConfigs` / `exportAllConfigs` / `importConfigs` back the Advanced Options Data + Backup sections.

```ts
const config = ConfigController.getInstance();
const harmonyCfg = config.getConfig('harmony');          // HarmonyConfig
config.setConfig('harmony', { harmonyType: 'triadic' });  // persists + notifies
const unsub = config.subscribe('harmony', (cfg) => this.update());
this.subs.add(unsub);                                     // BaseComponent cleans up on destroy
```

The flow for a tool: `init()` reads its config (normalising `matchingMethod`), subscribes to its own key and to `market`, applies share-URL params over the top (which may write back to config), then renders. `DisplayOptionsConfig` is applied to result cards through `applyDisplayOptions` / `getCardDisplayOptions` (`services/display-options-helper.ts`).

---

## Code Splitting

`vite.config.ts` `manualChunks`: `vendor-core` (`@xivdyetools/core` — in practice the two lazily-loaded race colour tables), `vendor-lit`, `vendor-spectral` (spectral.js), `vendor` (other `node_modules`), `modals` (welcome + changelog modals; note the label — the shared colour engine lands here too). Each tool is a natural dynamic-import boundary from `v4-layout.ts` (`harmony-tool-<hash>.js` etc.), and `language-service` dynamically imports exactly one locale chunk. `scripts/check-bundle-size.js` reports **JS payload (one locale)** against a 2,200 KB total with per-chunk limits (60 KB default); `src/__tests__/bundle-budget.test.ts` locks the arithmetic.

---

## Localization

`LanguageService` wraps `@xivdyetools/core`'s `LocalizationService`. `t(key)` looks up a dot-notation key in `src/locales/<lang>.json` (1,489 keys per language, parity-validated across `en ja de fr ko zh`) with English fallback; `tInterpolate(key, params)` replaces `{placeholder}` tokens. `setLocale()` swaps the locale chunk, sets `document.documentElement.lang`, and notifies subscribers; components re-render on the callback. Domain helpers (`getDyeName`, `getCategory`, `getAcquisition`, `getCurrency`, `getHarmonyType`, `getVisionType`, `getRace`, `getClan`) read core's localized tables. Curated preset text is localized through `shared/preset-i18n.ts` (`preset.<id>.*`).

---

## Related Documentation

- [Tools Reference](tools.md) -- per-tool files, ports, config, share params, routes
- [Theming](theming.md) -- the two-theme system and tokens
- [Web App Overview](overview.md) -- High-level architecture and build configuration
