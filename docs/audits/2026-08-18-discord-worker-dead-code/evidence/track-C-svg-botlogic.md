# Track C — `packages/svg` + `packages/bot-logic` (manual verification notes)

Scope: `@xivdyetools/svg` (17 src files) and `@xivdyetools/bot-logic` (+ `/i18n` subpath, 19 src files + 6 locale JSONs).
Branch monorepo-2.0-prep @ 84b6cf1. READ-ONLY pass; the only files written are this one and `bot-i18n-orphan-keys.txt`.

Method: every symbol was grepped with `-w` over the **git-tracked** `.ts/.js/.mjs/.tsx` files under `apps/` and `packages/`
(node_modules / dist / coverage / e2e-coverage excluded — the first naive `grep -r` was polluted by `apps/web-app/e2e-coverage/.tmp/*.json`
and `apps/*/coverage/**/*.html`, which is worth remembering for the other tracks). Counts below are
`int` = non-test files inside the package other than `index.ts`, `intT` = package tests, `ext` = non-test files outside the package, `extT` = tests outside.

## 0. Who actually consumes the two packages

| Package | Declared consumers (package.json) | Real importers (non-test) |
|---|---|---|
| `@xivdyetools/svg` | discord-worker, stoat-worker, og-worker, web-app, bot-logic | discord-worker (4 files: budget, extractor, preset + tests), og-worker (4 files: `services/svg/base.ts` re-export shim, `band-shared.ts`, `default-card.ts`, `harmony.ts` — glyphs + primitives only), web-app (6 `src/shared/*-icons.ts` glyph shims + `glyph-accent.ts` — glyphs only), bot-logic (8 command modules). **stoat-worker imports nothing from svg** (dep is dead — knip default already lists it). |
| `@xivdyetools/bot-logic` | discord-worker, stoat-worker, moderation-worker | discord-worker (12 files), moderation-worker (`parseModeratorIds` only), stoat-worker (`executeDyeInfo`, `resolveDyeInput`, `LocaleCode` type only). |

`packages/svg/README.md` and `CLAUDE.md` both list `apps/stoat-worker` as a consumer — stale.

## 1. svg — knip-flagged value exports (verified)

| Symbol (file) | int / intT / ext | Classification | Evidence |
|---|---|---|---|
| `arcPath` (base.ts:231-252, 22 lines) | 1/1/0 | **DEAD** (documented in README "Low-level SVG primitives" — remove-with-caution) | Only its own definition + `base.test.ts:263-284`. Pie/donut helper from the retired harmony wheel (removed 5.0 per DEPRECATIONS.md). |
| `truncateText` (base.ts:359-374, 16 lines) | 1/1/1 | **DEAD** (documented) | Only external ref is og-worker's `services/svg/base.ts` re-export, and og-worker itself never calls it (0 non-test refs). Also contradicts the README/CLAUDE rule "Never ellipsise to a character count". Tests: `base.test.ts:368-384` **and again 450-470** (duplicate describe block). |
| `rgbToHsv` (base.ts:403-442, 40 lines) | 1/1/0 | **DEAD**, duplicate of `ColorService.rgbToHsv` (core) | External hits are all core's own / web-app's own / discord-worker calling `ColorService.rgbToHsv`. Tests `base.test.ts:413-449`. |
| `DEFAULT_DISPLAY_OPTIONS` + `DisplayOptions` (base.ts:9-41, 33 lines) | 1/0/0 | **DEAD** | Nothing in svg reads it (no generator takes display flags); the web-app hits are web-app's *own* `DEFAULT_DISPLAY_OPTIONS` in `shared/tool-config-types.ts`. Comment "backward compat" is the legacy marker at base.ts:13 — nothing to be compatible with. |
| `ACCENT` (base.ts:269) | 1/0/0 | INTERNAL-ONLY (used by `THEME.accent`), documented | keep the constant, barrel export is unused |
| `NUMFMT` (base.ts:329) | 1/1/0 | INTERNAL-ONLY (used by `num`/`grp`), documented | barrel export unused |
| `CARD_TYPE`, `HARMONY_ROW_CAP`, `cardShell`, `cardText`, `textWidth`, `fitText`, `commandChip`, `placeGlyph`, `appIcon`, `markFooter`, `swatch`, `idealSwatch`, `dashedRule`, `hairline`, `formatMeasure` (frame.ts) | int 1-13 / ext 0 | INTERNAL-ONLY, **DOCUMENTED-PUBLIC-API** ("Frame primitives" section of README + CLAUDE.md) | Every one is used by the generators inside svg; no app or bot-logic imports them (only `cardTheme`, `num`, `grp`, `ROW_CAP`, `toolGlyph` cross the boundary). KEEP — they are the frame vocabulary the docs tell consumers to build with. `placeGlyph`/`appIcon`/`formatMeasure` are not in the README list and could be un-exported. (`swatch`/`hairline` ext hits are word collisions: `/swatch` command, CSS "hairline".) |
| `bandSlices` (palette-grid.ts:106) | 1/1/0 | INTERNAL-ONLY (used by `generatePaletteGrid`) + own tests | not documented; un-export candidate |
| `LEDGER_HEADER_H`, `LEDGER_COLHEAD_H`, `LEDGER_FOOTER_H`, `LEDGER_FOOTER_2LINE_H` (budget-ledger.ts:106-115) | 1/0/0 | INTERNAL-ONLY, documented as `LEDGER_*_H` | used inside `generateBudgetLedger` |
| `LEDGER_GROUP_H`, `LEDGER_ROW_H` (**knip did not flag**) | 1/1/0 | TEST-ONLY re-export | only `index.test.ts` asserts their values (40 / 24); no consumer imports them. knip missed them because the index test's `svg.LEDGER_ROW_H` counts as usage. |
| `GLYPH_SETS` (tool-icons.ts:335-342) | 1/1/0 | TEST-ONLY | only `icons/tool-icons.test.ts` iterates it |
| `GLYPH_ACCENT_LIGHT` (tool-icons.ts:29) | 1/0/0 | REDUNDANT token — consumers inline the literal | `#CE2222` is hard-coded in `frame.ts:305` (appIcon), og-worker `band.ts:140`, web-app `theme-service.ts:78`. Recommend wiring those to the constant rather than deleting it. |

Un-flagged exports also checked (all LIVE unless noted): `escapeXml`, `estimateTextWidth`, `getContrastTextColor`, `rect`, `line`, `text` (og-worker + internal); `hexToRgb` (internal via `getLuminance`), `createSvgDocument`/`circle`/`group` (internal, preset-swatch), `THEME`/`FONTS` (internal, preset-swatch only — the "pre-frame" theme), `num`/`grp`/`ROW_CAP`/`cardTheme`/`measuredRow` (bot-logic + discord-worker), all 13 `generate*`, `contrastRatio` (bot-logic), all five glyph functions + `GLYPH_ACCENT_DARK` (web-app/og-worker).

Extra finds knip missed:

| Symbol | Classification | Evidence |
|---|---|---|
| `rgbToHex` (base.ts:70-72) | TEST-ONLY / documented, duplicate of core | int 1 (definition only), ext only og-worker's unused re-export; svg's own generators never call it. |
| `interpolateColor` + `generateGradientColors` (gradient.ts:203-252, ~50 lines) | TEST-ONLY / documented ("Color and text utilities") | `generateGradientCard` does not call either; comment says "shared with bot-logic's interpolation" but bot-logic's gradient.ts uses core. Tests `gradient.test.ts:108-134` + `index.test.ts`. |
| `CATEGORY_DISPLAY` (preset-swatch.ts:92-101, 12 lines) | **DEAD duplicate** | Docblock says "Moved here from discord-worker's types/preset.ts" but discord-worker (`types/preset.ts:165`) and moderation-worker (`types/preset.ts:62`) still carry their own copies and import those; `preset-swatch.ts` itself only mentions it in a comment (line 191). Only `index.test.ts` touches svg's copy. |
| og-worker `services/svg/base.ts` re-export shim | (og-worker's file, noted for cross-track) | Re-exports 14 svg symbols; of those `hexToRgb`, `rgbToHex`, `getLuminance`, `createSvgDocument`, `circle`, `group`, `truncateText`, `FONTS` have **zero non-test callers in og-worker** — only `og-worker/src/services/svg/base.test.ts` exercises them. |

## 2. svg — flagged type exports

| Group | Classification | Notes |
|---|---|---|
| Parameter types of live generators: `HarmonyCardOptions`, `GradientCardOptions`, `MixerCardOptions`, `PaletteGridOptions`, `NearestSheetOptions`, `A11yCardOptions`, `ContrastCardOptions`, `RandomDyesGridOptions`, `ComparisonCardOptions`, `SwatchCardOptions`, `DyeInfoCardOptions`, `PresetSwatchOptions`, `BudgetLedgerOptions` (13) | LIVE-by-inference (INTERNAL-ONLY export) | consumers pass object literals; type export unused but structurally load-bearing. Do not delete. |
| Nested `*Labels` / row types: `HarmonyCardLabels`, `PaletteGridLabels`, `NearestSheetLabels`, `A11yCardLabels`, `ContrastCardLabels`, `RandomGridLabels`, `ComparisonCardLabels`, `SwatchCardLabels`, `DyeInfoLabels`, `BudgetLedgerLabels`, `BudgetLedgerRow`, `PaletteBandEntry`, `PaletteRowEntry` (13) | LIVE-by-inference | fields of the option types above (`labels: XLabels`, `rows: XRow[]`). |
| Frame types: `CardTheme` (int 14), `CardTextOptions`, `CommandChipOptions`, `MeasuredLead`, `MeasuredRowOptions`, `MeasuredRowWidths` | INTERNAL-ONLY, documented with the frame primitives | discord-worker's `CardTheme` hits are its own `type CardTheme = 'dark'\|'light'` in `types/preferences.ts:49` — a **name collision** with svg's `CardTheme` interface, not usage. |
| `ChromeGlyphName`, `PanelGlyphName` | INTERNAL-ONLY (parameter types of `chromeGlyph`/`panelGlyph`) | web-app calls with literals |
| `DisplayOptions` | **DEAD** (see §1) | |
| `AllVisionTypes` (a11y-card.ts:52) | **DEAD** (2 lines) | not used even inside a11y-card.ts (`LENS_SHORT` in bot-logic redefines `'normal' \| VisionType` inline). |

## 3. svg — glyph sets (manual item 2)

Requested names, from every literal + resolved dynamic call site (`apps/web-app/src/shared/{tool,harmony,category,state,ui}-icons.ts`, og-worker `default-card.ts` `DEFAULT_DECK`/`band-shared.ts`, svg internals):

| Set | Defined | Requested | Unused |
|---|---|---|---|
| tool (compact) | 10 | 10 (web-app tool-icons.ts incl. `'tools'`) | 0 |
| tool (detail) | 9 | 9 (og-worker `DEFAULT_DECK` renders every tool in `'detail'`) | 0 |
| harmony | 10 | 10 (web-app harmony-icons.ts) | 0 |
| chrome | 4 | 4 (`about`, `sun`, `moon`, `globe`) | 0 |
| category | 9 | 9 (web-app category-icons.ts) | 0 |
| **panel** | 20 | 11 (`search`, `funnel`, `alert`, `folder`, `coins`, `presets-empty`, `gear`, `star`, `star-fill`, `kebab`, `dye`) | **9: `wait`, `steps`, `formats`, `stack`, `ratio`, `swap`, `pin`, `pin-off`, `anchor` — 1,513 bytes of path data (of 3,029 in `PANEL`)** |

The unused nine ship in the web-app bundle (the whole `PANEL` record is retained once `panelGlyph` is imported; `sideEffects:false` cannot tree-shake object members). Header comment calls them the "panel + empty state set confirmed 2026-08-07" — a designed set, so this is DEAD-DATA / design-reserve; flag for the design owner rather than auto-delete. Web-app's `ui-icons.ts` still hand-draws its other icons and never migrated to these names.

## 4. svg — generators (manual item 3)

| Generator | Callers |
|---|---|
| `generateHarmonyCard`, `generateGradientCard`, `generateMixerCard`, `generateA11yCard`, `generateContrastCard`, `generateRandomDyesGrid`, `generateComparisonCard`, `generateSwatchCard`, `generateDyeInfoCard` | bot-logic `commands/*` (→ discord-worker; `executeDyeInfo` also → stoat-worker) |
| `generateNearestSheet` | discord-worker `extractor.ts` + bot-logic `swatch.ts` |
| `generatePaletteGrid`, `generatePresetSwatch`, `generateBudgetLedger` | discord-worker only (`extractor.ts`, `preset.ts`, `budget.ts`) |

Zero generators with no callers; zero stoat-only generators (stoat-worker never imports svg). `preset-swatch.ts` (324 lines) is the one pre-frame generator and is live via `/preset`.

## 5. bot-logic — knip-flagged value exports

| Symbol | int / intT / ext | Classification | Evidence |
|---|---|---|---|
| `isValidHex`, `normalizeHex` (input-resolution.ts:32-76) | 1/1/1 | INTERNAL-ONLY (used by `resolveColorInput`/`resolveDyeInput`), documented in README + CLAUDE.md | The one external hit is discord-worker's `utils/color.ts` **re-export shim**, and no discord-worker file imports either name from the shim (they import `resolveColorInput`/`dyeService` only). Not a straight duplicate of core: `isValidHex` accepts bare `FF0000` (no `#`) and has an `allowShorthand` switch; core's `isValidHexColor` requires `#`. |
| `getLocalizedCurrency` (localization.ts:137) | 2/1/0 | INTERNAL-ONLY (used by `commands/dye-info.ts`) | barrel export unused |
| `getColorDistance`, `getMatchQualityInfo` + type `MatchQualityInfo` (**whole file `color-math.ts`, 72 lines + `color-math.test.ts` 63 lines**) | 1/1/0 | **DEAD (whole-file orphan)** | Only `index.ts` re-exports and the test imports it. Docblock claims it is "used by match, mixer, and gradient commands" — none import it (`/match` was retired). It is the surviving twin of the svg `getMatchQuality`/`MATCH_QUALITIES` emoji ladder that DEPRECATIONS.md says "left every surface" in 5.0. Meanwhile discord-worker `gradient.ts:176-180` re-implements a quality ladder inline with *different* thresholds (10/25/50) than `classifyMatchDistance` — the "single source of truth" is the dead one. CLAUDE.md §"Shared types & helpers" documents both functions — update. |
| `HARMONY_TYPES` (harmony.ts:28), `VISION_TYPES` (accessibility.ts:30) | 1/1/0 | INTERNAL-ONLY (marked `@internal` in source, yet listed in README "Available…types") | used by `getHarmonyTypeChoices` and the a11y lens loop; external `VISION_TYPES` hits are core's own constant + web-app's own local array. |
| `isValidDiscordSnowflake` (moderators.ts:18) | 1/1/1 | INTERNAL-ONLY (used by `parseModeratorIds`) | moderation-worker `preset-api.ts:258` **defines its own private `isValidDiscordSnowflake`** instead of importing — duplicate; the shared one is only reachable through `parseModeratorIds`. |
| `parseModeratorIds` / `isModeratorId` | 1/1/1 each | LIVE | moderation-worker `preset-api.ts:12` / discord-worker `services/preset-api.ts:13` |
| `resolveDyeInput` | 1/1/2 | LIVE but **stoat-only** in practice | discord-worker's shim re-exports it and nobody imports it there; the only real caller is stoat-worker `dye-resolver.ts:60` (parked app). |
| devDependency `@xivdyetools/test-utils` | — | **DEAD devDep** | `grep -rn test-utils packages/bot-logic/src` → 0 hits (svg's tests do use `@xivdyetools/test-utils/factories`, so svg's is live). |

Non-barrel file-level exports that are module-private in practice: `capGradientRows` (gradient.ts:92), `MixerSweepStop`, `MIXER_SWEEP_RATIOS` (mixer.ts:46/58) — INTERNAL-ONLY, harmless.

## 6. bot-logic — flagged types

| Group | Classification |
|---|---|
| `HarmonyInput/Result`, `DyeInfoInput/Result`, `RandomInput/Result`, `MixerInput/Result/Match`, `GradientInput/Result/StepResult`, `ComparisonInput/Result`, `AccessibilityInput/Result`, `SwatchResult`, `ContrastInput/Result`, `ResolveColorOptions`, `EmbedData`/`EmbedField` | LIVE-by-inference — the input/result contract of every live `execute*` (discord-worker passes literals and narrows on `result.ok`). Do not delete. `ResolveColorOptions` is additionally re-exported by discord-worker's shim. |
| `LocaleCode` (root barrel) | LIVE (46 ext hits; discord-worker/stoat import it from `/i18n`, the root re-export is redundant but harmless) |
| `MatchingMethod`, `BlendingMode`, `HarmonyColorSpace` (root barrel) | REDUNDANT-RE-EXPORT — all three are core types; every consumer imports them from `@xivdyetools/core` (`discord-worker/harmony.ts:8` etc.). `harmony.ts:347 export type { HarmonyColorSpace }` is a pure pass-through. |
| `MatchQualityInfo` | DEAD with color-math.ts |
| `LocaleData`, `TranslatorLogger` (`/i18n`) | INTERNAL-ONLY (marked `@internal` in types.ts; used by translator.ts). External `LocaleData` hits are core's/moderation-worker's own interfaces of the same name. |

`Translator.getMeta()` (translator.ts:94-96) has **no caller** anywhere (0 non-test hits) — the `meta.flag`/`meta.nativeName` locale keys exist only to feed it.

## 7. bot-logic — i18n orphan keys (manual item 1) — the big one

Script: `scratchpad/i18n_orphans.py` (Python). Raw list: `evidence/bot-i18n-orphan-keys.txt` (288 lines).

Method: enumerate every leaf path in `en.json`; a key is **live** if the exact dotted path appears as a string literal (`'…'`, `"…"`, `` `…` ``) in any non-test `.ts` under `apps/discord-worker/src`, `apps/stoat-worker/src`, `packages/bot-logic/src`, `packages/svg/src` (this catches `t.t('x')`, `labelKey: 'x'`, `SLOT_KEYS = {…'card.slotSkin'}`, `TOPIC_KEYS`, etc.); **dynamic** if covered by a template/concat prefix whose runtime values were enumerated by hand; **test-only** if the literal occurs only in `*.test.ts`; otherwise **orphan**.

Dynamic prefixes found and their enumerations:
- `` `preferences.keys.${key}` `` (preferences.ts:202/329/344/365/445) → `PREFERENCE_ORDER` (15 keys) + `'filters'` (special-cased at 153/414) = all 16 `preferences.keys.*` — covered.
- `` `manual5.topics.${key}.{name,body}` `` (manual.ts:290/298) → `TOPIC_KEYS` = 5 topics × 2 = all 10 — covered.
- `` `accessibility.${lens}` `` (bot-logic accessibility.ts:83) → the four vision types only (I narrowed the prefix by hand; the other 15 `accessibility.*` keys were then re-checked as literals: 14 are test-only, 1 orphan).
- `` `quality.${qi.key}` `` only in the dead `color-math.ts` docblock — the five `quality.*` keys are live anyway via literals in discord-worker `gradient.ts:176-180`.
- No `${ns}.suffix` dynamic-namespace templates exist. `scripts/register-commands.ts` reads no locale files (no `*_localizations`). svg label objects are all filled by bot-logic/discord-worker `t.t('card.*')` literals (91/93 `card.*` live). stoat-worker calls `t.t` zero times.

Results (identical across the 6 files — **key-set parity is perfect: 621 keys each, 0 missing / 0 extra per locale**):

| | keys | share | approx bytes across 6 files (leaf+value JSON) |
|---|---|---|---|
| total | 621 | | 234,405 (file sizes: en 35.7 KB · ja 43.6 · de 39.2 · fr 41.3 · ko 39.7 · zh 35.0) |
| live (literal) | 343 | 55% | |
| dynamic-covered | 29 | 5% | |
| test-only | 38 | 6% | ~12.4 KB |
| **orphan** | **211** | **34%** | **~54.7 KB** (≈23% of the locale bytes; these JSONs are statically imported by `translator.ts`, so they ship inside the discord-worker bundle) |

Orphans by namespace (total / live / dyn / test-only / **orphan**):

| ns | tot | live | dyn | test | **orph** | what it is |
|---|---|---|---|---|---|---|
| swatch | 37 | 0 | 0 | 0 | **37** | the whole 4.x `/swatch color\|grid` surface (colorTypes.*, errors.*, clan/gender/row/col) — replaced by the `.chara` frame in 5.0; the 5.0 swatch handler uses `common.*`/`errors.*`/`card.*` only |
| stats | 31 | 0 | 0 | 0 | **31** | `/stats` is registered but `stats.ts` hard-codes English (`**Commands Used:**`) — 1 `t.t` call, none of the `stats.*` keys |
| budget | 41 | 10 | 0 | 0 | **31** | 4.x `/budget find` shape: `sortMethods.*`, `distanceQuality.*`, alternatives/savings/valueScore… (DEPRECATIONS: `max_price`/`sort_by`/`max_results` removed) |
| preset | 42 | 20 | 0 | 1 | **21** | `preset.categories.*` (6), `preset.status.*` (4), `preset.moderation.*` (10, moved to moderation-worker which has its own inline strings), `notConfigured` |
| mixer | 21 | 2 | 0 | 0 | **19** | `modes.*`/`modeDescriptions.*` (12), title/footer/inputDyes/closestMatch… — 5.0 mixer prints only `mixer.blendResult` + `card.ratioKey` |
| preferences | 79 | 45 | 15 | 0 | **19** | `preferences.descriptions.*` (14, never referenced anywhere), `errors.invalidTheme`, `reset.all`, `set.affectedCommands`, `set.updated`, `show.title` |
| common | 18 | 8 | 0 | 0 | **10** | closestDye, color, createdAt, distance, dye, inputColor, marketBoard, matchQuality, quality, success |
| paletteGrid | 9 | 0 | 0 | 0 | **9** | pre-frame extractor labels incl. `paletteGrid.quality.*` emoji-ladder words |
| extractor | 9 | 1 | 0 | 0 | **8** | subcommand descriptions, dominantColor, useInfoHint… |
| comparison | 9 | 0 | 0 | 2 | **7** | wcagAA/AAA, passes, mostSimilar… (contrast letters retired in 5.0) |
| matchImage | 14 | 9 | 0 | 0 | **5** | closestMatch, colorMatch, colorPalette, extractionMethod, topMatches |
| errors | 14 | 10 | 0 | 0 | **4** | colorNotFound, failedToReset, failedToSave, userNotFound |
| gradient | 10 | 6 | 0 | 0 | **4** | description, start, end, gradientFrom |
| card | 93 | 91 | 0 | 0 | **2** | `card.cost`, `card.idealKey` |
| meta | 4 | 0 | 0 | 2 | **2** | `flag`, `nativeName` — only reachable via the uncalled `getMeta()` |
| harmony / accessibility | 11 / 20 | 10 / 1 | 0 / 4 | 0 / 14 | **1 / 1** | `harmony.harmonyColors`; `accessibility.title` (the other 14 a11y keys are test-only mocks) |
| about | 35 | 17 | 0 | **18** | 0 | `about.cmd.*` (17 — 4.x per-command blurbs incl. removed `match`, `favorites`, `collection`, `language`, `stats`) + `categories.userData` exist only in `about.test.ts`'s mock table |
| manual, manual5, matchImageHelp, webhook, previewImage, dye, changelog, firstRun, quality | | all live | | | 0 | (`matchImageHelp` is reachable: `/manual topic:match_image` is still a schema choice) |

Cross-track dependency: "live" means referenced by a non-test discord-worker file. If Track A retires a handler (e.g. `stats.ts`, legacy `buildEmbeds` in `manual.ts` → 37 `manual.*` keys, `preview-image.ts` → 5 `previewImage.*`), its keys fall into this bucket too.

## 8. bot-logic — executors, legacy markers, orphans (manual items 4-6)

- Executors: `executeHarmony/Mixer/Gradient/Comparison/Accessibility/Swatch/Contrast/Random` → discord-worker only; `executeDyeInfo` → discord-worker + stoat-worker. None uncalled. `parseModeratorIds` (moderation-worker) / `isModeratorId` (discord-worker) both live.
- Legacy markers: `mixer.ts:69` — `MixerResult.matches` ("legacy shape, still returned"): computed every `/mixer` call (`count` extra nearest-dye searches, mixer.ts:135-154) but **no consumer reads `.matches`, `.blendedHex`, `.inputDyes` or `.sweep`** — discord-worker `mixer-v4.ts` uses only `svgString` and `embed`; only `mixer.test.ts` asserts them. `MixerInput.count` exists solely to size this loop (discord-worker still resolves and passes it). **DEAD runtime work + dead payload** (~20 lines + `MixerMatch` type). `localization.ts:74` — the `locale = 'en'` default is still exercised (`discord-worker/index.ts:62` calls `getLocalizedDyeName(id, name)` with no locale) — keep. svg `base.ts:13` — dead with `DisplayOptions`.
- Whole-file orphans: bot-logic `color-math.ts` (+test) is the only one. `css-colors.ts` is used by input-resolution; `commands/__fixtures__/chara-fixtures.ts` is used by `swatch.test.ts`. svg: every file is on the barrel and every barrel symbol is exported from exactly one file (no unreachable module).

## 9. Stale tests / duplicates / deps (manual item 7)

- `packages/svg/src/base.test.ts` contains **two** `describe('truncateText')` blocks (368-384, 450-470) and **two** `describe('estimateTextWidth')` blocks (385-412, 472-502) — ~50 duplicated lines from a merged file.
- Duplicate implementations vs core: svg `hexToRgb`/`rgbToHex`/`rgbToHsv` (↔ `ColorService.*`), `getLuminance` (↔ `getPerceivedLuminance`), `contrastRatio` (↔ `ColorService.getContrastRatio`, live in bot-logic), `interpolateColor` (↔ core `mixColorsRgb`/`lerp`); bot-logic `isValidHex`/`normalizeHex` (↔ core `isValidHexColor`/`ColorService.normalizeHex`, semantics differ on the `#` prefix); svg `CATEGORY_DISPLAY` ↔ discord-worker + moderation-worker copies; `isValidDiscordSnowflake` ↔ moderation-worker private copy. Only `rgbToHex`/`rgbToHsv`/`CATEGORY_DISPLAY` are *also* dead; the rest are live duplicates (a consolidation question, not a dead-code one).
- package.json: svg deps `core`, `types` used; devDeps `test-utils` used (3 tests). bot-logic deps `core`, `svg`, `types` used; **devDep `test-utils` unused**. stoat-worker's `@xivdyetools/svg` dependency is unused (out of scope, corroborates knip default).
- No skipped tests in either package (matches `skipped-tests.txt`).

## 10. Removal-candidate line/byte tally

| Item | Lines / bytes |
|---|---|
| svg `arcPath` + tests | 22 + 22 |
| svg `truncateText` + both test blocks (+ og-worker re-export line) | 16 + ~38 |
| svg `rgbToHsv` + tests | 40 + 37 |
| svg `DisplayOptions` + `DEFAULT_DISPLAY_OPTIONS` | 33 |
| svg `interpolateColor` + `generateGradientColors` + tests (documented — caution) | ~50 + ~27 |
| svg `rgbToHex` (documented — caution) | 3 |
| svg `CATEGORY_DISPLAY` | 12 |
| svg `AllVisionTypes` | 2 |
| svg 9 unused panel glyphs (design reserve) | ~1.5 KB / 9 entries |
| svg barrel lines for INTERNAL-ONLY/TEST-ONLY exports (if trimmed) | ~30 lines of index.ts |
| bot-logic `color-math.ts` + test + 3 barrel lines | 72 + 63 + 3 |
| bot-logic `MixerResult.matches` block + `MixerMatch` + `count` plumbing | ~30 |
| bot-logic `Translator.getMeta` | 4 |
| bot-logic `test-utils` devDep | 1 |
| bot-logic locale orphans (211 keys) / test-only (38 keys) | ~54.7 KB / ~12.4 KB across 6 files (+ the mock tables in `about.test.ts` etc.) |
