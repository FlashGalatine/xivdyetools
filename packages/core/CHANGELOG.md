# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] — 2026-08-16

**Web-App / Discord 5.0 release.** 2.8.0 and 3.0.0 below were bumped mid-branch but never published — npm still has 2.7.0, so 4.0.0 is the first release carrying schema v2, the `/blending` subpath, *and* everything in this entry. Consumers upgrading from 2.7.0 must read all three entries.

### Changed — BREAKING

- **The 5.0 matching vocabulary** (`src/types/index.ts`) — one list suite-wide (web, Discord bot, og-worker, public API): `MatchingMethod = 'ciede2000' | 'oklab' | 'cie76' | 'redmean' | 'rgb' | 'distinguish'`, ordered as `MATCHING_METHODS`, with `DEFAULT_MATCHING_METHOD = 'ciede2000'` (one answer to "what does CLOSE mean") and `MATCHING_METHOD_TAGS` (`ΔE2000` / `ΔEOK` / `ΔE76` / `REDMEAN` / `RGB DIST` / `DISTINGUISH %`, plus a display-only `ratio: 'RATIO'` for the two tools that print WCAG contrast — RATIO is not a distance and never ranks). Tags are identifiers and never localise.
  - **Retired:** `'hyab'` and `'oklch-weighted'` as matching methods, plus the `OklchWeights` and `MatchingConfig` types, the `MATCHING_PRESETS` constant, and the `weights?` option on `FindClosestOptions` / `CharacterMatchOptions`. The HyAB / weighted-OKLCH math itself stays available on `ColorConverter` (`getDeltaE_HyAB`, `getDeltaE_OklchWeighted`; `DeltaEFormula` still includes `'hyab'`) — only the ranking vocabulary lost them.
  - **Migration:** run every stored/parsed value (KV preference, localStorage, URL `algo` param, API body) through `normalizeMatchingMethod(value)` — current values pass through, `LEGACY_MATCHING_METHOD_MAP` folds `hyab` / `oklch-weighted` → `ciede2000` and the informal deep-link `euclidean` → `rgb`, and anything else falls back to the default. `isMatchingMethod()` is the type guard.
  - **Defaults moved:** `DyeSearch.findClosestDye` / `DyeService.findClosestDye` and `CharacterColorService.findClosestDyes` now default to `ciede2000` (was `oklab`). Callers that relied on the implicit OKLAB ranking should pass `matchingMethod: 'oklab'` explicitly. (`findDyesWithinDistance`'s default followed suit later in the same unreleased version — see the `### Changed` entry below.)
  - `distinguish` ranks by the **unrounded** percent inside `DyeSearch` / `CharacterColorService` (identical ranks to RGB DIST, so display ties can never scramble an ordering); the display-rounded integer comes from `ColorService.getDistanceForMethod` / `getDistinguishabilityPercent`.
- **`presets.json` 2.0.0 — curated palettes are stainID-keyed.** `PresetPalette.dyes` now holds **stainIDs** (3–6 per palette; was itemIDs, 2–5) and `PresetService.getPresetWithDyes()` / `resolvePresets()` resolve through `dyeService.getByStainId()` — the internal `IDyeService` contract now requires `getByStainId` alongside `getDyeById`. The curated set is 44 → **15 rows** (Grand Companies 3, Seasons 4, Events 8 — Little Ladies' Day and All Saints' Wake added; the Jobs and Aesthetics curated rows were cut, both categories stay submittable), with rewritten EN descriptions. A `curated parity` test asserts every curated stainID resolves (the silent-null guard). Localised names/descriptions/tags for the 15 rows live in the web-app locales as `preset.<id>.*`, not in core.
- **`'community'` is no longer a `PresetCategory`** (community-ness is a *source*, not a category — `@xivdyetools/types` 2.0.0). `presets.json` categories are now **8**: `jobs`, `grand-companies`, `seasons`, `events`, `aesthetics`, and the new `appearance` (a character's own colours — deliberately *not* `character`, which is the CollectionService record kind), `zones`, `raids-trials` (excludes dungeons; primals are descriptions inside it, never "duties"), each with name/description/icon metadata.
- **`SubRace` `'Helion'` → `'Helions'`** (matches the `.chara` files and the game's plural; `@xivdyetools/types` 2.0.0). `character_colors.json` + the split race-specific hair/skin files re-key their Hrothgar entries, `build-locales.ts` fallback tables and all six locale JSONs use the `helions` clan key, and `parseCharaFile` stores the plural while still accepting the pre-5.0 `'Helion'` as a read alias. Consumers persisting a subrace must migrate the stored value on read.
- **Band-vocabulary method ids** unified with `MatchingMethod` (`de2000` / `deok` / `de76` / `rgbdist` → `ciede2000` / `oklab` / `cie76` / `rgb`). Only relevant if you consumed the band table from an intermediate branch build — no npm release ever carried the old ids.

### Added

- **`PaletteExtractionOptions.matchingMethod`** — `PaletteService.extractAndMatchPalette()` forwards it to `DyeService.findClosestDye()` so a caller can pick each extracted colour's nearest dye under any of the six methods; omitted → the search's own default (`DEFAULT_MATCHING_METHOD`, ΔE2000). Additive; the k-means options are unchanged
- **Distance primitives** (`ColorConverter` + `ColorService` facade): `getRedmeanDistance` (weighted-RGB approximation, 0 – ~765), `getDistinguishabilityPercent` (RGB distance rescaled to an integer 0–100 — a display unit with identical ranks to RGB DIST, kept for continuity with the Accessibility readout; not WCAG), and `ColorService.getDistanceForMethod(hex1, hex2, method)` — the one dispatch every surface shares for a value in a method's native unit.
- **`ColorManipulator.rotateHueLch` / `ColorService.rotateHueLch`** — perceptual hue rotation in CIE LCh (preserves perceived lightness and chroma; out-of-gamut results clamp), the basis for harmony ideal-hue math on the og-worker cards.
- **Machado et al. (2009) severity-1.0 CVD matrices** — `MACHADO_MATRICES` constant plus `ColorblindnessSimulator.simulateColorblindnessMachado` / `…MachadoHex` (and `ColorService` mirrors) running a linear-RGB pipeline (sRGB linearise → matrix → re-encode). The legacy gamma-domain Brettel path (`BRETTEL_MATRICES`, `simulateColorblindness`) is untouched. The 5.0 band calibration's SEPARATION cuts were computed against Machado 1.0 lenses, which core previously could not reproduce.
- **Calibrated 5.0 band vocabulary** (`src/config/band-vocabulary.ts`, generated by `scripts/calibrate-bands.ts` from the algorithm in `band-calibration.ts` and guarded by `band-vocabulary.parity.test.ts`, which recomputes it from `dyes.json` so a data change fails loudly until re-blessed): `BAND_VOCABULARY[context][method]` tier cuts for `match` / `harmony` / `separation` × all six methods (ΔE2000 rows are the settled ground truth — MATCH 5/10/20 · HARMONY 6/12/20 · SEPARATION 8/15/30; the others are accuracy-optimal cuts scored on display-rounded values; DISTINGUISH % derives from RGB DIST via `deriveDistinguishCuts`), `BAND_METHOD_DP`, `RATIO_BANDS` (Comparison `1/1/1` — the literal "unreachable through lightness" finding — and Accessibility `1/1.29/3`, anchored at WCAG 1.4.11's 3:1), `SEPARATION_TIER_KEYS` (`merged` / `tight` / `workable` / `clear`), `classifyBandTier(value, method, context)`, `classifyBandTierWithCuts` (for ΔE2000 with a user-moved match line), `roundToBandDisplay`, and the calibration API (`calibrateBandVocabulary`, `DE2000_GROUND_TRUTH`, `METHOD_DISPLAY_DP`; types `BandContext` / `BandMethod` / `BandTier` / `MethodBandSet` / `BandCalibrationResult` / `CalibratedMethodId` / `CalibratedMethodBands` / `RatioCalibration`). Standing rules: print the method wherever a tier appears; never compare a tier across methods; only ΔE2000's bands follow the user's match line.
- **`.chara` character-file import** (`src/services/chara/`, the parse rules the 5.0 Swatch Matcher and the bot's `/swatch` share):
  - `parseCharaFile(text)` → `ParsedCharaFile` — key-presence parsing (never trusts `TypeName`), crossed eye keys (`REyeColor` is the LEFT eye), linear-RGB extended floats gamma-encoded, flag gating (`EnableHighlights` false / `FacePaint` 0 / Hrothgar fur-pattern lip → `CharaSlotInertReason`), `MouthColor` alpha as continuous lip opacity, gear `DyeId` / `DyeId2` as stain IDs, `Base64Image` never read, and loud `AppError`s naming got-vs-expected for an unrecognised race/tribe/gender or for a JSON carrying none of the fifteen colour fields (the WRONG-KIND refusal — float-only files still parse).
  - `resolveCharaColors(parsed, lookup)` → `ResolvedCharaCharacter` — index-vs-float arbitration (live floats only with `IsExtendedAppearanceValid`; more than `OFF_GRID_DELTA_E2000 = 6` apart = `offGrid` with both hexes named; missing flag = index wins), 0–95 / 128–223 dark-light sheet split with a loud 96–127 failure, lip composite over skin (raw + `blendHex` with alpha), limbal-vs-tattoo labelling, `R#.C#` grid addresses, shared-index eye merge signal, gear dyes resolved via a `StainIdLookup` (`getByStainId`). Slot verdicts: `index` / `offGrid` / `floatOnly` / `inert` / `error`. Types: `CharaSlotId`, `CharaGearSlotId`, `CharaColorSlotRaw`, `CharaGearDye`, `ResolvedCharaSlot`, `ResolvedGearDye`, `CharaSlotVerdict`, `CharaSlotErrorCode`.
  - Four measured fixtures under `services/chara/__tests__/fixtures/` (Duskwight heterochromia, Hrothgar Helions, Wildwood face paint, Xaela Anamnesis header). `Race` is now re-exported by `@xivdyetools/types` because the parser's public API needs it.
- **`/manual` topic roster + learn-more links** (`src/config/learn-links.ts`): `MANUAL_TOPICS` (`match_image`, `color_vision`, `contrast`, `matching_methods`, `spectrum_prices`, `character_file`) with per-locale authorities (NEI / Portal der Augenmedizin / Wikipédia Daltonisme / 日本眼科医会 / KDCA for colour vision — ZH deliberately open; WCAG 1.4.11 only in its endorsed en/fr/zh translations), `getLearnLink(topic, locale)` (absent locale = `null`, never English), `LODESTONE_BY_REGION` + `getLodestoneLink(region)` keyed by game region (`na` / `eu` / `jp` / `de` / `fr`) not locale, and `XIVDYETOOLS_DOCS_URL`. All URLs liveness-checked 2026-08-07.
- **`abbreviateDyeName(name, locale)`** (`src/utils/`) — the three-character axis code for the bot's comparison triangle and contrast plot, hoisted from two identical bot-logic copies. Uppercases *before* slicing (`'ß'.toUpperCase()` is `'SS'`), strips punctuation (`Ul'dahbrauner` → `ULD`), and keeps the first three glyphs for ja/zh/ko. Codes are deliberately not unique.
- **`SOCIAL_LINKS` / `PRODUCT_LINKS`** (`src/config/product-links.ts`, `ProductLink` type) — the one home for the seven social links and the web-app / invite-bot URLs printed by both the web About modal and the bot's `/about` (the bot had been advertising the pre-monorepo `xivdyetools-discord-worker` repo). Label + URL only; icons stay with the surface.
- `PresetService.searchPresets(query, dyeService?)` — with a dye service, a palette also matches on the names of the dyes it contains ("search presets, dyes, tags").
- Tests: coverage gate raised to 90 % on all four metrics (branches 85 → 90 in `vitest.config.ts`); new suites for the facewear legacy-ID map, the matching-method vocabulary, `APIService` construction, explicit-locale `LocalizationService` calls, `TranslationProvider` optional sections and `CharacterColorService`; `performance-benchmarks.test.ts` now times the CIEDE2000 exact scan and the RGB k-d tree separately and states the P-7 claim as a ratio (the old "k-d tree" budget was timing the linear scan — CI's ~5× contention over local was not a regression).

### Changed

- **`DyeSearch.findDyesWithinDistance` / `DyeService.findDyesWithinDistance` now default `matchingMethod` to `ciede2000`** (was `rgb`), matching `findClosestDye`'s default and completing the "one answer to what CLOSE means" migration this version started (see the **Defaults moved** bullet above). `maxDistance` is interpreted in the chosen method's native scale, so a caller that depended on the RGB-Euclidean radius must now pass `matchingMethod: 'rgb'` explicitly.
- `README.md` / `CLAUDE.md` rewritten for the branch state (scoped package name, 125-dye schema v2 database + Facewear collection, `getMarketItemID` in the market-board example, `/blending` subpath, licensing/legal notice, Blog link dropped) — docs only.

### Fixed

- `config/facewear.ts` dropped an unnecessary type assertion that failed `turbo run lint` workspace-wide (and therefore CI for everything downstream of core).
- `parseCharaFile` refuses a JSON document that carries none of the fifteen character-colour fields by name, instead of resolving eight dashed slots that read as a valid character wearing nothing (ordered after the race/tribe/gender mapping so a bad tribe still gets its own message).

### Removed

- `MATCHING_PRESETS`, `OklchWeights`, `MatchingConfig` exports and the `weights` option on `FindClosestOptions` / `CharacterMatchOptions` (see BREAKING above).
- The `'community'` preset category and 29 curated palette rows (see BREAKING above).
- `packages/core/CHANGELOG-laymans.md` — plain-language notes now live in the root `CHANGELOG-laymans.md` (product-level, all three surfaces).

### Removed (2026-08-18 dead-code audit)

- `src/data/character_colors.json` — the pre-split 798 KB monolith. `CharacterColorService` has imported only the split `src/data/character_colors/` files (`index.json`, `shared/*.json`, `race_specific/*.json`) since the schema-v2 split; the monolith had no importer left and was being hand-maintained by mistake (DEAD-028).
- **Dead constants** (DEAD-030): `VISION_TYPES`, `VISION_TYPE_LABELS`, `API_DEBOUNCE_DELAY`, `PATTERNS.RGB_COLOR` member, and `SEPARATION_TIER_KEYS` (`config/band-vocabulary.ts`) — zero references anywhere in the workspace. `COLOR_DISTANCE_MAX` stays defined (still used internally by `band-vocabulary.ts`/`ColorConverter`/`DyeSearch`) but drops off the public barrel — it was `@internal` and had no external consumers.
- **Orphan tooling** (DEAD-031): `test-build.mjs` (unwired smoke script), the TypeDoc setup (`typedoc.json`, the `docs` script, the `typedoc` devDependency — `typedoc-plugin-markdown` was already removed in the prior 4.0.0 entry), and the entire `VERSION` build step — `src/version.ts`, `scripts/generate-version.ts`, the `build:version` script and its place in `build`, and the barrel's `export { VERSION }`. `VERSION` had zero in-monorepo importers (the web-app's `VERSION` hits were an unrelated locale label).
- **`/blending` test-only exports** (DEAD-033): `getBlendingModeDescription` (its copy had drifted from `BLENDING_MODES[].description`) and the `rgbToLab` re-export (external callers use `ColorService.rgbToLab`).
- **11 dead `utils` helpers + `AsyncLRUCache`** (DEAD-029, ~500 lines incl. tests): `lerp`, `distance`, `unique`, `groupBy`, `sortByProperty`, `filterNulls`, `isString`, `isNumber`, `isArray`, `isObject`, `isNullish` — zero core-internal or external callers — and the test-only `AsyncLRUCache` (never barrel-exported; `LRUCache` remains the live cache). `CLAUDE.md` and `README.md` updated (dropped the `lerp` example).
- **Band-calibration barrel leak** (DEAD-032): dropped `calibrateBandVocabulary`, `DE2000_GROUND_TRUTH`, `METHOD_DISPLAY_DP`, and the `BandCalibrationResult` / `CalibratedMethodId` / `CalibratedMethodBands` / `RatioCalibration` types from the top-level barrel — `scripts/calibrate-bands.ts` and `band-vocabulary.parity.test.ts` already imported `config/band-calibration.js` directly, so the module is unaffected, only its runtime import graph (`ColorConverter`/`ColorblindnessSimulator`/`ColorAccessibility`) stops leaking into every barrel consumer. `METHOD_DISPLAY_DP` folded into `BAND_METHOD_DP` (values agreed for all 4 shared methods: oklab 3dp, cie76/redmean/rgb 1dp). Added `"calibrate:bands": "tsx scripts/calibrate-bands.ts"` to `package.json` so the manual recalibration path is discoverable. `RATIO_BANDS` stays exported (KEEP).
- **Dead locale sections** (DEAD-036): `metallicDyeIds`, `jobNames`, `grandCompanyNames` sections dropped from all six generated locale JSONs (regenerated via `build:locales`, not hand-edited — `git diff --stat` shows only these three sections gone from each file), their `LocalizationService`/`TranslationProvider` accessors (`getMetallicDyeIds`, `getJobName`, `getGrandCompanyName`), the `build-locales.ts` builders (`buildJobNames`, `buildGrandCompanyNames`, `identifyMetallicDyes`), and `JobKey`/`GrandCompanyKey` (moved out of `@xivdyetools/types` in lockstep, along with the corresponding `LocaleData` fields). Superseded by `METALLIC_STAIN_IDS` (already the source `DyeDatabase` uses) with zero external callers of the accessors.
- **~40 uncalled class methods + 4 legacy overload arms** (DEAD-034/035, Wave 3f): every listed method was verified to have zero callers outside its own facade wrapper and tests before removal.
  - `APIService`: `getPricesForItems`, static `getPriceTrend`, `getCacheStats`/`resetMetrics` + the `CacheMetrics` type and the now-write-only hit/miss/eviction/error counters. `getPricesForDataCenter` is unaffected and is now the only batch-fetch entry point.
  - **Legacy constructor arm removed** (DEAD-035): `APIService`'s positional `(cache, fetchClient, rateLimiter)` shape and its `isOptionsObject` sniffing guard — the constructor now takes a single `APIServiceOptions` object. All in-repo callers already used the options form.
  - `DyeService`/`DyeDatabase`: `getDyesByIds`, `getDyesByStainIds`, `getLastLoadedTime` (and the now-write-only `DyeDatabase.lastLoaded` field). `DyeService`/`DyeSearch`: `getDyesSortedByBrightness`/`…BySaturation`/`…ByHue`. `DyeService`/`HarmonyGenerator`: `findCompoundDyes`, `findShadesDyes`. `DyeService`: `getLocalizedDyeById`, `getLocalizedDyeByStainId`, `getAllLocalizedDyes`, `getNonMetallicDyes` (apps localise via `LocalizationService.getDyeName` and filter on `Dye.isMetallic` directly).
  - **Legacy overload arms removed** (DEAD-035): `DyeSearch.findClosestDye`/`DyeService.findClosestDye` no longer accept a bare `excludeIds: number[]` — only `FindClosestOptions`. `DyeSearch.findDyesWithinDistance`/`DyeService.findDyesWithinDistance` no longer accept a bare `maxDistance: number` + trailing `limit?: number` — only `FindWithinDistanceOptions`. In-core callers migrated: `HarmonyGenerator`'s internal `findClosestNonFacewearDye` helper and `CharacterColorService.findClosestDye`'s delegation to `findClosestDyes`. At the time this task landed, `findDyesWithinDistance`'s `matchingMethod` default was still `'rgb'` (kept for backwards compatibility per `DyeSearch.ts`) — this task only fixed the one stale caller that omitted it (`discord-worker`'s `extractor.ts`, below); the default itself moved to `ciede2000` in a later follow-up within this same unreleased version — see the top-level `### Changed` entry.
  - `ColorService`: `mixColorsOklch`, `mixColorsLch`, `mixColorsHsv` (the live `MixingMode` union never included these three; `mixColorsHsl` stays, it backs `hsl`). `ColorService`/`SpectralMixer`: `mixMultipleSpectral`/`SpectralMixer.mixMultiple`, `gradientSpectral`/`SpectralMixer.gradient`, `isSpectralAvailable`/`SpectralMixer.isAvailable` — only `mixColorsSpectral`/`SpectralMixer.mixColors` had a caller.
  - `ColorConverter.getDeltaE_HyAB` (instance + static) and the `'hyab'` member of `DeltaEFormula` (plus its `getDeltaE` case) — corrects the 4.0.0 entry above, which said this math "stays available"; it did not have a caller. `'hyab'` survives only as a legacy `MatchingMethod` string token that `normalizeMatchingMethod`/`LEGACY_MATCHING_METHOD_MAP` fold to `'ciede2000'` (og-worker/discord-worker/api-worker still accept it on input) — unrelated to `DeltaEFormula`, unaffected.
  - `PresetService`: `getPresetCountByCategory`, `getPresetsByTag`, `resolvePresets`, `getVersion`, `getLastUpdated`, `getPresetCount` (the sole consumer is web-app's own `hybrid-preset-service.ts`, which doesn't call these; `presets.json`'s `version`/`lastUpdated` fields are untouched data, just no longer read by this class).
  - `CharacterColorService`: `preloadRaceData`, `getSharedColorByIndex`, `getRaceSpecificColorByIndex`, `getAvailableSubraces`, `getVersion`, `getGridColumns`.
  - **Legacy overload arm removed** (DEAD-035): `CharacterColorService.findClosestDyes`'s `countOrOptions: number | CharacterMatchOptions` narrowed to `options: CharacterMatchOptions` only; the in-core `findClosestDye` → `findClosestDyes(color, dyeService, 1)` call migrated to `{ count: 1 }`.
  - `PaletteService.pixelDataToRGB` (apps use `pixelDataToRGBFiltered`).
  - `KDTree.getSize` (test-only; `isEmpty()` remains).
  - **Stale-default fix**: `discord-worker`'s `extractor.ts` deduplication path called `findDyesWithinDistance` without `matchingMethod`, silently falling back to the RGB-radius default while its primary match used the user's chosen method — now passes `matchingMethod` explicitly.
- **Inline clamps replaced with the exported `clamp()`** (DEAD-037, Wave 4a — pure refactor, no behaviour change): `blending/conversions.ts`'s six `Math.round(Math.max(0, Math.min(255, …)))` 0–255 clamps (LAB/OKLAB/RYB/Kubelka-Munk RGB conversions), `services/chara/chara-parser.ts` and `services/chara/chara-resolver.ts`'s `linearToSrgb255` 0–1 clamps, `services/chara/chara-resolver.ts`'s lip-alpha clamp, and `services/color/ColorConverter.ts`'s private `linearToSrgb`'s 0–1 clamp. `clamp()`'s `Math.min(Math.max(value, min), max)` is arithmetically identical to every inline `Math.max(min, Math.min(max, value))` / `Math.min(max, Math.max(min, value))` ordering replaced (including the shared NaN-propagates behaviour) — no new test needed, the existing suites for all four files are unchanged and green.

### Changed (2026-08-18 dead-code audit)

- **`DeltaEFormula` gains `'ciede2000'`; `'cie2000'` is now a legacy alias** (DEAD-037, Wave 4b). `'ciede2000'` — the spelling `MatchingMethod` already uses — is canonical, so a `MatchingMethod` can be handed straight to `ColorConverter.getDeltaE()` with no translation in between. `'cie2000'` stays in the union and keeps working: the new `normalizeDeltaEFormula()` folds it onto `'ciede2000'` at the `getDeltaE` entry point (and in `HarmonyGenerator`, where the formula selects the 25-vs-40 default `deltaETolerance`), so `getDeltaE(a, b, 'cie2000') === getDeltaE(a, b, 'ciede2000')` for every input — pinned by a new alias suite in `ColorConverter.test.ts`. **No call site has to change.** The three spelling-translation switches this removes are `DyeSearch.calculateDistance`, `ColorService.getDistanceForMethod` and `CharacterColorService.calculateDistanceWithMethod`, whose `'cie76' | 'ciede2000' | 'oklab'` arms now collapse to one `getDeltaE(hex1, hex2, method)` call. `normalizeDeltaEFormula` / `CanonicalDeltaEFormula` are core-internal and deliberately **not** re-exported from the package root.
- **`blending/conversions.ts` is staying** — the `DEPRECATIONS.md` follow-up "unify duplicated conversions with ColorService inside core" is **declined, not deferred** (DEAD-037, Wave 4b). A new permanent guard, `src/blending/conversions.equivalence.test.ts`, compares every helper against its `ColorConverter` / `RybColorMixer` counterpart over all 125 dye hexes plus the suites' vectors (86,319 interpolated samples per inverse helper). Only `hexToRgb` and `oklabToRgb` are bit-identical; the rest carry real numeric deltas — core rounds LAB to 4 dp, OKLAB to 6 dp and HSL to 2 dp on a 0–100 scale, its LAB inverse uses κ=903.3 where blending uses the 7.787 linear segment, its `rgbToHex` emits uppercase, and `RybColorMixer` is the Gossett-Chen solver rather than blending's approximation. Unifying them would move `blendColors()` output on real dye pairs (proven for `lab` and `hsl`, and on essentially every pair for `ryb`), i.e. every rendered gradient, mixer result and bot card. The test now pins those deltas so nobody unifies them by accident.

## [3.0.0] — 2026-07-31

**Schema v2** (Monorepo 2.0; spec: docs/research/monorepo-2.0/01-dye-data-format.md).

### Added

- **Inverted Tetradic harmony** — `findInvertedTetradicDyes` on `HarmonyGenerator`/`DyeService` (offsets `[120, 180, 300]`, the mirror rectangle of tetradic) + `invertedTetradic` in `HarmonyTypeKey` and all six locale `harmonyTypes` blocks.
- **Dye vocabulary module** (`src/config/dye-vocabulary.ts`, ported from the retired `apps/maintainer` GUI's validation role — preserve-first): `DYE_CATEGORIES`, `DYE_ACQUISITIONS`, `ACQUISITION_META` (acquisition → price/currency coupling), `METALLIC_STAIN_IDS`, and types `DyeCategory` / `DyeAcquisition` / `AcquisitionMeta` — the single source of truth for the closed vocabularies (the maintainer's own copies had drifted: 8 of its 10 acquisition values appeared in zero dyes). `dye-vocabulary.test.ts` pins the data invariants against the live data file: vocabulary membership, price/currency coupling, unique `stainID`s (the GUI never checked stainID), hex validity and the `consolidationType` domain.
- `getFacewearColor(slug)` alongside `facewearColors` (see the Facewear split below).
- **CMYK conversions** — `rgbToCmyk` / `cmykToRgb` / `hexToCmyk` / `cmykToHex` on `ColorConverter` and the `ColorService` facade, with a `CMYK` interface in `@xivdyetools/types` 1.16.0. Naive device-independent formula (display/reference values, not print production). Completes the derived-format set now that the data file stores only `hex` (RGB, HSV [= HSB], HSL, and Lab already existed).

### Changed — BREAKING

- **`colors_xiv.json` (136 entries × 16 fields) → `dyes.json` (125 entries × 7 fields, stainID-keyed)**: `stainID, name, hex, category, acquisition, consolidationType, legacyItemID`. `rgb`/`hsv`/`lab`/`cost`/`currency` and all five flags are now derived at `DyeDatabase.initialize()` — the **runtime `Dye` object keeps its full 16-field shape**, so consumers of dye objects are unaffected. Legacy runtime-shaped input (test fixtures) still initializes, with explicit field values respected.
- **The 11 Facewear entries left the dye database** → new `facewearColors` export (`FacewearColor` type in @xivdyetools/types 1.16.0), with `LEGACY_FACEWEAR_ITEM_IDS` (frozen pre-v2 synthetic-ID map) and `getFacewearColorByLegacyItemID()` for compatibility. `getAllDyes()` now returns 125; the synthetic negative-ID mechanism is deleted.
- **`isMetallic` is now the Stain sheet's gloss set** (`METALLIC_STAIN_IDS`, 16 dyes — adds Gunmetal Black + Pearl White vs the old name-prefix 14). `getNonMetallicDyes()` returns 120 (was 122).
- **`isCosmic` ≡ `consolidationType === 'C'`** (11 dyes, was 20 — the 9 Firmament dyes are no longer mislabeled cosmic); `isIshgardian` ≡ `'B'` (unchanged membership).
- `hex` is now required and is the single color source of truth; the Brass stored-HSV drift bug is fixed by construction. Data-file hex is lowercase-mandated (enforced by the invariant tests).
- `DYE_CATEGORIES` (8, `Facewear` removed) / `DYE_ACQUISITIONS` (4) / non-nullable `ACQUISITION_META`.
- `build-locales.ts` metallic set now derives from `METALLIC_STAIN_IDS` (emits byte-identical `metallicDyeIds`); `fetch_dye_names.py` and the emoji upload script re-pointed at `dyes.json` (both had pre-monorepo broken paths).

## [2.8.0] — 2026-07-31

Monorepo 2.0 Tier 1 package consolidation.

### Added

- Absorbed `@xivdyetools/color-blending` v1.1.0: the self-contained blending module (`blendColors`, `BLENDING_MODES`, `BlendingMode`, `rgbToLab`, six algorithms incl. Kubelka-Munk spectral) now lives at `src/blending/` and is published as the `@xivdyetools/core/blending` subpath export. The standalone package is retired — the API is identical, only the import specifier changes. Follow-up: unify its deliberately-duplicated conversions with `ColorService` (REFACTOR-005 context; see docs/research/monorepo-2.0/05 §2).
- `package.json#exports` map (`.`, `./blending`, `./package.json`). No consumer deep-imports core paths (verified repo-wide), so this is non-breaking.

### Changed

- **`scripts/build-locales.ts` is now idempotent.** Before writing each locale, it compares the freshly built payload against the file already on disk, ignoring `meta.generated`. When nothing else differs the existing file is left untouched — same bytes, same mtime — so rebuilding from unchanged sources no longer dirties all six locale JSONs. Previously every build re-stamped the timestamp, which meant a full `pnpm turbo run build` always produced six spurious modifications and buried real locale changes in churn. `meta.generated` now marks when the locale data last *changed* rather than when the build last ran; the field remains a required ISO string on `LocaleData`, so there is no API or consumer impact. Comparison is key-order-insensitive because `JSON.parse` of an existing file and a freshly built payload do not agree on key ordering for non-integer keys (e.g. synthetic negative Facewear IDs).

### Fixed

- `CONSOLIDATED_DYES` Type-B (Wide Spectrum #1 Dye, itemID 52255) costs **100 Skybuilders' Scrips** (verified in game), not 1000 "Sky Builders' Scrips" — price and currency spelling now match the individual Firmament dyes.

### Removed

- `src/data/colors_xiv.csv` — the CSV mirror had zero readers at build or runtime and had already drifted from the JSON (Ixali Vendor row, a price 40, a phantom `itemID_consolidated` column). `dyenames.csv` (the locale-name source) is unaffected.

## [2.7.0] — 2026-07-19

2026-07-18 audit remediation (Sprint 4).

### Fixed

- **REFACTOR-003**: perceptual dye search (`DyeSearch`) uses an exact linear scan for perceptual distance methods — the previous k-d-radius approach could return an in-radius worse dye while the true nearest sat outside the radius (proven by the new `DyeSearch.parity.test.ts`).
- **BUG-005**: `ColorConverter`'s LRU caches return defensive copies, so callers mutating a returned RGB/HSV/LAB object can no longer poison the process-wide cache.
- **REFACTOR-014**: `hexToRgb` uses one normalization pass as both cache key and parse source (was computed twice, asymmetrically).
- `APIService` batches Universalis requests above the 100-item API limit (previously a latent failure for >100-item queries).

### Changed

- Assorted `ColorManipulator`, `LocalizationService`, `DyeService`, and `DyeDatabase` audit fixes from the Sprint 4 batch (see `docs/audits/2026-07-18/` finding Status sections for details).

## [2.6.0] — 2026-04-29

### Removed

- **`ALLIED_SOCIETY_ACQUISITIONS` constant** + corresponding branch in `isDyeExcluded` / `hasActiveFilters`, the constant's re-export from the package index, and the 5 vendor entries (`Amalj'aa Vendor` / `Ixali Vendor` / `Sahagin Vendor` / `Kobold Vendor` / `Sylphic Vendor`) from each locale's `acquisitions` map. Patch 7.5 dye consolidation collapsed those acquisition rows out of `colors_xiv.json`; the filter and translations were already dead code (the contract test added in `[Unreleased]` had `it.skip.each`'d these assertions for exactly this reason). Co-removed with `DyeTypeFilters.excludeAlliedSocietyDyes` from `@xivdyetools/types@1.14.0`. Tests in `DyeFilter.test.ts` covering the constant and its filter branch are removed; `DyeFilter.contract.test.ts` keeps a "History:" comment pointing to this entry so future readers understand why the assertions are gone.

### Added

- **ARCH-002 Facewear invariants test** (2026-04-28 audit): New `src/services/dye/__tests__/Facewear.invariants.test.ts` (5 cases) pins the synthetic-ID contract end-to-end against the live `colors_xiv.json` data:
  - Every Facewear dye carries a negative synthetic itemID (raw `null` is rewritten on `DyeDatabase.initialize`).
  - The Facewear count remains 11 (matches CLAUDE.md / project memory).
  - No two synthetic IDs collide.
  - All non-Facewear dyes keep positive itemIDs.
  - The canonical `dye.itemID > 0` filter (per the 2026-02-05 budget bug fix) cleanly partitions the tradeable set from Facewear.
- **REFACTOR-001** (2026-04-28 audit): Three new translation surfaces to support og-worker localization:
  - `tools` — 6 web-app tool display names (Harmony Explorer / Gradient Builder / Dye Mixer / Swatch Matcher / Dye Comparison / Accessibility Checker), translated for all 6 locales
  - `visions` — compact vision-name forms (e.g. just "Deuteranopia" / "2型色覚") for OG embed titles, sibling to the existing verbose `visionTypes`
  - `sheets` — 9 Swatch Matcher color-sheet categories (Eye Colors, Highlights, Lip Colors Dark/Light, Tattoo/Limbal, Face Paint Dark/Light, Hair Colors, Skin Colors)
- New `TranslationProvider` methods `getToolName(key, locale)`, `getVisionShort(key, locale)`, `getSheetName(key, locale)` plus mirrored static + instance methods on `LocalizationService`.
- New top-level exports for stateless callers: `LocaleLoader`, `LocaleRegistry`, `TranslationProvider`, `SUPPORTED_LOCALES`, `extractLocaleCode`, `resolveLocaleFromPreference`. Lets workers like og-worker preload all 6 locales and make explicit-locale translation calls without relying on the `LocalizationService.setLocale()` mutable-singleton pattern (which is racy under concurrent requests with different locales).

- **BUG-003 contract test** (2026-04-28 audit): New `src/services/dye/__tests__/DyeFilter.contract.test.ts` validates that every value in `VENDOR_ACQUISITIONS` and `CRAFT_ACQUISITIONS` exists in the live `colors_xiv.json` acquisition set. Auto-detects future renames the same way the 2026-04 `'Crafting'` → `'The Firmament'` drift went unnoticed in tests. (An earlier revision also asserted `ALLIED_SOCIETY_ACQUISITIONS` via `it.skip.each` after discovering all 5 vendor names were absent from live data; both the assertions and the constant itself were removed in this release — see "Removed" above.)

### Changed

- **REFACTOR-001 locale rebuild** (2026-04-28 audit): Re-ran `pnpm build:locales` after extending `build-locales.ts` with the three new translation builders; all 6 locale JSONs now contain `tools`, `visions`, and `sheets` keys.

### Fixed

- **BUG-002** (2026-04-28 audit): `TranslationProvider.getDyeName(itemID, locale)` now returns localized names for the three Patch 7.5 consolidated itemIDs (52254 / 52255 / 52256). The CSV-driven locale registry doesn't contain these items (their metadata lives in `CONSOLIDATED_DYES`), so the lookup previously fell off the end and returned `null`. After the locale + English fallbacks, the method now consults `CONSOLIDATED_IDS` / `CONSOLIDATED_DYES` as a last resort. 4 new test cases in `TranslationProvider.test.ts` cover all three Type-A/B/C IDs across multiple locales.
- **BUG-003** (2026-04-28 audit): Replaced 8 stale `acquisition: 'Crafting'` instances with `'The Firmament'` across four dye test fixture files (`DyeDatabase.test.ts`, `DyeService.test.ts`, `DyeSearch.test.ts`, `HarmonyGenerator.test.ts`). Tests passed today only because no fixture exercised the `excludeCraftDyes` path; a future test that did would have silently false-passed against `'Crafting' !== 'The Firmament'`.

---

## [2.5.0] - 2026-04-28

### Added

- `CONSOLIDATED_DYES` config — full metadata for the three Patch 7.5 consolidated dye items: itemID, localized names in all 6 languages, acquisition source, price, currency
- `getConsolidatedDyeName(type, locale)` helper — returns the localized name; the `?? names.en` fallback is retained as a safety hatch for any future unsourced locale strings
- New types `ConsolidationType`, `ConsolidatedDye`, `LocalizedDyeName` exported from package index
- Korean and Chinese names for all three consolidated dyes (Standard Spectrum Dye / Wide Spectrum #1 Dye / Wide Spectrum #2 Dye)
- 6 unit tests covering `CONSOLIDATED_DYES` shape (en + ko/zh), localized name lookup, mocked-null fallback coverage, and itemID propagation from `CONSOLIDATED_IDS`

### Changed

- **Patch 7.5 dye consolidation is now active**: `CONSOLIDATED_IDS` populated with real itemIDs (A=52254 Standard Spectrum Dye, B=52255 Wide Spectrum #1 Dye, C=52256 Wide Spectrum #2 Dye). `isConsolidationActive()` now returns `true`, and `getMarketItemID()` collapses every consolidated dye to its 1-of-3 market ID

---

## [2.4.0] - 2026-04-03

### Added

- `isDyeExcluded()`, `filterDyes()`, `hasActiveFilters()` — pure filter functions for `DyeTypeFilters`
- `EXPENSIVE_DYE_IDS`, `VENDOR_ACQUISITIONS`, `CRAFT_ACQUISITIONS`, `ALLIED_SOCIETY_ACQUISITIONS` acquisition constants in new `DyeFilter.ts` module
- 25 unit tests for dye filter functions

---

## [2.3.0] - 2026-04-01

### Added

- `DyeService.getByStainId(stainId)` — facade method for single dye lookup by stainID, delegating to `DyeDatabase.getByStainId()`
- `DyeService.getDyesByStainIds(stainIds)` — batch stainID lookup, mirrors existing `getDyesByIds()` pattern
- `DyeService.getLocalizedDyeByStainId(stainId)` — stainID lookup with localized name resolution
- `DyeDatabase.getDyesByStainIds(stainIds)` — batch O(1) Map-based stainID lookup, skips unknown IDs

### Why

Post-Patch 7.5 (April 28, 2026), new dyes may only have stainIDs without individual itemIDs due to dye consolidation. These methods ensure apps built on `@xivdyetools/core` can look up dyes by stainID through the public `DyeService` facade, rather than bypassing it to access `DyeDatabase` directly. Supports plugin interop (Glamourer, Mare Synchronos) and future-proofs the API.

---

## [2.2.0] - 2026-03-18

### Changed

- **BUG-006**: Extracted `moveToEnd` helper in `LRUCache` and `AsyncLRUCache` for clarity; added documentation explaining thread-safety of synchronous Map operations within a single microtask
- **BUG-007**: Added documentation to `TranslationProvider` clarifying the intentional truthiness-based fallback strategy for locale lookups
- **REFACTOR-005**: Changed `getDyesInternal()` return type from `DyeInternal[]` to `readonly DyeInternal[]` for compile-time safety; no runtime impact, all callers already spread or use read-only operations
- **REFACTOR-006**: Added stability warnings to `@internal` character color data exports — consumers should use `CharacterColorService` for stable API access
- **BUG-003**: Replaced non-null assertion (`!`) in `DyeDatabase.initialize()` hue bucket accumulation with local variable pattern; no behavior change
- **BUG-011**: Added null/undefined guard to `DyeSearch.searchByName()` for defensive handling of untyped callers

### Performance

- **OPT-003**: Cache eviction deletes in `APIService.getCachedPrice()` are now fire-and-forget, eliminating unnecessary request-path blocking

---

## [2.1.0] - 2026-03-14

### Added

- `consolidated-ids.ts` config module with `CONSOLIDATED_IDS`, `isConsolidationActive()`, and `getMarketItemID()` for Patch 7.5 dye consolidation
- Exported `getMarketItemID`, `isConsolidationActive`, `CONSOLIDATED_IDS` from package index
- `consolidationType` and `isIshgardian` fields to all 136 dye entries in `colors_xiv.json`
- `isIshgardian` column to `colors_xiv.csv`

### Changed

- `DyeDatabase.initialize()` defaults `consolidationType` to `null` and `isIshgardian` to `false` for backward compatibility
- Synced acquisition, price, and currency data for 47 dyes from CSV to `colors_xiv.json`; corrected 3 Firmament dyes (30122–30124) from Cosmic Exploration to The Firmament / Skybuilders Scrips

---

## [2.0.1] - 2026-03-09

### Changed

- Updated `@types/node` from 25.3.3 to 25.3.5

## [2.0.0] - 2026-03-01

### Added

- `isAbortError` unit tests — covers AbortError, TimeoutError, and DOMException.ABORT_ERR detection (DEAD-054)
- `ResolvedPreset` interface — migrated from `@xivdyetools/types` and now exported from `PresetService` (DEAD-060)

### Changed

- Internal `Logger`/`NoOpLogger` imports now sourced directly from `@xivdyetools/logger/library` instead of deprecated `types/logger.ts` wrapper
- Marked 14 utility functions as `@internal` — `clamp`, `lerp`, `round`, `distance`, `unique`, `groupBy`, `sortByProperty`, `filterNulls`, `isValidRGB`, `isValidHSV`, `isString`, `isNumber`, `isArray`, `isAbortError` (DEAD-045, DEAD-054)
- Marked 4 constants as `@internal` — `COLOR_DISTANCE_MAX`, `VISION_TYPES`, `VISION_TYPE_LABELS`, `API_DEBOUNCE_DELAY` (DEAD-046)
- Marked 10 character color data exports as `@internal` — `characterColorMeta`, `eyeColorsData`, `highlightColorsData`, `lipColorsDarkData`, `lipColorsLightData`, `tattooColorsData`, `facePaintDarkData`, `facePaintLightData`, `hairColorsData`, `skinColorsData` (DEAD-048)
- Version bump to 2.0.0 — breaking change release

### Removed

- Deprecated `types/logger.ts` wrapper file — import `Logger`, `NoOpLogger`, `ConsoleLogger` directly from `@xivdyetools/logger/library` instead (DEAD-042)
- **BREAKING**: All deprecated type re-exports removed from barrel — `Dye`, `RGB`, `PresetCategory`, `PresetPalette`, `PresetData`, `CategoryMeta`, `SubRace`, `Gender`, `CharacterColorMatch`, `PriceData`, `CachedData`, and all remaining `@xivdyetools/types` re-exports. Import directly from `@xivdyetools/types` instead (DEAD-047 Phase 2)
- ~35 zero-consumer deprecated re-exports from barrel: `LocalizedDye`, `HSV`, `LAB`, `HexColor`, `VisionType`, `Matrix3x3`, `ColorblindMatrices`, `ErrorSeverity`, `Logger`, `NoOpLogger`, `ConsoleLogger`, `AppError`, `ErrorCode`, `createHexColor`, all auth types, most preset types, all character types/constants, all localization types, all API response types (DEAD-047 Phase 1)
- Legacy omnibus `core.test.ts` — coverage duplicated by per-service unit tests (DEAD-043)
- Legacy `logger.test.ts` — tests deprecated re-exports; logger package has its own test suite (DEAD-044)
- Deprecated `characterColorData` barrel export — use `CharacterColorService` or individual data exports instead (DEAD-049)
- 3 orphaned `add-type-flags` one-time migration scripts (DEAD-050)
- Orphaned `compare-scrapes.js` script (DEAD-051)
- Stale `response.json` debug artifact (DEAD-052)
- Tracked `dye_names.csv` output file (already in `.gitignore`) (DEAD-053)

## [1.17.3] - 2026-02-27

### Fixed

- **ESLint v10 compatibility**: Fix lint errors for new `eslint:recommended` rules
  - `no-useless-assignment`: Remove dead initializers (`rNorm`, `gNorm`, `bNorm`) in `ColorConverter.hsvToRgb()`
  - `preserve-caught-error`: Add `{ cause: parseError }` to re-thrown error in `APIService.get()`
  - `preserve-caught-error`: Add `{ cause: e }` in `types.test.ts`

## [1.17.2] - 2026-02-21

### Added

- `spectral-js.d.ts` type declarations for untyped spectral.js library

### Performance

- **OPT-001**: Add LRU cache for `rgbToOklab()` conversions — OKLAB is the recommended matching method and was the only uncached color space conversion on the hot path

## [1.17.1] - 2026-02-21

### Changed

- Patch version bump for lint-only changes
- Resolve type-check errors in tests — add missing Dye properties, fix type-only imports, rename OklchWeights `L/C/H` → `kL/kC/kH`

## [1.17.0] - 2026-02-19

### Added

- **OPT-002**: Cache hit/miss/eviction/error metrics in `APIService`
  - New `CacheMetrics` interface exported from `@xivdyetools/core`
  - `getCacheStats()` now returns `{ size, keys, metrics }` with hit/miss/eviction/error counters
  - New `resetMetrics()` method to reset counters independently
  - `clearCache()` automatically resets metrics
  - Metrics are tracked per-instance and returned as a snapshot (copy, not reference)

---

## [1.16.0] - 2026-02-05

### Added

- **HARMONY-CS-001**: Color space selection for harmony generation
  - New `colorSpace` option in `HarmonyOptions`: `'hsv'` (default), `'oklch'`, `'lch'`, `'hsl'`
  - New `HarmonyColorSpace` exported type
  - Hue rotation is performed in the selected color space, producing perceptually different harmony results
  - Non-HSV spaces use k-d tree matching (O(log n)) instead of HSV-specific hue buckets
  - Complementary harmony uses 180° hue rotation in the selected space (instead of RGB inversion) for non-HSV modes
  - **OKLCH** (recommended): Perceptually uniform hue - equal angles produce equal perceptual differences
  - **LCH**: CIELCHab cylindrical perceptual space - traditional color science standard
  - **HSL**: Similar to HSV with different lightness mapping
  - Fully backward compatible: default behavior unchanged (`'hsv'`)
  - **Usage**: `dyeService.findTriadicDyes('#FF6B6B', { colorSpace: 'oklch' })`

---

## [1.15.4] - 2026-02-04

### Fixed

- **I18N-001**: Populated Korean and Chinese locale files with actual translated dye names
  - **Issue**: `ko.json` and `zh.json` contained English dye names due to XIVAPI v2 not serving Korean/Chinese item data
  - `build-locales.ts` silently fell back to English when locale columns were missing from CSV
  - **Korean (ko.json)**: All 125 dye names now use official Korean translations (e.g., "Snow White" → "하얀 눈색")
  - **Chinese (zh.json)**: All 125 dye names now use official Chinese translations (e.g., "Snow White" → "素雪白")
  - UI labels, categories, acquisitions, and other sections were already correctly translated
  - **Impact**: `/gradient`, `/dye info`, and all other commands now display localized dye names for Korean and Chinese users

---

## [1.15.3] - 2026-01-26

### Fixed

- **BUG-006**: Added missing required Dye fields to HarmonyGenerator test mocks
  - Added `stainID`, `isMetallic`, `isPastel`, `isDark`, `isCosmic` fields
  - Ensures type safety with strict TypeScript checking
  - Facewear dye mock correctly uses `stainID: null` per type definition

---

## [1.15.2] - 2026-01-25

### Added

- **OPT-001**: New `AsyncLRUCache` class for async-safe caching with request deduplication
  - Addresses the concurrency limitation documented in `LRUCache` warning
  - Uses pending promises Map pattern for request deduplication
  - Critical: Promise is stored synchronously before any await (race-safe)
  - Handles errors gracefully - removes from pending but doesn't cache failures
  - Includes `getOrCompute(key, compute)` method for async value computation
  - Includes `pendingSize` getter for monitoring in-flight operations
  - **Reference**: Security audit OPT-001 (2026-01-25)

---

## [1.15.1] - 2026-01-22

### Fixed

- **AUDIT-FINDING-001**: Replaced `console.warn()` calls with logger interface (Security)
  - **Issue**: Direct console output bypassed logger abstraction, leaked implementation details
  - **Severity**: LOW (CWE-532: Information Disclosure)
  - **Changes**:
    - `retry()` utility now accepts optional `logger` parameter
    - `DyeSearch` now uses injected logger from `DyeDatabase` instead of `console.warn()`
    - `APIService` passes logger to `retry()` function
    - Added `getLogger()` getter to `DyeDatabase` for service delegation
  - **Impact**: Consistent logging, configurable output, no information leakage in production
  - **Files Modified**:
    - `src/utils/index.ts` (retry function)
    - `src/services/dye/DyeDatabase.ts` (added logger getter)
    - `src/services/dye/DyeSearch.ts` (replaced 2 console.warn calls)
    - `src/services/APIService.ts` (pass logger to retry)
  - **Reference**: Security audit FINDING-001 (2026-01-22)

### Documentation

- **AUDIT-BUG-001**: Added concurrency limitation warning to `LRUCache` class
  - Documented potential race conditions when used in async contexts
  - Added warning about cache stampede (duplicate expensive computations)
  - Added warning about incorrect LRU ordering under concurrent access
  - Recommended mitigation strategies:
    - Use `lru-cache` npm package for high-concurrency scenarios
    - Implement request deduplication pattern (see `APIService.getPriceData`)
  - Updated inline comment to reference concurrency warning
  - **Impact**: No code changes, documentation-only update
  - **Rationale**: Current implementation is adequate for synchronous color conversion use case, but future async-heavy scenarios should be aware of limitations
  - **Reference**: Deep-dive analysis BUG-001 (2026-01-22)

---

## [1.15.0] - 2026-01-20

### Changed

- **Character Color Data Refactoring**: Split `character_colors.json` (779KB) into granular files for better performance
  - **New file structure**: `src/data/character_colors/` with organized subdirectories
    - `index.json` - Metadata and subrace manifest
    - `shared/` - 7 race-agnostic color files (eye, highlight, lip, tattoo, face paint)
    - `race_specific/` - 2 lazy-loaded files (hair_colors.json, skin_colors.json)
  - **Hybrid loading strategy**: Shared colors load synchronously, race-specific colors load on-demand
  - **Bundle size optimization**: Initial load reduced by ~87% (shared colors only ~108KB vs full 779KB)

### Breaking Changes

- **CharacterColorService API changes** - Race-specific methods are now async:
  - `getHairColors(subrace, gender)` → returns `Promise<CharacterColor[]>`
  - `getSkinColors(subrace, gender)` → returns `Promise<CharacterColor[]>`
  - `getRaceSpecificColors(category, subrace, gender)` → returns `Promise<CharacterColor[]>`
  - `getRaceSpecificColorByIndex(category, subrace, gender, index)` → returns `Promise<CharacterColor | null>`
  - All shared color methods remain synchronous (unchanged API)

### Added

- **New exports for tree-shaking**: Individual color data exports
  - `characterColorMeta`, `eyeColorsData`, `highlightColorsData`, `lipColorsDarkData`, `lipColorsLightData`
  - `tattooColorsData`, `facePaintDarkData`, `facePaintLightData`, `hairColorsData`, `skinColorsData`
- **`preloadRaceData()` method**: Preload race-specific data to avoid latency on first access
- **Promise deduplication**: Concurrent calls to lazy-loaded data share the same Promise

### Deprecated

- **`characterColorData` export**: Use `CharacterColorService` or individual exports instead

### Migration Guide

```typescript
// Before (sync)
const hairColors = characterColors.getHairColors('Midlander', 'Male');

// After (async)
const hairColors = await characterColors.getHairColors('Midlander', 'Male');

// Optional: Preload on app init to avoid first-access latency
await characterColors.preloadRaceData();
```

---

## [1.14.0] - 2026-01-19

### Fixed

- **CORE-BUG-001/002**: Fixed race condition in APIService request deduplication using deferred promise pattern to ensure map entry exists before any async operations
- **CORE-BUG-003**: Fixed KDTree `nearestNeighbor` skipping far side search when `best` was null (all nodes excluded). Now searches far side when no valid candidate found yet
- **CORE-BUG-004**: Made HSV validation required in DyeDatabase - previously optional validation allowed dyes without HSV to pass, causing crashes when accessing `dye.hsv.h` for hue bucket indexing

### Improved

- **CORE-REF-001**: Added `console.warn` logging for complete search failures in DyeSearch while documenting intentional silent handling for per-dye errors

### Refactored

- **CORE-REF-002**: Extracted duplicated price parsing logic (~65 lines) into shared `extractPriceFromApiItem()` helper function. Added `UniversalisItemResult` type for consistency. Price extraction priority (NQ only: DC → World → Region) now documented in single source of truth

---

## [1.13.0] - 2026-01-18

### Added

- **Configurable Color Matching Algorithms** (COLOR-MATCH-001)
  - New `MatchingMethod` type: `'rgb' | 'cie76' | 'ciede2000' | 'oklab' | 'hyab' | 'oklch-weighted'`
  - `ColorConverter.getDeltaE_Oklab(hex1, hex2)` - OKLAB Euclidean distance (recommended default)
  - `ColorConverter.getDeltaE_HyAB(hex1, hex2)` - HyAB hybrid algorithm (best for large color differences)
  - `ColorConverter.getDeltaE_OklchWeighted(hex1, hex2, weights?)` - OKLCH with customizable L/C/H weights
  - All algorithms accessible via unified `ColorConverter.getColorDistanceByMethod(hex1, hex2, method, weights?)`

- **DyeSearch Matching Method Support**
  - `findClosestDye(hex, options)` now accepts `matchingMethod` and `weights` options
  - `findDyesWithinDistance(hex, options)` now accepts `matchingMethod` and `weights` options
  - K-d tree used for candidate selection, then perceptual re-ranking for accurate results

- **DyeService Matching Method Proxy**
  - `findClosestDye(hex, options)` forwards matching method to DyeSearch
  - Backwards compatible: existing code continues to work

- **CharacterColorService Matching Method Support**
  - `findClosestDyes(hex, options)` now accepts `matchingMethod` for perceptual matching

- **New Types** (exported from `@xivdyetools/core`)
  - `MatchingMethod` - Union type for all supported algorithms
  - `OklchWeights` - Interface for custom L/C/H weight configuration
  - `MatchingConfig` - Combined config interface
  - `MATCHING_PRESETS` - Pre-configured weight presets for common use cases

- **New i18n Keys** (all 6 languages: EN, JA, DE, FR, KO, ZH)
  - `config.matchingMethod` - "Matching Algorithm"
  - `config.matchingOklab` / `config.matchingOklabDesc` - OKLAB descriptions
  - `config.matchingHyab` / `config.matchingHyabDesc` - HyAB descriptions
  - `config.matchingCiede2000` / `config.matchingCiede2000Desc` - CIEDE2000 descriptions
  - `config.matchingCie76` / `config.matchingCie76Desc` - CIE76 descriptions
  - `config.matchingRgb` / `config.matchingRgbDesc` - RGB descriptions

### Algorithm Comparison

| Algorithm | Best For | Speed | Perceptual Accuracy |
|-----------|----------|-------|---------------------|
| `rgb` | K-d tree optimization | Fastest | Low |
| `cie76` | Quick approximations | Fast | Fair |
| `ciede2000` | Industry standard | Medium | High |
| `oklab` | General use (recommended) | Fast | Very Good |
| `hyab` | Palette matching | Fast | Excellent for large Δ |
| `oklch-weighted` | Custom L/C/H priority | Fast | Configurable |

### Usage Example

```typescript
import { DyeService, type MatchingMethod } from '@xivdyetools/core';

const dyeService = new DyeService();

// Find closest dye using OKLAB (recommended)
const closest = dyeService.findClosestDye('#FF5733', { matchingMethod: 'oklab' });

// Find closest using HyAB (best for palette matching)
const paletteMatch = dyeService.findClosestDye('#FF5733', { matchingMethod: 'hyab' });

// Find with custom OKLCH weights (prioritize hue matching)
const hueMatch = dyeService.findClosestDye('#FF5733', {
  matchingMethod: 'oklch-weighted',
  weights: { lightness: 0.5, chroma: 1.0, hue: 2.0 }
});
```

---

## [1.11.0] - 2026-01-17

### Added

- **OKLAB/OKLCH Color Space Support**: Modern perceptually uniform color space (Björn Ottosson, 2020)
  - `ColorService.rgbToOklab(r, g, b)` / `ColorService.oklabToRgb(L, a, b)` - OKLAB conversions
  - `ColorService.hexToOklab(hex)` / `ColorService.oklabToHex(L, a, b)` - Hex ↔ OKLAB
  - `ColorService.rgbToOklch(r, g, b)` / `ColorService.oklchToRgb(L, C, h)` - OKLCH cylindrical form
  - `ColorService.hexToOklch(hex)` / `ColorService.oklchToHex(L, C, h)` - Hex ↔ OKLCH
  - `ColorService.mixColorsOklab(hex1, hex2, ratio)` - OKLAB perceptual mixing
  - `ColorService.mixColorsOklch(hex1, hex2, ratio, hueMethod)` - OKLCH with hue direction control
  - Fixes CIELAB's blue color distortion (Blue + Yellow = Green, not Pink)

- **LCH Color Space Support**: Cylindrical form of CIE LAB for hue-based operations
  - `ColorService.labToLch(L, a, b)` / `ColorService.lchToLab(L, C, h)` - LAB ↔ LCH
  - `ColorService.rgbToLch(r, g, b)` / `ColorService.lchToRgb(L, C, h)` - RGB ↔ LCH
  - `ColorService.hexToLch(hex)` / `ColorService.lchToHex(L, C, h)` - Hex ↔ LCH
  - `ColorService.mixColorsLch(hex1, hex2, ratio, hueMethod)` - LCH cylindrical mixing

- **HSL Color Space Support**: Hue-Saturation-Lightness common in design tools
  - `ColorService.rgbToHsl(r, g, b)` / `ColorService.hslToRgb(h, s, l)` - RGB ↔ HSL
  - `ColorService.hexToHsl(hex)` / `ColorService.hslToHex(h, s, l)` - Hex ↔ HSL
  - `ColorService.mixColorsHsl(hex1, hex2, ratio, hueMethod)` - HSL hue-based mixing

- **Spectral.js Integration**: Kubelka-Munk theory-based realistic paint mixing
  - `ColorService.mixColorsSpectral(hex1, hex2, ratio)` - Physics-based paint mixing
  - `ColorService.mixMultipleSpectral(colors, weights)` - Mix multiple colors
  - `ColorService.gradientSpectral(hex1, hex2, steps)` - Spectral gradient generation
  - `ColorService.isSpectralAvailable()` - Check if spectral.js is loaded
  - Blue + Yellow = Green (like real paint!)

- **Hue Interpolation Control**: For cylindrical color spaces
  - `ColorService.interpolateHue(h1, h2, ratio, method)` - 4 interpolation modes:
    - `'shorter'` (default): Take shorter arc around hue wheel
    - `'longer'`: Take longer arc
    - `'increasing'`: Always clockwise
    - `'decreasing'`: Always counter-clockwise

- **HSV Mixing**: Added for completeness
  - `ColorService.mixColorsHsv(hex1, hex2, ratio, hueMethod)` - HSV hue-based mixing

- **New Exported Types** (from `@xivdyetools/types`)
  - `OKLAB` - OKLAB color type with L (0-1), a, b components
  - `OKLCH` - OKLCH color type with L (0-1), C (chroma), h (hue 0-360)
  - `LCH` - LCH color type with L (0-100), C, h
  - `HSL` - HSL color type with h (0-360), s (0-100), l (0-100)

- **New i18n Keys**: Localization for all 6 languages (EN, JA, DE, FR, KO, ZH)
  - Gradient interpolation mode labels and descriptions
  - Mixing mode labels and descriptions

### Dependencies

- Added `spectral.js` for Kubelka-Munk spectral mixing (~8KB gzipped)
- Updated `@xivdyetools/types` to ^1.6.0

### Usage Example

```typescript
import { ColorService } from '@xivdyetools/core';

// OKLAB mixing - Blue + Yellow = Green (not pink like LAB!)
const mixed = ColorService.mixColorsOklab('#0000FF', '#FFFF00');

// Spectral mixing - Most realistic paint simulation
const paint = ColorService.mixColorsSpectral('#0000FF', '#FFFF00');

// OKLCH gradient with hue direction control
const oklch1 = ColorService.hexToOklch('#FF0000');
const oklch2 = ColorService.hexToOklch('#00FF00');
const midHue = ColorService.interpolateHue(oklch1.h, oklch2.h, 0.5, 'shorter');
```

---

## [1.10.0] - 2026-01-14

### Added

- **RYB Subtractive Color Mixing**: New service for paint-like color mixing using the Gossett-Chen algorithm
  - `RybColorMixer` class implementing trilinear interpolation in the RYB color cube
  - `ColorService.mixColorsRyb(hex1, hex2, ratio?)` - Mix colors like physical paints (Blue + Yellow = Green!)
  - `ColorService.rybToRgb(r, y, b)` - Convert RYB to RGB using trilinear interpolation
  - `ColorService.rgbToRyb(r, g, b)` - Convert RGB to RYB using Newton-Raphson approximation
  - `ColorService.hexToRyb(hex)` - Convert hex color to RYB
  - `ColorService.rybToHex(r, y, b)` - Convert RYB to hex color
  - Uses Gossett-Chen cube corner values for accurate paint mixing simulation:
    - Red + Yellow = Orange
    - Yellow + Blue = Green
    - Red + Blue = Violet

- **LAB to RGB Conversion**: Added reverse LAB conversion methods in `ColorConverter`
  - `ColorService.labToRgb(L, a, b)` - Convert CIE LAB to RGB
  - `ColorService.labToHex(L, a, b)` - Convert CIE LAB to hex color

- **New Exported Types**
  - `RYB` - RYB color type with `r`, `y`, `b` components (0-255)

### Technical Details

The RYB color mixing uses the algorithm from Gossett & Chen's 2006 paper "Paint Inspired Color Mixing and Compositing for Visualization":
- Forward transform (RYB→RGB): Trilinear interpolation in 3D color cube with 8 empirically-tuned corner values
- Reverse transform (RGB→RYB): Newton-Raphson iterative gradient descent approximation (no closed-form inverse exists)

### Usage Example

```typescript
import { ColorService } from '@xivdyetools/core';

// Mix blue and yellow like paint - produces green!
const mixed = ColorService.mixColorsRyb('#0000FF', '#FFFF00');
// Returns greenish color (not gray like RGB averaging)

// Custom mix ratio (0 = all hex1, 1 = all hex2)
const partialMix = ColorService.mixColorsRyb('#FF0000', '#FFFF00', 0.3);
// Returns orange-red (30% yellow)

// Direct RYB conversions
const ryb = ColorService.hexToRyb('#00FF00'); // Green in RYB space
const rgb = ColorService.rybToRgb(0, 255, 255); // Yellow+Blue = Green
```

---

## [1.9.0] - 2026-01-11

### Added

- **World ID Extraction**: APIService now extracts `worldId` from Universalis API responses
  - Identifies which world has the cheapest listing when fetching data center prices
  - Available in both single-item (`fetchPriceData`) and batch (`fetchBatchPriceData`) responses
  - Uses `minPriceListing.worldID` from Universalis aggregated response

### Changed

- Updated `@xivdyetools/types` dependency to ^1.5.0

---

## [1.8.0] - 2026-01-11

### Added

- **DeltaE-Based Harmony Matching**: Alternative perceptually-accurate algorithm for all harmony calculations
  - New `HarmonyOptions` interface with `algorithm`, `deltaEFormula`, and tolerance settings
  - `algorithm: 'hue'` (default) - existing fast hue-based matching
  - `algorithm: 'deltaE'` - perceptually accurate matching using LAB color space
  - `deltaEFormula: 'cie76'` (default) - fast Euclidean distance in LAB
  - `deltaEFormula: 'cie2000'` - industry-standard CIEDE2000 for highest accuracy
  - Pre-computed LAB values for all dyes (computed once during database initialization)
  - All harmony methods now accept optional `HarmonyOptions` parameter:
    - `findComplementaryPair()`, `findAnalogousDyes()`, `findTriadicDyes()`
    - `findSquareDyes()`, `findTetradicDyes()`, `findMonochromaticDyes()`
    - `findCompoundDyes()`, `findSplitComplementaryDyes()`, `findShadesDyes()`

- **LAB Color Conversion**: New methods in `ColorConverter`
  - `rgbToLab(r, g, b)` - Convert RGB to CIE LAB
  - `hexToLab(hex)` - Convert hex color to CIE LAB
  - LRU caching for LAB conversions (same pattern as other conversions)

- **DeltaE Calculations**: New methods in `ColorConverter`
  - `getDeltaE76(lab1, lab2)` - CIE76 formula (fast, Euclidean in LAB)
  - `getDeltaE2000(lab1, lab2)` - CIEDE2000 formula (accurate, industry standard)
  - `getDeltaE(hex1, hex2, formula?)` - Convenience method for hex colors

- **New Exported Types**
  - `HarmonyOptions` - Options for harmony generation algorithm selection
  - `HarmonyMatchingAlgorithm` - `'hue' | 'deltaE'`
  - `DeltaEFormula` - `'cie76' | 'cie2000'`
  - `LAB` - Re-exported from `@xivdyetools/types`

### Changed

- Updated `@xivdyetools/types` dependency to ^1.4.0
- `DyeInternal` interface now includes pre-computed `lab` field

### Usage Example

```typescript
import { DyeService, dyeDatabase } from '@xivdyetools/core';

const dyeService = new DyeService(dyeDatabase);

// Traditional hue-based matching (default, unchanged API)
const hueTriadic = dyeService.findTriadicDyes('#FF5733');

// DeltaE matching with CIE76 (fast)
const deltaETriadic = dyeService.findTriadicDyes('#FF5733', {
  algorithm: 'deltaE',
});

// DeltaE matching with CIEDE2000 (most accurate)
const accurateTriadic = dyeService.findTriadicDyes('#FF5733', {
  algorithm: 'deltaE',
  deltaEFormula: 'cie2000',
  deltaETolerance: 25,
});
```

---

## [1.7.0] - 2026-01-08

### Added

- **Character Color Service**: New service for accessing FFXIV character customization colors
  - `CharacterColorService` class provides access to all character creator color options
  - Shared colors: eye colors (192), highlight colors (192), lip colors (96 dark/96 light), tattoo colors (192), face paint colors (96 dark/96 light)
  - Race-specific colors: hair colors and skin colors for all 16 subraces × 2 genders (192 each)
  - Color matching: `findClosestDyes()`, `findClosestDye()`, `findDyesWithinDistance()` methods to find dyes matching character colors
  - Lookup methods: `getSharedColorByIndex()`, `getRaceSpecificColorByIndex()`
  - Metadata: `getVersion()`, `getGridColumns()`, `getAvailableSubraces()`

- **Character Color Data**: Added `character_colors.json` data file (779 KB)
  - Complete color palette data extracted from FFXIV character creator
  - 13,000+ color entries covering all character customization options

- **Character Type Exports**: Re-exported character types from `@xivdyetools/types` for convenience
  - `CharacterColor`, `CharacterColorMatch`, `SubRace`, `Gender`, `Race`
  - `RACE_SUBRACES`, `SUBRACE_TO_RACE`, `COLOR_GRID_DIMENSIONS` constants

### Changed

- Updated `@xivdyetools/types` dependency to ^1.3.0

---

## [1.6.0] - 2026-01-08

### Added

- **StainID Support**: Added `stainID` field to all dyes in the database
  - Each dye now includes `stainID: number | null` (1-125 for standard dyes, null for Facewear dyes)
  - StainID is the game's internal stain table ID from the Stain.exh data
  - New `dyeDatabase.getByStainId(stainId)` method for looking up dyes by stain ID
  - Useful for integration with tools that reference the game's internal stain IDs

### Changed

- Updated `@xivdyetools/types` dependency to ^1.2.0

---

## [1.5.6] - 2026-01-07

### Fixed

- **Localization**: Added missing metallic dye IDs to EN, DE, FR, JA locale files
  - Added Gunmetal Black (30122) and Pearl White (30123) to metallicDyeIds array
  - All 6 locale files now have consistent 16 metallic dye entries
  - Files now have consistent structure (233 lines each)

---

## [1.5.5] - 2026-01-05

### Security

#### Medium Priority Audit Fixes (2026-01-05 Security Audit)

- **MED-001**: Added input length validation before hex color regex
  - `isValidHexColor()` now checks string length before regex to prevent potential ReDoS
  - Maximum length of 7 characters (#RRGGBB format) enforced

- **MED-002**: Sanitized error messages in APIService
  - `fetchPriceData()` now logs detailed errors internally but provides sanitized messages to callers
  - Prevents exposing internal API structure or upstream error details to consumers

---

## [1.5.4] - 2025-12-24

### Changed

- Updated `@xivdyetools/types` to ^1.1.1 for Facewear dye ID support
- Updated `@xivdyetools/logger` to ^1.0.2 for improved log redaction patterns

---

## [1.5.3] - 2025-12-24

### Changed

#### Low Priority Audit Fixes

- **REEXP-001**: Added explicit v2.0.0 removal timeline to all deprecated re-exports
  - Updated 11 deprecation notices in `types/index.ts` to specify removal version
  - Helps consumers plan their migration to `@xivdyetools/types`

#### Medium Priority Audit Fixes

- **TYPES-001**: Extracted shared `LRUCache<K, V>` class to `utils/index.ts`
  - Consolidated duplicate implementations from `ColorConverter` and `ColorblindnessSimulator`
  - Generic implementation with configurable `maxSize` parameter
  - Provides O(1) get/set operations with automatic eviction

### Improved

- **INPUT-003**: Added warning logs when PaletteService clamps option values
  - Logs warning when `colorCount` is clamped to [1, 10] range
  - Logs warning when `maxIterations` is clamped to [1, 100] range
  - Helps developers understand when their values are being adjusted

### Performance

- **MEM-001**: Pre-computed lowercase name and category for search optimization
  - Added `DyeInternal` interface extending `Dye` with `nameLower` and `categoryLower` fields
  - Pre-computes lowercase values once during `DyeDatabase.initialize()` instead of on every search
  - Updated `DyeSearch.searchByName()`, `DyeSearch.searchByCategory()`, and `DyeService.searchByLocalizedName()`
  - Eliminates ~N×2 `toLowerCase()` calls per search operation (where N = dye count)

### Fixed

- **PERF-003**: Simplified `findClosestNonFacewearDye` in `HarmonyGenerator`
  - Removed redundant O(n²) loop that re-filtered already-filtered results
  - `DyeSearch.findClosestDye` already excludes Facewear dyes internally (CORE-BUG-005)
  - Method now delegates directly to `findClosestDye` for O(log n) performance

---

## [1.5.2] - 2025-12-24

### Fixed

#### Security Audit - High Priority Issues Resolved

- **INPUT-001**: Added validation to batch API URL builder
  - Validates array is not empty before building batch request URL
  - Limits batch size to 100 items (Universalis API recommendation)
  - Validates each item ID is a positive integer
  - Throws `AppError` with `INVALID_INPUT` code for invalid input

---

## [1.5.1] - 2025-12-16

### Added

- **APIService**: Added `baseUrl` option to `APIServiceOptions` for configurable Universalis API endpoint
- Exported `UNIVERSALIS_API_BASE` constant for reference

### Fixed

- **APIService**: Fixed constructor options detection to check for any known property (`cacheBackend`, `baseUrl`, `fetchClient`, `rateLimiter`, `logger`) instead of only `logger`, preventing issues when passing options without a logger

---

## [1.4.0] - 2025-12-14

### Added

- **Shared Package Integration**: Integrated `@xivdyetools/types` and `@xivdyetools/logger` as dependencies for ecosystem-wide type and logging consistency

### Changed

- **Package Rename**: Package renamed from `xivdyetools-core` to `@xivdyetools/core` for npm organization consistency

### Fixed

- **Security**: Prevented cache key collisions by adding type prefixes to cache keys
- **Performance**: Addressed HIGH severity performance audit findings
- **Color Handling**: Fixed hue normalization before caching to prevent cache thrashing (CORE-BUG-001)
- **Medium Severity**: Addressed MEDIUM severity audit findings

### Deprecated

#### Type Re-exports
The following re-exports from `@xivdyetools/core` are deprecated and will be removed in the next major version:

- **Logger Types**: Import from `@xivdyetools/logger/library` instead
- **Color Types** (RGB, HSV, HexColor, etc.): Import from `@xivdyetools/types` instead
- **Dye Types** (Dye, DyeDatabase, etc.): Import from `@xivdyetools/types` instead
- **Preset Types**: Import from `@xivdyetools/types` instead
- **Auth Types**: Import from `@xivdyetools/types` instead
- **API Types**: Import from `@xivdyetools/types` instead
- **Localization Types**: Import from `@xivdyetools/types` instead
- **Error Types**: Import from `@xivdyetools/types` instead
- **Utility Types** (Result, isOk, isErr): Import from `@xivdyetools/types` instead

**Migration Guide:**
```typescript
// Before (deprecated)
import { RGB, Dye, ErrorCode, NoOpLogger } from '@xivdyetools/core';

// After (recommended)
import type { RGB, Dye } from '@xivdyetools/types';
import { ErrorCode } from '@xivdyetools/types';
import { NoOpLogger } from '@xivdyetools/logger/library';
```

---

## [1.3.7] - 2025-12-08

### Added
- **PresetService Test Coverage**: Comprehensive test suite for `PresetService.ts` (0% → 100% coverage)
  - 64 new tests covering category operations, preset retrieval, search, random selection, and dye resolution
  - Tests for `getCategories`, `getCategoryMeta`, `getAllPresets`, `getPresetsByCategory`, `getPreset`
  - Tests for `getPresetCountByCategory`, `searchPresets`, `getPresetsByTag`, `getRandomPreset`
  - Tests for `getPresetWithDyes`, `resolvePresets`, metadata methods, and edge cases

- **TranslationProvider Test Coverage**: Added missing method tests
  - 21 new tests for `getJobName()` covering all 22 FFXIV jobs (tanks, healers, melee/ranged/caster DPS)
  - Tests for `getGrandCompanyName()` covering all 3 Grand Companies
  - Japanese localization tests for job names and Grand Company names

- **DyeDatabase Test Coverage**: Significant coverage improvements (84% → 100% lines)
  - 35+ new tests for prototype pollution protection (`__proto__`, `constructor`, `prototype` filtering)
  - Dye validation tests for invalid name, hex, RGB, HSV, and category values
  - Facewear dye synthetic ID generation tests
  - Price-to-cost field mapping tests
  - Logger integration tests
  - Edge case tests for null/undefined values

### Changed
- Overall project test coverage improved to 97.92% statements
- 1256+ total tests across the entire test suite

---

## [1.3.6] - 2025-12-07

### Added
- **CommunityPreset Types**: TypeScript types for community preset API integration
  - `PresetStatus`: pending | approved | rejected | flagged
  - `CommunityPreset`: Full preset with voting and moderation data
  - `PresetSubmission`: Data required to submit a new preset
  - `PresetListResponse`, `PresetSubmitResponse`, `VoteResponse`, `PresetFilters`
- **Facewear Filtering**: Native exclusion of Facewear dyes in harmony functions
  - `findComplementaryPair` now excludes Facewear dyes
  - `findMonochromaticDyes` now excludes Facewear dyes
  - `findClosestNonFacewearDye` helper method for explicit filtering

---

## [1.3.5] - 2025-12-05

### Added
- **PaletteService**: New service for multi-color palette extraction from images
  - K-means++ clustering algorithm for accurate dominant color detection
  - `extractPalette(pixels, options)` - Extract N dominant colors with dominance percentages
  - `extractAndMatchPalette(pixels, dyeService, options)` - Extract and match to closest FFXIV dyes
  - Configurable: `colorCount` (3-5), `maxIterations`, `convergenceThreshold`, `maxSamples`
  - Helper functions: `pixelDataToRGB()`, `pixelDataToRGBFiltered()` for Canvas data conversion

### Usage Example
```typescript
import { PaletteService, DyeService, dyeDatabase } from 'xivdyetools-core';

const paletteService = new PaletteService();
const dyeService = new DyeService(dyeDatabase);

// Extract from Canvas ImageData
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const pixels = PaletteService.pixelDataToRGBFiltered(imageData.data);

// Get palette with matched dyes
const matches = paletteService.extractAndMatchPalette(pixels, dyeService, {
  colorCount: 4,
  maxIterations: 25
});

// Each match includes: extracted, matchedDye, distance, dominance
```

---

## [1.3.2] - 2025-12-04

### Added
- **Logger Test Coverage**: Comprehensive test suite for `logger.ts` (25% → 100% coverage)
  - 23 new tests covering `NoOpLogger`, `ConsoleLogger`, and custom `Logger` implementations
  - Tests for all log levels (info, warn, error, debug)
  - Branch coverage for error handling with and without error objects
  - Validation of Logger interface contract

## [1.3.1] - 2025-12-02

### Fixed
- **Security**: Added prototype pollution protection in `DyeDatabase.initialize()` for untrusted data sources
- **Data Integrity**: Fixed `price` vs `cost` field mismatch - JSON data uses `price` but `Dye` interface expects `cost`
- **Memory**: Removed duplicate ID mapping in `DyeDatabase` - now only maps `itemID` separately if it differs from `id`
- **Concurrency**: Fixed race condition in singleton patterns by using eager initialization for `ColorConverter` and `LocalizationService`
- **Integer Operations**: Fixed `generateChecksum` to use proper 32-bit integer conversion (`|0` instead of `&hash`)
- **Color Manipulation**: Fixed negative hue values in `rotateHue` - now properly normalizes to 0-360 range
- **Floating Point**: Consistent rounding strategy in `ColorConverter` between `rgbToHsv` and `hsvToRgb`
- **Tests**: Fixed Point3D typo in `kd-tree.test.ts` (`b` → `z`)

### Added
- **Logger Interface**: Injectable `Logger` interface with `NoOpLogger` (default) and `ConsoleLogger` implementations
- **Dye Validation**: Runtime validation for dye data with `isValidDye()` method
- **Test Isolation**: `LocalizationService.resetInstance()` for preventing test pollution
- **AbortError Detection**: `isAbortError()` utility function for timeout error handling in retry logic
- **Documentation**: Comprehensive `docs/ERROR_HANDLING.md` guide for error handling patterns

### Changed
- **API Retry**: `retry()` now includes AbortError/TimeoutError in retry loop for transient network issues
- **Harmony Methods**: Documented that `findTriadicDyes`, `findSquareDyes`, `findTetradicDyes` may return fewer results than expected
- **VERSION Sync**: VERSION constant now auto-generated from package.json during build

## [1.3.0] - 2025-12-01

### Added
- **Dye Type Flags**: Added locale-independent type flags to `Dye` interface for filtering
  - `isMetallic`: Identifies metallic dyes (14 dyes)
  - `isPastel`: Identifies pastel dyes (4 dyes)
  - `isDark`: Identifies dark dyes (5 dyes)
  - `isCosmic`: Identifies cosmic dyes from Cosmic Exploration/Fortunes (20 dyes)
  - Enables filtering by dye type regardless of user's language setting
  - All 136 dyes in `colors_xiv.json` now include these boolean flags

### Changed
- **Breaking Change**: `Dye` interface now requires four additional boolean properties
  - Applications using this package must update to handle the new properties
  - Existing code will continue to work but TypeScript will show type errors until updated

## [1.2.5] - 2025-11-30

### Fixed
- **Metallic Dyes**: Added "Gunmetal Black" (30122) and "Pearl White" (30123) to `metallicDyeIds` list in all locales.

## [1.2.4] - 2025-11-30

### Fixed
- **Japanese Locale**: Removed trailing colon from `labels.dye` ("カララント:" → "カララント")
- **Korean Locale**: Corrected Venture Coffers translation ("모험 보물상자" → "집사의 보물상자" - official term)

### Added
- **Localization Reference Documentation**: New `docs/LOCALIZATION_REFERENCE.md` with verified official FFXIV terms
  - Official translations for Dye, Market Board, Dark, Pastel, Metallic across all 6 languages
  - Cosmic Exploration and Cosmic Fortunes translations
  - Venture Coffers translations (verified against official sources)
  - Allied Society Vendors (Beast Tribe Vendors) translations
  - Beast tribe names (Ixali, Sylph, Kobold, Amalj'aa, Sahagin)
  - Dye name format pattern documentation
- **Scrape Comparison Script**: New `scripts/compare-scrapes.js` for validating locale data against scraped sources

---

## [1.2.3] - 2025-11-28

### Added
- **Comprehensive Branch Coverage Testing**: Improved test coverage from ~85% to 95.8% branch coverage
  - **types/index.ts**: Added 66 new tests for branded type helpers (`createHexColor`, `createDyeId`, `createHue`, `createSaturation`) and `AppError` class (41.66% → 100%)
  - **DyeSearch.ts**: Added linear search fallback tests for when k-d tree is unavailable (74.5% → 98.03%)
  - **APIService.ts**: Added tests for oversized response handling, JSON parse errors, health check failures, worldID cache keys (84% → 93%)
  - **LocaleLoader.ts**: Added `isValidLocaleData` direct tests and mocked validation failure tests (84.21% → 94.73%)
  - **ColorblindnessSimulator.ts**: Added LRU cache eviction tests (73.33% → 86.66%)

### Changed
- All 17 source files now meet or approach 90%+ branch coverage target
- 1095 total tests across the entire test suite

---

## [1.2.2] - 2025-11-28

### Fixed
- **Locale File Updates**: Additional translation keys and refinements
  - Added missing harmony type descriptions
  - Updated category labels for consistency across all 6 locales
  - Minor translation corrections in Japanese, German, French locale files

---

## [1.2.0] - 2025-11-27

### Added
- **Chinese (zh) Localization**: Full Chinese translation support
  - All 125 dye names translated
  - UI labels, categories, acquisitions, harmony types, vision types
- **Korean (ko) Localization**: Full Korean translation support
  - All 125 dye names translated
  - UI labels, categories, acquisitions, harmony types, vision types
- **Expanded `LocaleCode` type**: Now includes `'ko'` and `'zh'` in addition to `'en'`, `'ja'`, `'de'`, `'fr'`
- **6 supported locales**: English, Japanese, German, French, Korean, Chinese

### Changed
- `SUPPORTED_LOCALES` array now contains 6 locales
- Updated tests to reflect new supported locales

---

## [1.1.2] - 2025-11-27

### Fixed
- **Locale files missing from npm package**: Added `copy:locales` build step to copy locale JSON files to `dist/data/locales/`
  - TypeScript's `tsc` only copies statically imported JSON files
  - Dynamic imports (used for locale code-splitting) require manual copy
  - Build now runs: `build:locales` → `tsc` → `copy:locales`

---

## [1.1.1] - 2025-11-27

### Added
- **Comprehensive Test Coverage**: Achieved 93%+ overall test coverage
  - **ColorService Tests**: 41 tests covering all facade delegation methods
  - **DyeService Tests**: 50 tests covering database access, search/filter, harmony generation, localization
  - **LocalizationService Tests**: Enhanced static API tests for 100% coverage
  - **Utils Tests**: 93 tests for all utility functions (clamp, lerp, validation, async helpers)
  - **882 total tests** across the entire test suite

### Changed
- **Test Quality Improvements**
  - Static API tests now actually call methods instead of just checking `typeof`
  - Harmony tests use flexible expectations for limited sample data scenarios
  - Retry utility tests use real timers for more reliable async behavior

### Fixed
- Test assertions for color brightness comparisons use `toBeLessThanOrEqual`
- Harmony generation tests handle variable result counts from limited dye datasets

---

## [1.1.0] - 2025-11-23

### Added
- **Performance Optimizations**
  - **LRU Caching**: Added LRU cache for color conversions (60-80% speedup)
    - Caches hex→RGB, RGB→HSV, HSV→RGB, hex→HSV, RGB→hex conversions
    - Caches colorblindness simulation results
    - Cache statistics and clearing methods
  - **Hue-Indexed Harmony Lookups**: 70-90% faster harmony generation
    - Hue bucket indexing (10° buckets, 36 total)
    - Optimized color wheel queries
  - **k-d Tree Implementation**: 10-20x speedup for color matching
    - Custom 3D RGB color space k-d tree
    - O(log n) average case vs O(n) linear search
    - Fast nearest neighbor and range queries

- **Type Safety**
  - **Branded Types**: Enhanced type safety with branded types
    - `HexColor`, `DyeId`, `Hue`, `Saturation` branded types
    - Factory functions with validation (`createHexColor`, `createDyeId`)

- **Service Architecture**
  - **Service Class Splitting**: Split services into focused classes
    - `ColorConverter`: Format conversions (hex ↔ RGB ↔ HSV)
    - `ColorblindnessSimulator`: Colorblindness simulation
    - `ColorAccessibility`: WCAG contrast, luminance calculations
    - `ColorManipulator`: Brightness, saturation, hue rotation
    - `DyeDatabase`: Database loading, indexing, data access
    - `DyeSearch`: Search and matching operations
    - `HarmonyGenerator`: Color harmony generation
  - Maintained backward compatibility with facade classes

- **Testing & Documentation**
  - **Integration Tests**: Comprehensive integration test suite
    - Harmony workflow tests
    - Color conversion pipeline tests
    - Dye matching workflow tests
    - End-to-end workflow tests
    - Performance benchmarks
  - **API Documentation**: TypeDoc generation configured
  - **Algorithm Documentation**: k-d tree algorithm documented

### Changed
- **Performance Improvements**
  - Color conversion operations now use LRU caching
  - Harmony generation uses hue-indexed lookups
  - Dye matching uses k-d tree for spatial indexing
  - Optimized RGB→HSV conversion (single-pass min/max)

- **Code Quality**
  - TypeScript strict mode enabled
  - ESLint and Prettier configured
  - Pre-commit hooks for code quality
  - Improved code organization and maintainability

### Performance
- **Color Conversions**: < 0.05ms per conversion (target: < 0.1ms) ✅
- **Dye Matching**: < 2ms per match (target: < 3ms) ✅
- **Harmony Generation**: < 15ms per harmony (target: < 20ms) ✅
- **Cache Hit Rate**: > 60% ✅

### Security
- **Dependency Scanning**: 0 high/critical vulnerabilities ✅
- All dependencies up to date

### Documentation
- Complete API documentation (TypeDoc)
- Algorithm documentation (k-d tree)
- Testing strategy documentation

---

## [1.0.2] - Previous Release

Initial stable release with core color algorithms and dye database functionality.










