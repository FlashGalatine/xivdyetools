# Hardcoded String Extraction Report — web-app — 2026-08-20

**Scope:** `apps/web-app/src` — 117 non-test TypeScript files (62,199 lines) + `index.html` body, every file read end-to-end by seven parallel reviewers; every candidate traced to a render site before being listed.
**Branch:** `monorepo-2.0-prep` @ `1cbb303e`
**Raw per-file tables:** `evidence/hardcoded-scan-group{1..7}.md` (≈270 rows — the canonical line-level list; this document groups them)

---

## Summary by Priority

| Priority | Rows | Of which in dead code | Action |
|----------|------|-----------------------|--------|
| 🔴 High — visible text, button labels, toasts, titles | **≈100** | 9 | Extract. ~20 already have an identical or near-identical key in `en.json` |
| 🟡 Medium — aria/title/placeholder, English `dye.name` in search/sort/aria, stale-after-switch | **≈60** | 6 | Extract / route through core getters / subscribe |
| 🟢 Low — concatenated fragments, punctuation outside keys, `toLocaleString()` without locale, edge fallbacks | **≈110** | 10 | Fold into keys opportunistically; most are one-line |
| ⚪ Skip | — | — | logger/console, comments, tests, CSS classes, technical ids (RGB/LAB/ΔE…), brand names, keyboard keys, URLs, pure symbols |

The 2026-08-09 audit reported **4** hardcoded strings (`HC-001…004`, all in `preset-detail.ts`) — **all four are fixed** (`preset.copyLink`, `preset.voted`/`preset.vote`, `presetCategoryLabel()`). This pass read every file rather than grepping the `v4/` directory, which is why the count is two orders of magnitude larger. Most of the volume is concentrated: `preset-edit-form.ts` + `preset-submission-form.ts` + `preset-submission-service.ts` account for ≈65 rows by themselves; the rest is 8 systemic shapes repeated across tools.

**Completely clean (35 files):** `dye-search-box`, `chara-resolve-service`, `color-picker-display`, `harmony-generator`, `market-board-service`, `world-service`, `mixer-blending-engine`, `pricing-mixin`, `v4-app-header`, `range-slider-v4`, `toggle-switch-v4`, `theme-modal`, `base-lit-component`, `preset-category-selector`, `hybrid-preset-service`, `saved-presets-service`, `preset-i18n`, `collapsible-panel`, `empty-state`, `offline-banner`, `signin-modal`, `welcome-modal`, `export-sheet`, the auth/tutorial/tooltip/modal/toast/keyboard/theme/storage/config-controller/indexeddb/api-wrapper/dye-wrapper/display-options-helper/tool-panel-builders/index services, `beta-branding`, all icon/logo modules, `example-link`, `glyph-accent`, `utils`, `types`, `tool-config-types`, `i18n-types`, `index.html` body.

---

## Part 1 — Systemic shapes (fix once, land everywhere)

### [HC-SYS-001] Palette drawer category headings render the raw English key in every locale — BUG 🔴
**File:** `components/v4/dye-palette-drawer.ts:33-61, 826-841, 1327`

`CATEGORY_TRANSLATION_KEYS` is keyed `White/Grey/Black/Brown/Red/Orange/Yellow/Green/Blue/Purple/Pink` and `DYE_CATEGORY_ORDER` lists the same names, but runtime `Dye.category` is `Blues/Browns/Greens/Neutral/Purples/Reds/Special/Yellows` (schema v2 — verified from `packages/core/src/data/dyes.json`). No key ever matches, so:

```ts
LanguageService.t(CATEGORY_TRANSLATION_KEYS[category] || category)   // → t('Blues') → warns "Translation not found" → "Blues"
```

Every category heading in the drawer is English for ja/de/fr/ko/zh users, and the hand-authored order is ignored (groups come out in dye-DB order). The `i18n:unused` gate does not catch it because the map *references* the keys.

**Fix:** `LanguageService.getCategory(category)` (what `dye-grid.ts:205`, `dye-search-box.ts:197` already do); drive order from core's category list; delete the map and the 11 `colorPalette.{whites,grays,blacks,browns,reds,oranges,yellows,greens,blues,purples,pinks}` keys ×6 locales. (Terminology cross-ref: TERM-002.)

### [HC-SYS-002] The virtual "Custom (#HEX)" dye is English in every tool 🔴
**Files:** `gradient-tool.ts:2760-2765`, `comparison-tool.ts:2410-2415`, `harmony-tool.ts:2044-2049`, `mixer-tool.ts:853-858`, `accessibility-tool.ts:418-423`, `budget-tool.ts:1877-1882`, `swatch-tool.ts:637→778`

Seven tools build the same ad-hoc `Dye` for a picked hex: `` name: `Custom (${hex})` ``, `category: 'Custom'`, `acquisition: 'Custom'`. `getDyeName(negativeId)` has nothing to return so `dye.name` leaks into endpoint cards, pair chips, the comparison duel headline and SOURCE row, budget's verdict `{t}` interpolation, the result-card acquisition line (`getAcquisition('Custom')` falls back to the key verbatim), the wheel hub, and saved-mix collection names.

**Fix:** one shared factory (`shared/custom-dye.ts`) that sets `name` from `tInterpolate('common.customColorName', {hex})` and a sentinel `category`/`acquisition` that the render sites map to `t('common.custom')`. `colorPalette.customColor` = "Custom Color" exists but carries no `{hex}`.

### [HC-SYS-003] Hardcoded currency word next to prices 🔴
| Site | Literal |
|------|---------|
| `budget-tool.ts:781, 1516, 1518, 1526, 1539` | `` `${n} gil` `` |
| `budget-tool.ts:1523` | `` `${n} ${tierMeta.currency}` `` — raw core currency id (`'Gil'`, `"Skybuilders' Scrips"`) |
| `mixer-tool.ts:2205` | `` `${n} gil` `` |
| `comparison-tool.ts:1636` | `` `${n} gil` `` → `{saving}` in `comparison.costDiff` |
| `v4/preset-detail.ts:934` | `` `${n}g` `` |
| `v4/result-card.ts:1013` | `` `${n} G` `` (the vendor-cost line 9 lines below uses `getCurrency` correctly) |

The dictionary localises Gil (ギル / 길 / 金币) and `budget-tool.ts:464, 1238` already use `LanguageService.getCurrency('Gil')` — this is internal inconsistency, not a missing facility. **Fix:** a shared `formatGil(n)` helper = `tInterpolate('common.gilAmount', {n: fmt(n)})` with `getCurrency('Gil')`.

### [HC-SYS-004] Dye search & alphabetical sort operate on the English name 🟡
**Files:** `dye-selector.ts:394` (search) `:405, 425, 428` (sort), `v4/dye-palette-drawer.ts:797`, `preset-edit-form.ts:380`, `preset-submission-form.ts:485`

A ja user typing 漆黒 into any of these boxes gets "No dyes found"; "Alphabetical" sorts the visible localized list in English order. **Fix:** match/sort on `getDyeName(itemID) ?? name`, `localeCompare(…, getCurrentLocale())`.

### [HC-SYS-005] English `dye.name` rendered or announced where a localized getter is available 🟡
`dye-grid.ts:117` (aria-label on every grid button), `v4/v4-color-wheel.ts:478` (node tooltip), `v4/dye-palette-drawer.ts:904` (random-dye toast), `preset-edit-form.ts:292, 352`, `preset-submission-form.ts:389, 456` (chips + tooltips), `shared/palette-export.ts:98` (export file header comments). `chara-import.ts:606-613` is the same shape for **clans**: the raw `SubRace` enum (`'SeekerOfTheSun'`) is printed in the file-card meta line instead of `LanguageService.getClan()` (which `swatch-tool.ts:1065` uses).

### [HC-SYS-006] Route titles / `document.title` are English-only 🔴
**File:** `services/router-service.ts:60-68` (`ROUTES[].title`) → `:191, 228, 348, 377` (`document.title = …`)
`tools.{id}.title` already exists ×6. The tab title never refreshes on locale change either. **Fix:** `title` → `titleKey`, resolve at set-time, and re-set from the `LanguageService.subscribe` in `v4-layout.ts`.

### [HC-SYS-007] Components that go stale after a language switch 🟡
| Component | Mechanism |
|-----------|-----------|
| `v4/result-card.ts:210` | `primaryActionLabel = t('common.selectDye')` is a **field initialiser** — evaluated once; the element never subscribes, so a surviving card keeps the old button label and all other `t()` strings |
| `v4/v4-layout-shell.ts:955-1015` | no subscribe; aria labels + the visible mobile palette hint only refresh when another `@state` flips |
| `v4/display-options-v4.ts:382-482`, `v4/dye-filters-v4.ts:264-352` | no subscribe, and the parent re-render passes identical boolean props so Lit skips the child — group headers and toggle labels stay in the old language until a toggle flips |
| `v4/share-button.ts` | no subscribe |

18 components do subscribe (`v4-app-header`, the nine tools, `config-sidebar`, `dye-palette-drawer`, …) — the pattern exists; these five missed it.

### [HC-SYS-008] Number/date formatting follows the **browser** locale, not the app locale 🟢
`toLocaleString()` without an argument: `budget-tool.ts` ×16, `v4/result-card.ts` ×2, `v4/preset-detail.ts` ×2, `mixer-tool.ts` ×1; `toLocaleDateString()` in `collection-manager-modal.ts:230`; `toLocaleUpperCase()` in `v4/config-sidebar.ts:69`. A user with an en-US browser who chose 日本語 sees `1,234` rather than `1,234`-vs-`1.234`-style differences only matter for de/fr — but the date in the collections list is the visible case. **Fix:** `shared/format.ts` with `formatNumber/formatDate(locale = LanguageService.getCurrentLocale())`.

### [HC-SYS-009] Translated fragments concatenated in English word order 🟢 (≈30 sites)
Representative: `tutorial-spotlight.ts:341` `${t('tutorial.step')} ${i} ${t('tutorial.of')} ${n}` (🔴 — "Step 1 of 5" cannot be expressed in ja/ko in that order); `v4/result-card.ts:1698-1707` `${t('common.replace')} ${t('common.slot')} 1`; `gradient-tool.ts:1503` `${t('gradient.stepLabel')} ${n}`; `harmony-tool.ts:1470` / `v4-color-wheel.ts:447,477` `${t('harmony.harmony')} ${n}`; `budget-tool.ts:1529,1540` `${t('budget.boardWord')} ${price}` / `${t('budget.orWord')} ${cost}`; `preset-tool.ts:942` `${n} ${t('preset.resultsWord')}`; `preset-detail.ts:885`, `my-submissions-modal.ts:139` `${n} ${t('preset.votesLabel')}`; `preset-submission-form.ts:350` `${t('preset.dyes')} — ${t('preset.dyesReq')}`; `config-sidebar.ts:1579` `${t(a)} — ${t(b)}`; `shortcuts-panel.ts:126` `${t(a)}: ${t(b)}`; `image-upload-display.ts:167`; colon appended in code: `result-card.ts:1385`, `dye-action-dropdown.ts:320,331,550`, `dye-card-renderer.ts:130`, `dye-palette-drawer.ts:1238` (fr wants ` :`, ja/zh want `：`); list joins with `', '` / `' · '` / `'. '`: `chara-import.ts:1166`, `preset-detail.ts:806`, `preset-edit-form.ts:685`, `preset-submission-service.ts:216` (ja/zh use `、`; use `Intl.ListFormat`).

### [HC-SYS-010] English pluralization 🟢
`collections.collectionsCount` = `{count} collection(s)`, `collections.dyeCount` = `{count} dye(s)` (en only — the five targets already pluralise normally); `matcher.paletteExtracted` "Extracted {count} colors", `preset.mineSummary` "{n} presets · {v} votes", `comparison.allPairs`, `preset.maxDyesAllowed`; `shared/palette-export.ts:120` `n === 1 ? 'entry' : 'entries'`; `swatch.footEmptyOne/Many` shows the house pattern to copy.

### [HC-SYS-011] Service-layer English surfaced verbatim in toasts 🔴
| Service | Reaches the user via | Rows |
|---------|----------------------|------|
| `services/preset-submission-service.ts:93-136, 207-284, 457-590` | `preset-submission-form.ts:674/737`, `preset-edit-form.ts:716` toast `result.error` / `e.message` | 13 reachable validation + 6 transport messages (`Failed to submit preset. Please try again.` duplicates `errors.submitPresetFailed` exactly; `Maximum 6 dyes allowed` duplicates `preset.maxDyesAllowed`) |
| `services/community-preset-service.ts:363-455` | `preset-detail.ts:743/759` | `Failed to vote` / `Failed to remove vote` duplicate `errors.voteFailed` / `errors.removeVoteFailed` exactly; `Network error - please try again` ×2 |
| `services/collection-service.ts:933-1003` | `collection-manager-modal.ts:553-557` shows `errors[0]` | 5 import messages (`collections.invalidFormat` exists) |
| `components/chara-import.ts:218, 429, 801` | toast + warnings card + slot card | core's English parse/slot errors rendered raw (already `TODO(i18n)` in source) — needs a code→key map |
| `services/share-service.ts:469, 486, 488, 546` | `ToastService` directly | `Link copied to clipboard!` (`success.copiedToClipboard` near), `Failed to copy link` (`errors.copyLinkFailed` identical) + `Please copy the URL manually`, `Failed to generate share link` |
| `components/extractor-tool.ts:310, 1938` | toast | `Failed to load image` (`errors.imageLoadFailed` near), `Color info copied to clipboard` (`success.copiedToClipboard` near) |

Pattern fix: services return **error codes**; components map code → key. Where the literal already equals an `en.json` value, swap in place.

### [HC-SYS-012] Dead components still carrying strings ⚪ (delete rather than localise)
`components/harmony-result-panel.ts` and `components/color-wheel-display.ts` (imported by `harmony-tool.ts` for their *types*, never constructed — results are `<v4-result-card>`, the wheel is `<v4-color-wheel>`; `color-wheel-display.ts:69` even calls a non-existent `harmony.${type}` key), `components/recent-colors-panel.ts` (imported by `extractor-tool.ts`, never instantiated), `components/dye-card-renderer.ts` (only its own test imports it), `services/announcer-service.ts:185-270` (ten English helper templates, zero callers), `services/preset-submission-service.ts:339-365` `getStatusInfo()` (no callers). ≈25 rows. knip misses the first three because a type-position import keeps a file "used" (the blind spot `knip.jsonc` documents — DEAD-030).

---

## Part 2 — Per-component highlights (what a reader of one tool needs)

| ID | File:Line | String | Pri | Existing key |
|----|-----------|--------|-----|--------------|
| HC-PRE-001 | `preset-edit-form.ts` 119, 177, 222, 269, 327, 371, 457, 473, 609, 628/763, 672-681, 701, 711 + placeholders 187/231/467 | Whole form still 4.x English: `Edit Preset`, `Preset Name`, `Description`, `Select Dyes`, `Search dyes...`, `No dyes found`, `All matching dyes selected`, `Tags (optional)`, `Max N tags, 30 chars each`, `Cancel`, `Save Changes`, `Saving...`, 4 validation toasts | 🔴 | `common.cancel`, `preset.fieldDesc`, `colorPalette.noDyesFound`, `colorPalette.searchPlaceholder`, `preset.maxDyesAllowed`, `preset.fieldName/Tags`, `common.optional` all identical/near — the sibling submission form was localized for 5.0; this one was missed |
| HC-PRE-002 | `preset-submission-form.ts` 266, 311, 375, 405, 432, 521, 685, 692 | placeholders, `Click dyes below to add them...`, `Click to remove`, `Search dyes by name...`, `Submitting...`, `existing preset` | 🔴/🟡 | `dyeSelector.searchPlaceholder` identical |
| HC-PRE-003 | `v4/preset-detail.ts:845, 1015` | `Loading preset...`, `Login with Discord or XIVAuth to vote for this preset` | 🔴 | `preset.loginToVote` **identical** (exists ×6) |
| HC-PRE-004 | `v4/preset-card.ts:412` | `${byline} · ${dyes.length} · ${age}` — bare count, no unit | 🟡 | — |
| HC-PRE-005 | `add-to-collection-menu.ts:220` | `Full` | 🔴 | `collections.collectionFull` (sentence) |
| HC-V4-001 | `v4/dye-palette-drawer.ts:1327` | → HC-SYS-001 | 🔴 | `getCategory` |
| HC-V4-002 | `v4/result-card.ts:1535` | `STAIN` metric label (sibling `HUE OFF` is `t('resultCard.hueOff')`) | 🔴 | `config.showStain` (toggle, different surface) |
| HC-V4-003 | `v4/result-card.ts:1484` | `aria-label="Dye result: ${name}"` | 🟡 | — |
| HC-V4-004 | `v4/result-card.ts:1298, 1468` | `Unknown`, `No data` | 🟢 | — |
| HC-V4-005 | `v4-layout.ts:485` | `Loading ${toolId}...` — raw router id ("Loading extractor...") | 🔴 | `loading.title`, `tools.<id>.title` |
| HC-V4-006 | `v4-layout.ts:635-636` | `Failed to load tool` / `Please try again or refresh the page` | 🔴 | — |
| HC-V4-007 | `v4-layout.ts:651-652` | `${toolId} Tool` / `Coming soon` (unreachable default) | 🟢 | — |
| HC-V4-008 | `v4/config-sidebar.ts:1467, 1469` | `RGB DIST - …`, `DISTINGUISH % - …` option tags (siblings ΔE2000/ΔEOK/ΔE76/REDMEAN are identifiers; these two are English words). Same two in `swatch-tool.ts:209-216` | 🟡 | decision: identifier or key |
| HC-V4-009 | `v4/config-sidebar.ts:1947`, `market-board.ts:250` | `${dc.name} (${dc.region})` — `region` from `public/json/data-centers.json` mixes `Europe`/`North-America`/`中国`/`한국` | 🟢 | — |
| HC-V4-010 | `v4/config-sidebar.ts:1613` | `'User'` display-name fallback | 🟢 | — |
| HC-V4-011 | `v4/language-modal.ts:158` | English exonyms (`Japanese`, `German`…) under the native names regardless of UI language | 🟢 | — |
| HC-V4-012 | `v4/share-button.ts:323, 328` | `t(...) \|\| 'Copied!'` / `\|\| 'Share'` dead fallbacks (`t()` never returns falsy — same in `dye-grid.ts:83, 279`) | 🟢 | keys exist |
| HC-SWA-001 | `swatch-tool.ts:1395` | `Closest Swatches` section heading | 🔴 | `swatch.matchesHead` is the sibling |
| HC-SWA-002 | `swatch-tool.ts:894` | `Row ${r}, Column ${c}` | 🔴 | — |
| HC-SWA-003 | `swatch-tool.ts:2331` | `primary-action-label="Explore Dye"` on every swatch result card | 🔴 | `common.selectDye` (default) |
| HC-SWA-004 | `swatch-tool.ts:1878-2195` | `R${row}·C${col}` address grammar, `ID ${stainId}` (`chara-import.ts:1285`) | 🟢 | decision: identifier |
| HC-CHA-001 | `chara-import.ts:606-613` | raw `SubRace` enum in file-card meta | 🔴 | `getClan()` |
| HC-CHA-002 | `chara-import.ts:218, 429, 801` | core error messages verbatim | 🔴 | — (code→key map) |
| HC-CHA-003 | `chara-import.ts:1166` | `Same model: ` + `', '`-joined list + ` …` | 🟡 | `swatch.sameModel` (prefix) |
| HC-EXT-001 | `extractor-tool.ts:1840, 1906` | `Sampled Color`, `Copy Color Info` | 🔴 | — |
| HC-EXT-002 | `extractor-tool.ts:310, 1938` | toasts → HC-SYS-011 | 🔴 | near keys |
| HC-EXT-003 | `extractor-tool.ts:2257, 2776` | `'Market'` server-name fallback | 🟡 | `common.market` identical |
| HC-EXT-004 | `image-zoom-controller.ts:189, 200, 219` | `title: 'Zoom Out' / 'Current Zoom' / 'Zoom In'` (siblings `matcher.zoomFit/zoomWidth/zoomReset` translated) | 🟡 | — |
| HC-EXT-005 | `camera-service.ts:97`, `camera-preview-modal.ts:54` | `Camera ${n}` option fallback (and `availableCameras.length` is the *old* array inside the `.map` — logic bug) | 🟡 | — |
| HC-HAR-001 | `comparison-tool.ts:1933` | `addRow('RATIO', …)` — every other row uses localized `methodShort()` | 🔴 | — |
| HC-HAR-002 | `gradient-tool.ts:1351` | `Interpolation: ${space} · ${n} steps` export header (rendered in export preview + file) | 🔴 | — |
| HC-HAR-003 | `mixer-tool.ts:1920` | `Blend: ${mixingMode} @ ${pct}%` export meta — "Blend:" English + raw model id | 🔴 | `mixer.model*` |
| HC-HAR-004 | `mixer-tool.ts:1198` | `MODEL_SHORT.spectral = 'Spectral'` row header while its tooltip says `mixer.modelSpectral` = "Pigment" | 🟢 | `mixer.modelSpectral` |
| HC-ACC-001 | `accessibility-tool.ts:121, 127` | `'~6% males'` / `'~2% males'` prevalence labels (checkbox, drawer, lens tab) | 🔴 | — |
| HC-ACC-002 | `accessibility-tool.ts:1547-1580` | `NRM/DEU/PRO/TRI/ACH` short codes in the pair note | 🟢 | `getVisionType` (full only) |
| HC-BUD-001…009 | `budget-tool.ts` | → HC-SYS-003 (gil ×6), HC-SYS-002 (Custom), HC-SYS-009 (boardWord/orWord) | 🔴 | `getCurrency` |
| HC-BUD-010 | `budget-tool.ts:121-124` | `STANDARD` / `WIDE #1` / `WIDE #2` / `COFFER` tier tags (source comment: "identifiers, never localized") | 🟢 | `colorPalette.spectrum*` exist |
| HC-BUD-011 | `budget-tool.ts:870` | `dyeName.split(' ')[0]` quick-pick truncation — no-op for CJK names | 🟢 | — |
| HC-SHL-001 | `tutorial-spotlight.ts:341` | `Step ${i} of ${n}` from two fragments | 🔴 | `tutorial.step`, `tutorial.of` |
| HC-SHL-002 | `tutorial-spotlight.ts:89` | aria `Tutorial` | 🟡 | — |
| HC-SHL-003 | `modal-container.ts:384, 420, 429, 465` | aria `Close modal`, `Modal dialogs`; footer fallbacks `Cancel` / `Confirm` when a caller omits the texts | 🟡 | `common.cancel`, `common.close`; no `confirm` key |
| HC-SHL-004 | `toast-container.ts:151, 182` | aria `Dismiss notification`, `Notifications` | 🟡 | `common.dismiss` |
| HC-SHL-005 | `advanced-options-panel.ts:242, 346` | `DEVICE` / `SAVED` card badges | 🔴 | — |
| HC-SHL-006 | `about-modal.ts:349, 351` | `Data API`, `API Worker docs` link labels | 🔴 | — |
| HC-SHL-007 | `about-modal.ts:255, 268-281` | credit sentence + host link forced trailing | 🟢 | keys exist |
| HC-SHL-008 | `main.ts:110-119` | fatal-init overlay `Application Error` / `Failed to initialize XIV Dye Tools` / `Reload Page` (+ `constants.ts` `ERROR_MESSAGES` ×11 only reachable here) — runs before/without LanguageService | 🟢 | needs a pre-i18n fallback (browser-language pick from a tiny inline table) |
| HC-SHL-009 | `base-component.ts:364`, `error-handler.ts:56, 65` | raw `error.message` shown in the error boundary | 🟢 | `errors.unexpectedError` |
| HC-SHL-010 | `changelog-modal.ts:226-355` | changelog content English-only (source `CHANGELOG-laymans.md` via `virtual:changelog`) | ⚪ | structural — per-locale changelog or an "English only" note |
| HC-SHL-011 | `metric-help.ts:281, 350` | `en.wikipedia.org/…CIEDE2000` regardless of locale (the ratio link beside it uses `getLearnLink(locale)`) | 🟢 | core per-locale link table |
| HC-SHL-012 | `shared/palette-export.ts:98, 120, 241-242` | `dye.name` in file comments, `entry/entries`, `Source`/`Dyes` headers, `Generated …` line in every export | 🟡 | — |
| HC-SHL-013 | `services/share-service.ts:258-307` | 8 share titles + 9 descriptions — **traced only into a CustomEvent detail, not rendered**; listed for completeness | 🟢 | — |

Per-file suggested keys for every row are in the evidence tables.

---

## New keys to add to `en.json` (then ×5)

Representative set — the evidence tables carry the full suggestions per row:

```jsonc
"common": { "custom": "Custom", "customColorName": "Custom ({hex})", "gilAmount": "{n} gil",
            "confirm": "Confirm", "closeModal": "Close modal", "unknown": "Unknown", "slotN": "Slot {n}",
            "loadingTool": "Loading {tool}…", "notAvailable": "N/A" },
"errors": { "toolLoadFailed": "Failed to load tool", "tryAgainOrRefresh": "Please try again or refresh the page",
            "requestTimeout": "Request timed out. Please try again.", "networkError": "Network error — please try again." },
"share":  { "linkCopied": "Link copied to clipboard!", "copyManually": "Please copy the URL manually",
            "generateFailed": "Failed to generate share link" },
"preset": { "editTitle": "Edit Preset", "saveChanges": "Save Changes", "saving": "Saving…", "submitting": "Submitting…",
            "clickDyesToAdd": "Click dyes below to add them…", "allMatchingSelected": "All matching dyes selected",
            "fieldNamePlaceholder": "e.g., Dark Knight Abyssal", "fieldDescPlaceholder": "Describe your color palette and when to use it…",
            "fieldTagsPlaceholder": "e.g., dark, edgy, tank (comma-separated)", "fieldTagsLimit": "Max {max} tags, {chars} chars each",
            "loadingOne": "Loading preset…", "resultsCount": "{n} presets", "votesCount": "{n} votes", "dyeCountShort": "{n} dyes",
            "validation": { "nameMin": "Name must be at least {n} characters", "nameMax": "Name must be {n} characters or less",
                            "descMin": "…", "descMax": "…", "category": "Please select a valid category",
                            "dyesMin": "Must include at least {n} dyes", "dyesInvalid": "Invalid dye selection",
                            "tagsMax": "Maximum {n} tags allowed", "tagLength": "Each tag must be {n} characters or less" } },
"swatch": { "closestSwatchesHead": "Closest Swatches", "rowColumn": "Row {row}, Column {col}", "exploreDye": "Explore Dye",
            "customSource": "Custom ({hex})", "parseFailed": "Couldn't read this character file: {reason}" },
"matcher": { "sampledColor": "Sampled Color", "copyColorInfo": "Copy Color Info", "zoomIn": "Zoom In", "zoomOut": "Zoom Out", "zoomLevel": "Current Zoom" },
"accessibility": { "prevalenceDeuteranopia": "~6% males", "prevalenceProtanopia": "~2% males" },
"comparison": { "mRatioShort": "RATIO" },
"gradient":  { "exportMeta": "Interpolation: {space} · {n} steps", "stepN": "STEP {n}" },
"mixer":     { "exportMeta": "Blend: {model} @ {pct}%" },
"tutorial":  { "stepOf": "Step {i} of {n}", "dialogLabel": "Tutorial" },
"resultCard": { "stainShort": "STAIN", "replaceSlotN": "Replace Slot {n}", "dyeResultAria": "Dye result: {name}" },
"about":     { "dataApiLabel": "Data API", "apiDocsLabel": "API Worker docs" },
"advanced":  { "dataBadge": "DEVICE", "behaviorBadge": "SAVED" },
"camera":    { "deviceFallback": "Camera {n}" },
"collections": { "full": "Full", "importSkippedInvalid": "Skipped invalid collection: {name}" },
"a11y":      { "modalDialogs": "Modal dialogs", "notifications": "Notifications" }
```

Keys to **delete** (after the code stops referencing them): `colorPalette.{whites,grays,blacks,browns,reds,oranges,yellows,greens,blues,purples,pinks}` and — if TERM-003/004 take the "use core getters" route — `config.{complementary,analogous,triadic,splitComplementary,tetradic,square,monochromatic,compound,shades}`.

---

## Side observations surfaced by the sweep (not i18n — filed so they are not lost)

| Where | What |
|-------|------|
| `components/my-submissions-modal.ts:138-141` | `preset.name` and `rejection_reason` injected into `innerHTML` **unescaped** — no `escapeHtml` in the file. Names are the user's own submissions, but `rejection_reason` is moderator-authored. Security, not i18n. |
| `services/preset-submission-service.ts:418-443` + callers `preset-tool.ts:834`, `my-submissions-modal.ts:195` | `deletePreset()` failures are never surfaced — both callers ignore `{success:false}` and toast success |
| `services/camera-service.ts:97` | `this.availableCameras.length` inside the `.map` is the previous array — `Camera N` numbering is off by the old count |
| `components/dye-selector.ts:343` | remove-chip `✕` button has no aria-label |
| `components/dye-search-box.ts:210` | builds a CSS selector from a translated aria-label (`button[aria-label="…"]`) — breaks if a translation ever contains `"` |
| dead files | `harmony-result-panel.ts`, `color-wheel-display.ts`, `recent-colors-panel.ts`, `dye-card-renderer.ts` (HC-SYS-012) |
