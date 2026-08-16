# Agent report — TypeScript symbol verification (knip + tsc lists, plus own sweep)

Scope searched for every symbol: `apps/web-app/src`, `apps/web-app/e2e`, `apps/web-app/scripts`, and the root-level `vite-plugin-*.ts` / `vite.config.ts` / `service-worker.js`. `src/services/index.ts` barrel lines excluded from hit counts throughout, but the underlying files are covered.

## A. Knip "unused exports" — functions & constants

### A1. Modal `close*` functions

| file:line | symbol | evidence | verdict | del. lines | instruction |
|---|---|---|---|---|---|
| `src/components/about-modal.ts:414` | `closeAboutModal` | `grep -w closeAboutModal src e2e scripts` → **1 hit** (the declaration) | **DEAD-HIGH** | 7 (410–419, incl. JSDoc) | Delete the function + its JSDoc. `aboutModalInstance` stays (used by `showAboutModal`). |
| `src/components/advanced-options-panel.ts:414` | `closeAdvancedOptionsPanel` | **1 hit** | **DEAD-HIGH** | 7 (411–419) | Delete function + JSDoc. |
| `src/components/v4/language-modal.ts:239` | `closeLanguageModal` | **1 hit** | **DEAD-HIGH** | 8 (236–244) | Delete function + JSDoc. |
| `src/components/v4/theme-modal.ts:208` | `closeThemeModal` | **1 hit** | **DEAD-HIGH** | 8 (205–213) | Delete function + JSDoc. |
| `src/components/add-to-collection-menu.ts:262` | `closeAddToCollectionMenu` | **7 hits** — called at `:39, :95, :127, :149, :159` in its own file | **DROP-EXPORT-ONLY** | 0 | Remove the `export` keyword only. |
| `src/components/add-to-collection-menu.ts:281` | `isAddToCollectionMenuOpen` | **1 hit** | **DEAD-HIGH** | 6 (276–283, incl. JSDoc) | Delete function + JSDoc. |

### A2. `destroyV4Layout` + `_configController`

| file:line | symbol | evidence | verdict | del. lines |
|---|---|---|---|---|
| `src/components/v4-layout.ts:657` | `destroyV4Layout` | **1 hit** across src/e2e/scripts. `initV4Layout` is imported by `main.ts`; nothing ever tears the shell down (SPA never unmounts). | **DEAD-MEDIUM** | **46** (654–699 incl. JSDoc) |
| `src/components/v4-layout.ts:39` | `_configController` (tsc TS6133) | 3 hits: decl `:39`, write `:153` (`ConfigController.getInstance()`), write `:696` (inside `destroyV4Layout`). **Never read.** | **DEAD-HIGH** | **3** (39, 153, 696) |

Delete `destroyV4Layout` and the `_configController` module variable together (`:696` disappears with the function). DEAD-MEDIUM rather than HIGH because it is a deliberate lifecycle counterpart to `initV4Layout`.

### A3. `LanguageModal` / `ThemeModal` classes

**Neither is a custom element.** `grep "customElements.define|@customElement" language-modal.ts theme-modal.ts` → **0 hits**. Plain classes, `new`-ed only inside their own file's singleton factory (`language-modal.ts:231`, `theme-modal.ts:200`); the public API is `showLanguageModal` / `showThemeModal` (imported by `v4-layout.ts:26-27`, called at `:249` / `:269`).

| file:line | symbol | verdict | instruction |
|---|---|---|---|
| `src/components/v4/language-modal.ts:22` | `LanguageModal` | **DROP-EXPORT-ONLY** | `export class` → `class`. |
| `src/components/v4/theme-modal.ts:29` | `ThemeModal` | **DROP-EXPORT-ONLY** | `export class` → `class`. |

### A4. Service classes exported as aliases — singleton is what's consumed

| file:line | symbol | evidence | verdict | del. lines |
|---|---|---|---|---|
| `src/services/auth-service.ts:845` | `AuthService` | `export { AuthServiceImpl as AuthService };`. Consumers import the singleton `authService` (`:844`) — 8 component files. Other `AuthService` matches are log-prefix strings and a `describe('AuthService')` title. | **DROP-EXPORT-ONLY** | **1** (line 845) |
| `src/services/preset-submission-service.ts:622` | `PresetSubmissionService` | Same pattern. Test imports `{ validateSubmission, uploadPreviewImage }` only. | **DROP-EXPORT-ONLY** | **1** (line 622) |
| `src/services/hybrid-preset-service.ts:94` | `HybridPresetService` | used internally at `:95, :113–117` and `:461` (`export const hybridPresetService = HybridPresetService.getInstance()`). | **DROP-EXPORT-ONLY** | 0 |

### A5. Other unused exports

| file:line | symbol | evidence | verdict | del. lines | instruction |
|---|---|---|---|---|---|
| `src/components/v4/result-card.ts:173` | `generateMarketErrorCode` | **1 hit** (declaration). Not referenced by `result-card.ts` itself, no test, no e2e. | **DEAD-HIGH** | **51** (162–212, incl. JSDoc) | Delete function + JSDoc. |
| `src/services/harmony-generator.ts:316` | `generateHarmonyPanelData` | **1 hit**. `harmony-generator.test.ts` imports `findHarmonyDyes`, `findClosestDyesToHue`, `replaceExcludedDyes` — not this. | **DEAD-HIGH** | **53** (305–357, incl. JSDoc) | Delete function + JSDoc; last thing in the file. |
| `src/services/share-service.ts:40` | `SHARE_URL_VERSION` | 2 hits — used internally at `:216`. | **DROP-EXPORT-ONLY** | 0 | Drop `export`. |
| `src/services/share-service.ts:45` | `BASE_URL` | 3 hits — used internally at `:207`, `:592`. | **DROP-EXPORT-ONLY** | 0 | Drop `export`. |
| `src/shared/beta-branding.ts:34` | `PRODUCTION_ORIGIN` | 3 hits — used internally at `:127`. | **DROP-EXPORT-ONLY** | 0 | Drop `export`. |
| `src/shared/example-link.ts:16` | `EXAMPLE_LINK_HOSTS` | 2 hits — used internally at `:41`. | **DROP-EXPORT-ONLY** | 0 | Drop `export`. |
| `src/shared/logger.ts:17` | `createBrowserLogger` | Pass-through re-export `export { perf, createBrowserLogger } from '@xivdyetools/logger/browser'`. Nothing imports it from `@shared/logger`; the 3 other hits are `@deprecated` doc-comment mentions. | **DEAD-HIGH** | 1 identifier | Edit line 17 to `export { perf } …`. `perf` is imported by `src/shared/__tests__/logger.test.ts`. |
| `src/shared/tool-config-types.ts:513` | `isToolId` | **1 hit**. A type guard nobody calls. | **DEAD-HIGH** | **9** (505–513) | Delete function + JSDoc. |
| `src/shared/tool-config-types.ts:413` | `DEFAULT_CONFIGS` | 3 hits — used internally at `:521` (`getDefaultConfig`), plus a mock key in `config-sidebar.test.ts:72`. | **DROP-EXPORT-ONLY** | 0 | Drop `export`. |

## B. Icons

### B1. `ui-icons.ts` — 18 unreferenced icon constants — **all DEAD-HIGH**

Every one grepped to exactly 1 hit (its own declaration), except three that additionally appear only inside *comments* in `state-icons.ts`, and `ICON_FOLDER`, whose 3 extra hits are a **different** symbol (`collection-manager-modal.ts:14` imports `ICON_STATE_FOLDER as ICON_FOLDER`). None appear inside any `html\`\`` template, `innerHTML`, e2e spec, or `icons.test.ts` (which imports only `ICON_THEME, ICON_CAMERA, ICON_EYEDROPPER, ICON_HINT, ICON_CRYSTAL, ICON_WARNING, ICON_UPLOAD, ICON_DICE`).

| symbol | lines | bytes | note |
|---|---|---|---|
| `ICON_COINS` | 9 (109–117) | 431 | superseded by `ICON_STATE_COINS` |
| `ICON_FILTER` | 6 (137–142) | 194 | |
| `ICON_EXPORT` | 8 (152–159) | 288 | |
| `ICON_SORT` | 6 (186–191) | 186 | |
| `ICON_TARGET` | 6 (216–221) | 285 | |
| `ICON_SPARKLES` | 6 (223–228) | 608 | |
| `ICON_DISTANCE` | 6 (230–235) | 424 | |
| `ICON_SEARCH` | 6 (261–266) | 261 | superseded by `ICON_STATE_SEARCH` |
| `ICON_USER` | 6 (276–281) | 282 | |
| `ICON_EDIT` | 6 (283–288) | 322 | |
| `ICON_TRASH` | 6 (290–295) | 337 | |
| `ICON_DOCUMENT` | 9 (329–337) | 390 | |
| `ICON_LOCKED` | 9 (348–356) | 388 | `ICON_LOCK` at `:362` is byte-identical geometry and *is* live — do not confuse |
| `ICON_BOOK` | 9 (380–388) | 389 | |
| `ICON_SUCCESS` | 8 (390–397) | 304 | |
| `ICON_ERROR` | 8 (399–406) | 295 | |
| `ICON_IMPORT` | 9 (419–427) | 384 | |
| `ICON_FOLDER` | 7 (429–435) | 328 | superseded by `ICON_STATE_FOLDER` |
| **TOTAL** | **130 lines** | **6,096 bytes** | |

### B2. Duplicate-export aliases

| file:line | symbol | evidence | verdict |
|---|---|---|---|
| `src/shared/ui-icons.ts:37` | `ICON_THEME` (= `ICON_THEME_SUN`) | 7 hits: decl, one doc-comment, and 4 in `icons.test.ts` only (`:38` import, `:291-294`). Zero production consumers. | **TEST-ONLY** — delete + trim test |
| `src/shared/tool-icons.ts:36` | `ICON_TOOL_MATCHER` (= `ICON_TOOL_EXTRACTOR`) | 6 hits: decl + 5 in `icons.test.ts` only. | **TEST-ONLY** — delete + retarget `icons.test.ts:176` to `ICON_TOOL_EXTRACTOR` |
| `src/shared/tool-icons.ts:25` | `ICON_TOOL_EXTRACTOR` | 4 hits, all internal (`:36`, `:44`, `:53`). | **DROP-EXPORT-ONLY** |
| `src/shared/tool-icons.ts:29` | `ICON_TOOL_MIXER` | internal at `:37`, `:48`; rest test-only. | **DROP-EXPORT-ONLY** |
| `src/shared/tool-icons.ts:37` | `ICON_TOOL_DYE_MIXER` | **Actively used**: `mixer-tool.ts:47` import, `:1520` template, `:1612` innerHTML. | **FALSE-POSITIVE** — keep |

### B3. `state-icons.ts`

`src/shared/state-icons.ts:38` `ICON_STATE_WAIT` — 1 code hit (declaration); the only other match is prose at `:57` about *other apps*. `ICON_STATE_WAIT_ANIMATED` (`:69`) is the separate live constant. **DEAD-HIGH**, 2 lines (37–38).

## C. Knip "unused exported types"

### C1. Used internally → DROP-EXPORT-ONLY (remove `export` keyword)

`base-component.ts:36 ComponentLifecycle` (`:62 implements`); `auth-service.ts` `AuthProvider`(:22) `PrimaryCharacter`(:27) `AuthUser`(:33) `AuthState`(:50) `AuthStateListener`(:58); `collection-service.ts` `Tombstone`(:72) `CollectionExport`(:90); `display-options-helper.ts:26 DisplayOptionsChangeCallback`; `hybrid-preset-service.ts` `UnifiedCategory`(:61) `PresetSortOption`(:73) `GetPresetsOptions`(:78); `modal-service.ts:19 ModalType`; `preset-submission-service.ts:42 MySubmissionsResponse`; `tool-config-types.ts` `SampleAreaSize`(:19) `GlobalConfig`(:28) `PresetSortOption`(:193); `share-service.ts:58-118` all 8 `*ShareParams` — every one is a member of the `ShareParams` discriminated union at `:129–136`; **load-bearing**.

### C2. `EyeDropper` / `EyeDropperConstructor` — DYNAMIC-KEEP

`src/shared/browser-api-types.ts:8,12` feed the `declare global { interface Window { EyeDropper?: EyeDropperConstructor } }` augmentation at `:18`, consumed via a bare side-effect import (`color-picker-display.ts:15`). Keep.

### C3. Truly unreferenced → DEAD-HIGH

| file:line | type | del. lines |
|---|---|---|
| `src/services/config-controller.ts:77` | `ConfigChangeEvent` | 10 (74–83) |
| `src/services/market-board-service.ts:42` | `PricesUpdatedEvent` | 7 (39–45) |
| `src/services/market-board-service.ts:50` | `ServerChangedEvent` | 7 (47–53) |
| `src/services/market-board-service.ts:58` | `SettingsChangedEvent` | 6 (55–60) |
| `src/services/market-board-service.ts:65` | `FetchErrorEvent` | 7 (62–68) — stale CustomEvent detail shapes for events the service dispatches untyped |
| `src/services/pricing-mixin.ts:4` | `PricingState` | 8 (4–10) — `MarketBoardListenerOptions` at `:15` is the live one |
| `src/shared/i18n-types.ts:32` | `WebAppTranslations` | 33 (29–64, runs to EOF). Locale JSON is not typed against it anywhere. |
| `src/shared/types.ts:88–128` | `AppState`, `HarmonyState`, `MatcherState`, `ComparisonState` | 41 — a self-contained dead island (`AppState` referenced only by the other three, which nothing references). `MatcherState` names the retired `matcher` tool. |

## D. tsc `--noUnusedLocals/Parameters` — the 15 non-test hits

**`harmony-tool.ts:1699` `findHarmonyDyesInternal`** — DEAD-HIGH, 13 lines (1696–1707), thin delegation to `findHarmonyDyes`. No exclusive helpers; sibling `*Internal` wrappers are live. One exclusive import: `findHarmonyDyes` at `harmony-tool.ts:36` becomes unused. Knock-on: `findHarmonyDyes` in `harmony-generator.ts:269` then becomes TEST-ONLY (`harmony-generator.test.ts:16, :428, :447, :472`) — 45 more lines available if the 4 test cases go; flagging, not recommending.

**`comparison-tool.ts:140` `dyesWithHSV`** — DEAD-HIGH, ~32 lines. Written at `:351`, `:2070` (`calculateHSVValues`), `:2371`; **read nowhere**. Exclusive helper `calculateHSVValues` (`:2066–2079`) is called from 6 sites (`:313, :586, :2037, :2213, :2430, :2562`) that exist solely to keep the dead field fresh. Exclusive type `DyeWithHSV` (`:78–86`). Delete field, helper, 6 call sites, both resets, interface; then check `ColorService.hexToHsv` import.

**`comparison-tool.ts:542` `createHeader`** — DEAD-HIGH, 12 lines (539–550). Private, zero call sites. Same-named live methods in `accessibility-tool.ts:527` and `harmony-result-panel.ts:148` are separate classes.

**`swatch-tool.ts:283` `gridExcerptAnchor`** — DEAD-HIGH, 7 lines. Written 5× (`:1513, :1523, :1530, :1747, :1778`), read 0×.

**`swatch-tool.ts:3103` `_key`** — DEAD-HIGH, 1 line. Leftover interpolated i18n key string; the method resolves via the explicit `labels` record.

**`share-service.ts:235` param `tool`** — DEAD-HIGH. `addParamsToUrl(url, tool, params)` — body iterates `params` only; one call site (`:213`). Drop the param at both.

**`share-service.ts:751` `_failed`** — DEAD-HIGH, 1 line.

**`beta-branding.ts:127` param `attr`** — FALSE-POSITIVE (arity-required first arg of a `String.replace` callback). Rename `_attr` or leave.

| file:line | symbol | evidence | verdict | del. lines |
|---|---|---|---|---|
| `add-to-collection-menu.ts:185` | param `dyeName` | 1 call site (`:90`, passing `dyeName` at `:93`); the local at `:43` exists only to feed it. | DEAD-HIGH | 3 (185, 93, 43) |
| `dye-action-dropdown.ts:449` | `_toolName` | 3-branch if/else (`:449–456`), never read. | DEAD-HIGH | 9 (448–456) |
| `dye-grid.ts:103` | `_isFocused` | computed per cell, never used — the `btn` className branches on `isSelected` only. | DEAD-HIGH | 1 |
| `mixer-tool.ts:178` | `slot3Element` | decl + null-reset `:1580`; never assigned an element. Mixer is a two-dye tool — leftover of a 3-slot design. | DEAD-HIGH | 2 |
| `v4/preset-detail.ts:99` | `@state() displayOptions` | decl, writes `:591`, `:596`; never read. Each write triggers a wasted Lit re-render. | DEAD-HIGH | 3 |
| `v4/result-card.ts:1336` | `_toolName` | 1 read-free assignment from `getToolDisplayName(tool)` → that private helper (`:1317`) becomes exclusively dead. | DEAD-HIGH | 1 + ~18 |

## E. Own sweep beyond the tool output

### E1. Never-called `protected` members on `BaseComponent` (dead API surface inherited by ~30 components)

| file:line | member | evidence | del. lines |
|---|---|---|---|
| `base-component.ts:553` | `addClass` | `.addClass(` → 0 | 6 (550–555) |
| `base-component.ts:560` | `removeClass` | 0 | 6 (557–562) |
| `base-component.ts:574` | `hasClass` | 0 | 6 (571–576) |
| `base-component.ts:625` | `off` | 0 | 23 (622–644) |
| `base-component.ts:705` | `setState` | 0 anywhere; the two overrides (`dye-selector.ts:708`, `market-board.ts:521`) also uncalled | 6 + 10 + 11 = 27 |
| `v4/base-lit-component.ts:135` | `clearError` | 0; `setError` is live (`share-button.ts:284,:312`) | 8 (131–138) |

Kept — verified live or dynamic: `safeTimeout`, `clearSafeTimeout`, `setContent`, `toggleClass`, `emit`, `onCustom` (called from subclasses); `getState` (polymorphic via `getDebugInfo`, 7 overrides); `firstUpdated` (Lit hook); private singleton constructors.

### E2. No-op method with live call sites

`harmony-tool.ts:1387 updateDrawerContent` — body is two comment lines; JSDoc: *"no longer needed … Kept for backwards compatibility"*. Called 6× (`:931, :979, :2005, :2039, :2064, :2113`), all no-ops. **DEAD-HIGH**, 13 lines. Do not touch same-named methods in accessibility/gradient/mixer tools (real bodies).

### E3. Always-true feature flags (`src/shared/constants.ts:151`)

`FEATURE_FLAGS` has 7 members. `ENABLE_KEYBOARD_SHORTCUTS: true` — sole consumer `keyboard-service.ts:60` `if (!FEATURE_FLAGS.ENABLE_KEYBOARD_SHORTCUTS) { … return; }` — literal `true` under `as const` → guard body unreachable. `ENABLE_PRICES`, `ENABLE_PRICE_HISTORY`, `ENABLE_SAVED_PALETTES`, `ENABLE_EXPORT_FORMATS`, `ENABLE_DARK_MODE`, `DEBUG_MODE` — zero consumers. Delete the whole object (`constants.ts:147–159`), the guard, its import, and the mock stanza in `keyboard-service.test.ts:37-38`. ~19 lines.

### E4. Unreachable code, commented-out code, `debugger` — all clean

~190 after-return candidates all false positives (multi-line returns/templates/ternaries). `if (false)/if (true)` 0. Module-level boolean consts 0 outside `FEATURE_FLAGS`. Empty catch: 0 (the `base-component.ts:653` bare catch is a commented, deliberate teardown swallow). Commented-out code blocks: 0. `debugger`: 0. One single-line commented `console.log` at `base-component.ts:590`.

### E5. Debug globals & `console.*` in production paths

`window.TutorialService`/`ShareService` at `main.ts:93-94` — DEV-gated (`import.meta.env.DEV`), intentional. **30 `console.*` calls bypass `shared/logger.ts`'s dev gate**: `extractor-tool.ts` 842,856,2301,2389,2406 (`🔔`/`💰` price tracing); `market-board.ts` 292,311,447,471 (`📣`); `auth-service.ts` 240,258,268,277,296,410,557 (`🔐` OAuth tracing — **logs `window.location.href` and URL params during the auth code exchange**); `pricing-mixin.ts` 64,72,82; `preset-submission-form.ts` 698,700,731,733; `api-service-wrapper.ts` 222; plus `console.error` at `preset-detail.ts` 658,692,778 and `base-component.ts` 139,592,613 (arguably legitimate). Verdict DEAD-MEDIUM: convert the ~24 `console.info` to `logger.info` or delete; `auth-service.ts` first.

### E6. Legacy markers

Raw grep 1,021 hits (dominated by `v4` dir/class prefix and `5.0`). Removable now: `harmony-tool.ts:1385` (E2); `tool-config-types.ts:59–67` 4× `@deprecated` `HarmonyConfig.showHex/showRgb/showHsv/showLab` — every hit repo-wide is `displayOptions.showX` / `comparisonOptions.showX` / a `STORAGE_KEYS` entry / `card.showHex`; nothing reads or writes `HarmonyConfig.showX`; `DEFAULT_CONFIGS.harmony` does not set them → **DEAD-HIGH**, 9 lines; `extractor-tool.ts:95` `const ICON_UPLOAD = ICON_IMAGE;` "alias for backward compatibility" — 1 use, DEAD-MEDIUM 2 lines. Not removable: `EVERCOLD_DEPRECATED_CATEGORIES` (game data), `collection-service.ts:213-397` and `extractor-tool.ts:455-464` storage migrations, `LEGACY_ROUTE_REDIRECTS`, `TOOL_ICONS` legacy keys, `migrateLegacyThemeName`, stainID guards, `showDeltaE` (`@deprecated` but still read).

### E7. Knip "unused files"

`scripts/check-bundle-size.d.ts` — **FALSE-POSITIVE**: `src/__tests__/bundle-budget.test.ts:31` imports `'../../scripts/check-bundle-size.js'`; TS resolves the sibling `.d.ts` implicitly. Keep all 54 lines. `service-worker.js` — dead (see DEAD-003); note this agent assumed `sw-register.js` is loaded by a `<script>` tag — the main session verified it is **not** (no tag in `src/index.html` or `dist/index.html`), so no 404 fires.

### E8. Orphan-module scan — all clear

Six candidates (`v4/dye-palette-drawer.ts`, `v4/preset-detail.ts`, `v4/range-slider-v4.ts`, `v4/toggle-switch-v4.ts`, `v4/v4-app-header.ts`, `shared/browser-api-types.ts`) are all side-effect imports (`@customElement` / `declare global`). Keep.

## Totals by verdict

| Verdict | Findings | Deletable lines |
|---|---:|---:|
| DEAD-HIGH | 57 | ~600 (incl. 18 ui-icons 130 lines / 6,096 B; `types.ts` island 41) |
| DEAD-MEDIUM | 5 | ~90 (+ service-worker.js 258, handled separately) |
| TEST-ONLY | 4 | ~15 + ~15 test |
| DROP-EXPORT-ONLY | 30 | 2 |
| DYNAMIC-KEEP | 11 | 0 |
| FALSE-POSITIVE | 13 | 0 |
