# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-08-21

### Security — 2026-08-21 security audit (FINDING-028)

- `escapeXml` now also strips characters that XML 1.0 forbids outright — C0 controls other than TAB/LF/CR, U+FFFE/U+FFFF and lone surrogates — so a preset name carrying U+0001 (presets-api validates length only) no longer makes resvg reject the whole card. Hex values interpolated into `fill="…"` in `contrast-card`, `gradient`, `dye-info-card` and `swatch-card` go through `escapeXml` like every other attribute (defence in depth; they were the only unescaped attribute sites).

### Changed — 2026-08-20 i18n audit remediation

- `FONTS.cjk / headerCjk / primaryCjk / monoCjk` (base.ts) now list `Noto Sans JP` ahead of SC, matching `frame.ts` — `preset-swatch` was the one card drawing ja text in Chinese letterforms (F-17).
- `generatePresetSwatch` accepts `authorLine`, `emptyLabel` and `dyeName(dye)` so the card renders in the user's locale; defaults unchanged (F-11).
- `contrast-card` ratios (`:1`), `mixer-card` / `palette-grid` percent leads use `num()` with the card's `lang` instead of bare `toFixed()` (F-08).

## [2.0.0] - 2026-08-16

The 5.0 graphics release. Every Discord bot card is redrawn on one shared **frame system** (`src/frame.ts`) at Discord's real display width, the pre-5.0 generators are deleted, and the package becomes the single geometry home for the 5.0 icon set consumed by the web app and og-worker. Consumers on the branch: `apps/discord-worker` 5.0.0, `@xivdyetools/bot-logic` 2.0.0, `apps/og-worker` 2.0.0, `apps/web-app` 5.0.0. See `DEPRECATIONS.md` → "5.0 graphics-era removals" for the removal table.

### ⚠️ BREAKING

**Removed generators and helpers** (no shim, no deprecation period — the replacements shipped in the same release):

| Removed | Replacement |
|---|---|
| `generateHarmonyWheel`, `HarmonyDye`, `HarmonyWheelOptions` (`harmony-wheel.ts` deleted) | `generateHarmonyCard` (11A) |
| `generateGradientBar`, `GradientStep`, `GradientBarOptions` | `generateGradientCard` (12H) — `interpolateColor` / `generateGradientColors` are unchanged |
| `generateContrastMatrix`, `calculateContrast`, `ContrastDye`, `ContrastMatrixOptions`, `ContrastResult`, `WCAGLevel` (`contrast-matrix.ts` deleted) | `generateContrastCard` + `contrastRatio` (13A/13B/13C·1) — AA/AAA letter grades left the bot; bands are named by their ratio |
| `generateAccessibilityComparison`, `generateCompactAccessibilityRow`, `AccessibilityComparisonOptions`, `VisionLabels` (`accessibility-comparison.ts` deleted) | `generateA11yCard` (13D/13E/13H) — `VisionType` / `AllVisionTypes` now export from `a11y-card.ts` and gain `'achromatopsia'` |
| `generateComparisonGrid`, `ComparisonGridOptions` (`comparison-grid.ts` deleted) | `generateComparisonCard` (14A/14C·2/14C) |
| `generateBudgetComparison`, `generateNoWorldSetSvg`, `generateErrorSvg`, `formatGil`, `DyePriceData`, `BudgetSuggestion`, `BudgetSortOption`, `BudgetSvgLabels`, `BudgetComparisonOptions` (`budget-comparison.ts` deleted) | `generateBudgetLedger` (13G) + `LEDGER_*_H` row constants; gil formatting via `grp()`; no error/no-world PNGs — those states are embed text now |
| `getMatchQuality`, `MATCH_QUALITIES`, `MatchQuality`, `PaletteEntry` | core's `classifyBandTier` (a tier is a property of the matching method, not of the pair); `PaletteBandEntry` / `PaletteRowEntry` |
| `generateCompactPresetSwatch` | none — zero callers for two releases; `generatePresetSwatch` stays |
| `RandomDyeInfo` | `RandomDyeRow` + `RandomGridLabels` |
| `CATEGORY_DISPLAY.community` | the community preset category was retired when presets moved to stainIDs; `appearance` / `zones` / `raids-trials` entries added |

**Retained generators changed shape** — every card is now 400 px wide, at most 350 px tall, takes `lang` and `theme?: 'dark' | 'light'`, and takes caller-supplied `labels` (translated strings) instead of drawing English:

- `generateDyeInfoCard(options)` — new required `stainID`, `srcValue`, `mktValue`, `nearest: NearestDyeInfo[]`, `labels: DyeInfoLabels`, `lang`; the old free-size card is gone.
- `generateRandomDyesGrid(options)` — `dyes: RandomDyeRow[]` (hex/name/category/stainID), `labels: RandomGridLabels`; five rows maximum.
- `generatePaletteGrid(options)` — now the 14K ramp: `band: PaletteBandEntry[]` (every extracted colour at its real share) + `rows: PaletteRowEntry[]` (top five by share, source→dye pair); the `width`/column options are gone. New `bandSlices()` helper (7 px floor per slice, remainder taken off the largest).
- `THEME` palette replaced wholesale — the `#1a1a2e` navy and the Discord-blurple `accent` are gone; surfaces now match `CARD_DARK` (`#17171A` / `#ECECEE` / `#9C9CA2` …) and `accent` is `ACCENT`. `FONTS.mono` is `Fragment Mono` (was `Habibi`, a proportional serif — numeric columns never aligned). Anything reading `THEME`/`FONTS` values (og-worker does) gets the new ones.
- `@xivdyetools/color-blending` dependency dropped — in-card mixing imports `@xivdyetools/core/blending`; only `@xivdyetools/core` and `@xivdyetools/types` remain as dependencies.

**Migration for consumers:** rebuild each card call against the new option types (all labels come from the caller's translator; pass the user's `theme` preference; raster at 2× for a crisp 800 px PNG), load `Fragment Mono` and the JP/SC/KR Noto subsets in the rasteriser, and pass an explicit `ink` to any glyph rendered through resvg (`currentColor` is black there).

### Added

- **Method-aware measured rows** — `measuredRow()` takes `method?: MatchingMethod` (default `ciede2000`): the tier bar is classified against that method's calibrated bands and the measure prints in its register via the new exported `formatMeasure()` (ΔE2000/ΔE76 one decimal, ΔEOK raw to three, REDMEAN/RGB DIST integers, DISTINGUISH % with `%`). `generateNearestSheet()` and `generatePaletteGrid()` accept `method?` and forward it, swapping the `ΔE` column header for the method's tag when off-default (the harmony card's convention); the harmony card's own ΔE column now prints through `formatMeasure()` too, so an ΔEOK verdict shows `0.052` instead of collapsing to `0.1` at one decimal
- **Frame system** (`src/frame.ts`) — the shared card vocabulary every 5.0 generator composes from:
  - Constants: `CARD_WIDTH` 400 (the canvas width IS the display width), `CARD_MAX_HEIGHT` 350 (a wall — past it Discord contracts the box horizontally), `CARD_TYPE` `{ label: 11, value: 13, name: 16 }` type floor, `ROW_CAP` 5 (R1: every list card holds five rows; the tail rides the embed), `HARMONY_ROW_CAP` 4.
  - Themes: `CARD_DARK` / `CARD_LIGHT` (`CardTheme`) + `cardTheme(mode)`. Both ship; light is selected per user via the bot's `/preferences`. Each carries the four-step tier ramp `#5bbd68 · #8bc34a · #ffc107 · #f4645a` (dark), settled 2026-08-09 against the web app's shipped ramp; the state amber `#F4BF4F` (OFF GRID, vendor flag) is deliberately a different token.
  - Primitives: `cardShell` (rounded surface + inset hairline), `cardText` (font stacks with CJK fallback, always XML-escaped), `textWidth` / `fitText` (ellipsise to pixels, CJK counted 2×), `commandChip` (the pill with the tool glyph inside; mono on dye-coloured grounds), `placeGlyph`, `appIcon` / `markFooter` (the app mark bottom-right, 18 px), `swatch` / `idealSwatch` (solid = buyable, outlined = the hue the maths asked for), `measuredRow` (the suite's unconditional five-slot list row: lead · butted source→dye pair · name · tier bar · measure; `lead` accepts `string | MeasuredLead { text, sub, subTone }`), `dashedRule`, `hairline`. Types: `CardTheme`, `CardTextOptions`, `CommandChipOptions`, `MeasuredLead`, `MeasuredRowOptions`, `MeasuredRowWidths`.
- **New generators** (one module per card, each naming its confirmed design frame in its docblock; all take `theme` and `lang`; heights grow with content and stop at the ceiling):
  - `generateHarmonyCard` (11A, `harmony-card.ts`) — base row + per-slot ideal-vs-found swatch pairs with the angle the maths asked for, harmony-calibrated tier words, the matching method printed wherever a tier appears, weakest-slot verdict, four-slot cap with the R1 tail strip. Types `HarmonyCardSlot`, `HarmonyCardLabels`, `HarmonyCardOptions`.
  - `generateGradientCard` (12H·2/·3/·4, `gradient.ts`) — the strip carries every step (7 px ideal cap over the nearest dye's block); rows are the distinct dyes on `measuredRow` with per-step ΔE; a `verdict` collapses the card to the shorter 12H·4 frame. Types `GradientStripCell`, `GradientRowEntry`, `GradientCardOptions`.
  - `generateMixerCard` (12F, `mixer-card.ts`) — the five-ratio sweep with the best landing highlighted; the mixer's first image. Types `MixerCardRow`, `MixerCardOptions`.
  - `generateNearestSheet` (14J·2, `nearest-sheet.ts`) — `/extractor color`: target block, rank leads, the target repeated down the pair column as a reference rail. Types `NearestSheetRow`, `NearestSheetLabels`, `NearestSheetOptions`.
  - `generateA11yCard` (13D/13E/13H, `a11y-card.ts`) — `mode: 'lens' | 'all' | 'solo'`: the pair repainted through one lens with the others as a summary strip / every lens one row with the normal row as control / a single dye's shift per lens (no tier colours, no verdict). Separation bands read larger-is-safer. Types `A11yCardOptions`, `A11yCardLabels`, `A11yLensRow`.
  - `generateContrastCard` (13A/13B/13C·1, `contrast-card.ts`) + `contrastRatio()` (delegates to `ColorService.getContrastRatio` — the bot's second hardcoded 4.5/7 ladder is gone) — routes on pair count: one pair gets the whole card, three pairs the ledger, six pairs the log-axis plot with 3/4.5/7 criterion lines. Types `ContrastPair`, `ContrastCardLabels`, `ContrastCardOptions`.
  - `generateComparisonCard` (14A/14C·2/14C, `comparison-card.ts`) — routes on dye count: two-dye duel with seven readouts (ΔE2000/ΔEOK/ΔE76/REDMEAN/RGB/DIST%/RATIO), three-dye triangle with full names, four-dye triangle with 3-char coded axes. Types `ComparisonDyeEntry`, `ComparisonReadout`, `ComparisonCardLabels`, `ComparisonCardOptions`.
  - `generateBudgetLedger` (13G, `budget-ledger.ts`) — tier groups carry the single consolidated price (header wash + vendor-cheaper flag pill), rows are name / ΔE (tier-toned) / gil-per-ΔE, command chip inline in the header, generated footer key. Exports `LEDGER_HEADER_H`, `LEDGER_COLHEAD_H`, `LEDGER_GROUP_H`, `LEDGER_ROW_H`, `LEDGER_FOOTER_H`, `LEDGER_FOOTER_2LINE_H` so callers can pixel-budget the row cap. Types `BudgetLedgerRow`, `BudgetLedgerGroup`, `BudgetLedgerLabels`, `BudgetLedgerOptions`.
  - `generateSwatchCard` (character sheet 1a/1b, `swatch-card.ts`) — live-slot strip header, character name/sub, rows on `measuredRow` with the shaped OFF GRID lead in state amber. Types `SwatchCardRow`, `SwatchCardLabels`, `SwatchCardOptions`.
- **5.0 icon system** (`src/icons/tool-icons.ts`) — the single geometry home ported from the design project; web-app and og-worker consume it through shims:
  - `toolGlyph(name, 'compact' | 'detail', opts)` — the 1B Chip Cluster set for the nine tools + the `tools` menu glyph; `detail` adds a 1.2-weight context layer.
  - `harmonyGlyph` (ten ring glyphs at the real generator offsets, incl. `inverted-tetradic`), `chromeGlyph` (`about` / `sun` / `moon` / `globe`), `panelGlyph` (20 panel/empty-state glyphs: search, funnel, alert, wait, folder, coins, steps, formats, stack, ratio, kebab, presets-empty, star/star-fill, swap, pin/pin-off, anchor, dye, gear), `categoryGlyph` (eight preset categories + `default`; `appearance` / `zones` / `raids-trials` added 2026-08-11).
  - `GLYPH_SETS` (every name per set — for shims and parity tests), `GLYPH_ACCENT_DARK` `#EA4133` / `GLYPH_ACCENT_LIGHT` `#CE2222`, `GlyphRenderOptions` (`size`, `fluid`, `ink`, `accent`). Rules baked in and tested: 32×32 grid, exactly one accent-filled element per glyph, real inline SVG (never `<symbol>`/`<use>`), explicit `fill="none"`, no opacity anywhere.
- **Typography / number formatting** (`base.ts`): `ACCENT` `#EA4133` (the one suite accent — colour is reserved for state), `NUMFMT` per-language `{ dec, thou }` table, `num(value, lang, dp)` and `grp(value, lang)` formatters (every measured value in a card goes through them; identifiers never do), `FONTS.monoCjk` fallback chain. The frame font stacks fall back `Noto Sans JP → SC → KR` (JP must precede SC or Japanese renders in Chinese letterforms).
- **Tests**: `frame-budget.test.ts` sweeps every generator in German at its densest case for width, the 350 px ceiling, the 11 px type floor and constant drift (it caught `/compare` drawing labels at 9.5 px); new suites for the a11y, contrast and swatch cards, the icon system and the frame primitives. Package coverage 78.5% → 98.6% statements; thresholds raised to 90%.

### Changed

- **Dead-code gate wired into `lint`** (2026-08-18 audit follow-up 6). `pnpm run lint` now ends in `lint:dead` (`knip --directory ../.. --workspace packages/svg`) against the repo-root `knip.jsonc`, with `includeEntryExports` on: a `src/index.ts` export no workspace imports fails the lint unless its specifier carries a `/** @public */` JSDoc tag. 58 specifiers were tagged — the frame primitives (`cardShell`, `cardText`, `fitText`, `commandChip`, `markFooter`, `swatch`, `idealSwatch`, `dashedRule`, `hairline`, `textWidth`, `appIcon`, `CARD_TYPE`, `HARMONY_ROW_CAP`, `LEDGER_FOOTER_*`, `ACCENT`, `NUMFMT`) and the `*Options`/`*Labels` companion types, all documented in `README.md`. Comments only — no runtime change.
- `generateDyeInfoCard` is the 11B sheet: dye-coloured 78 px band, two-column numeric grid, SRC row carrying the vendor price, MKT row naming the consolidated market item, and a nearest-dyes strip with match-band tier bars and "+N more".
- `generateRandomDyesGrid` is the 11B table: header row, 52 px rows, stain column, count clamped to five.
- `generatePaletteGrid` shows all extracted colours at their real share in the band; only the top five get rows, and the tenth colour can no longer silently disappear.
- Harmony re-cut to the Turn-13 geometry (2026-08-09 conformance audit): 39 px slot rows, `HARMONY_ROW_CAP` 4 (base + four slots renders at 344 px), the base row loses its hex line to pay for the verdict block, each slot leads with its angle, the matching method is printed beside every tier.
- `preset-swatch.ts` defects fixed in place (the frame redesign of `/preset` is deferred pending the command's survival): centred header strings are measured, the 60-character description cut and `Math.floor(width / 7)` name cut become pixel budgets, and the palette follows the new `THEME`.
- Docs: `CLAUDE.md` rewritten around the frame system and band vocabulary; `README.md` audited for accuracy and attribution.

### Removed

- Everything in the BREAKING table above, plus the navy/blurple palette, the emoji match-quality ladders, and `palette-grid`'s raw-RGB distance helper.

### Removed (2026-08-18 dead-code audit)

- **`arcPath`, `rgbToHsv`, `rgbToHex`** (`base.ts`, DEAD-014/015): the retired harmony-wheel arc helper; a duplicate of core's `ColorService.rgbToHsv`/`rgbToHex` that no generator in this package called. `truncateText` (`base.ts`, DEAD-014) is also gone — `fitText`/`estimateTextWidth` (pixel-budget ellipsis) were always the documented way to cut text, and this character-count helper's only external reference was og-worker's own unused re-export.
- **`DisplayOptions` interface + `DEFAULT_DISPLAY_OPTIONS` constant** (`base.ts`, DEAD-014): no generator ever read a display-flags object; the web app's identically-named `DEFAULT_DISPLAY_OPTIONS` (`@shared/tool-config-types`) is a separate, unrelated constant.
- **`AllVisionTypes`** (`a11y-card.ts`, DEAD-014): unused even inside its own module.
- **`interpolateColor`, `generateGradientColors`** (`gradient.ts`, DEAD-015): test-only outside `generateGradientCard`'s own internal use of them — deleting both together leaves no orphaned caller.
- **`GLYPH_SETS`, `LEDGER_GROUP_H`, `LEDGER_ROW_H` barrel exports** (DEAD-015): the underlying constants/exports stay defined and in production use inside `icons/tool-icons.ts` / `budget-ledger.ts` respectively — only the `index.ts` re-export was test-only (`icons/tool-icons.test.ts` and `budget-ledger.ts`'s own callers import directly, not through the barrel).
- **`placeGlyph`, `formatMeasure`, `bandSlices` barrel exports** (DEAD-015, optional trim): internal-only helpers with no consumer outside `frame.ts`/`harmony-card.ts`/`palette-grid.ts` and no README/CLAUDE mention — trimmed from `index.ts`, code unchanged. `appIcon`, `ACCENT`, and `NUMFMT` were also candidates in the finding but are documented in the README's "Frame primitives" example and Constants table, so they were kept on the barrel.
- **`CATEGORY_DISPLAY` adopted, not deleted** (`preset-swatch.ts`, DEAD-014): this package's copy is now the single source — `discord-worker`'s byte-identical duplicate (`types/preset.ts`) is deleted in favor of importing this export; `moderation-worker`'s duplicate had zero consumers of its own and was deleted outright with no new dependency added.
- **`GLYPH_ACCENT_LIGHT` wired to its three hard-coded `#CE2222` copies** (DEAD-018): `frame.ts`'s `appIcon()` now reads the constant instead of the literal (og-worker's `band.ts` and web-app's `theme-service.ts` wired the same way — see their own changelogs).
- **`PANEL` glyphs audited, KEPT** (DEAD-016): the 9 unrequested `PANEL` glyphs (`wait`, `steps`, `formats`, `stack`, `ratio`, `swap`, `pin`, `pin-off`, `anchor`) have no current caller, but were kept as a designed reserve pending the design owner's call rather than deleted.

## [1.2.1] - 2026-07-28

Release-infrastructure validation. **No functional changes** — the published contents are identical to 1.2.0.

### Changed

- Published via npm **trusted publishing (OIDC)** rather than a long-lived `NPM_TOKEN`. `@xivdyetools/svg` is the second pilot of that migration (after `@xivdyetools/crypto@1.1.2`), chosen because it declares three `workspace:*` dependencies — `@xivdyetools/core`, `@xivdyetools/color-blending`, `@xivdyetools/types`. `pnpm publish` rewrites those to exact versions at pack time, and the migration also moved the publish job from npm 10 to npm 11, so this release exists to confirm that rewriting still happens correctly under the new client. `crypto` could not test it: having no dependencies, its `package.json` has nothing to rewrite.

## [1.2.0] - 2026-07-19

2026-07-18 audit remediation (Sprint 6).

### Fixed

- **BUG-056**: emoji removed from SVG text (preset-swatch category icon, random-dyes default title) — the bundled resvg fonts have no emoji glyphs, so they rendered as tofu boxes in generated PNGs. `CATEGORY_DISPLAY` icons remain exported for Discord message text.
- **BUG-060**: `truncateText` slices by code points, so truncation can no longer bisect a surrogate pair (emoji in preset names) and render U+FFFD before the ellipsis.
- **BUG-063**: `generateGradientColors(start, end, 1)` returns `[start]` instead of `['#NaNNaNNaN']` (0/0 division guard).
- **OPT-018**: the contrast matrix computes each symmetric pair once (30 → 15 calls at 6 dyes) via an unordered-pair cache.

### Changed

- **REFACTOR-019**: every string attribute in the SVG primitives (fill, stroke, dashArray, fontFamily, transform) is escaped with `escapeXml` — hostile or malformed values can no longer close an attribute and inject sibling elements.
- **REFACTOR-020**: `estimateTextWidth` counts Fullwidth Forms, Fullwidth Signs, and Hangul Jamo as wide, so localized badges size correctly for ja/zh/ko punctuation.
- **REFACTOR-004**: match-quality classification delegates to `classifyMatchDistance` from `@xivdyetools/types` (inclusive boundaries) — `palette-grid`'s exported helper and its formerly self-contradicting inline badge copy, plus `budget-comparison`, now agree with bot-logic at boundary distances.

### Added

- **REFACTOR-022**: `AccessibilityComparisonOptions.labels?: Partial<VisionLabels>` — caller-supplied translated vision-type labels merged over the English defaults (new `VisionLabels` export), mirroring the labels-object convention of the other generators.

## [1.1.2] - 2026-03-01

### Added

- `rgbToHsv()` shared utility in `base.ts` — consolidated from duplicate implementations in `comparison-grid.ts` and `dye-info-card.ts` (DEAD-077)

### Changed

- Migrate `Dye` and `RGB` type imports across 7 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **Dead code cleanup — Wave 13 Phase 2** (2026-02-28 audit)
  - Replace duplicate `rgbToHsv()` in `comparison-grid.ts` and `dye-info-card.ts` with shared `base.ts` utility (DEAD-077)
  - Replace local `getRelativeLuminance()`/`getContrastRatio()` in `comparison-grid.ts` with `ColorService.getContrastRatio()` from core (DEAD-078)
  - Replace inline substring truncation in `comparison-grid.ts` with shared `truncateText()` utility (DEAD-085)

### Removed

- **Dead code cleanup — Wave 13 Phase 1** (2026-02-28 audit)
  - Remove 3 unused parameters: `columnWidth` from `generateDyeColumn`, `pairs` and `dyes` from `generateAnalysisSection` in `comparison-grid.ts` (DEAD-080)
  - Remove unused `ComparisonDye` interface and un-export `DyePair` interface in `comparison-grid.ts` (DEAD-079)
  - Remove unused `baseName` option from `HarmonyWheelOptions` interface — accepted but never rendered (DEAD-081)

## [1.1.1] - 2026-02-27

### Fixed

- **ESLint v10 compatibility**: Remove dead initializer (`hue`) in `harmony-wheel.ts` for `no-useless-assignment` rule

## [1.1.0] - 2026-02-21

### Added

- **REFACTOR-005**: New `truncateText()` and `estimateTextWidth()` shared utilities in `base.ts` with 11-test suite

### Fixed

- **BUG-012**: Fix CJK badge width miscalculation in dye-info-card — use `estimateTextWidth()` to account for full-width CJK characters in category badges
- **BUG-001**: Remove double XML escaping across 7 SVG generators — `escapeXml()` was called on values already escaped by tagged template literals, producing `&amp;amp;` in output

### Changed

- **REFACTOR-001**: Replace local `getColorDistance()` in `comparison-grid.ts` with `ColorService.getColorDistance()` from core
- **REFACTOR-005**: Standardize text truncation across all SVG generators — replace 3 inconsistent ellipsis styles with shared `truncateText()` utility using Unicode ellipsis

## [1.0.1] - 2026-02-21

### Changed

- Patch version bump for lint-only changes

## [1.0.0] - 2026-02-18

### Added

- Extracted SVG generators from the Discord worker into a shared package
- **Card generators:**
  - `generateDyeInfoCard` — single dye info card with color values (HEX, RGB, HSV, LAB)
  - `generateRandomDyesGrid` — grid of randomly selected dyes
  - `generateComparisonGrid` — side-by-side dye comparison
  - `generatePresetSwatch` — full preset swatch with all dye slots
  - `generateCompactPresetSwatch` — compact single-row preset swatch
- **Color tool generators:**
  - `generateHarmonyWheel` — color harmony wheel SVG
  - `generateGradientBar` — gradient bar with labeled steps
  - `generatePaletteGrid` — color match palette grid with quality labels
  - `generateAccessibilityComparison` — colorblind simulation comparison
  - `generateCompactAccessibilityRow` — compact accessibility view
  - `generateContrastMatrix` — WCAG contrast ratio matrix
  - `generateBudgetComparison` — market price comparison chart
- **Utility generators:**
  - `generateErrorSvg` — generic error message SVG
  - `generateNoWorldSetSvg` — "no world set" prompt SVG
- SVG primitive builders: `rect`, `circle`, `line`, `text`, `arcPath`, `group`, `createSvgDocument`
- Color utilities: `hexToRgb`, `rgbToHex`, `getLuminance`, `getContrastTextColor`, `escapeXml`
- Gradient utilities: `interpolateColor`, `generateGradientColors`
- Contrast utilities: `calculateContrast`, `getMatchQuality`
- Budget formatting: `formatGil`
- Shared constants: `THEME`, `FONTS`, `MATCH_QUALITIES`, `CATEGORY_DISPLAY`

---

[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/svg-v1.0.0
