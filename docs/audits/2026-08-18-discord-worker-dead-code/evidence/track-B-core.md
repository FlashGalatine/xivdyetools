# Track B — `@xivdyetools/core` (`packages/core`)

Verification notes for the knip 6.32 `--include-entry-exports` findings plus the manual deep analysis.
Baseline: `monorepo-2.0-prep @ 84b6cf1`, clean tree. Read-only; nothing but this file was written.

## Method

1. Built the search corpus from `git ls-files apps packages` (1,079 tracked ts/js/mjs/json/md/yml/py/toml/html
   files). **A plain `grep -r apps packages` is poisoned here**: `apps/web-app/e2e-coverage/**` (gitignored) holds
   Playwright coverage JSON that embeds the full source of `packages/core/src/index.ts` and every core module, so
   every core symbol appears to have 20–30 "hits" in apps. Excluding `node_modules/dist/coverage` is not enough —
   restrict to tracked files (or add `e2e-coverage`, `test-results`, `playwright-report`, `.wrangler`, `.turbo`).
2. `refs.sh <symbol>`: word-boundary grep over the corpus, bucketed into core-src (non-test, excl. `src/index.ts`),
   core-barrel, core-test, core-other (README/CLAUDE/scripts/test-build.mjs), other packages, apps-src, apps-test.
3. `imports.py`: regex extraction of every `import [type] {…} from '@xivdyetools/core[/blending]'` (plus
   `export {…} from`, `import('@xivdyetools/core')`, `vi.mock`) across the 824 tracked ts/js files outside
   `packages/core`. Result: **156 root-barrel exports, 58 imported by at least one other workspace, 98 never
   imported from the barrel** (list matches knip's ±0: knip's value list + type list is exactly this set).
4. `internal-usage` table: for each of the 98, count same-file uses, other-core-src uses, core-test uses,
   scripts uses, docs mentions (README/CLAUDE) → INTERNAL-ONLY vs TEST-ONLY vs DEAD.
5. `members.py`: per-class public-method survey (`\.method(` occurrences bucketed ext-src / ext-test / core-src /
   core-test) for ColorService, ColorConverter, DyeService, DyeDatabase, DyeSearch, HarmonyGenerator,
   PaletteService, PresetService, CharacterColorService, APIService, SpectralMixer, RybColorMixer,
   ColorManipulator, ColorAccessibility, ColorblindnessSimulator, KDTree. knip cannot see class members
   (`classMembers` rule off), so this is where the biggest misses are.
6. Whole-module importer map for every `src/**/*.ts`; data-file importer map; locale-section → accessor →
   external-consumer chain; dependency and script wiring (package.json / turbo.json / .github/workflows).

Classification legend: DEAD / TEST-ONLY / INTERNAL-ONLY / REDUNDANT-RE-EXPORT / DOCUMENTED-PUBLIC-API / DUPLICATE / LIVE.
Because core is npm-published, every barrel removal is "REMOVE WITH CAUTION (semver-minor breaking for hypothetical
external consumers; DEPRECATIONS.md and the CHANGELOG name only workspace consumers)".

---

## 0. Headline observations (things the tool got wrong or missed)

1. **`src/data/character_colors.json` (798 KB, 1 minified line) is an orphan data file — and it is still being
   maintained.** DEAD-049 (2026-02-28 audit) removed the deprecated `characterColorData` barrel export but the file
   stayed. Nothing imports it (`CharacterColorService` imports only `character_colors/index.json` + the split
   `shared/*.json` / `race_specific/*.json`), yet commit `be884d1` (Helion → Helions) re-keyed its Hrothgar entries
   alongside the live split files, and `packages/core/CLAUDE.md:52` still lists it in the tree as "FFXIV skin/hair
   color tables". Zero references outside CHANGELOG/CLAUDE prose. Not shipped (tsc only emits imported JSON), so
   the cost is repo weight + a maintenance trap, not bundle size.
   - `git ls-files packages/core/src/data | grep -v locales` + per-file `grep -rln <basename> src scripts` → only
     `character_colors.json` has no importer.
2. **~450 lines of `utils/index.ts` have no caller anywhere** (plus ~440 lines of dedicated tests) — knip listed
   the exports, but grep confirms they are not INTERNAL-ONLY either. Only 9 utils symbols are used inside core
   (`clamp`, `round`, `isValidHexColor`, `isValidRGB`, `isValidHSV`, `LRUCache`, `retry`, `sleep`,
   `generateChecksum`, and `isAbortError` from within `retry`); `abbreviateDyeName` is used by bot-logic/svg.
   `AsyncLRUCache` (156 lines, lines 127–282) is not even in the barrel and only its own test touches it — knip
   missed it because tests are entries.
3. **`band-calibration.ts` is build/test-time tooling exported from the runtime barrel.** `calibrateBandVocabulary`,
   `DE2000_GROUND_TRUTH`, `METHOD_DISPLAY_DP` (+4 result types) are consumed only by `scripts/calibrate-bands.ts`
   and `band-vocabulary.parity.test.ts`. The module is not dead (the parity test is a real guard on the frozen
   `BAND_VOCABULARY` numbers) but its barrel exports pull `ColorConverter`+`ColorblindnessSimulator`+
   `ColorAccessibility` into any consumer's graph for a function nobody calls at runtime.
4. **knip is right about `typedoc-plugin-markdown` and the 2026-02-28 audit was wrong.** `typedoc.json` has no
   `plugin` key and uses `"theme": "default"` (HTML), so the markdown plugin is never loaded (TypeDoc ≥0.23 needs
   explicit `plugin: [...]`). Moreover the whole `docs` script (`typedoc`) is wired to nothing: not in `turbo.json`,
   not in any workflow, its `docs/api` output is not gitignored, and the public developer docs are VitePress in
   `api-worker`. `packages/core/CLAUDE.md:20` still advertises `pnpm --filter @xivdyetools/core run docs # TypeDoc → markdown`.
5. **`test-build.mjs` (117 lines) is an orphan smoke script** importing from `./dist/index.js`; nothing in any
   package.json/turbo/CI references it (`git ls-files | xargs grep -l test-build` → nothing). Last touched in the
   monorepo-migration commit `e823275`.
6. **`VERSION` + `src/version.ts` + `scripts/generate-version.ts` + the `build:version` step exist to export a
   constant nobody reads.** Zero importers in the monorepo (web-app's `VERSION` hits are an unrelated locale
   label). Documented in README/CLAUDE.md, so DOCUMENTED-PUBLIC-API / remove-with-caution — but note the removal
   would also delete a build step (38-line script) and a generated file.
7. **Class-member dead code is where the real volume is** (knip cannot see it): ~40 public methods with zero
   production callers across the monorepo — `APIService.getPricesForItems` (70 lines) / `getPriceTrend` /
   `getCacheStats` / `resetMetrics`; a 12-method TEST-ONLY chain through the `DyeService` facade
   (`getDyesByIds`, `getDyesByStainIds`, `getLastLoadedTime`, `getDyesSortedBy{Brightness,Saturation,Hue}`,
   `findCompoundDyes`, `findShadesDyes`, `getLocalizedDyeById`, `getLocalizedDyeByStainId`, `getAllLocalizedDyes`,
   `getNonMetallicDyes`) that reaches into DyeDatabase/DyeSearch/HarmonyGenerator; the whole `SpectralMixer`
   surface except `mixColors` (`mixMultiple`, `gradient`, `isAvailable` + their `ColorService` facades
   `mixMultipleSpectral`, `gradientSpectral`, `isSpectralAvailable`); `ColorService.mixColorsOklch/Lch/Hsv`;
   6 of 16 `PresetService` methods; 6 of 20 `CharacterColorService` methods; `PaletteService.pixelDataToRGB`;
   `ColorConverter.getDeltaE_HyAB` + the `'hyab'` member of `DeltaEFormula` (retired v4 method). Detail in §4.
8. **Three locale sections × 6 languages feed accessors nobody calls.** `LocalizationService.getMetallicDyeIds`,
   `getJobName`, `getGrandCompanyName` have zero external consumers (0 src, 0 test outside core), so the
   `metallicDyeIds` (16 legacy itemIDs — superseded by `METALLIC_STAIN_IDS`, which `DyeDatabase` now uses),
   `jobNames` (22 keys) and `grandCompanyNames` (3 keys) sections of every `src/data/locales/*.json` are
   test-only payload, along with `buildJobNames`/`buildGrandCompanyNames`/`identifyMetallicDyes` in
   `build-locales.ts` and `JobKey`/`GrandCompanyKey` in `@xivdyetools/types`. Also: en.json carries both
   `visionTypes` and `visions` (long/short label pairs — both read, by `getVisionType`/`getVisionShort`), and
   `categories.Facewear` / `acquisitions.Facewear Collection` survive although Facewear left the dye table
   (`DyeSearch` still filters `category === 'Facewear'` defensively, so keep for now).
9. **Cross-package duplicates of core exports** (belong to other tracks, recorded here because they explain
   knip's "unused" verdicts): `apps/web-app/src/shared/constants.ts:59` redefines `SUPPORTED_LOCALES`;
   `apps/discord-worker/src/services/i18n.ts:48` and `apps/moderation-worker/src/services/i18n.ts:34` each carry
   their own `SUPPORTED_LOCALES` (different shape); `apps/discord-worker/src/types/preferences.ts:140` has its own
   `MATCHING_METHODS` (value/name/description) while core's `MATCHING_METHODS` is a bare tuple;
   `packages/bot-logic/src/commands/accessibility.ts:30` and `apps/web-app/src/components/accessibility-tool.ts:110`
   each define `VISION_TYPES` (bot-logic's is the 4-lens list, web-app's a rich object list). Core's
   `VISION_TYPES`/`VISION_TYPE_LABELS` are the ones with zero consumers.
10. **Two blending stacks inside core** — `src/blending/conversions.ts` (307 lines) re-implements rgb↔lab/oklab/ryb/hsl
    hex helpers that `ColorConverter`/`RybColorMixer` already provide, and `blendColors()` parallels
    `ColorService.mixColors*` (web-app mixer calls the latter, bot-logic calls the former). Already tracked as an
    open checkbox in `DEPRECATIONS.md:244` ("unify duplicated conversions with ColorService inside core"). Not
    re-filed as new; noted so the two findings can be linked.

---

## 1. Barrel exports knip flagged (verified one by one)

Columns: `same` = uses inside the defining file (excl. definition); `core` = other core src (non-test); `test` =
core test refs; `scripts` = `scripts/*` + `test-build.mjs`; `docs` = README/CLAUDE mentions.
Source: `internal-usage.txt` (scratchpad) — commands: `python internal-usage` over `files.txt`, then hand-read.

### 1a. Values

| Symbol | Def | same/core/test/scripts/docs | Class | Notes |
|---|---|---|---|---|
| `MemoryCacheBackend` | services/APIService.ts:170 | 2/0/10/3/3 | INTERNAL-ONLY + DOCUMENTED | default backend inside `APIService` ctor (411, 418); README §Universalis shows `new MemoryCacheBackend()`. KEEP. |
| `SUPPORTED_LOCALES` | services/LocalizationService.ts:34 | 6/0/11/0/3 | INTERNAL-ONLY + DOCUMENTED | used by `extractLocaleCode`/`resolveLocaleFromPreference`; CHANGELOG 4.x says exported "for stateless callers (og-worker)" — og-worker only imports `extractLocaleCode`. web-app has its own copy. Keep export; low value to drop. |
| `resolveLocaleFromPreference` | LocalizationService.ts:88 | 4/0/17/0/2 | INTERNAL-ONLY + DOCUMENTED | called by `LocalizationService.resolveLocale` (283). No worker imports it (discord/moderation have own i18n). Keep or drop-from-barrel (low). |
| `MATCHING_METHODS` | types/index.ts | 1/0/10/0/3 | INTERNAL-ONLY + DOCUMENTED | `isMatchingMethod` iterates it. discord-worker defines its own richer list. KEEP. |
| `DYE_CATEGORIES`, `DYE_ACQUISITIONS` | config/dye-vocabulary.ts:20,34 | 1/0/2/0/2 each | INTERNAL-ONLY | only used to derive `DyeCategory`/`DyeAcquisition` types (same file) + `dye-vocabulary.test.ts`. Barrel export removable; the const must stay (type source). |
| `ACQUISITION_META` | dye-vocabulary.ts:56 | 1/2/2/0/3 | INTERNAL-ONLY + DOCUMENTED | `DyeDatabase.ts:235` derives cost/currency. Keep. |
| `METALLIC_STAIN_IDS` | dye-vocabulary.ts:70 | 0/2/4/3/4 | INTERNAL-ONLY + DOCUMENTED | `DyeDatabase.ts:259` + `scripts/build-locales.ts:518`. Keep. |
| `RATIO_BANDS` | config/band-vocabulary.ts:115 | 0/0/3/0/1 | TEST-ONLY (design constant) | only `band-vocabulary.parity.test.ts:55-56` reads it; web-app *deliberately* does not (`comparison-tool.ts:1930`, `metric-help.ts:23` comments say "not core's RATIO_BANDS"). 12 lines. Keep as documented 5.0 calibration output or drop from barrel — decide with design owner. |
| `SEPARATION_TIER_KEYS` | band-vocabulary.ts:128 | 0/0/0/0/1 | **DEAD** | 0 references anywhere (comment claims "locale strings key off these" — no locale file or app uses `merged/tight/workable/clear` as keys; web-app en.json only has an unrelated `"clear"`). 5 lines incl. comment. |
| `classifyBandTierWithCuts` | band-vocabulary.ts:141 | 2/0/3/0/1 | INTERNAL-ONLY | `classifyBandTier` (157) delegates to it; the JSDoc says it exists for "the ΔE2000-with-user-slider case" — no app uses that yet. Drop from barrel or keep for the slider; 15 lines. |
| `deriveDistinguishCuts` | band-vocabulary.ts:58 | 3/0/2/0/1 | INTERNAL-ONLY | builds the `distinguish` band sets at module init (90/98/106). Barrel export removable. |
| `calibrateBandVocabulary` | config/band-calibration.ts:229 | 0/0/2/2/1 | TEST/SCRIPT-ONLY | `scripts/calibrate-bands.ts:14,20` + parity test. See §0.3. Module 273 lines — keep module, drop 3 value + 4 type barrel exports (index.ts:112-127). |
| `DE2000_GROUND_TRUTH` | band-calibration.ts:66 | 6/0/2/0/1 | INTERNAL-ONLY (to calibration) | same story. |
| `METHOD_DISPLAY_DP` | band-calibration.ts:73 | 1/0/0/0/1 | INTERNAL-ONLY (to calibration) | same; note it duplicates `BAND_METHOD_DP` for the 4 calibrated methods. |
| `OFF_GRID_DELTA_E2000` | services/chara/chara-resolver.ts:33 | 1/0/3/0/1 | INTERNAL-ONLY | threshold used at 319; web-app never imports it. Barrel export removable (2 lines). |
| `LODESTONE_BY_REGION` | config/learn-links.ts:72 | 2/0/3/0/1 | INTERNAL-ONLY | `getLodestoneLink` (209) reads it; web-app/og-worker import `getLodestoneLink`/`getLearnLink`. Barrel export removable. |
| `XIVDYETOOLS_DOCS_URL` | learn-links.ts:69 | 1/0/0/0/1 | INTERNAL-ONLY | used by `MANUAL_TOPICS` (103). Barrel export removable. |
| `facewearColors`, `getFacewearColor` | config/facewear.ts:10,37 | 1/0/10/0/4 ; 1/0/5/0/2 | INTERNAL-ONLY + DOCUMENTED-PUBLIC-API | `getFacewearColorByLegacyItemID` (used by api-worker `routes/dyes.ts:230`) calls both. README §"Facewear colors are not dyes" and CLAUDE.md present `facewearColors` as *the* API. KEEP. |
| `LEGACY_FACEWEAR_ITEM_IDS` | facewear.ts:22 | 1/0/13/0/2 | INTERNAL-ONLY + FROZEN (documented) | read only by `getFacewearColorByLegacyItemID` (43); 13 test refs incl. `facewear.test.ts` freeze guard. KEEP; must never be regenerated. Barrel export could go but the CLAUDE.md contract names it — leave. |
| `RGB_MIN/MAX`, `HUE_MIN/MAX`, `SATURATION_MIN/MAX`, `VALUE_MIN/MAX` | constants/index.ts:18-29 | core 2–20 each | INTERNAL-ONLY + DOCUMENTED | `utils/index.ts` validators + `ColorConverter` (RGB_* ×16, HUE_MAX ×4). Keep. |
| `COLOR_DISTANCE_MAX` | constants:34 (`@internal`) | 0/6/2/0/2 | INTERNAL-ONLY | band-vocabulary, ColorConverter, DyeSearch. Marked `@internal` yet barrel-exported — drop from barrel. |
| `VISION_TYPES` | constants:42 (`@internal`) | 0/0/0/1/3 | **DEAD** | only `test-build.mjs:106` (itself orphaned) + docs. bot-logic and web-app define their own. 8 lines. |
| `VISION_TYPE_LABELS` | constants:51 (`@internal`) | 0/0/0/0/2 | **DEAD** | 8 lines. English-only labels superseded by the locale `visionTypes` section. |
| `BRETTEL_MATRICES`, `MACHADO_MATRICES` | constants:64,107 | 1/3/4/0/3 ; 0/2/0/0/1 | INTERNAL-ONLY | `ColorblindnessSimulator.ts:9,138`. Keep values; barrel export optional. |
| `PATTERNS` | constants:137 | 0/2/0/0/1 | INTERNAL-ONLY | `utils/index.ts:573` (`isValidHexColor`). web-app's `PATTERNS` (validate-i18n.js) is unrelated. `RGB_COLOR` pattern inside it has 0 uses. |
| `UNIVERSALIS_API_TIMEOUT/RETRY_COUNT/RETRY_DELAY`, `API_CACHE_TTL/CACHE_VERSION/MAX_RESPONSE_SIZE/RATE_LIMIT_DELAY` | constants:150-162 | core 2–5 each | INTERNAL-ONLY (APIService) | Keep. (`UNIVERSALIS_API_BASE` is LIVE — web-app `api-service-wrapper.ts:58`.) |
| `API_DEBOUNCE_DELAY` | constants:159 (`@internal`) | 0/0/0/0/2 | **DEAD** | 2 lines. |
| `clamp`, `round`, `isValidHexColor`, `isValidRGB`, `isValidHSV`, `sleep`, `retry`, `generateChecksum`, `isAbortError` | utils/index.ts | imported by ColorConverter/ColorblindnessSimulator/ColorManipulator/RybColorMixer/APIService (`grep "from '.*utils/index.js'" src`) | INTERNAL-ONLY + DOCUMENTED (README §Utilities shows clamp/lerp/generateChecksum) | Keep code; barrel export optional. |
| `lerp` (315-343), `distance` (376-406), `unique` (411-433), `groupBy` (434-473), `sortByProperty` (474-515), `filterNulls` (516-537), `isString`/`isNumber`/`isArray`/`isObject`/`isNullish` (649-754) | utils/index.ts | 0 core imports (word-hits for `round`/`distance`/`unique`/`isArray` in other files are unrelated identifiers — no `import {…} from utils` carries them) | **DEAD** (documented in CLAUDE.md:176 list + README lerp example) | ≈360 src lines + ≈290 test lines (`utils.test.ts` 119-156, 190-223, 224-338, 437-539). |
| `AsyncLRUCache` (utils/index.ts:127-282) | not in barrel | 0/0/10/0/0 | **TEST-ONLY** (tool missed: test entry) | 156 src + ≈146 test lines (`utils.test.ts:811-957`). `LRUCache` is live (ColorConverter ×7, ColorblindnessSimulator). |
| `VERSION` | src/version.ts (generated) | 0/0/0/3/3 | DOCUMENTED-PUBLIC-API, 0 consumers | See §0.6. |

### 1b. Types (all `export type`, zero runtime cost)

`APIServiceOptions`, `CacheMetrics`, `ResolvedPreset`, `PaletteExtractionOptions`, `ExtractedColor`,
`PaletteServiceOptions`, `CharacterMatchOptions`, `HarmonyMatchingAlgorithm`, `DeltaEFormula`, `RYB`,
`ConsolidatedDye`, `LocalizedDyeName`, `DyeCategory`, `DyeAcquisition`, `AcquisitionMeta`, `BandContext`,
`BandMethod`, `BandTier`, `MethodBandSet`, `ProductLink`, `ParsedCharaFile`, `CharaColorSlotRaw`, `CharaGearDye`,
`CharaGearSlotId`, `CharaSlotInertReason`, `ResolvedGearDye`, `CharaSlotVerdict`, `CharaSlotErrorCode`,
`StainIdLookup`, `ManualTopic` → every one is the parameter/return/companion type of a LIVE export
(`APIService`, `PresetService.getPresetWithDyes`, `PaletteService`, `CharacterColorService.findClosestDyes`,
`HarmonyOptions`, `getDeltaE`, `mixColorsRyb`, `CONSOLIDATED_DYES`, `BAND_VOCABULARY`, `PRODUCT_LINKS`,
`parseCharaFile`/`resolveCharaColors`, `MANUAL_TOPICS`). Exporting them is API hygiene → **DOCUMENTED-PUBLIC-API,
KEEP**. Exceptions worth a line each:
- `BandCalibrationResult`, `CalibratedMethodId`, `CalibratedMethodBands`, `RatioCalibration` — companions of the
  calibration tooling (§0.3); go with it.
- `CacheMetrics` — companion of `getCacheStats()` which is TEST-ONLY (§4); goes with it.
- `DeltaEFormula` still contains `'hyab'` (retired 5.0 method) — see §4 HyAB.
- `/blending` `RGB`, `LAB`, `HSL`, `BlendResult` — `RGB`/`LAB` duplicate `@xivdyetools/types` `RGB`/`LAB`
  structurally; only `BlendingMode` (type) is imported externally. Fold into DEPRECATIONS.md:244 refactor.

### 1c. `/blending` subpath (`src/blending/index.ts`)

External imports (bot-logic gradient/mixer, discord-worker preferences): `blendColors`, `BlendingMode`,
`BLENDING_MODES`, `isValidBlendingMode`. **Not imported anywhere outside the blending tests:**
`getBlendingModeDescription` (blending.ts:85-99, 15 lines — and its strings drift from
`BLENDING_MODES[].description`, e.g. "Simple additive channel averaging" vs "Additive channel averaging (default)")
and `rgbToLab` (web-app's `rgbToLab` hits are `ColorService.rgbToLab`). Both TEST-ONLY; knip missed them because
`blending.test.ts` imports from `./index.js`.

---

## 2. Whole-module orphans

Importer map (`for f in src/**/*.ts: grep -l "/<base>.js'" src scripts`): every non-test module has at least one
non-test importer besides the barrel **except**:
- `src/version.ts` → barrel only (§0.6).
- `src/config/product-links.ts` → barrel only, but `SOCIAL_LINKS`/`PRODUCT_LINKS` are LIVE (web-app, og-worker). Fine.
- `src/config/band-calibration.ts` → barrel + `scripts/calibrate-bands.ts` (§0.3).
- `src/config/facewear.ts`, `learn-links.ts`, `band-vocabulary.ts`, `services/dye/DyeFilter.ts`,
  `services/chara/chara-resolver.ts`, `services/APIService.ts`, `PaletteService.ts`, `PresetService.ts` → barrel
  only *inside core*, but each has live external importers (see imports.py output). LIVE.
- `src/types/spectral-js.d.ts` — ambient declaration for `spectral.js` (imported by `SpectralMixer.ts:17`). LIVE.
- `.chara`: `parseCharaFile` / `resolveCharaColors` are LIVE (web-app `components/chara-import.ts`, bot-logic
  `commands/swatch.ts`); the *equipment* resolution research (memory) is separate. `CharacterColorService` LIVE (4 src).
- `services/cache/*` does not exist as a directory; `MemoryCacheBackend` lives in `APIService.ts` (§1a).

---

## 3. Legacy markers (`legacy-markers.txt` lines for packages/core)

`grep -rn "@deprecated" packages/core/src` → **0 hits**. The markers are all dual-signature overloads or comments:

| Marker | What | Callers of the legacy shape | Class |
|---|---|---|---|
| `APIService` ctor (399-423): `options?: ICacheBackend \| APIServiceOptions, fetchClient?, rateLimiter?` | positional legacy branch + `isOptionsObject` sniffing | production: **none** (web-app `api-service-wrapper.ts:206` passes `{cacheBackend, …}`); core tests: `APIService.test.ts` ×15, `APIService.construction.test.ts` ×19 use positional; README:69,231,288 + `test-build.mjs:61` show positional | TEST-ONLY legacy overload → migrate tests+README, then delete branch (~10 lines + `isOptionsObject`) |
| `CharacterColorService.findClosestDyes(color, dyeService, countOrOptions: number \| CharacterMatchOptions)` (316-341) | number legacy | in-core `CharacterColorService.ts:387` (`findClosestDyes(color, dyeService, 1)`) + `CharacterColorService.test.ts:194,288,320`; web-app passes options | migrate 1 in-core call + 3 tests, then drop `number` |
| `DyeSearch.findClosestDye(hex, excludeIdsOrOptions: number[] \| FindClosestOptions)` (164-172) & `DyeService.findClosestDye` (211-215) | array legacy | in-core `HarmonyGenerator.ts:128` (`findClosestDye(hex, excludeIds)`); web-app test `dye-service.test.ts:171`; all app/bot-logic callers pass options or nothing | migrate 1 in-core call + 1 web-app test, then drop |
| `DyeSearch.findDyesWithinDistance(hex, maxDistanceOrOptions: number \| FindWithinDistanceOptions, limit?)` (255-272) & `DyeService` (225-234) | numeric legacy | production: **none** (api-worker, discord-worker, web-app ×2 all pass options); core `DyeSearch.test.ts:340-373, 561-583` numeric; README:153,376 numeric | migrate tests+README, drop `number` + trailing `limit` |
| `DyeSearch.ts:32` "default 'rgb' for backwards compatibility" | `findDyesWithinDistance` defaults `matchingMethod='rgb'` (272) while `findClosestDye` defaults `'ciede2000'` (175) | discord-worker `extractor.ts:121-124` relies on the default (no `matchingMethod`) → gets RGB while its primary match used the user's method | not dead code — **stale-default inconsistency**; flag to owner |
| `DyeDatabase.ts:120,126,204-232` legacy `id`/`itemID`/`price` acceptance | production code branch kept for "runtime-shaped test fixtures" | test-utils `factories/dye.ts` already emits `stainID`; the branch is exercised by `DyeDatabase.test.ts:835` "legacy Facewear input" etc. | keep (cheap), or tighten once fixtures are all schema-v2 |
| `types/index.ts:72` `LEGACY_MATCHING_METHOD_MAP` | 4.x → 5.0 method normalisation | LIVE: api-worker imports it; `normalizeMatchingMethod` uses it; og-worker `index.ts:88-95` still accepts `euclidean/hyab/oklch-weighted` | LIVE (intentional compat) |
| `facewear.ts:22,42` `LEGACY_FACEWEAR_ITEM_IDS` / `getFacewearColorByLegacyItemID` | frozen compat map | api-worker `routes/dyes.ts:230` (negative-ID 404 with slug) | LIVE, frozen |
| `ColorService.ts:9,52`, `DyeService.ts:9,53` "backward compatibility" | facade classes over split services | LIVE (facades are the API) — but see §4 for facade methods with no callers |
| `ColorblindnessSimulator.ts:116`, `constants:97` "legacy Brettel path" | Brettel vs Machado | both LIVE (Brettel = `simulateColorblindnessHex`, 15 ext src; Machado = band calibration + tests only, see §4) | LIVE / TEST-ONLY(Machado public methods) |

---

## 4. Class members with zero production callers (knip blind spot)

`members.py` output (`members-out.txt`). "ext" = outside packages/core; "core" = core non-test incl. facade
delegation. All items below: ext-src 0 **and** no core non-test caller other than their own facade wrapper.

| Class.member | Lines | Ext test refs | Notes |
|---|---|---|---|
| `APIService.getPricesForItems` (1025-1094) | 70 | 0 | batch price fetch; web-app uses `getPriceData`/`getPricesForDataCenter`. README:238 + CLAUDE.md:146 document it. Core tests: 23 refs. |
| `APIService.getPriceTrend` (1222-1242, static) | 21 | 0 | README:249, CLAUDE.md:150. Tests: `describe('getPriceTrend')` 1345+. |
| `APIService.getCacheStats` (544-550), `resetMetrics` (552-563) + `CacheMetrics` type + metrics bookkeeping | ≈40 | 0 | README:242, CLAUDE.md:149. 48 test refs. |
| `DyeService.getDyesByIds` → `DyeDatabase.getDyesByIds` | 6+10 | 0 | CLAUDE.md:116 lists both. |
| `DyeService.getDyesByStainIds` → `DyeDatabase.getDyesByStainIds` | 13+17 | 0 | 5.0 stainID-first — apps use singular `getByStainId` (13 refs). |
| `DyeService.getLastLoadedTime` → `DyeDatabase.getLastLoadedTime` | 6+6 | 0 | |
| `DyeService.getDyesSortedBy{Brightness,Saturation,Hue}` → `DyeSearch.*` (342-382) | 18+39 | web-app tests only (mocks) | |
| `DyeService.findCompoundDyes` / `findShadesDyes` → `HarmonyGenerator` (282-323) | 16+28 | 0 | web-app `harmony-generator.ts:82-83` implements compound/shades itself; bot-logic harmony has no compound/shades. |
| `DyeService.getLocalizedDyeById` (400-426), `getLocalizedDyeByStainId` (428-449), `getAllLocalizedDyes` (451-477), `getNonMetallicDyes` (479-497) | 95 | 0 | apps localise via `LocalizationService.getDyeName` (23 ext src). |
| `ColorService.mixColorsOklch` (726-752), `mixColorsLch` (754-781), `mixColorsHsv` (812-838) | 82 | 0 | web-app `MixingMode = rgb\|lab\|oklab\|ryb\|hsl\|spectral`; bot uses `/blending`. CLAUDE.md:110 lists them. |
| `ColorService.mixMultipleSpectral` (869-878), `gradientSpectral` (880-893), `isSpectralAvailable` (895-902) → `SpectralMixer.mixMultiple` (67-107), `gradient` (109-137), `isAvailable` (139-150) | 32+82 | 0 | CLAUDE.md:209 documents `isSpectralAvailable()`. Only `SpectralMixer.mixColors` is live. |
| `ColorConverter.getDeltaE_HyAB` (921-956) + `DeltaEFormula` `'hyab'` + `getDeltaE` case | 36+3 | 0 (og-worker lists 'hyab' only as a legacy token to normalise) | retired v4 method; `normalizeMatchingMethod('hyab') → 'ciede2000'`. |
| `PresetService.getPresetCountByCategory` (156-166), `getPresetsByTag` (212-220), `resolvePresets` (289-300), `getVersion`, `getLastUpdated`, `getPresetCount` (306-328) | 53 | 0 | web-app `hybrid-preset-service.ts` is the only consumer of `PresetService`. |
| `CharacterColorService.preloadRaceData` (265-272), `getSharedColorByIndex` (425-431), `getRaceSpecificColorByIndex` (433-444), `getAvailableSubraces` (450-455), `getVersion` (457-462), `getGridColumns` (464-469) | 45 | 0 | |
| `PaletteService.pixelDataToRGB` (475-495) | 21 | 0 | README:213 documents it; apps use `pixelDataToRGBFiltered`. |
| `ColorblindnessSimulator.simulateColorblindnessMachado`/`…MachadoHex` (+ `ColorService` facades) | — | 0 | used by `band-calibration.ts` (script/test-time) only. Keep with the calibration module. |
| `KDTree.getSize` | small | 0 (ext hits are other classes' `getSize`) | test-only. |

Facade methods with 0 ext-src but ≥1 ext-test or in-core use (`hsvToRgb`, `getRedmeanDistance`,
`getDistinguishabilityPercent`, `simulateColorblindness` (RGB form), `getPerceivedLuminance`, `meetsWCAGAA/AAA`,
`getOptimalTextColor`, `adjustBrightness/Saturation`, `invert`, `desaturate`, `labToRgb`, `rgbToOklab`,
`hexToOklab`, `oklabToRgb`, `oklabToHex`, `rgbToOklch`, `oklchToRgb`, `labToLch`, `lchToLab`, `rgbToLch`,
`lchToRgb`, `rgbToHsl`, `hexToHsl`, `hslToRgb`, `hslToHex`, `rgbToCmyk`, `cmykToRgb`, `cmykToHex`,
`rybToRgb`, `rgbToRyb`, `hexToRyb`, `rybToHex`, `interpolateHue`, `clearCaches`) are the published
colour-science surface (README §ColorService, CLAUDE.md:100-112). DOCUMENTED-PUBLIC-API — not proposed.

---

## 5. Data files

- `dyes.json`: 125 entries × exactly the 7 documented fields (`stainID,name,hex,category,acquisition,consolidationType,legacyItemID`). No extra fields.
- `facewear_colors.json`: 11 × `{id,name,hex}` — all read by `FacewearColor`. Clean.
- `presets.json`: `{version,lastUpdated,categories,palettes}` — `PresetService.getVersion/getLastUpdated` are the only readers of the two meta fields and are TEST-ONLY (§4); og-worker reads `palettes` directly.
- `character_colors/*.json`: all imported by `CharacterColorService` (eager shared, lazy race-specific).
- `character_colors.json` (monolith): **orphan** (§0.1).
- `locales/*.json` (generated by `build-locales.ts`, tracked): every section has an accessor; sections whose accessor
  has zero external consumers: `metallicDyeIds`, `jobNames`, `grandCompanyNames` (§0.8). `dyeNames` is keyed by
  legacy itemID (`getDyeName(itemID)`) — consistent with `Dye.itemID`, fine.

## 6. Dependencies (`packages/core/package.json`)

| Dep | Used by | Verdict |
|---|---|---|
| `spectral.js` | `src/services/color/SpectralMixer.ts:17` | LIVE |
| `@xivdyetools/logger`, `@xivdyetools/types` | throughout | LIVE |
| `csv-parse`, `yaml` (dev) | `scripts/build-locales.ts:11-12` (runs in `build`) | LIVE |
| `tsx` (dev) | `build:version`, `build:locales`, `copy:locales` scripts | LIVE |
| `typedoc` (dev) | `docs` script only — unwired (§0.4) | ORPHAN tooling |
| `typedoc-plugin-markdown` (dev) | nothing (`typedoc.json` has no `plugin`) | **UNUSED — knip correct** |
| `@types/node`, `vitest`, `@vitest/coverage-v8` | build/test | LIVE |
| `rimraf` (used by `clean`) | root devDependency, hoisted | fine |

## 7. Scripts / bench / typedoc

- `scripts/generate-version.ts` (38) → `build:version` (LIVE, but only to feed the unread `VERSION`, §0.6).
- `scripts/build-locales.ts` (1,217) → `build:locales` (LIVE; contains the three test-only section builders §0.8).
- `scripts/copy-locales.ts` (55) → `copy:locales` (LIVE).
- `scripts/calibrate-bands.ts` (21) → not in package.json; documented in CHANGELOG + module headers as the manual
  recalibration path guarded by the parity test. Intentional one-off tool — KEEP, but it should be listed as a
  script (`"calibrate:bands"`) so it is discoverable.
- `scripts/fetch_dye_names.py` (313) + `requirements.txt` + `scripts/output/.gitkeep` → manual, documented in
  `scripts/README.md` and CLAUDE.md. KEEP.
- `test-build.mjs` (117) → orphan (§0.5).
- `typedoc.json` + `docs` script → orphan (§0.4).
- No `bench*` files; the "benchmarks" are `src/__tests__/integration/performance-benchmarks.test.ts` (vitest, LIVE).
- `dyenames.csv`, `localize.yaml` → inputs of `build-locales.ts`. LIVE.

## 8. Stale tests

- No test file targets a missing module (all 40 test files map to live modules).
- Tests that exercise only removal candidates (would go with them): `utils.test.ts` blocks for lerp/distance/array
  helpers/type guards/AsyncLRUCache (≈436 lines); `APIService.test.ts` `getPriceTrend` block + `getPricesForItems`
  cases; `DyeService.test.ts:454-560` localized/non-metallic blocks; `PresetService.test.ts:431-750` six blocks;
  `SpectralMixer.test.ts:17-200` isAvailable/mixMultiple/gradient; `HarmonyGenerator.test.ts:367-410, 616-650`
  compound/shades; `DyeSearch.test.ts:378-460` sorted-by blocks + numeric-overload cases 340-373/561-583;
  `APIService.construction.test.ts` positional-ctor cases; `band-vocabulary.parity.test.ts` stays (guard).
- Retired-vocabulary residue in tests: `'cie2000'` is still the live `DeltaEFormula` spelling (only
  `MatchingMethod` uses `'ciede2000'`) — not stale, just two vocabularies for one formula.
- `src/types/__tests__/{index,types,matching-method}.test.ts` — three files for one module; overlap not measured.

## 9. Duplicate implementations inside core

- `src/blending/conversions.ts` vs `ColorConverter`/`RybColorMixer` (rgb↔lab/oklab/ryb/hsl, hex↔rgb) — tracked in DEPRECATIONS.md:244.
- `getBlendingModeDescription` strings vs `BLENDING_MODES[].description` (drifted copies).
- `METHOD_DISPLAY_DP` (band-calibration) vs `BAND_METHOD_DP` (band-vocabulary) for the 4 calibrated methods.
- Inline `/^#[A-Fa-f0-9]{6}$/` in `DyeDatabase.ts:139,225` vs `PATTERNS.HEX_COLOR` / `isValidHexColor` (the
  latter also accepts 3-digit hex, so the inline copies are deliberately stricter — note only).
- Rec.709 luminance coefficients appear in `ColorAccessibility.ts:34`, `MACHADO_MATRICES.achromatopsia`, and
  (as the 0.2126729… variant) `ColorConverter.ts:548` + `blending/conversions.ts:23` — different precisions.
- Inline clamps (`Math.max(0, Math.min(255, …))`) ×12 in `blending/conversions.ts`, `chara-parser.ts:165`,
  `chara-resolver.ts:123`, `ColorConverter.ts:1040` next to the exported `clamp()`.
- `DeltaEFormula` (`'cie2000'`) vs `MatchingMethod` (`'ciede2000'`) — two spellings of the same algorithm; every
  consumer that maps between them (`DyeSearch.ts:67-74`, `ColorService.ts:182-186`, `CharacterColorService.ts:294-305`)
  carries a switch for it.

## 10. Line-count summary for the proposed removals

| Group | src lines | test lines |
|---|---|---|
| utils dead helpers (lerp, distance, unique, groupBy, sortByProperty, filterNulls, isString/isNumber/isArray/isObject/isNullish) | ≈360 | ≈290 |
| `AsyncLRUCache` | 156 | ≈146 |
| constants `VISION_TYPES`, `VISION_TYPE_LABELS`, `API_DEBOUNCE_DELAY`, `SEPARATION_TIER_KEYS` | ≈23 | 0 |
| `test-build.mjs` | 117 | — |
| `character_colors.json` | 1 line / 798 KB | — |
| `typedoc.json` + `docs` script + 2 devDeps | 25 + 3 | — |
| `VERSION` machinery (`version.ts`, `generate-version.ts`, `build:version`) | ≈45 | — |
| band-calibration barrel exports (module stays) | 12 barrel lines | 0 |
| `/blending` `getBlendingModeDescription` + `rgbToLab` re-export | 16 | ≈15 |
| APIService `getPricesForItems`/`getPriceTrend`/`getCacheStats`/`resetMetrics`/`CacheMetrics` | ≈130 | ≈120 |
| DyeService/DyeDatabase/DyeSearch/HarmonyGenerator TEST-ONLY chain (12 facade methods) | ≈250 | ≈300 |
| ColorService mix/spectral facades + SpectralMixer `mixMultiple`/`gradient`/`isAvailable` | ≈115 | ≈150 |
| `getDeltaE_HyAB` + `'hyab'` | ≈40 | ≈20 |
| PresetService ×6, CharacterColorService ×6, `PaletteService.pixelDataToRGB` | ≈120 | ≈200 |
| Legacy overloads (APIService ctor, findClosestDye/findClosestDyes/findDyesWithinDistance) after migration | ≈40 | (rewrite ≈60) |
| Locale sections `metallicDyeIds`/`jobNames`/`grandCompanyNames` + builders + accessors + `JobKey`/`GrandCompanyKey` | ≈150 (across core, types, 6 JSON) | ≈60 |

Everything in the class-member and locale rows is documented in `packages/core/CLAUDE.md`/README as the package API
→ REMOVE WITH CAUTION (semver-minor break for hypothetical external npm consumers; in-repo blast radius 0).
