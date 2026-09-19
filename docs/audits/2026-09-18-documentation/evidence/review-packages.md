# Documentation audit — cluster `packages` (core, types, logger, test-utils)

Worktree HEAD: `0fec18f4` (origin/main, 2026-09-18). Previous audit baseline: `39e08c32` (2026-09-05).

## Coverage table

| file | sections reviewed | result |
|------|--------------------|--------|
| docs/projects/core/overview.md | all (What is / Installation / Quick Start / v2.0.0 Migration / Environment / Key Features 1-6 / Architecture / Performance / Type Safety / Related Docs) | reviewed |
| docs/projects/core/services.md | all (ColorService / DyeService / PaletteService / APIService / PresetService / LocalizationService / Full reference) | reviewed |
| docs/projects/core/algorithms.md | all (k-d tree / hue bucketing / harmony generation / color wheels / matching methods+bands / K-means++ / delta-E / colorblindness / LRU caching) | reviewed |
| docs/projects/core/types.md | all (type location table / branded types / colour types / dye types / harmony types / matching+bands / accessibility / API types / localization / "not in this ecosystem") | reviewed |
| docs/projects/core/publishing.md | all (build order / publishing flow) | reviewed |
| docs/projects/types/overview.md | all (colour/dye/preset/auth types / branded types / usage) | reviewed |
| docs/projects/logger/overview.md | all (factory table / quick start / worker / library / configuration / log levels / extended API) | reviewed |
| docs/projects/test-utils/overview.md | all (installation / D1, KV, R2, Fetcher, Analytics mocks / factories / auth helpers / usage example) | reviewed |

All 8 files read in full, end to end.

## Candidate table

None found that meet the bar (opened both doc line and a contradicting source line). One low-severity MISSING item below.

| cand-id | sev | kind | file:line | one-line claim vs reality | evidence pointer (source path:line) |
|---------|-----|------|-----------|----------------------------|--------------------------------------|
| PKG-001 | LOW | MISSING | docs/projects/test-utils/overview.md:122-141 ("Domain Object Factories") | The factories section lists `createMockDye`, `createMockPresetRow`, `createMockSubmission`, `createMockCategoryRow`, `mockDyes` but omits `resetMockDyeSequence()` and `randomStainId()`, both added post-baseline (BUG-007, part of the `39e08c32..HEAD` diff) and both part of the public `/factories` surface a reader would need to avoid the new "stainID sequence exhausted" throw in a suite building >254 default dyes. | packages/test-utils/src/factories/dye.ts:62 (`export function resetMockDyeSequence()`), :72 (`export function randomStainId()`); re-exported via packages/test-utils/src/factories/index.ts:15 (`export * from './dye.js'`) |

That is the only candidate raised to the reply threshold. Given the size of the surface fact-checked (see POSITIVE below), this cluster's docs are unusually well synchronized with source — most likely because `packages/*/CLAUDE.md` files are detailed and kept current, and the docs/projects pages appear to be generated/maintained in step with them.

## Positive controls (checked and correct — do not re-chase)

- Package versions: core 5.3.0, types 3.2.0, logger 2.2.1, test-utils 2.0.1 (private) — none of the 8 docs state a current version inline; all correctly defer to `versions.md` or omit it (test-utils correctly says "workspace-private, not published"). packages/{core,types,logger,test-utils}/package.json
- Subpath exports match exactly: core `.`, `./blending` (packages/core/package.json:8-16); types `.`,`./color`,`./dye`,`./character`,`./preset`,`./auth`,`./api`,`./error`,`./localization` (packages/types/package.json); logger `.`,`./browser`,`./worker`,`./library`, explicitly no `/node` (packages/logger/package.json); test-utils `.`,`./cloudflare`,`./auth`,`./factories`,`./constants`, no `/dom`/`/assertions` (packages/test-utils/package.json), consistent with the 2026-08-18 dead-code removal note in docs/projects/test-utils/overview.md:166-168.
- `Matrix3x3` really is subpath-only (`packages/types/src/color/index.ts:24`) and absent from the root barrel (`packages/types/src/index.ts:26-31`) — docs/projects/core/types.md:19 correct.
- 125 dyes / 11 facewear colours: `packages/core/src/data/dyes.json` (125 rows), `packages/core/src/data/facewear_colors.json` (11 rows) — matches every doc's count claims.
- `HARMONY_OFFSETS` has exactly the 10 keys and numeric offsets shown in docs/projects/core/algorithms.md:120-133 and docs/projects/core/types.md:116-118 — packages/core/src/constants/index.ts:166-177, byte-for-byte match.
- `COLOR_WHEEL_IDS` = `['rgb','ryb','munsell','oklch-hue','oklch-lightness']`, default `'rgb'` — packages/core/src/services/dye/wheels/ColorWheel.ts:17-25, matches docs/projects/core/algorithms.md:179-190.
- `BAND_VOCABULARY` cuts for match/harmony/separation × ciede2000/oklab/cie76 quoted in docs/projects/core/algorithms.md:220-224 are byte-identical to packages/core/src/config/band-vocabulary.ts:92-117.
- `METALLIC_STAIN_IDS` is a 16-element set (92-125 gloss subset) — packages/core/src/config/dye-vocabulary.ts:70-72 — matches the "16-dye gloss set" claim in docs/projects/core/overview.md:148-149.
- `DYE_CATEGORIES` (8) and `DYE_ACQUISITIONS` (4) match exactly, same order — packages/core/src/config/dye-vocabulary.ts:20-41 vs. docs/projects/core/types.md:104-110.
- Public `Dye` is a 17-field interface with no `lab` field (lab lives only on internal `DyeInternal`) — packages/types/src/dye/dye.ts (17 properties counted), matches docs/projects/core/types.md:69-98 and docs/projects/core/overview.md:152-154.
- `ColorConverter` builds exactly 7 LRU caches in the documented order (hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, hexToHsv, rgbToLab, rgbToOklab), no `labToRgb` cache — packages/core/src/services/color/ColorConverter.ts:95-119, matches docs/projects/core/algorithms.md:464-471.
- `DeltaEFormula = 'cie76' | 'cie2000' | 'ciede2000' | 'oklab'`, `getDeltaE`'s own default is `'cie76'` — packages/core/src/services/color/ColorConverter.ts:21,915,936 — matches docs/projects/core/algorithms.md:356-358.
- `presetData.palettes` has exactly 15 rows and includes `season-spring` with the exact fields quoted in services.md's example — packages/core/src/data/presets.json — matches docs/projects/core/overview.md:113 ("15 curated rows") and services.md:239.
- `ColorService` has no `blend`, `lighten`, `darken`, or `saturate` static methods; `rgbToHex` takes 3 scalar args; `desaturate` takes 1 arg; all six `mixColors*` default `ratio = 0.5` — packages/core/src/services/ColorService.ts:107,326,589-782 — matches docs/projects/core/services.md:59-80.
- `LocalizationService` method list (getLabel/getDyeName/getCategory/getAcquisition/getCurrency/getHarmonyType/getColorWheelName/getVisionType+Short/getToolName/getSheetName/getRace/getClan/getFacewearColorName), each instance+static, plus `getAvailableLocales`/`isLocaleLoaded`, `setLocale` async, no `translate()`/`getLocale()` — packages/core/src/services/LocalizationService.ts — matches docs/projects/core/services.md:250-276 exactly.
- `PresetService` method list (getAllPresets/getPreset/getPresetWithDyes/getCategories/getCategoryMeta/getPresetsByCategory/searchPresets/getRandomPreset, all instance, no static `getPresets()`) — packages/core/src/services/PresetService.ts — matches docs/projects/core/services.md:229-246.
- `PaletteExtractionOptions` defaults (`colorCount:4`, `maxIterations:25`, `convergenceThreshold:1.0`, `maxSamples:10000`) and the `colorCount` clamp to [1,10] — packages/core/src/services/PaletteService.ts:316-386 — matches docs/projects/core/algorithms.md:295-303.
- `ICacheBackend` is exactly 5 members (get/set/delete/clear/keys), each may be sync or async — packages/core/src/services/APIService.ts:144-164 — matches docs/projects/core/services.md:213-223.
- `JWTPayload` in `@xivdyetools/types` (sub/iat/exp/iss/jti?/orig_iat?/username/global_name/avatar/auth_provider/discord_id?/xivauth_id?/primary_character?) vs. the *different* `JWTPayload` in `@xivdyetools/auth` (sub/iat/exp/nbf?/type?/jti?/iss?/aud?/orig_iat?, no auth_provider/character claims) — packages/types/src/auth/jwt.ts:34-80 vs packages/auth/src/jwt.ts:26-50 — matches docs/projects/types/overview.md:152-154 exactly, including which fields are absent from each.
- `PresetCategory` (8 values), `PresetStatus` (5 values) — packages/types/src/preset/core.ts:18-37 — matches docs/projects/types/overview.md:123-125 word for word.
- `TranslationKey` is a flat 7-member union (dye/dark/metallic/pastel/cosmic/cosmicExploration/cosmicFortunes) — packages/types/src/localization/index.ts:19-20 — matches docs/projects/core/types.md:204-207 ("flat union of seven UI labels").
- `VisionType` has exactly 5 members (normal/protanopia/deuteranopia/tritanopia/achromatopsia) — packages/types/src/color/colorblind.ts:18-23 — matches both core/types.md:168 and core/services.md:113.
- `createDyeId` rejects non-integers and anything outside 1-254, returns `null` (not a throw) — packages/types/src/color/branded.ts:98-106 — matches every doc that states the 1-254 stainID window.
- `SubRace` includes `'Helions'` (not `'Helion'`) — packages/types/src/character/index.ts:72-92,120,140 — matches docs/projects/types/overview.md:7-8 and docs/projects/core/overview.md:19.
- logger `error(message, error?, context?)` — packages/logger/src/types.ts:111 — matches docs/projects/logger/overview.md:56.
- Logger root barrel subpaths and every symbol named in the "Choosing a factory" table and "Extended API" section (BaseLogger, ConsoleAdapter/JsonAdapter/NoopAdapter, LogLevel/LogContext/LogEntry/Logger/ExtendedLogger/ErrorTracker) all exist and are exported exactly as described — packages/logger/src/index.ts.
- test-utils D1/KV/R2/Fetcher/Analytics mock APIs (`createMockD1Database`, `createMockD1`, `_setBanStatus`, `_setBatchFailure`, `createMockKV`, `_store`/`_ttls`, `createMockR2Bucket`, `_store: Map<string, StoredR2Object>`, `createMockFetcher`, `_setupResponse`/`_setDefaultResponse`/`_calls`, `createMockAnalyticsEngine`, `writeDataPoint`/`_dataPoints`) all match their doc'd shapes and examples exactly — packages/test-utils/src/cloudflare/{d1,kv,r2,fetcher,analytics}.ts.
- `createTestJWT(secret, payload, expiresInSeconds = 3600, issuer = 'xivdyetools-oauth-worker')`, `createExpiredJWT`, `authHeaders(token, userId?, userName?)` all match signatures and doc'd header names exactly — packages/test-utils/src/auth/{jwt,headers}.ts.
- `VALID_CODE_VERIFIER` / `VALID_CODE_CHALLENGE` exist under `/constants`, and `/dom` + `/assertions` genuinely do not exist in the tree — packages/test-utils/src/constants/pkce.ts; `git ls-files packages/test-utils/src` has no dom/assertions paths.
- All relative doc links checked resolve: `packages/{core,types,logger,test-utils}/README.md`, `docs/versions.md`, `docs/developer-guides/{release-process,logging-standards,testing}.md`.
- No barrel (`src/index.ts`) changed in core/types/logger/test-utils since the 2026-09-05 baseline (`git diff 39e08c32 HEAD -- packages/{core,types,logger,test-utils}/src/index.ts` is empty), so none of PR #186/#188's changes altered any symbol these docs name.

## Rejected items (looked wrong, were right)

- DyeDatabase.ts still contains comments/branches referencing "Facewear" dyes inside the k-d-tree build loop (packages/core/src/services/dye/DyeDatabase.ts:322-361, e.g. "stainID is null for Facewear dyes", "exclude Facewear dyes from tree") and HarmonySelector.ts:142-144 skips `category === 'Facewear'`. This looked like it might contradict the docs' "Facewear is a wholly separate collection, never in `dyes.json`" claim. Rejected: `dyes.json` has 125 entries and zero `Facewear`-category rows (confirmed by direct load), so these branches are dead/vestigial defensive code on data that can no longer occur — the docs' behavioural claim (facewear never reaches `DyeDatabase`/the k-d tree/harmony candidates) is still true in practice; this is source-comment staleness, not a documentation defect, and is outside this audit's scope (we audit docs against source, not source comments against source).

## Summary

Reviewed all 8 files end to end. Extensive cross-checking (package.json exports, barrel `src/index.ts` files, ~40 individual class/function/constant signatures, 6 numeric/count claims, JWTPayload shape divergence between two packages, and every relative link) turned up no WRONG / STALE-VERSION / BROKEN-LINK / PLANNED-VS-SHIPPED candidates. One LOW MISSING candidate (PKG-001) for two new test-utils factory helpers not yet documented.
