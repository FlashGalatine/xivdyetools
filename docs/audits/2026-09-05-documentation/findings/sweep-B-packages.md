# Sweep B findings — packages (READMEs, CLAUDE.md, docs/projects/{core,types,logger,test-utils}, DEPRECATIONS.md)

Verified against the worktree at 1eb57cda (= origin/main 2026-09-05). Evidence is path:line in the code.

| ID | File:line | Claim (quoted) | Reality (evidence) | Sev | Proposed fix |
|---|---|---|---|---|---|
| B-01 | `packages/types/README.md:210-228` | "`import { Result, isOk, isErr, Nullable } from '@xivdyetools/types';`" + a `Result<Dye>` example | No `Result`, `isOk`, `isErr` or `Nullable` exists anywhere under `packages/types/src`. Barrel `packages/types/src/index.ts:26-158` exports none of them. | HIGH | Delete the whole "Utility Types" section, or replace with the real runtime exports (`AppError`, `ErrorCode`, `classifyMatchDistance`, `isValidSnowflake`). |
| B-02 | `packages/types/README.md:286-287` | "\| `isOk(result)` \| … \| `isErr(result)` \|" | Same as B-01 | HIGH | Remove both rows; add `classifyMatchDistance(distance)` and `isValidSnowflake(id)`. |
| B-03 | `packages/types/README.md:113-127` | "`name: 'Snow White', hex: '#FFFFFF', … acquisition: 'NPC', cost: 216`" | `dyes.json` stainID 1 = `hex: "#e4dfd0"`, `acquisition: "Dye Vendor"`. `DYE_ACQUISITIONS` (`packages/core/src/config/dye-vocabulary.ts:34-39`) has no `'NPC'` | MED | `hex: '#e4dfd0'`, `acquisition: 'Dye Vendor'` (verify cost in dyes.json / ACQUISITION_META) |
| B-04 | `packages/types/README.md:269,276` | "`/color` \| RGB, HSV, LAB, OKLAB, OKLCH, LCH, HSL, HexColor…" / "`/localization` \| LocaleCode, LocaleData" | `/color` also exports `CMYK`, `Matrix3x3` (`src/color/index.ts:17,24`); `/localization` also exports `ColorWheelId` (`src/localization/index.ts:44`) | LOW | Add them |
| B-05 | `packages/types/CLAUDE.md:116-121` | localization type list | `ColorWheelId` also exported (`src/index.ts:144`) | LOW | Insert `type ColorWheelId; // 'rgb'\|'ryb'\|'munsell'\|'oklch-hue'\|'oklch-lightness'` |
| B-06 | `packages/types/CLAUDE.md:19`; `packages/logger/CLAUDE.md:23`; `packages/auth/CLAUDE.md:25` | "`pnpm lint          # eslint src`" | All three define `"lint": "eslint src && pnpm run lint:dead"` | LOW | `pnpm lint  # eslint src + knip dead-code gate` |
| B-07 | `packages/types/CLAUDE.md:92` | "23 types covering `CommunityPreset`…" | 24 preset types (`src/index.ts:62-96`) | LOW | "24 types" |
| B-08 | `docs/projects/types/overview.md:3` | "**@xivdyetools/types** v2.0.0" | 3.2.0 | MED | DROP the version line (versions live in docs/versions.md) |
| B-09 | `docs/projects/types/overview.md:53` | "`import { Dye, DyeId, DyeCategory, DyeMatch } from '@xivdyetools/types';`" | Neither `DyeCategory` nor `DyeMatch` exists in types. `DyeCategory` is core-only (`dye-vocabulary.ts:31`); `DyeMatch` exists nowhere | HIGH | `import { Dye, DyeId, DyeWithDistance, FacewearColor } from '@xivdyetools/types';` |
| B-10 | `docs/projects/types/overview.md:79-96, 155` | "`import { Preset, PresetColor, PresetStatus } …`" + `interface Preset {…}` | No `Preset`, `PresetColor`, `PresetAuthor`. Real: `CommunityPreset` (`src/preset/community.ts`), `PresetPalette`/`PresetData` (`src/preset/core.ts`) | HIGH | Replace with the real shapes or point at `packages/types/src/preset/` |
| B-11 | `docs/projects/types/overview.md:136`; `docs/projects/core/overview.md:307` | "`const dyeId: DyeId = createDyeId(42);`" | `createDyeId` returns `DyeId \| null` (`packages/types/src/color/branded.ts:98`) | LOW | `const dyeId: DyeId \| null = createDyeId(42);` |
| B-12 | `docs/projects/logger/overview.md` (whole file) | "`import { createLogger } from '@xivdyetools/logger';`" … `/node` subpath … `includeTimestamp`, `structured` options | `createLogger` does not exist. Factories: `createBrowserLogger`, `createWorkerLogger`, `createRequestLogger`, `createLibraryLogger` (`src/index.ts:109-126`). No `/node` subpath — exports are `.`, `./browser`, `./worker`, `./library`. `LoggerConfig` (`src/types.ts:177-195`) has `level/format/timestamps/prefix/sanitizeErrors/redactFields` | HIGH | REWRITE the page against the real API (short), linking `packages/logger/README.md` which is accurate |
| B-13 | `packages/logger/README.md:250-261` | "automatically redacted" list of 9 fields | `CORE_REDACT_FIELDS` (`packages/logger/src/constants.ts:14-38`) has 22 entries; worker presets add 4 (`:44-49`) | MED | List all 22 + the 4 worker-only additions |
| B-14 | `packages/logger/CLAUDE.md:128-131` | same 9-field list | 22 entries | MED | same as B-13 |
| B-15 | `packages/logger/CLAUDE.md:157` | "All 15 patterns are compiled once (`SANITIZE_RULES`)" | 17 entries (`src/core/base-logger.ts:669-728`); prose list at :153 omits the JSON-key sweep | LOW | "17"; add the JSON-shaped sweep to the list |
| B-16 | `packages/auth/README.md:135`; `packages/auth/CLAUDE.md:66` | `verifyJWT(token, secret)` | `verifyJWT(token, secret, options?: VerifyJWTOptions)` (`packages/auth/src/jwt.ts:232-236`); options `expectedType`, `issuer`, `audience`, `clockToleranceSeconds` (`:62-85`) | MED | Document the options |
| B-17 | `packages/auth/CLAUDE.md:57-64` | `interface JWTPayload { sub; iat; exp; type: 'access'\|'refresh'; username?; avatar? }` | `jwt.ts:26-56`: `type` optional; also `nbf?`, `jti?`, `iss?`, `aud?`, `orig_iat?`, `global_name?` | MED | Add fields; `type?` optional |
| B-18 | `packages/auth/CLAUDE.md:216-218` | consumer list (apps only) | `packages/test-utils/package.json` also depends on auth | LOW | Add "Packages: `@xivdyetools/test-utils`" |
| B-19 | `packages/worker-kit/README.md:16` | "`hono ^4.12.34`" | `^4.13.5` | LOW | fix |
| B-20 | `packages/worker-kit/README.md:3, 121, 135-141` | "three interchangeable backends" (Memory/KV/Upstash) | Four: `CloudflareRateLimiter` exported (`src/rate-limiter/index.ts:72-78`), subpath `./rate-limiter/cloudflare`; CLAUDE.md:12 calls it the preferred limiter (FINDING-003), "KV cannot throttle a fast client" | MED | "four backends"; add the Cloudflare row |
| B-21 | `packages/worker-kit/README.md:38` | subpaths list | Also `./rate-limiter/cloudflare` | LOW | add |
| B-22 | `packages/worker-kit/README.md:158` | exported types list | Also `CloudflareRateLimiterOptions`, `CloudflareRateLimitTier`, `RateLimitBinding`, `GetClientIpOptions`, `RequestIdOptions`, `LoggerMiddlewareOptions`, `RateLimitMiddlewareOptions` | LOW | append |
| B-23 | `packages/core/README.md:393` | "Node.js 22.0.0 or higher" | `engines.node: ">=18.0.0"` (`packages/core/package.json`); `docs/projects/core/overview.md:127` says "v16+" | MED | "18.0.0 or higher" in both |
| B-24 | `packages/core/README.md:148` | `// ['Neutral', 'Red', 'Blue', ...]` | Categories: `Neutral, Reds, Browns, Yellows, Greens, Blues, Purples, Special` (`dye-vocabulary.ts:20-29`) | LOW | fix |
| B-25 | `packages/core/README.md:176` | `searchByCategory('Red')` | exact match; category is `'Reds'` (`DyeSearch.ts:100-107`) | MED | `'Reds'` |
| B-26 | `packages/core/README.md:89` | "5 caches × 1000 … ~500KB" | 7 caches (`ColorConverter.ts:113-119`) | LOW | "7 caches × 1000 … ~700KB" |
| B-27 | `packages/core/README.md:169-173` | `colorSpace` option presented as current; no mention of wheels | `HarmonyOptions.colorSpace` is `@deprecated Since 5.2.0` (`HarmonyGenerator.ts:121-125`); README never mentions `generateHarmonySlots`, `COLOR_WHEEL_IDS`, `getColorWheel`, `normalizeColorWheelId` (`src/index.ts:68-94`) | MED | Mark deprecated; add a "Colour wheels" section with `generateHarmonySlots(..., { wheel })` — model it on `packages/core/CLAUDE.md:211-219`, which is correct |
| B-28 | `packages/core/README.md:405-412`; `packages/core/CLAUDE.md:9, 239` | stoat-worker listed as a direct consumer | stoat declares only bot-logic, logger, types | MED | Drop stoat from both consumer lists |
| B-29 | `packages/core/CLAUDE.md:36, 66-68, 222` | "`SpectralMixer`" class in `services/color/` | No such symbol. Spectral mixing is `blendColors(hex1, hex2, 'spectral', ratio)` in `src/blending/blending.ts`, via `ColorService.mixColorsSpectral` (`ColorService.ts:780-782`) | HIGH | Replace in all three places |
| B-30 | `packages/core/CLAUDE.md:148` | `APIServiceOptions { cache?: ICacheBackend; … }` | Field is `cacheBackend` (`APIService.ts:288-308`) | HIGH | `cacheBackend?` |
| B-31 | `packages/core/CLAUDE.md:226` | build-locales reads `localize.yaml`, `dyenames.csv`, `dyes.json` | Reads `localize.yaml`, `dyenames.csv`, `facewear-names.csv` (`build-locales.ts:63-83`); never `dyes.json`; categories hardcoded (`:305`) | MED | fix |
| B-32 | `packages/core/CLAUDE.md:122` | DyeService method list | Also `searchByCategory`, `filterDyes`, `isLoadedStatus`, `searchByLocalizedName` | LOW | append |
| B-33 | `docs/projects/core/overview.md:3` | "v4.0.0" | 5.2.0 | MED | DROP the version line |
| B-34 | `docs/projects/core/overview.md:51-53` | `match.dye.name // "Dalamud Red"`, `match.deltaE` | `findClosestDye` returns `Dye \| null`; nearest to `#FF6B6B` is Coral Pink (`#cc6c5e`, ΔE00 9.57) | HIGH | `console.log(match?.name); // "Coral Pink"` |
| B-35 | `docs/projects/core/overview.md:61` | `ColorService.rgbToHsv(rgb)` | `rgbToHsv(r, g, b)` (`ColorService.ts:115`) | HIGH | positional |
| B-36 | `docs/projects/core/overview.md:65, 208`; `docs/projects/core/services.md:82` | `ColorService.evaluateWCAG(contrast)` | No such method; real: `getContrastRatio`, `meetsWCAGAA(hex1, hex2, largeText?)`, `meetsWCAGAAA` (`:247-261`) | HIGH | fix |
| B-37 | `docs/projects/core/overview.md:68, 212-214`; `services.md:100-102` | `simulateColorblindness('#FF6B6B', 'protanopia')` | Takes `RGB`; hex variant is `simulateColorblindnessHex` (`:205, 212`) | HIGH | fix |
| B-38 | `docs/projects/core/overview.md:71, 225-231`; `services.md:252-257, 264`; `algorithms.md:141-166` | `await PaletteService.extractPalette(imageData, { numColors: 5, quality: 'high' })` → hex strings | Sync instance method `extractPalette(pixels: RGB[], options)` → `ExtractedColor[]` (`PaletteService.ts:368`); options `colorCount`, `maxIterations`, `convergenceThreshold`, `maxSamples`, `matchingMethod` (`:38-53`); pixels via static `pixelDataToRGBFiltered` (`:499`) | HIGH | Use the form in `packages/core/README.md:190-215` |
| B-39 | `docs/projects/core/algorithms.md:169-175` | "Quality Settings" table | No `quality` option | HIGH | Replace with `maxSamples` / `maxIterations` / `convergenceThreshold` defaults |
| B-40 | `docs/projects/core/overview.md:157-166` | `dyeDatabase.getAllDyes()` etc. | `dyeDatabase` is the raw JSON array (`src/index.ts:318`) | HIGH | `new DyeService(dyeDatabase)` |
| B-41 | `docs/projects/core/overview.md:194`; `services.md:148` | `findComplementaryDyes` | `findComplementaryPair(hex, options?): Dye \| null` (`DyeService.ts:218`) | HIGH | fix |
| B-42 | `docs/projects/core/overview.md:244`; `services.md:190` | `getPriceData(19952, 'Gilgamesh')` | `getPriceData(itemID, worldID?: number, dataCenterID?: string)` (`APIService.ts:490-494`) | MED | `getPriceData(19952, undefined, 'Aether')` |
| B-43 | `docs/projects/core/overview.md:149` | "16-field shape" | 17 fields (`packages/types/src/dye/dye.ts:26-123`); `lab` is internal only | LOW | "17-field" |
| B-44 | `docs/projects/core/services.md:42-54` | object-arg conversions | All take scalars: `rgbToHex(r,g,b)` :107, `rgbToHsv` :115, `hsvToRgb(h,s,v)` :123, `rgbToHsl` :500, `hslToRgb` :515, `rgbToLab` :338, `labToRgb(L,a,b)` :366 | HIGH | rewrite |
| B-45 | `services.md:61-66` | `lighten/darken/saturate/desaturate(hex, n)` | `adjustBrightness(hex, amount)` :287, `adjustSaturation` :295, `rotateHue` :303, `invert` :319, `desaturate(hex)` one-arg :326 | HIGH | rewrite |
| B-46 | `services.md:72` | `ColorService.blend(...)` | `mixColorsRgb/Lab/Oklab/Hsl/Ryb/Spectral(hex1, hex2, ratio)` (:589-780) | HIGH | fix |
| B-47 | `services.md:91` | `getRelativeLuminance` | `getPerceivedLuminance(hex)` (:239) | HIGH | fix |
| B-48 | `services.md:123-132` | `findClosestDye` → `{dye, distance, deltaE}`; `findClosestDyes(hex, 5)` | Returns `Dye \| null`; N-nearest is `findDyesWithinDistance(hex, { maxDistance, limit, matchingMethod })` (:200) | HIGH | fix |
| B-49 | `services.md:141` | `getByCategory('brown')` | `searchByCategory('Browns')` | HIGH | fix |
| B-50 | `services.md:172-173` | category list `basic, brown, … metallic` | `Neutral, Reds, Browns, Yellows, Greens, Blues, Purples, Special` | HIGH | fix |
| B-51 | `services.md:210-215`; `types.md:229-234` | `ICacheBackend { get; set; delete; clear }` | Five members incl. `keys()`; sync-or-async unions (`APIService.ts:140-164`) | MED | fix |
| B-52 | `services.md:280-286` | static `PresetService.getPresets()` etc. | Instance class `new PresetService(presetData)`; methods `getCategories`, `getAllPresets`, `getPresetsByCategory`, `getPreset`, `searchPresets`, `getRandomPreset`, `getPresetWithDyes` (`PresetService.ts:75-254`) | HIGH | fix |
| B-53 | `services.md:299-309` | `LocalizationService.setLocale('ja'); translate(...); getAvailableLocales(); getLocale()` | `setLocale` is async; no `translate` (use `getLabel`, `getDyeName`, `getCategory`, `getHarmonyType`, `getColorWheelName`); `SUPPORTED_LOCALES` export; `getCurrentLocale` (`LocalizationService.ts:235,310,355,372,389,440,450`) | HIGH | fix |
| B-54 | `services.md:316-329` | imports `DyeMatch`, `HarmonyResult` from core; `LAB { l }` | Neither type exists; `LAB` is `{ L, a, b }` (`packages/types/src/color/rgb.ts:40-47`) | HIGH | fix |
| B-55 | `types.md:14` | `import { HexColor, createHexColor, isValidHexColor } from '@xivdyetools/core'` | `HexColor`/`createHexColor` are in types; only `isValidHexColor` in core (`src/index.ts:301`) | HIGH | split import |
| B-56 | `types.md:55, 64` | `Hue, Saturation, Value, createHue, createSaturation` from core; `createValue` | Four are in types (`branded.ts`); `Value`/`createValue` don't exist | HIGH | fix |
| B-57 | `types.md:104-108` | `LAB { l }` | `L` capitalised | MED | fix |
| B-58 | `types.md:118-126` | `interface Dye { id: DyeId; … itemId?; sellable }` | Real 17-field `Dye` (`dye.ts:26-123`): `id: number`, `hex: string`, `itemID: number` (never optional), `stainID`, … no `sellable` | HIGH | replace |
| B-59 | `types.md:132-141` | `DyeCategory = 'basic' \| … \| 'metallic'` | `'Neutral'\|'Reds'\|'Browns'\|'Yellows'\|'Greens'\|'Blues'\|'Purples'\|'Special'` (core) | HIGH | replace |
| B-60 | `types.md:147-151` | `DyeMatch` | doesn't exist; `DyeWithDistance extends Dye { distance }` (`dye.ts:145-148`) | HIGH | replace |
| B-61 | `types.md:157-168` | `HarmonyResult`, 6-member `HarmonyType` | `HARMONY_OFFSETS` has 10 keys (`packages/core/src/constants/index.ts:166-177`); result is `HarmonySlot[]` from `generateHarmonySlots` (`HarmonySelector.ts:62-108,177-183`) | HIGH | document `HarmonySlot` + 10 keys |
| B-62 | `types.md:178-184` | `WCAGResult` | doesn't exist | HIGH | delete; see B-36 |
| B-63 | `types.md:190-193` | `ColorblindnessType` 3 members | `VisionType` 5 members (`packages/types/src/color/colorblind.ts:18-23`) | HIGH | fix |
| B-64 | `types.md:203-221` | `PriceData { itemId; server; listings; … }` | `{ itemID, currentAverage, currentMinPrice, currentMaxPrice, lastUpdate, worldId?, worldName? }` (`packages/types/src/api/price.ts:14-43`); no `PriceListing` | HIGH | replace |
| B-65 | `types.md:236-240` | `CachedData { data: unknown; timestamp; ttl }` | generic `CachedData<T>` + `version?`, `checksum?` (`response.ts:15-30`) | MED | fix |
| B-66 | `types.md:250-270` | `Preset`, `PresetColor`, `PresetAuthor` | don't exist (see B-10) | HIGH | replace with `CommunityPreset` / `PresetPalette` |
| B-67 | `types.md:280` | `type Locale` | `LocaleCode` (`localization/index.ts:14`) | MED | rename |
| B-68 | `types.md:286-291` | template-literal `TranslationKey` | flat 7-member union (`localization/index.ts:19-20`) | HIGH | replace |
| B-69 | `types.md:300-305` | `DeepReadonly<T>` | doesn't exist | HIGH | delete |
| B-70 | `types.md:311-321` | `Result<T,E>` `{ success, data }` | doesn't exist (contradicts types README's own fictional `{ok,value}`) | HIGH | delete |
| B-71 | `algorithms.md:44-63` | `new KDTree(dyes, { dimensions })`, `kdTree.nearest(rgb, 1)`, `DyeDatabase.findNearest/findKNearest` | `DyeDatabase(config = {})` + `initialize(dyeData)` (`DyeDatabase.ts:76,171`); `KDTree(points: Point3D[])` (`kd-tree.ts:46`); `nearestNeighbor(target, excludeData?)` (`:116`); `getKdTree()` (`:463`) | HIGH | rewrite |
| B-72 | `algorithms.md:254-270` | Brettel matrices values | Shipped constant (`constants/index.ts:45-66`) differs on every value and has `achromatopsia`; also `MACHADO_MATRICES` (`:75-82`) | HIGH | paste real matrices |
| B-73 | `algorithms.md:282-288` | 5 caches incl. `labToRgb` | 7 caches, no `labToRgb` (`ColorConverter.ts:113-119`) | MED | fix |
| B-74 | `algorithms.md:104` | "272 checks" | 125 × 2 = 250 | LOW | fix |
| B-75 | `docs/projects/core/publishing.md:9-13, 55-85` | local `npm whoami` / `npm version patch` / `npm publish` as the normal steps | Policy: bump + merge + "Publish Packages to npm" workflow (OIDC); tokens disallowed | HIGH | REPLACE the whole page with a short pointer to `docs/developer-guides/release-process.md` (which the A-fixer is correcting) plus core-specific notes (build:locales runs in build; bump version; the workflow) |
| B-76 | `publishing.md:22, 37-38, 121-139` | `cd xivdyetools-core` etc. | dirs don't exist | MED | moot after B-75 |
| B-77 | `publishing.md:27, 34` | "85% threshold" | 90% (`packages/core/vitest.config.ts:23-28`) | MED | moot after B-75 |
| B-78 | `publishing.md:116-140` | `npm update @xivdyetools/core` for consumers | `workspace:*` | MED | moot after B-75 |
| B-79 | `publishing.md:183-184` | "2FA one-time code" | `npm login --auth-type=web` (security key) + granular token; never `--otp` | MED | moot after B-75 |
| B-80 | `packages/core/scripts/README.md:13, 51, 133-139` | `colors_xiv.json` | `src/data/dyes.json` (`fetch_dye_names.py:48`) | MED | replace |
| B-81 | `scripts/README.md:52-74, 165` | "136 dyes … 544 requests … ~54 s" | 125 × 4 = 500 ≈ 50 s | MED | regenerate sample |
| B-82 | `scripts/README.md:22, 37-38, 135-138` | `cd xivdyetools-core` | `packages/core` | MED | fix |
| B-83 | `packages/svg/CLAUDE.md:97` | "9 tool glyphs" | 10 (`tool-icons.ts:33-43`) — 9 tools + `tools` | LOW | fix |
| B-84 | `packages/svg/README.md:176-181`; `packages/svg/CLAUDE.md:140-145` | Consumers: discord-worker, bot-logic; "og-worker keeps its own" | Also web-app (`src/shared/harmony-icons.ts:12`, `category-icons.ts:18`, `services/theme-service.ts:12`), og-worker (`src/services/svg/band.ts:38`, `band-shared.ts:7`), api-worker docs (`docs/.vitepress/theme/components/Glyph.vue:3`) | MED | add glyph-set consumers; scope the og-worker caveat to cards |
| B-85 | `packages/bot-logic/README.md:77-78` | Jet Black `'#000000'` | `#1e1e1e` (stainID 102) | MED | fix |
| B-86 | `packages/bot-logic/README.md:80-82` | `resolveColorInput('coral') // '#FF7F50'` | dye names win: returns Coral Pink `#cc6c5e` (`input-resolution.ts:194-270`) | MED | use `'burlywood'` and say dye names win |
| B-87 | `packages/bot-logic/CLAUDE.md:102`, `:53` | 8-member `HarmonyType` | 10 (`commands/harmony.ts:45-56`) incl. `compound`, `shades` | MED | append |
| B-88 | `packages/bot-logic/README.md` (whole), `CLAUDE.md:99` | `HarmonyInput` without `wheel` | `wheel?: ColorWheelId` (`commands/harmony.ts:75-76`) | MED | add |
| B-89 | `packages/bot-logic/CLAUDE.md:73-74` | `ResolvedColor`, `ResolveColorOptions` shapes | also `stainID?`, `locale?` | LOW | add |
| B-90 | `packages/bot-logic/CLAUDE.md:71`; `README.md:112` | `resolveDyeInput(input)` | `(input, locale = 'en')` (`:285`) | LOW | add |
| B-91 | `packages/test-utils/CLAUDE.md:161` | "bot-logic and stoat-worker declare it as devDependency but never import it" | Neither declares it now | MED | delete sentence |
| B-92 | `packages/test-utils/CLAUDE.md:98` | `MockAnalyticsEngineDataset` | `MockAnalyticsEngine` (`analytics.ts:40,55`) | LOW | fix |
| B-93 | `packages/test-utils/CLAUDE.md:165` | "`Dye`, `Preset`, `User`" | no `Preset`/`User` in types; factories re-export `Dye`, `PresetSubmission` | LOW | fix |
| B-94 | `packages/test-utils/CLAUDE.md:74` | `createMockD1Database()` | `(config?: MockD1DatabaseConfig)` (`d1.ts:184`) | LOW | add |
| B-95 | `docs/projects/test-utils/overview.md:16` | `npm install -D @xivdyetools/test-utils` | private, unpublished | HIGH | `workspace:*` |
| B-96 | `test-utils/overview.md:26-32` | `createMockD1({ presets: [...] })` | `createMockD1()` no params (`d1.ts:477`); seed via `_setupMock` | HIGH | fix |
| B-97 | `test-utils/overview.md:44-46` | `createMockKV({...})` | no params (`kv.ts:101`) | HIGH | fix |
| B-98 | `test-utils/overview.md:57-59` | `createMockR2` | `createMockR2Bucket()` (`r2.ts:129`) | HIGH | fix |
| B-99 | `test-utils/overview.md:71-80` | `createMockFetcher({ '/path': {...} })` | config is `{ maxCallHistory? }`; use `_setupResponse(pathPattern, response, config?)` (`fetcher.ts:53-70`) | HIGH | fix |
| B-100 | `test-utils/overview.md:90-92` | `createMockAnalytics` | `createMockAnalyticsEngine()` | HIGH | fix |
| B-101 | `test-utils/overview.md:106-127` | `createTestDye`, `createTestPreset`, `createTestUser` | `createMockDye` (`factories/dye.ts:171`), `createMockPresetRow`/`createMockSubmission` (`preset.ts:75,55`), `createMockCategoryRow` (`category.ts:32`), `mockDyes` (`dye.ts:48`); no user factory | HIGH | rewrite |
| B-102 | `test-utils/overview.md:134-153` | `createMockJWT`, `createBotAuthHeaders`, `createJWTAuthHeaders` | `createTestJWT(secret, payload, expiresInSeconds?, issuer?)` (`auth/jwt.ts:69`), `createExpiredJWT` (`:115`), `authHeaders(token, userId?, userName?)` (`auth/headers.ts:25`) | HIGH | rewrite |
| B-103 | `test-utils/overview.md:158-178` | `/dom` subpath | removed 2026-08-18 (DEAD-026) | HIGH | delete section |
| B-104 | `test-utils/overview.md:184-210` | Usage example | compounds B-96/101/102 | HIGH | rewrite |
| B-105 | `packages/types/src/preset/community.ts:139` (source JSDoc) | "Array of dye item IDs (2-5 dyes)" | 3–6 stainIDs (`validation-service.ts:29-30`) | LOW | `/** Array of dye stainIDs (3-6 dyes) */` — this is a SOURCE comment; fix it (one-line JSDoc change, no behaviour) |

## Structural recommendations (apply)

1. **`docs/projects/logger/overview.md`, `docs/projects/test-utils/overview.md`, `docs/projects/core/services.md`, `docs/projects/core/types.md`** — rewrite wholesale as SHORT, accurate pages built from the real barrels (`packages/*/src/index.ts`) and the READMEs (which are accurate). Do not try to patch them line by line. Each page: purpose, install (`workspace:*` for test-utils), the real top-level API grouped by service/module with correct signatures, and a "Full reference: `packages/<p>/README.md`" pointer. Keep each under ~150 lines.
2. **`docs/projects/core/algorithms.md`** — fix B-38/39/71/72/73/74 and ADD a "Harmony generation" section: `HARMONY_OFFSETS` (10 keys), `generateHarmonySlots` + `HarmonySlot`, the five colour wheels (`COLOR_WHEEL_IDS`, `getColorWheel`, `hueOf`/`target`/`ringStops`, default `rgb` byte-identical), matching methods + `BAND_VOCABULARY`. Model on `packages/core/CLAUDE.md:192-230` which is correct.
3. **`docs/projects/core/overview.md`** — fix the listed findings; drop the version line.
4. **`docs/projects/core/publishing.md`** — replace with a ≤30-line page: core-specific build notes (`build:locales` → `tsc` → `copy:locales`; hand-edits to locale JSON are overwritten), then "Publishing follows [release-process.md](../../developer-guides/release-process.md) — bump, merge, run the *Publish Packages to npm* workflow. Never publish locally."
5. **`packages/core/scripts/README.md`** — fix B-80/81/82 and add one-line entries for the other scripts in the directory (`build-locales.ts`, `copy-locales.ts`, `calibrate-bands.ts`, `build-munsell-hues.ts`, `build-oklch-hue-table.ts`) using `packages/core/CLAUDE.md:75-82, 218-230` as the source.
6. Drop hard-coded version lines from every `docs/projects/*/overview.md` you touch.
