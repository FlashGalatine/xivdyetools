# Remediation Plan — 2026-08-20 (web-app i18n)

**Sources:** single-source mode — `i18n-manager` catalogs in this folder: `I18N_AUDIT_2026-08-20.md` (L-1…L-7, checklist), `HARDCODED_STRINGS.md` (HC-SYS-001…012, HC-PRE/V4/SWA/CHA/EXT/HAR/ACC/BUD/SHL-*), `TERMINOLOGY_VIOLATIONS.md` (TERM-001…005 + doc drift), `FONT_SUBSET_AUDIT.md` (FONT-WEB-001…003).
**Deploy unit:** one — `apps/web-app` (Cloudflare Pages; beta project first, production on the 5.0 merge). Every sprint ends in **one** web-app build + deploy.
**Status basis:** 12 systemic + 47 per-component hardcoded-string IDs (≈270 line rows), 7 locale-content defects, 5 terminology IDs + 1 doc drift, 3 font IDs — **0 completed, all outstanding.** 0 superseded. 0 KEEP. 0 rotations (no credentials involved).
**Not scheduled here (hand-off register at the end):** 5 non-i18n side observations the sweep surfaced (one is a security item).

**Ordering principles**

1. **One deploy unit per sprint** — there is only one, so sprints are sequential web-app releases; each must leave `validate:i18n` + `i18n:unused` + vitest green.
2. **Data loss first** — none found (0 duplicate keys), so Sprint 0 becomes *prerequisites*: delete dead code that would otherwise be localized for nothing, add the three shared helpers later sprints call, and land the seven no-risk locale one-liners.
3. **Untranslated text in shipped UI (P1) before consistency (P2) before cosmetics (P3)** — the palette-drawer bug and the community-presets surface lead; vocabulary unification follows; concatenation/plural/locale-formatting polish after.
4. **Fonts last, always** — FONT-WEB-001/002 are CSS-only and do not depend on text, but the rule is the rule; they close the plan.

**Tier mapping used:** P1 = English text/toast/title visible in a non-English UI (🔴 High rows, HC-SYS-001 bug, TERM-001); P2 = aria/title/placeholder, English `dye.name` in search/sort/aria, stale-after-switch, vocabulary split (🟡); P3 = concat/plural/`toLocaleString`/fallback/identifier decisions/font ordering (🟢/⚪).

---

## Sprint 0 — Prerequisites: delete, scaffold, one-liners ✅ COMPLETED 2026-08-21 (commits `37668a97..27db39d2`, Tasks 1–3)

Nothing here is a hotfix; nothing ships out-of-band. The sprint removes ≈25 rows of work by deleting the four dead components, gives Sprints 1–4 the helpers they call, and lands the seven locale-file edits (pure content, no key changes, so the gates cannot move).

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| HC-SYS-012 | hardcoded | ⚪ P3 (but first) | Delete `components/harmony-result-panel.ts`, `components/color-wheel-display.ts` (+ the two unused fields/imports in `harmony-tool.ts`), `components/recent-colors-panel.ts` (+ import in `extractor-tool.ts`), `components/dye-card-renderer.ts` (+ its test); delete `announcer-service.ts:185-270` helpers and `preset-submission-service.ts` `getStatusInfo()`. Run `knip --production` to confirm nothing else references them. |
| — (scaffold for HC-SYS-002) | hardcoded | P1 enabler | `shared/custom-dye.ts`: `makeCustomDye(hex)` returning the virtual `Dye` with a `CUSTOM_SENTINEL` category/acquisition and `name = tInterpolate('common.customColorName', {hex})`; `isCustomDye()`. Add `common.custom`, `common.customColorName` ×6. |
| — (scaffold for HC-SYS-003/-008) | hardcoded | P1 enabler | `shared/format.ts`: `formatNumber(n, locale = LanguageService.getCurrentLocale())`, `formatDate(d)`, `formatGil(n)` = `tInterpolate('common.gilAmount', {n: formatNumber(n)})` using `getCurrency('Gil')`. Add `common.gilAmount` ×6. |
| — (scaffold for HC-SYS-004/-005) | hardcoded | P2 enabler | `shared/dye-name.ts`: `localizedDyeName(dye)` = `getDyeName(dye.itemID) ?? dye.name`; `compareDyeNames(a,b)` via `localeCompare(…, getCurrentLocale())`; `dyeNameMatches(dye, query)` testing both localized and English names. |
| L-1, L-2, L-3 | i18n (fr) | P3 | Strip the leading space from `config.mixingOklab` / `mixingRyb` / `mixingHsl`. |
| L-4 / TERM-001 | i18n (ko) | P1 | `swatch.absentFurPattern`: 로스가르 → 로스갈. |
| L-5, L-6, L-7 | i18n (ja/ko/zh) | P3 | `preset.gateBrowseNote`: restore the "no rate limit" clause. |
| TERM doc drift | terminology | P3 | `docs/reference/ffxiv-terminology.md`: ja Shades = シェード (matches runtime core); add the `invertedTetradic` row. |

**Ends with:** one web-app beta deploy; `npm run lint && npm run test -- --run && npm run type-check && npm run build:check` green; `i18n:unused` must still report 0 orphans (the deletions remove *code*, not keys — if a key goes orphan, delete it in the same commit).

---

## Sprint 1 — Community Presets surface + the palette-drawer bug (P1) ✅ COMPLETED 2026-08-21 (commits `62e82bf7..2f64b44f`, Tasks 4–7)

The two things a ja/de/fr user hits first on 5.0: the palette drawer (every tool) and the presets flow (edit form, validation toasts, vote errors, collection import). `preset-edit-form.ts` is rewritten against the already-localized `preset-submission-form.ts` as the template; services stop returning English and return codes.

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| HC-SYS-001 / HC-V4-001 / TERM-002 | hardcoded + terminology | 🔴 P1 **bug** | `dye-palette-drawer.ts`: render `LanguageService.getCategory(category)`; order from core's category list; delete `CATEGORY_TRANSLATION_KEYS` + `DYE_CATEGORY_ORDER`; delete `colorPalette.{whites,grays,blacks,browns,reds,oranges,yellows,greens,blues,purples,pinks}` ×6 (11 keys — `i18n:unused` would flag them otherwise). |
| HC-PRE-001 | hardcoded | 🔴 P1 | `preset-edit-form.ts` (24 rows): title, labels, placeholders, counters, `Cancel`/`Save Changes`/`Saving…`, empty states, 4 validation toasts, `another preset`. Reuse `common.cancel`, `preset.fieldName/fieldDesc/fieldTags`, `common.optional`, `colorPalette.noDyesFound/searchPlaceholder`, `preset.maxDyesAllowed`; add `preset.editTitle/saveChanges/saving/allMatchingSelected/fieldNamePlaceholder/fieldDescPlaceholder/fieldTagsPlaceholder/fieldTagsLimit/anotherPreset` + `preset.validation.*`. Chips/tooltips via `localizedDyeName()`. |
| HC-PRE-002 | hardcoded | 🔴/🟡 P1 | `preset-submission-form.ts` (15 rows): placeholders, `Click dyes below to add them…`, `Click to remove`, `Submitting…`, `existing preset`; `dyeSelector.searchPlaceholder` for the search box; chips/tooltips via `localizedDyeName()`. |
| HC-SYS-011 (presets) | hardcoded | 🔴 P1 | `preset-submission-service.ts`: validation returns `{field, code}`; forms map code → `preset.validation.*`; transport errors → `errors.submitPresetFailed` / `errors.saveChangesFailed` / new `errors.requestTimeout` / `errors.networkError`; `preset.loginToSubmit/loginToEdit` for the auth guards. One toast per error (drops the `'. '` join). |
| HC-SYS-011 (votes) | hardcoded | 🔴 P1 | `community-preset-service.ts:363-455` → codes; `preset-detail.ts:743/759` map to `errors.voteFailed` / `errors.removeVoteFailed` / `errors.networkError` / `preset.loginToVote`. |
| HC-SYS-011 (collections) | hardcoded | 🔴 P1 | `collection-service.ts:933-1003` import errors → codes; `collection-manager-modal.ts:553` maps to `collections.invalidFormat` / new `collections.importSkippedInvalid` / `collections.importCreateFailed`; `collections.importedSuffix` for the generated name. |
| HC-PRE-003 | hardcoded | 🔴 P1 | `preset-detail.ts:1015` → `preset.loginToVote` (identical key exists); `:845` → `preset.loadingOne`; `:934` → `formatGil()`. |
| HC-PRE-005 | hardcoded | 🔴 P1 | `add-to-collection-menu.ts:220` `Full` → `collections.full`. |
| HC-PRE-004 + votes concat | hardcoded | 🟡 P2 | `preset-card.ts:412` bare count → `preset.dyeCountShort` "{n} dyes"; `preset-detail.ts:885`, `my-submissions-modal.ts:139` → `preset.votesCount` "{n} votes"; `preset-tool.ts:942` → `preset.resultsCount`. |

**Ends with:** one web-app beta deploy. Manual check in ja: open the palette drawer on Harmony → headings 赤系/青系…; edit a preset → every label Japanese; submit an invalid preset → Japanese toast.

---

## Sprint 2 — Cross-tool P1 shapes and per-tool High rows ✅ COMPLETED 2026-08-21 (commits `2380e1dc..971a2ae0`, Tasks 8–12)

The three scaffolds from Sprint 0 are wired into the nine tools, route titles go through keys, and the five components that never subscribe start re-rendering on locale change.

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| HC-SYS-002 | hardcoded | 🔴 P1 | Replace the seven ad-hoc `Custom (#HEX)` dyes (`gradient:2760`, `comparison:2410`, `harmony:2044`, `mixer:853`, `accessibility:418`, `budget:1877`, `swatch:637`) with `makeCustomDye()`; render sites (`result-card` acquisition line, comparison SOURCE row, budget verdict `{t}`) map the sentinel to `t('common.custom')`. |
| HC-SYS-003 / HC-BUD-001…009 | hardcoded | 🔴 P1 | `formatGil()` at `budget-tool.ts:781,1516,1518,1526,1539`, `mixer-tool.ts:2205`, `comparison-tool.ts:1636`, `result-card.ts:1013`; `budget-tool.ts:1523` → `getCurrency(tierMeta.currency)`. `budget-tool.ts:1529/1540` → `budget.boardPrice` "board {price}" / `budget.orLocalCost` "or {cost}". |
| HC-SYS-006 | hardcoded | 🔴 P1 | `router-service.ts`: `ROUTES[].title` → `titleKey: 'tools.<id>.title'`; `document.title` set from `t(titleKey)` at the four sites; re-set in `v4-layout.ts`'s locale subscriber. |
| HC-SYS-007 | hardcoded | 🟡 P2 | Subscribe + `requestUpdate()` in `v4/result-card.ts` (and make `primaryActionLabel` a getter, not a field initialiser), `v4/v4-layout-shell.ts`, `v4/display-options-v4.ts`, `v4/dye-filters-v4.ts`, `v4/share-button.ts`. |
| HC-V4-005, HC-V4-006 | hardcoded | 🔴 P1 | `v4-layout.ts:485` → `common.loadingTool` with `tools.<id>.title`; `:635-636` → `errors.toolLoadFailed` / `errors.tryAgainOrRefresh`. |
| HC-V4-002 | hardcoded | 🔴 P1 | `result-card.ts:1535` `STAIN` → `resultCard.stainShort`; `:1698-1707` → `resultCard.replaceSlotN`. |
| HC-SWA-001…003 | hardcoded | 🔴 P1 | `swatch-tool.ts:1395` → `swatch.closestSwatchesHead`; `:894` → `swatch.rowColumn`; `:2331` → `swatch.exploreDye` (or drop the override → `common.selectDye`). |
| HC-CHA-001, HC-CHA-002 | hardcoded | 🔴 P1 | `chara-import.ts:606-613` → `LanguageService.getClan(SUBRACE_TO_CLAN_KEY[tribe])` (move the map to `shared/`); `:218/429/801` core parse/slot errors → `swatch.parseFailed` + a `slot.error.code` → `swatch.slotError.*` map (clears the in-source `TODO(i18n)`). |
| HC-EXT-001, HC-EXT-002 | hardcoded | 🔴 P1 | `extractor-tool.ts:1840/1906` → `matcher.sampledColor/copyColorInfo`; `:310` → `errors.imageLoadFailed`; `:1938` → `success.copiedToClipboard`. |
| HC-HAR-001…003 | hardcoded | 🔴 P1 | `comparison-tool.ts:1933` → `comparison.mRatioShort`; `gradient-tool.ts:1351` → `gradient.exportMeta`; `mixer-tool.ts:1920` → `mixer.exportMeta` with the `mixer.model*` label. |
| HC-ACC-001 | hardcoded | 🔴 P1 | `accessibility-tool.ts:121/127` → `accessibility.prevalenceDeuteranopia/Protanopia` (+ the three numeric siblings for symmetry). |
| HC-SHL-001 | hardcoded | 🔴 P1 | `tutorial-spotlight.ts:341` → `tutorial.stepOf` "Step {i} of {n}". |
| HC-SHL-005, HC-SHL-006 | hardcoded | 🔴 P1 | `advanced-options-panel.ts:242/346` → `advanced.dataBadge/behaviorBadge`; `about-modal.ts:349/351` → `about.dataApiLabel/apiDocsLabel`. |
| HC-SYS-011 (share) | hardcoded | 🔴 P1 | `share-service.ts:469/486` → `share.linkCopied`; `:488` → `errors.copyLinkFailed` + `share.copyManually`; `:546` → `share.generateFailed`. |

**Ends with:** one web-app beta deploy. Check: switch ja → en → ja with a result card on screen — button label follows; tab title reads ハーモニーエクスプローラー | XIV Dye Tools.

---

## Sprint 3 — One vocabulary: core owns harmony / vision / category labels (P2) ✅ COMPLETED 2026-08-21 (commit `8b1ca836`, Task 13)

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| TERM-003 | terminology | 🟡 P2 | `config-sidebar.ts:944-957` harmony `<option>` labels → `LanguageService.getHarmonyType(value)`; delete `config.{complementary,analogous,triadic,splitComplementary,tetradic,square,monochromatic,compound,shades}` ×6 (9 keys). |
| TERM-004 | terminology | 🟡 P2 | `config-sidebar.ts:1170-1194` vision toggle labels: keep the short form but align the ja/ko/zh head nouns to core's (`2型色覚` / `제2색맹` / `绿色盲`…) — edit the 10 cells; or add a `getVisionTypeShort()` to core and delete `config.{deuteranopia,protanopia,tritanopia,achromatopsia}`. Decide once; the former is a locale-only edit, the latter a core bump. |
| TERM-005 | terminology | 🟢 P3 | Translator call on "Venture Coffer" in `filters.excludeCoffers` (de/fr), `preset.cfgHideUnbuyableDesc` (de/fr/ko), `budget.offText` (fr) — adopt Schatzkiste / Trouvaille / 보물상자 or record the paraphrase as accepted. |
| HC-V4-008 (+ swatch `METHOD_TAGS`) | hardcoded | 🟡 P2 decision | `RGB DIST` / `DISTINGUISH %` in `config-sidebar.ts:1467/1469` and `swatch-tool.ts:209-216`: decide identifier-vs-key; if key, `config.matchingRgbTag/matchingDistinguishTag`. Record the decision in the design record alongside the ΔE tags. |

**Ends with:** one web-app beta deploy; `i18n:unused` 0 orphans after the key deletions.

---

## Sprint 4 — Medium: aria/title/placeholder, English names in search/sort/aria, locale formatting ✅ COMPLETED 2026-08-21 (commits `d6fefd1c..f42a22af`, Tasks 14–15)

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| HC-SYS-004 | hardcoded | 🟡 P2 | `dyeNameMatches()` / `compareDyeNames()` in `dye-selector.ts:394/405/425/428`, `dye-palette-drawer.ts:797`, `preset-edit-form.ts:380`, `preset-submission-form.ts:485`. |
| HC-SYS-005 | hardcoded | 🟡 P2 | `localizedDyeName()` at `dye-grid.ts:117` (aria), `v4-color-wheel.ts:478`, `dye-palette-drawer.ts:904`, `palette-export.ts:98`. |
| HC-SYS-008 | hardcoded | 🟢 P3 | `formatNumber()` / `formatDate()` at the ≈23 `toLocaleString()` / `toLocaleDateString()` / `toLocaleUpperCase()` sites (budget ×16, result-card ×2, preset-detail ×2, mixer ×1, collection-manager-modal ×1, config-sidebar ×1). |
| HC-V4-003 | hardcoded | 🟡 P2 | `result-card.ts:1484` → `resultCard.dyeResultAria`. |
| HC-EXT-003…005 | hardcoded | 🟡 P2 | `extractor-tool.ts:2257/2776` → `common.market`; `image-zoom-controller.ts:189/200/219` → `matcher.zoomOut/zoomLevel/zoomIn`; `camera-service.ts:97` + `camera-preview-modal.ts:54` → `camera.deviceFallback` (fix the stale-array count while there). |
| HC-CHA-003 | hardcoded | 🟡 P2 | `chara-import.ts:1166` → `swatch.sameModelList` "{list}" with `Intl.ListFormat(getCurrentLocale())`. |
| HC-SHL-002…004 | hardcoded | 🟡 P2 | `tutorial-spotlight.ts:89` → `tutorial.dialogLabel`; `modal-container.ts:384/420/429/465` → `common.closeModal` / `common.cancel` / new `common.confirm` / `a11y.modalDialogs`; `toast-container.ts:151/182` → `common.dismiss` / `a11y.notifications`. |
| HC-SHL-012 | hardcoded | 🟡 P2 | `palette-export.ts:120/241-242` → `export.generatedLine` (with `{count}` plural), `export.hexSourceHeader/hexDyesHeader`. |

**Ends with:** one web-app beta deploy.

---

## Sprint 5 — Low polish + guardrails ✅ COMPLETED 2026-08-21 (commits `ca0ee36d..71c72651`, Tasks 16–18)

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| HC-SYS-009 | hardcoded | 🟢 P3 | Fold the ≈30 concatenations into interpolated keys: `gradient.stepN/pinnedCount/avgDriftValue/maxDriftValue`, `harmony.harmonyN/baseColorTitle`, `common.slotN`, `resultCard.addingDyeLabel`, `harmony.copiedHexValue`, `collections.favoritesCount`, `swatch.gridTitle/cellTag`, `preset.dyesLabelFull`, `preset.cfgStoredLocallyHint`, `shortcuts.platformHintFull`, `matcher.privacyLabel`, `aria.*FavoritesNamed`, `matcher.distanceValue`; list joins → `Intl.ListFormat`. |
| HC-SYS-010 | hardcoded | 🟢 P3 | en plural hacks: `collections.collectionsCount/dyeCount` → One/Many pair (house pattern `swatch.footEmptyOne/Many`); `matcher.paletteExtracted`, `preset.mineSummary`, `comparison.allPairs`, `preset.maxDyesAllowed` reviewed for `1 x` cases. |
| HC-V4-004, HC-V4-007, HC-V4-010, HC-V4-012 | hardcoded | 🟢 P3 | `Unknown` / `No data` → `common.unknown` / `resultCard.noData`; `${toolId} Tool` / `Coming soon`; `'User'` → `config.userFallback`; drop dead `\|\| '…'` fallbacks in `share-button.ts:323/328`, `dye-grid.ts:83/279`. |
| HC-V4-009 | hardcoded | 🟢 P3 | `data-centers.json` `region` → `market.region.<slug>` keys at `config-sidebar.ts:1947`, `market-board.ts:250`. |
| HC-V4-011 | hardcoded | 🟢 P3 | `language-modal.ts:158` exonyms → `languages.<code>` per locale, or drop the exonym line. |
| HC-SWA-004, HC-BUD-010, HC-BUD-011 | hardcoded | 🟢 P3 decision | `R{row}·C{col}` / `ID {n}` / `STANDARD`·`WIDE #1`·`WIDE #2`·`COFFER` tier tags — confirm "identifier" status in the design record (or key them); `budget-tool.ts:870` `split(' ')[0]` → CSS ellipsis on the full localized name. |
| HC-HAR-004, HC-ACC-002 | hardcoded | 🟢 P3 | `mixer-tool.ts:1198` `Spectral` → `mixer.modelSpectral`; `accessibility-tool.ts:1547-1580` `NRM/DEU/PRO/TRI/ACH` → `accessibility.visionShort.*`. |
| HC-SHL-007…011, HC-SHL-013 | hardcoded | 🟢 P3 / ⚪ | about-modal credit link order; `main.ts` fatal overlay → tiny inline browser-language table; `base-component.ts:364` → `errors.unexpectedError` instead of raw `error.message`; changelog "English only" note; `metric-help.ts:281/350` → core per-locale learn-link; share titles/descriptions keyed only if they ever render. |
| Key order | i18n | 🟢 P3 | One-off reorder of de/fr/ja/ko/zh to `en.json` key order (a 15-line script); then make `validate:i18n` assert order and fail on leading/trailing-whitespace drift vs source. |
| Guardrail: lint | i18n | 🟢 P3 | New rule in `eslint-rules/`: flag string literals with ≥2 Latin words inside `` html` `` templates, `textContent =`, `placeholder=`, `aria-label`, `title=`, `ToastService.*(`, `AnnouncerService.announce(` that are not wrapped in `LanguageService.t*`. Start as `warn`, flip to `error` once Sprints 1–4 land. |
| Guardrail: switch test | i18n | 🟢 P3 | Vitest that mounts each Lit component in `components/v4/`, flips the locale, and asserts rendered text changed — pins HC-SYS-007. |
| Guardrail: parity script | i18n | 🟢 P3 | Promote `evidence/locale-parity.txt`'s generator to `scripts/i18n-parity.mjs` (duplicates, interpolation, identical-to-EN with allow-list) and run it in `validate:i18n`. |

**Ends with:** one web-app beta deploy + the new CI gates green.

---

## Sprint 6 — Fonts (terminal, always last) ✅ COMPLETED 2026-08-21 (commit `13b84fdb`, Task 19)

| ID | Source | Sev/Pri | Item |
|----|--------|---------|------|
| FONT-WEB-001 | font | 🟢 P3 | `globals.css`: `:root:lang(zh)` and `:root:lang(ko)` overrides of `--font-cjk` so SC/KR faces precede JP for those locales. |
| FONT-WEB-002 | font | 🟢 P3 | `my-submissions-modal.ts:139` inline `font-family` → `var(--font-mono)`. |
| FONT-WEB-003 | font | 📝 Info | No action (`<html lang>` runtime-set; no per-language URLs → no hreflang; manifest cannot be per-user). Record as accepted. |

**Ends with:** one web-app beta deploy. Visual check on a machine with Noto Sans JP + SC installed: zh UI renders 骨/直 in SC forms.

---

## Superseded Findings

None — single-source plan; no fix-vs-delete collisions. (HC-SYS-012 deletions *remove* ≈25 rows from `dye-card-renderer`, `recent-colors-panel`, `harmony-result-panel`, `color-wheel-display`, the announcer helpers and `getStatusInfo()`; those rows are closed by deletion in Sprint 0, not localized.)

## KEEP Register (not scheduled)

| ID | Item | Reason to Keep | Revisit Trigger |
|----|------|----------------|-----------------|
| — | identical-to-EN values (87) | brand / units / cognates / legal — verified legitimate | a translator disagrees |
| HC-SHL-010 | changelog content English-only | structural (source is `CHANGELOG-laymans.md`) | a per-locale changelog is authored |

## Hand-off register — surfaced by the sweep, not i18n, not scheduled here

| Where | What | Route to |
|-------|------|----------|
| `components/my-submissions-modal.ts:138-141` | `preset.name` / `rejection_reason` into `innerHTML` unescaped (moderator-authored reason) | security-audit / fix with `escapeHtml` before the 5.0 merge |
| `services/preset-submission-service.ts:418-443` + `preset-tool.ts:834`, `my-submissions-modal.ts:195` | `deletePreset()` failures never surfaced — callers toast success | deep-dive / BUG |
| `services/camera-service.ts:97` | `availableCameras.length` inside `.map` is the old array — numbering off | deep-dive / BUG (trivially fixed with HC-EXT-005) |
| `components/dye-selector.ts:343` | remove-chip `✕` has no aria-label | a11y |
| `components/dye-search-box.ts:210` | CSS selector built from a translated aria-label | refactor (data-attr hook) |
| `knip.jsonc` | type-position imports hide never-constructed components (DEAD-030 blind spot bit again: 3 files) | dead-code-finder — add a `knip --production` warning step to CI |

---

## Standing guidance while executing

- Verify each finding's evidence against reality before coding — the line numbers are from `1cbb303e` and the sibling session edits this checkout; treat findings as leads, not gospel.
- Every new key lands in **all six** locale files in the same commit, in `en.json` order; `validate:i18n` + `i18n:unused` + `src/__tests__/i18n-orphans.test.ts` must pass at every sprint boundary.
- Delete keys only together with the code that referenced them (HC-SYS-001, TERM-003/004), otherwise the orphan gate trips.
- Core locale values (`packages/core/src/data/locales/*.json`) are **generated** — any correction there goes through `dyenames.csv` / `localize.yaml`, never the JSON. Nothing in this plan requires a core change unless TERM-004 takes the `getVisionTypeShort()` route (then: core bump + publish via the GitHub Action, not a local `pnpm publish`).
- Beta first (`beta.xivdyetools.app`, Pages `--branch=beta` is load-bearing), production on the 5.0 merge; a bare `wrangler deploy` is not involved — web-app is Pages.
- Re-run the i18n sweep (this folder's evidence scripts + a fresh hardcoded scan) after Sprint 2 and again after Sprint 5; the lint guardrail should make the third run boring.

---

## Execution notes (added 2026-08-21, Task 20 close-out)

All seven sprints above shipped as 19 tasks (Task 20 is this close-out) on branch **`i18n-remediation-2026-08-20`**, worktree `C:\dev\XIVProjects\.worktrees\xivdyetools-i18n`, cut from `monorepo-2.0-prep` @ `1cbb303e`. Full commit range: `37668a97..13b84fdb` (22 commits including the audit-doc commit `cae7c68c` itself). Per-task detail lives in `.superpowers/sdd/EXECUTION_TASKS/progress.md` and the individual `task-N-report.md` files; this section pulls forward only what a future reader of this plan needs without opening the ledger.

### Rulings made during execution

- **Worktree/branch choice**: work landed on a new branch in a dedicated worktree rather than directly on `monorepo-2.0-prep`, because `.worktrees/` is not gitignored in this repo and another session was concurrently editing the main checkout. The branch fast-forwards cleanly onto `monorepo-2.0-prep`.
- **10 harmony keys, not 9** (Sprint 3 / TERM-003, Task 13): all ten `config.*` harmony option keys — including `config.invertedTetradic`, which the plan's item list omitted — were converted to `LanguageService.getHarmonyType()` and deleted from all six locales together, not nine. Splitting them would have orphaned the tenth key against the `i18n:unused` gate; the deletion had to be atomic.
- **TERM-004 took the locale-edit route**, not a core `getVisionTypeShort()` addition: the ja/ko/zh head nouns for the vision-toggle short labels were aligned to core's vocabulary by editing the locale values directly, avoiding a `@xivdyetools/core` publish from inside a web-app-only branch. The duplicate short-label vocabulary in web-app `config.*` keys remains (accepted cost).
- **Identifier rulings**: `HC-V4-008` and `HC-SWA-004`/`HC-BUD-010` tags (`RGB DIST`, `DISTINGUISH %`, `R{row}·C{col}`, `ID {n}`, tier tags) stay English identifiers, consistent with how the ΔE method tags are already treated — not translated. The mixer's `MODEL_SHORT` **`Spectral`** row header (Task 17) stays an identifier for the same reason (the tooltip beside it does carry the localized `mixer.modelSpectral` string).
- **ko/zh CIEDE2000 learn-link — no English fallback** (Task 17): the dispatch brief for Task 17 had assumed ko/zh would fall back to an English Wikipedia link when no localized article exists. Execution instead followed core's already-documented `getLearnLink` policy: absent means no link, never an English one. Repo convention won over the brief's assumption — cost if wrong: ko/zh users lose a Wikipedia link they could have read in English anyway.
- **`errors.networkError` wording** (Task 6): the shipped string "Network error. Please try again." was kept as originally translated rather than revised, since it matches the register of the rest of the `errors.*` namespace.

### Deferred minors that remain (grouped, not blocking; none change gate status)

**Shared helpers / custom dye (Tasks 2, 8)**
- `custom-dye.ts:509` and `:57` carry a redundant `as Dye` cast.
- `dyeNameMatches()` has no test for the empty-query case.
- A custom dye's localized name is frozen at mint time (the swatch tool's `reverseDyeName` caches the interpolated string) — same behaviour as the real-dye path, so treated as consistent rather than a defect.
- Comparison tool's `sourceLabel` keeps a dead `|| d.acquisition` fallback.

**Presets services and forms (Tasks 5, 6, 7)**
- German `preset.anotherPreset` should be nominative ("eine andere Voreinstellung").
- `preset-edit-form.test.ts:239-247` dye-name assertions are vacuous (they stub `getDyeName`).
- Korean `saveChanges` spacing is inconsistent with `noChanges`.
- Pre-existing: ja `preset.dyes` = 染料 vs the runtime's カララント (not introduced by this remediation).
- `importedCopyName`'s loop is unguarded if a locale ever drops the `{n}` placeholder.
- `MIN_`/`MAX_` validation constants are duplicated between the form and the service.
- The vote-failure path drops the server's wire message and surfaces only the mapped code as `details`.
- A stale comment remains in `collection-service-branches.test.ts:170`.
- `preset-detail.ts`, `preset-tool.ts`, `my-submissions-modal.ts`, `add-to-collection-menu.ts` still have no dedicated test files.
- The loop-guard test added for the collection-import path doesn't reproduce the double-collision case it guards against.

**Config sidebar / vocabulary (Tasks 11, 13)**
- `config-sidebar.ts` holds its own copy of the `SUBRACE_TO_CLAN_KEY` map — a third copy alongside `chara-import.ts` and `swatch-tool.ts` — never folded into a shared module.
- `METHOD_TAGS` is duplicated across three files; `RACE_KEY_BY_RACE` is unshared.
- A full `<v4-config-sidebar>` mount is impossible in the current test harness (the `ConfigController` mock doesn't support it).

**Budget / gil / currency (Tasks 9, 15)**
- Hand-off, out of `apps/web-app` scope: `packages/core`'s `CONSOLIDATED_DYES.B.currency` reads "Skybuilders' Scrips" while the web-app currency table's key is "Skybuilders Scrips" — the apostrophe mismatch makes the tier-B currency label fall back to English. Needs a core fix, not a web-app one.
- `budget-tool.ts:466` and `:1524` still hand-roll tier-A gil formatting instead of `formatGil()` (visible as a ja spacing inconsistency).
- `camera-preview-modal`'s device-count fallback branch is unreachable as written.
- A key-count typo in one of the sprint reports (cosmetic, doc-only).
- The pre-existing "Market · Market" duplication in one label was left as-is (predates this remediation).

**Swatch / chara-import (Task 16)**
- `image-upload-display.ts:172` has a leading ASCII space after a fullwidth colon in one locale string.
- French `harmony.baseColorSection` ("Couleur de Base") capitalisation doesn't match the newer `baseColorTitle` key's convention.
- `gradient-tool.test.ts` carries negative assertions that can't fail (inert).
- Swatch's `gridTitle` is computed twice per render.
- Swatch-tool fallback branches still join `{palette}`/`{addr}` manually instead of through a shared formatter.

**Guardrails / lint infrastructure (Task 18)**
- `validate-i18n.js:583` has a stale `--fix` hint in its output.
- The `no-hardcoded-ui-strings` rule splits `html`` `` text at `${}` interpolation holes, so a sentence broken across a hole is invisible to it.
- Only the `html` tagged template is scanned — `svg`` `` templates are not.
- `innerHTML` assignments inside the nine `BaseComponent`-derived tools (≈28 call sites) are not covered by the rule — flagged as a follow-up, not fixed here.
- `checkOrderAndWhitespace` re-parses each locale file rather than reusing an already-parsed AST.

**Doc corrections folded into this close-out**
- `FONT_SUBSET_AUDIT.md`'s FONT-WEB-002 count was wrong (said one `my-submissions-modal.ts` inline `'Fragment Mono'` site, there were four — two of which predated the 2026-08-20 audit and were missed by its grep). Corrected in this task.
- `result-card.ts:1858`'s `no-hardcoded-ui-strings` warning for the "Saddlebag Exchange" brand name is now suppressed with a rule-scoped disable comment (Task 20), leaving `npm run lint` at 0 warnings / 0 errors.
