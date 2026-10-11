# Review: packages cluster (core, types, logger, test-utils, projects index)

Run 2026-10-11, HEAD 42c35e87 (== served 16a6123f for all code). Read-only review; this is the only file written.

## Coverage

| Path | Tier | Units | Sections reviewed | Result |
|------|------|-------|-------------------|--------|
| docs/projects/core/algorithms.md | living | packages/core | all 499 lines: k-d tree, hue buckets, harmony, wheels, bands, K-means, delta E, CVD matrices, LRU | reviewed (cand-packages-01, 05, 10; the pi stat values and the 60-80% hit rate are unverifiable and left alone) |
| docs/projects/core/overview.md | living | packages/core, types | all 343 lines: quick start, v2/v4 migration notes, features, architecture, type safety | reviewed (cand-packages-02, 10; the "Coral Pink 9.57" example output was not executed, see unverified note) |
| docs/projects/core/publishing.md | living | packages/core | all 44 lines | reviewed, no defects (build script order, scripts and source files exist) |
| docs/projects/core/services.md | living | packages/core | all 294 lines: ColorService, DyeService, PaletteService, APIService, PresetService, LocalizationService | reviewed (cand-packages-03, 04, 06, 07, 08, 10) |
| docs/projects/core/types.md | living | packages/core, types | all 230 lines: ownership table, branded, Dye, harmony, bands, API, locale | reviewed (cand-packages-10 only) |
| docs/projects/logger/overview.md | living | packages/logger | all 167 lines: factories, subpaths, config, extended API | reviewed (cand-packages-10 only) |
| docs/projects/test-utils/overview.md | living | packages/test-utils | all 218 lines: subpaths, every mock, factories, auth, PKCE | reviewed (cand-packages-08 note only) |
| docs/projects/types/overview.md | living | packages/types | all 204 lines | reviewed (cand-packages-02, 09, 10) |
| docs/projects/index.md | living | repo-wide | all 169 lines: matrix, diagram, link tables; counts (10 tools, 18 commands, 125 dyes, 11 Facewear) | reviewed (cand-packages-10 only) |

Method: every export name in docs was matched against `packages/core/src/index.ts`, `packages/types/src/index.ts` (+ `package.json` exports), `packages/logger/src/index.ts`, `packages/test-utils/src/*/index.ts`; signatures were read from source. Anchors in these files (`algorithms.md#harmony-generation`, `#extraction-options`) resolve (headings at algorithms.md:108 and :295).

Recent-change check (`git log --since=2026-09-21 --no-merges` over core/types/logger/test-utils): logger 2.3.0 (redaction in context strings, toJSON) is correctly described by logger/overview.md:112; test-utils 3.0.0 removals (`createMockD1`, `randomStainId`, `./auth` subpath, `/dom`, `/assertions`) are correctly described; core 5.9.0 `getPricesForDataCenterWithOutcome` / `PriceBatchResult` / `CHARA_DYEABLE_SLOTS` are not in services.md (cand-packages-07); types 3.3.0 review custom_id grammar is not in types/overview.md (cand-packages-09).

## Candidates

### cand-packages-01 (MEDIUM, inaccurate): `classifyBandTier` argument order swapped
- Doc: docs/projects/core/algorithms.md:226 gives `classifyBandTier(distance, context, method)`.
- Source: packages/core/src/config/band-vocabulary.ts:158-165 `classifyBandTier(value, method, context)` and looks up `BAND_VOCABULARY[context][method]`. Following the doc passes a context string as `method`: a type error, and at runtime `BAND_VOCABULARY[method][context]` is undefined and throws.
- Fix: "`classifyBandTier(distance, method, context)` returns the `BandTier`".

### cand-packages-02 (MEDIUM, inaccurate): type-only names imported without `import type`
- Under the repo's `verbatimModuleSyntax` these are TS1484 errors (the snippets import type-only exports in a plain value import):
  - docs/projects/core/overview.md:93 (the "After (v2.0.0+)" snippet, all five names are types) and :324 (`createHexColor, createDyeId` mixed with types `HexColor, DyeId`)
  - docs/projects/types/overview.md:34, :55, :91, :131 (all types) and :163-170 (mixed)
- Source: packages/types/src/index.ts:25-27 (`export type { RGB, HSV, ... }`, `export type { HexColor, DyeId, Hue, Saturation }`), :40-46 (`Dye`, `FacewearColor`), :80-103 (preset types), :118-129 (auth types). The correct pattern is already used in docs/projects/core/types.md:37-38 and types/overview.md:190-196.
- Fix: use `import type { ... }` for the type-only lines; split the mixed ones into `import { createHexColor, createDyeId } ...` + `import type { HexColor, DyeId } ...`. Out of cluster, same pattern: docs/CLAUDE.md "Service Usage" snippet `import { Dye, RGB, HexColor } from '@xivdyetools/types'`.

### cand-packages-03 (LOW, inaccurate): `getCategories()` order
- Doc: docs/projects/core/services.md:138 shows `['Neutral', 'Reds', 'Browns', 'Yellows', 'Greens', 'Blues', 'Purples', 'Special']` as the return of `dyeService.getCategories()`.
- Source: packages/core/src/services/dye/DyeDatabase.ts:496-505 returns `Array.from(categories).sort()`, i.e. alphabetical: `['Blues','Browns','Greens','Neutral','Purples','Reds','Special','Yellows']`. The doc order is `DYE_CATEGORIES` (config/dye-vocabulary.ts:20-29).
- Fix: show the sorted order, or say the set is the eight `DYE_CATEGORIES`, returned sorted alphabetically.

### cand-packages-04 (LOW, inaccurate): "seven LRU caches" is eight in `clearCaches` / `getCacheStats`
- Doc: docs/projects/core/services.md:118 ("cover the seven LRU caches"); docs/projects/core/algorithms.md:473 ("`clearCaches()` empties all seven and `getCacheStats()` reports on them").
- Source: ColorConverter has seven (packages/core/src/services/color/ColorConverter.ts:95-101), but `ColorService.clearCaches()` also calls `ColorblindnessSimulator.clearCache()` and `getCacheStats()` returns 8 keys including `colorblind` (packages/core/src/services/ColorService.ts:63-83; simulator cache `LRUCache(1000)` at ColorblindnessSimulator.ts:19). algorithms.md:466-470 ("ColorConverter builds seven") is right.
- Fix: "the seven ColorConverter caches plus the colorblindness simulator's cache (eight keys in `getCacheStats()`)".

### cand-packages-05 (LOW, inaccurate): Brettel "Algorithm" section describes an LMS pipeline core does not run
- Doc: docs/projects/core/algorithms.md:380-392 says the algorithm converts RGB to LMS, applies a confusion matrix, converts back, and gives `L_simulated = 2.02344 x M - 2.52581 x S`.
- Source: packages/core/src/services/color/ColorblindnessSimulator.ts:39-68 applies the precomputed 3x3 `BRETTEL_MATRICES[visionType]` directly to gamma-encoded sRGB; no LMS step or those coefficients exist (grep of the file for `LMS` / `2.02344`: no match). The doc's own next section (:396-399) states the gamma-encoded application correctly.
- Fix: replace the three-step LMS block with "multiply the RGB vector by the precomputed 3x3 matrix for the vision type (gamma-encoded sRGB, no LMS step); Machado path linearizes first".

### cand-packages-06 (LOW, inaccurate): `getLabel` result annotated as `TranslationKey`
- Doc: docs/projects/core/services.md:270 `LocalizationService.getLabel('metallic');       // TranslationKey`.
- Source: packages/core/src/services/LocalizationService.ts:349,356 `getLabel(key: TranslationKey, locale?): string`. `TranslationKey` is the parameter type; the return is a string.
- Fix: `// string (the localized label)`.

### cand-packages-07 (LOW, missing): batch price outcome API not documented
- Doc: docs/projects/core/services.md:207-232 (APIService section) and overview.md:259-269 mention only `getPriceData` and `getPricesForDataCenter`.
- Source: packages/core/src/services/APIService.ts:1060 `getPricesForDataCenterWithOutcome(itemIDs, dataCenterID): Promise<PriceBatchResult>`; types `PriceBatchOutcome = 'ok'|'partial'|'error'` and `PriceBatchResult { prices, outcome }` at :346-358, exported from packages/core/src/index.ts:20-25. Shipped in core 5.9.0 (docs/versions.md:73). `getPricesForDataCenter` (:1029) cannot distinguish an outage from "no listings", which is exactly why the new method exists.
- Fix: add two lines under APIService: the method, the three outcomes, and that `getPricesForDataCenter` returns the same map without the outcome.

### cand-packages-08 (LOW, missing): public exports with no coverage in the package docs
- core services.md covers only the six facade services. Exported and undocumented there: the `.chara` import surface (`parseCharaFile`, `resolveCharaColors`, `charaTwinsOf`, `groupCharaTwinRules`, `GPOSERS_*`, `CHARA_DYEABLE_SLOTS`, `CharacterColorService`) at packages/core/src/index.ts:47-52, 224-300; `getMarketItemID` / `CONSOLIDATED_DYES` at :133-146; `getFacewearColor` / `getFacewearColorByLegacyItemID` at :318-326; the dye-filter helpers at :113-122. Only a one-line bullet in overview.md:18 mentions `.chara`. (The Glamour Reader docs live in web-app/tools.md; the core API surface is not described anywhere under docs/projects/core.)
- test-utils: packages/test-utils/src/index.ts re-exports `./utils/index.js` (`randomId`, `randomStringId`, `nextStringId`, utils/counters.ts:32-52), absent from docs/projects/test-utils/overview.md.
- Fix: add a short ".chara import" section and a one-paragraph "consolidation / Facewear / filter helpers" list to services.md; add a line for the id helpers to the test-utils overview.

### cand-packages-09 (LOW, missing): types overview omits the review custom_id grammar, `ErrorCode`/`AppError` and the subpaths
- Doc: docs/projects/types/overview.md has no mention; packages/types/package.json:10-47 declares eight subpaths (`./color`, `./dye`, `./character`, `./preset`, `./auth`, `./api`, `./error`, `./localization`).
- Source: packages/types/src/index.ts:96-103 (`REVIEW_STATUSES`, `isReviewStatus`, `parseReviewCustomId`, `buildReviewCustomId`, `buildReviewCustomIdOrLegacy`, types 3.3.0 per docs/versions.md:337), :163-164 (`ErrorCode`, `AppError`), :27-34 `classifyMatchDistance`. packages/types/README.md:251-259 documents the review grammar; docs/projects/core/types.md:215-217 mentions `AppError`/`ErrorCode`.
- Fix: a "Moderation review ids", "Errors" and "Subpaths" paragraph in types/overview.md pointing to the README.

### cand-packages-10 (LOW, spelling; supersedes 2026-09-21-documentation/DOC-003): 24 British spellings across 7 documents in this cluster
Top three: docs/projects/core/types.md (6), docs/projects/core/algorithms.md (5), docs/projects/index.md (4). Full table below. Run `node .agents/skills/audit-shared/scripts/american-spelling.mjs . <files> --fix`, then hand-fix the two dictionary misses (`capitalised`).

### Prior re-check
- DOC-003 (41 spellings across 13 docs, algorithms.md had 5): algorithms.md still has 5 (172, 190, 196, 197 + 340); core/overview, services, types, index, types/overview, logger still carry theirs. STILL_PRESENT for this cluster; folded into cand-packages-10.

## Positive controls (checked and correct)
- core index barrel: every name in docs/projects/core/{overview,services,types,algorithms}.md exists (`MemoryCacheBackend`, `LocaleLoader`/`LocaleRegistry`/`TranslationProvider`, `COLOR_WHEEL_IDS`, `COLOR_WHEEL_TAGS`, `getColorWheel`, `parseColorWheelId`, `normalizeColorWheelId`, `generateHarmonySlots`, `isKnownHarmonyType`, `HARMONY_OFFSETS` (10 keys, values identical at constants/index.ts:166-177), `BAND_VOCABULARY` cut values at band-vocabulary.ts:92-117, `BRETTEL_MATRICES` / `MACHADO_MATRICES` verbatim at constants/index.ts:45-106, `LEGACY_MATCHING_METHOD_MAP`).
- ColorService scalar signatures (`rgbToHsv(r,g,b)`, `rgbToHex(r,g,b)`, `labToRgb(L,a,b)`), `mixColors*` (six, ratio default 0.5), `getDeltaE` default `'cie76'`, `DeltaEFormula` incl. `cie2000` alias, nine color spaces, `simulateColorblindness*Hex` variants, no `lighten/darken/blend` exist.
- DyeService: `getByStainId`, `findClosestDye(hex, {matchingMethod, excludeIds}) -> Dye|null`, `findDyesWithinDistance`, `filterDyes`, all find*Dyes and defaults; 125 dyes; Dye has 17 fields (packages/types/src/dye/dye.ts); Jet Black stainID 102 / itemID 13115, Snow White 5729, `season-spring` preset id and 15 curated rows exist.
- PaletteService option clamps/defaults (colorCount 4, maxIterations 25, maxSamples 10000) and `PaletteMatch` shape; `ICacheBackend` has five members; `APIServiceOptions` five fields; `PresetService` and `LocalizationService` method lists; `LocalizationService.getLabel` etc exist as both instance and static.
- types package: `createDyeId` 1-254 null, `createHexColor` throws, `createHue` normalizes, `Matrix3x3` only on `/color`, `PresetCategory`/`PresetStatus`/`CommunityPreset`/`JWTPayload`/`PriceData`/`CachedData`/`LocaleCode`/`TranslationKey` shapes match.
- logger: four subpaths and no `/node`; factory signatures; `LoggerConfig`; 22 + 4 redaction fields; `error(message, error?, context?)`.
- test-utils: four subpaths, no `./auth`; every `_` helper named (`_setupMock`, `_setBanStatus`, `_setBatchFailure`, `_ttls`, `_setupResponse`, `_setDefaultResponse`, `_dataPoints`), `createTestJWT` / `createExpiredJWT` / `authHeaders` signatures, 254-dye sequence guard, KV 60 s TTL minimum.
- publishing.md: `build` = `build:locales` -> `tsc -p tsconfig.build.json` -> `copy:locales`; `build:oklch-hue` / `build:munsell` exist and are outside `build`; `localize.yaml`, `dyenames.csv`, `facewear-names.csv` are tracked.
- projects/index.md counts (10 tools, 18 slash commands, 125 dyes, 11 Facewear) and `/universalis` + `/api/v2` mounts (apps/api-worker/src/index.ts:187-188); image-worker `@cf-wasm/photon` dependency.

## Rejected suspicions
- Hue bucketing section (algorithms.md:68-106) as stale: `getHueBucketsToSearch` / `getDyesByHueBucket` are still used by the legacy `HarmonyGenerator` (HarmonyGenerator.ts:548-551); only `generateHarmonySlots` bypasses them. Doc is true for the legacy path.
- "Facewear entries are skipped unconditionally" (algorithms.md:170): HarmonySelector.ts:155 does skip `category === 'Facewear'`, which is now unreachable for real dyes but harmless; claim is literally true.
- Logger "three layers of secret redaction on by default": key list + suffix pattern + free-text sanitization; `sanitizeErrors` defaults true (base-logger.ts:184); the browser preset turns it off only in dev. Accepted.
- Root docs "16-field Dye": not in this cluster; the cluster's "17-field" is correct (dye.ts lists 17).
- "Coral Pink (delta E2000 9.57)" (overview.md:54): could not execute (types dist not built in this worktree; a tsx run failed on `ERR_PACKAGE_PATH_NOT_EXPORTED`). Left unverified, not filed.

## Spelling per-document table (all prose, none quoted UI labels; `en.json` has only a key named `colours`)

| Document | Count | Locations |
|----------|-------|-----------|
| docs/projects/core/types.md | 6 | 10 behaviour; 43 normalised; 54 Colour; 63 capitalised (dictionary miss); 77 normalisation; 128 colour |
| docs/projects/core/algorithms.md | 5 | 172 Colour; 190 behaviour; 196, 197 colour; 340 capitalised (dictionary miss) |
| docs/projects/index.md | 4 | 63 colours, 64 Colour (ASCII-diagram prose); 102 colour; 145 behaviour |
| docs/projects/core/overview.md | 3 | 146 colour; 156 colours; 209 colour |
| docs/projects/core/services.md | 3 | 25 Colour; 47 colour; 101 Colourblindness |
| docs/projects/types/overview.md | 2 | 7 colours; 74 colour (code comment) |
| docs/projects/logger/overview.md | 1 | 112 sanitisation (code comment) |
| docs/projects/core/publishing.md, docs/projects/test-utils/overview.md | 0 | - |
| Total | 24 | 15 default sweep + 7 --all extras (comments/ASCII prose, all counted) + 2 dictionary misses (`capitalised`) |

Rejected from the extras: none (every --all row is English comment or ASCII-diagram prose, not an identifier). Dictionary misses: `capitalised` x2.
