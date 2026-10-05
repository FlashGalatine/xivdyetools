# Dead-code review: group "core" (packages/core)

Reviewer: worker, 2026-10-04, read-only. Branch preview/integration-2026-10-04. No PR in pr-delta.txt touches packages/core; the only delta is delta-since-2026-09-15.txt (42 files: chara-*, CharacterColorService, DyeDatabase, ColorConverter +12, LocalizationService/LocaleLoader/Registry/TranslationProvider small edits, utils/index.ts +55, index.ts +41, build-locales.ts +64, character_colors data).

## Module map
- Barrel `src/index.ts` (~170 export specifiers), subpath `./blending` (`src/blending/index.ts`: blendColors, BLENDING_MODES, isValidBlendingMode + @public types), `./package.json`.
- Services: ColorService facade -> color/{ColorConverter,ColorManipulator,ColorAccessibility,ColorblindnessSimulator}; DyeService facade -> dye/{DyeDatabase,DyeSearch,HarmonyGenerator}; HarmonySelector (live harmony path); wheels/*; LocalizationService facade -> localization/{LocaleLoader,LocaleRegistry,TranslationProvider}; APIService; PaletteService; PresetService; CharacterColorService; chara/* (parser, resolver, models, game-rules, twins, gposers, shader-colors).
- Generators: scripts/build-locales.ts (localize.yaml + dyenames.csv + facewear-names.csv -> src/data/locales/*.json; run by `build`), build-munsell-hues, build-oklch-hue-table, build-character-colors, calibrate-bands, copy-locales, fetch_dye_names.py (manual).

## Commands run and results
1. `sed dead-code-check.txt`: core owns 0 @testonly, 0 @entrypoint, 3 @public ColorService members (hexToRyb, rybToHex, interpolateHue) + LocalizationService.getAvailableLocales (all DEAD-018 KEEP). Result as stated.
2. Enumerated every `export` declaration in packages/core/src + scripts (251 names) -> `git grep -ow` of all names over all tracked non-doc files (excluding docs/audits, md, lock, coverage, json) -> bucketed by core-prod / core-test / external-prod / external-test / barrel. Result: 0 names with zero production references beyond the definition; 26 names whose only prod file is their own (list below); every barrel export without an external prod consumer carries `/** @public */` (spot-verified; knip gate green).
3. `isColorWheelId`: external consumers are discord-worker tests only, but it is used by `parseColorWheelId` in ColorWheel.ts and tagged @public in the barrel -> live.
4. `members.py` equivalents (own script over all tracked ts/js) for ColorService, ColorConverter, ColorManipulator, ColorAccessibility, ColorblindnessSimulator, DyeService, DyeDatabase, DyeSearch, HarmonyGenerator, LocalizationService, TranslationProvider, LocaleLoader/Registry, PresetService, PaletteService, APIService (+DefaultFetchClient, DefaultRateLimiter, MemoryCacheBackend), CharacterColorService, LRUCache, KDTree. Method-level zero-external-caller sets are in candidates below.
5. `git grep` of find{Complementary,Analogous,Triadic,Square,Tetradic,InvertedTetradic,Monochromatic,SplitComplementary} outside tests: only DyeService.ts:219-316 (delegates) and HarmonyGenerator.ts:168-373. Only consumers are core tests and apps/web-app/src/services/__tests__/dye-service.test.ts:197+. HarmonyGenerator.ts:33-39 states these "survive as published npm API" and the façade "nothing in this monorepo calls".
6. `git grep getToolName|ToolKey|tools`: LocalizationService.ts:494-509 @deprecated I18N-003 ("no consumer in this monorepo ... Removal is a core major"); og-worker og-data-generator.ts:172-180 says "never core tools.*". Locale `tools` section still generated (build-locales.ts:250, buildTools:814).
7. `git grep getLabel|\.labels`: only caller is web-app LanguageService.getLabel (language-service.ts:264) whose only caller is language-service.test.ts:233.
8. `git grep` skip/only/todo markers in packages/core: none (only CHANGELOG prose).
9. `git grep` @deprecated|TODO|LEGACY|compat in core src: findings folded into candidates; LEGACY_FACEWEAR_ITEM_IDS / LEGACY_MATCHING_METHOD_MAP are live (below).
10. Dependency check: spectral.js (blending.ts:13), yaml + csv-parse (build-locales.ts:11-12), culori + @types/culori (gamut-map.test.ts:2, config-only devDeps), tsx (package.json scripts), @vitest/coverage-v8, @types/node: all used. @xivdyetools/logger/types used. No unused dependency.
11. Data/asset check: munsell-anchors.json imported only by munsell.test.ts:2 (documented TEST DATA, munsell.ts:8; CLAUDE.md:55); all other data JSON imported at runtime; chara fixtures all referenced by tests; no non-test helper files in __tests__.
12. DEPRECATIONS.md: color-blending (-> core/blending) gone as a package; blending/ lives in core; `ALLIED_SOCIETY_*` grep: gone. Nothing listed for core is still present.
13. `scripts/README.md:9,97` and `fetch_dye_names.py:13,50` write `scripts/output/dye_names.csv` while build-locales.ts:85 reads root `dyenames.csv` (manual copy step, documented in CLAUDE.md:231) - not dead, noted only.

## Candidates (all published @xivdyetools/core API; none removable before a core major)
- C1 Harmony find* family: HarmonyGenerator class body (find* x8, findClosestNonFacewearDye, findHarmonyDyesByOffsets, rotateHueInSpace(@deprecated), findClosestByDeltaE, findClosestDyeByHue; ~400 of 577 lines), the 8 DyeService delegates (DyeService.ts:219-316), and the DyeDatabase helpers only they call (getHueBucketsToSearch :517, getDyesByHueBucket :539). ~737-line HarmonyGenerator.test.ts exists only for them. HarmonyOptions type must stay (bot-logic/src/commands/harmony.ts:11,79; but note field `harmonyOptions` appears never read outside its declaration at line 79 - bot-logic group to confirm).
- C2 `tools` locale section: LocalizationService.getToolName (instance + static), TranslationProvider.getToolName, buildTools (build-locales.ts:814), `tools` x6 locales, `ToolKey` and `LocaleData.tools` in @xivdyetools/types. Already @deprecated I18N-003.
- C3 `labels` locale section: getLabel (LocalizationService instance+static, TranslationProvider), buildLabels + fallbackLabels (build-locales.ts:~265), localize.yaml labels, 7 keys x 6 locales. Only caller chain ends at a test-only web-app wrapper. NOT deprecated.
- C4 ColorManipulator (6 methods, whole class) + ColorService delegates adjustBrightness/adjustSaturation/rotateHue/rotateHueLch/invert/desaturate; ColorAccessibility.meetsWCAGAA/meetsWCAGAAA/getOptimalTextColor + ColorService delegates: zero non-test callers anywhere in the monorepo.
- C5 Other zero-caller facade methods: LocalizationService.setLocaleFromPreference (instance :282 + static :290; type LocalePreference), preloadLocales (:609/:616), PresetService.getPresetWithDyes (:254; web-app has its own same-named method), ColorService/ColorConverter getDeltaE76, cmykToHex, cmykToRgb, labToLch/lchToLab/lchToRgb, oklabToHex etc. have only facade or test callers (see item 4 output).
- C6 `src/config/band-calibration.ts` (261 lines): compiled into dist (tsconfig.build excludes only tests) but reachable only from scripts/calibrate-bands.ts:14 and band-vocabulary.parity.test.ts:13. It is the parity guard for the shipped band numbers; it also keeps ColorblindnessSimulator.simulateColorblindnessMachadoHex and ColorConverter.getDeltaE_Oklab "used".
- C7 Test-only export keywords (single prod file = own file, tests import): DefaultFetchClient, DefaultRateLimiter, FetchClient (APIService.ts), DE2000_GROUND_TRUTH, MUNSELL_TABLE, OKLCH_HUE_TABLE, RING_LIGHTNESS, RYB_TABLE, assertMonotoneTable, fromWheelHue, toWheelHue. The code is live; only the `export` is test-driven. Plus ~14 internal-only exported types (CharaTwinMember, ColorConverterConfig, DyeServiceOptions, HttpError, ...).
- C8 DyeDatabase.ts:99-104 orphaned JSDoc ("Validate dye data structure") detached from isValidDye by REFACTOR-013; DyeDatabase.isValidDye `hasLegacyId` and the legacy-shape passthrough (`DyeDatabase.ts:117-124`, ~:188-215) exist for "runtime-shaped test data" - verify whether any prod caller passes id/itemID-only dyes.

## Positive controls
- knip + dead-code:check green for core; all 7 @public exemptions in core are named, documented, DEAD-018.
- Every barrel export has an external prod consumer or @public (251-name scan).
- Prior 17 cleanups stayed gone (no ALLIED_SOCIETY, no color-blending package).
- New chara-* exports (charaTwinsOf, groupCharaTwinRules, gposers*, charaShaderHex) all have web-app production consumers.
- Facewear compatibility: LEGACY_FACEWEAR_ITEM_IDS used by getFacewearColorByLegacyItemID (api-worker 404 slug path); frozen by design.

## Rejected (live)
- HarmonySelector/generateHarmonySlots/HARMONY_OFFSETS: api-worker routes/harmony.ts:11, web-app, og-worker, bot-logic.
- LEGACY_MATCHING_METHOD_MAP: normalizeMatchingMethod (33 external refs).
- LocalizationService.isLocaleLoaded static: DyeService.ts:341. resetInstance: test reset hook over real singleton (keep).
- blending/conversions.ts duplication with ColorConverter: declined DEAD-037 (DEPRECATIONS.md:314-329).
- DyeDatabase.getKdTree/getLogger/getHueBucket: DyeSearch.ts:44,183,267; internal.
- TranslationProvider/LocaleLoader/LocaleRegistry exports: og-worker translator.ts, discord/og font-coverage tests.
- scripts/*: all wired in package.json; munsell-anchors.json documented test data.

## Prior KEEP register
- DEAD-018 (getSharedColors, getRaceSpecificColors, both getAvailableLocales, hexToRyb/rybToHex): trigger "next core major" NOT met (core 5.8.0; no 6.0 in any PR). getSharedColors/getRaceSpecificColors still have 0 non-test callers (members output). C1-C6 are the same class (published API, no local caller) and share the trigger.
- DEAD-020: not in this unit.

## Files covered
57 non-test core ts files + 64 test files scanned by name, scripts (6 ts + 1 py), 3 csv/yaml, 14 data JSON, package.json, tsconfig.build.json, vitest config.
