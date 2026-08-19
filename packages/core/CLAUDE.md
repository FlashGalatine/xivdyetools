# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/core` is the heart of the XIV Dye Tools ecosystem: a Node + browser-compatible TypeScript library that bundles the FFXIV dye database (125 dyes, schema v2: stainID-keyed with derived fields) plus the separate facewear color collection, color-science algorithms (RGB/HSV/HSL/CMYK/LAB/OKLAB/OKLCH/LCH/RYB conversions, DeltaE variants, Kubelka-Munk spectral mixing), color-vision-deficiency simulation, k-d tree dye matching, harmony generation, palette extraction, character-color matching, the Universalis market-board API client, and a 6-language localization service.

It is consumed by every downstream library and app — `@xivdyetools/svg`, `@xivdyetools/bot-logic`, the Vite web app, the public API worker, the Discord bot, the Revolt (stoat) bot, and the OG image worker. Because so much depends on it, refactors here ripple everywhere — be conservative and run the full workspace test suite (`pnpm turbo run test`) for any non-trivial change.

## Commands

```bash
pnpm --filter @xivdyetools/core run build         # build:locales → tsc → copy:locales
pnpm --filter @xivdyetools/core run test
pnpm --filter @xivdyetools/core run test:integration
pnpm --filter @xivdyetools/core run test:coverage
pnpm --filter @xivdyetools/core run type-check
pnpm --filter @xivdyetools/core run lint
pnpm --filter @xivdyetools/core run calibrate:bands  # Recompute the band vocabulary from dyes.json
pnpm --filter @xivdyetools/core run clean
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/core
pnpm turbo run test --filter=@xivdyetools/core
pnpm --filter @xivdyetools/core exec vitest run src/services/__tests__/ColorService.test.ts
```

## Architecture

`@xivdyetools/core` follows a **facade + focused-class** pattern (per the internal "R-4" refactor): top-level service classes (`ColorService`, `DyeService`, `LocalizationService`) are thin façades that delegate to single-responsibility classes (`ColorConverter`, `ColorblindnessSimulator`, `ColorAccessibility`, `ColorManipulator`, `RybColorMixer`, `SpectralMixer`, `DyeDatabase`, `DyeSearch`, `HarmonyGenerator`, `LocaleLoader`, `LocaleRegistry`, `TranslationProvider`).

The dye database, presets, and per-locale translation files are bundled as JSON imports — there is no runtime I/O, which keeps the package safe for Cloudflare Workers, Vite browser bundles, and Node alike.

### Key Directories

```
src/
├── index.ts                       # Public API surface
├── constants/                     # RGB/HSV ranges, Universalis API config, Brettel matrices
├── types/                         # MatchingMethod (6-value 5.0 vocabulary), MATCHING_METHODS, DEFAULT_MATCHING_METHOD, normalizeMatchingMethod
├── blending/                      # Self-contained blending algorithms + conversions — subpath export @xivdyetools/core/blending (absorbed from color-blending)
├── config/consolidated-ids.ts     # Patch 7.5 dye consolidation (A=52254, B=52255, C=52256)
├── data/
│   ├── dyes.json                  # 125 dyes (schema v2: 7 fields, stainID-keyed)
│   ├── facewear_colors.json       # 11 facewear colors (not dyes)
│   ├── presets.json               # Curated palette/harmony presets
│   ├── character_colors/          # FFXIV skin/hair color tables, split per-race
│   └── locales/                   # Generated en/ja/de/fr/ko/zh JSON (after build:locales)
├── services/
│   ├── ColorService.ts            # Facade: conversion, mixing, simulation
│   ├── DyeService.ts              # Facade: database, search, harmony
│   ├── LocalizationService.ts     # Facade: 6-locale translation
│   ├── APIService.ts              # Universalis client + ICacheBackend
│   ├── PresetService.ts           # Resolve curated presets
│   ├── PaletteService.ts          # K-means palette extraction + dye matching
│   ├── CharacterColorService.ts   # FFXIV skin/hair color lookup
│   ├── color/                     # ColorConverter, ColorblindnessSimulator,
│   │                              # ColorAccessibility, ColorManipulator,
│   │                              # RybColorMixer, SpectralMixer
│   ├── dye/                       # DyeDatabase, DyeSearch, HarmonyGenerator, DyeFilter
│   └── localization/              # LocaleLoader, LocaleRegistry, TranslationProvider
├── utils/
│   ├── kd-tree.ts                 # 3D k-d tree (RGB nearest neighbour)
│   └── index.ts                   # clamp, round, retry, sleep, generateChecksum, validators
└── __tests__/integration/         # End-to-end workflow + perf benchmarks
scripts/
├── fetch_dye_names.py             # Pulls XIVAPI v2 names → dyenames.csv (en/ja/de/fr only)
├── build-locales.ts               # YAML + CSV + dyes.json → src/data/locales/*.json
├── copy-locales.ts                # Copies generated locales into dist/
└── calibrate-bands.ts             # Recomputes the band vocabulary from dyes.json (manual recalibration path)
```

## Public API

### Services (classes)

```ts
class ColorService              // Facade — see below
class DyeService                // Facade — see below
class LocalizationService       // Facade — see below
class ColorConverter            // hex/RGB/HSV/HSL/LAB/OKLAB/OKLCH/LCH conversions, DeltaE
class APIService                // Universalis market-board API
class MemoryCacheBackend        // In-process ICacheBackend impl
class PresetService             // Resolve presets.json entries
class PaletteService            // extractPalette / extractAndMatchPalette
class CharacterColorService     // FFXIV skin/hair lookups
class LocaleLoader              // Stateless — loads a single locale's JSON
class LocaleRegistry            // Stateless — manages multiple loaded locales
class TranslationProvider       // Stateless — performs translations from a registry
```

### `ColorService` (static methods)

Conversion: `hexToRgb`, `rgbToHex`, `rgbToHsv`, `hsvToRgb`, `hexToHsv`, `hsvToHex`, `normalizeHex`, `rgbToLab`, `hexToLab`, `labToRgb`, `labToHex`, `rgbToOklab`, `hexToOklab`, `oklabToRgb`, `oklabToHex`, `rgbToOklch`, `hexToOklch`, `oklchToRgb`, `oklchToHex`, `labToLch`, `lchToLab`, `rgbToLch`, `hexToLch`, `lchToRgb`, `lchToHex`, `rgbToHsl`, `hexToHsl`, `hslToRgb`, `hslToHex`, `rgbToCmyk`, `cmykToRgb`, `hexToCmyk`, `cmykToHex`, `rybToRgb`, `rgbToRyb`, `hexToRyb`, `rybToHex`.

Distance: `getColorDistance` (Euclidean RGB), `getRedmeanDistance`, `getDeltaE` (`DeltaEFormula`: CIE76 / CIEDE2000 / OKLAB), `getDistanceForMethod(hex1, hex2, MatchingMethod)` (the 5.0 suite dispatcher). `ColorConverter` additionally exposes `getDeltaE_Oklab`.

Accessibility: `getPerceivedLuminance`, `getContrastRatio`, `meetsWCAGAA`, `meetsWCAGAAA`, `isLightColor`, `getOptimalTextColor`.

Manipulation: `adjustBrightness`, `adjustSaturation`, `rotateHue`, `invert`, `desaturate`.

CVD simulation: `simulateColorblindness`, `simulateColorblindnessHex` (Brettel matrices for protan/deuter/tritanopia).

Mixing: `mixColorsRgb`, `mixColorsLab`, `mixColorsOklab`, `mixColorsHsl`, `mixColorsRyb`, `mixColorsSpectral`, `interpolateHue` (`shorter` | `longer` | `increasing` | `decreasing`).

Cache: `clearCaches`, `getCacheStats`.

### `DyeService` (instance methods, constructor `new DyeService(dyeData?, options?)`)

`getAllDyes`, `getDyeById`, `getByStainId`, `getDyeCount`, `getCategories`, `findClosestDye`, `findDyesWithinDistance`, `searchByName`, `findTriadicDyes`, `findComplementaryPair`, `findAnalogousDyes`, `findSplitComplementaryDyes`, `findTetradicDyes`, `findInvertedTetradicDyes`, `findSquareDyes`, `findMonochromaticDyes`, plus types `FindClosestOptions`, `FindWithinDistanceOptions`, `HarmonyOptions`, `HarmonyMatchingAlgorithm`, `HarmonyColorSpace`. `findClosestDye`/`findDyesWithinDistance` take an options object only (the legacy positional `excludeIds`/`maxDistance`/`limit` shapes were removed — DEAD-035, 2026-08-18 audit).

### `LocalizationService` + helpers

```ts
const SUPPORTED_LOCALES: readonly LocaleCode[]   // ['en','ja','de','fr','ko','zh']
function extractLocaleCode(locale: string): LocaleCode | null
function resolveLocaleFromPreference(p: LocalePreference): LocaleCode  // explicit > guild > system > fallback
class LocalizationService {
  setLocale(code: LocaleCode): Promise<void>
  getDyeName(itemID: number): string | null
  getCategory(key: string): string
  // + harmony types, vision types, tool/sheet/race/clan keys
}
```

`LocaleLoader` / `LocaleRegistry` / `TranslationProvider` are also exported for **stateless** callers (e.g., `og-worker`) that want explicit-locale APIs without the singleton + `setLocale` pattern.

### `APIService` — Universalis market board

```ts
interface ICacheBackend {
  get(key): Promise<CachedData<PriceData> | null> | CachedData<PriceData> | null
  set(key, value): Promise<void> | void
  delete(key): Promise<void> | void
}
interface APIServiceOptions { cache?: ICacheBackend; logger?: Logger; fetchClient?: FetchClient; rateLimiter?: RateLimiter }
class APIService {
  constructor(options?: APIServiceOptions)   // legacy positional (cache, fetchClient, rateLimiter) removed — DEAD-035, 2026-08-18 audit
  getPriceData(itemID: number, worldID?: number, dataCenterID?: string): Promise<PriceData | null>
  getPricesForDataCenter(itemIDs: number[], dataCenterID: string): Promise<Map<number, PriceData>>
  isAPIAvailable(): Promise<boolean>; getAPIStatus(): Promise<{ available; latency }>
  clearCache()
  static formatPrice(price): string
  // Pass getMarketItemID(dye) — 105 of the 125 dyes share a Patch 7.5 consolidated itemID
}
```

### Dye filtering / consolidation / matching presets

```ts
isDyeExcluded, filterDyes, hasActiveFilters
EXPENSIVE_DYE_IDS, VENDOR_ACQUISITIONS, CRAFT_ACQUISITIONS  // ['The Firmament','Venture Coffers']
CONSOLIDATED_IDS, CONSOLIDATED_DYES, isConsolidationActive,
  getMarketItemID, getConsolidatedDyeName
type ConsolidationType, ConsolidatedDye, LocalizedDyeName
type MatchingMethod = 'ciede2000' | 'oklab' | 'cie76' | 'redmean' | 'rgb' | 'distinguish'   // 5.0 vocabulary; hyab / oklch-weighted retired
MATCHING_METHODS, DEFAULT_MATCHING_METHOD ('ciede2000'), MATCHING_METHOD_TAGS,
  LEGACY_MATCHING_METHOD_MAP, isMatchingMethod, normalizeMatchingMethod   // hyab / oklch-weighted → ciede2000, euclidean → rgb
type DeltaEFormula = 'cie76' | 'ciede2000' | 'oklab' | 'cie2000'   // ColorConverter.getDeltaE formulas; 'ciede2000' is canonical (same spelling as MatchingMethod), 'cie2000' is a legacy alias folded by normalizeDeltaEFormula() at the getDeltaE entry (DEAD-037, 2026-08-18 audit); getDeltaE_HyAB removed (DEAD-034) — 'hyab' survives only as a legacy MatchingMethod token, normalized to ciede2000
normalizeDeltaEFormula, type CanonicalDeltaEFormula   // core-internal (not re-exported from the package root)
type RYB
```

### Constants

`RGB_MIN/MAX`, `HUE_MIN/MAX`, `SATURATION_MIN/MAX`, `VALUE_MIN/MAX`, `BRETTEL_MATRICES`, `MACHADO_MATRICES`, `PATTERNS`, `UNIVERSALIS_API_BASE`, `UNIVERSALIS_API_TIMEOUT`, `UNIVERSALIS_API_RETRY_COUNT`, `UNIVERSALIS_API_RETRY_DELAY`, `API_CACHE_TTL`, `API_CACHE_VERSION`, `API_MAX_RESPONSE_SIZE`, `API_RATE_LIMIT_DELAY`.

### Utils

`clamp`, `round`, `isValidHexColor`, `isValidRGB`, `isValidHSV`, `sleep`, `retry`, `isAbortError`, `generateChecksum`, `abbreviateDyeName`.

### Bundled data

```ts
import { dyeDatabase, presetData } from '@xivdyetools/core';
```

## Key Patterns / Algorithms

### `DyeDatabase.initialize()` — the singleton init step
- Reads **`dyes.json` only** — all 125 entries are real stains. Facewear is not in this database at all (see below).
- Validates each entry (id/itemID, name, hex `^#[A-Fa-f0-9]{6}$`, RGB 0-255, HSV ranges, category).
- **Derives the runtime `Dye` shape from the 7 stored fields**: `rgb`/`hsv`/`lab` from `hex`, `cost`/`currency` from `acquisition` via `ACQUISITION_META`, and the five `is*` flags (`isMetallic` from `METALLIC_STAIN_IDS`, `isCosmic ≡ consolidationType 'C'`, `isIshgardian ≡ 'B'`, …). `Dye.itemID` is a `number` — `legacyItemID`, falling back to `stainID` for future consolidated-only dyes.
- Builds three indexes: `dyesByIdMap`, `dyesByStainIdMap` (for Glamourer / Mare plugin interop), and `dyesByHueBucket` (36 × 10° buckets — 70-90% speedup on harmony lookups).
- Builds a 3D k-d tree (RGB) over all 125 dyes for nearest-neighbour matching.
- Pre-computes `nameLower`, `categoryLower` (search optimization) and `lab` (DeltaE pre-computation) on each entry.
- Defends against prototype pollution by stripping `__proto__`, `constructor`, `prototype` keys via `safeClone`.

### Facewear is not a dye (schema v2, 2026-07-31)
The 11 Facewear glasses colors were split out of the dye database. They live in `data/facewear_colors.json` and are exported as `facewearColors: readonly FacewearColor[]` — a `{ id: string slug, name, hex }` shape with **no** stainID, no market presence, and no Stain-sheet row. Look them up with `getFacewearColor(slug)`.

Before v2, `initialize()` assigned each one a synthetic `-(1000 + Σ charCode(name))` itemID, and those IDs escaped into serialized data (api-worker's public lookups, possibly localStorage). `LEGACY_FACEWEAR_ITEM_IDS` in `config/facewear.ts` is the **frozen** compatibility table mapping them back to slugs, read via `getFacewearColorByLegacyItemID()`. It was computed once from the names as they stood at the split and **must never be regenerated from live data** — a rename would silently orphan every persisted reference.

Nothing computes a synthetic ID at runtime any more. Code that filters "real dyes" no longer needs to: every entry in the database is one. `dye.itemID > 0` remains the correct market-board predicate (`itemID` is always a number, never null).

### k-d Tree (`utils/kd-tree.ts`)
3D RGB k-d tree with index-based construction (no point-array slicing → less GC pressure). O(log n) average for nearest-neighbour queries vs O(n) linear search.

### Harmony color spaces
`HarmonyGenerator` supports both `'hue'` and `'deltaE'` matching, in any of 4 color spaces: `'hsv'` (default, fast bucket lookup), `'oklch'` (perceptually uniform, recommended), `'lch'`, `'hsl'`. DeltaE tolerance defaults differ per formula (`cie76: 40`, `ciede2000`/`cie2000`: 25).

### Spectral mixing (Kubelka-Munk)
`SpectralMixer` wraps `spectral.js` and reflects light absorption/scattering across 380-750nm. Blue + Yellow = Green like real paint. Only `mixColors` is live — `mixMultiple`, `gradient`, and `isAvailable` were removed as uncalled (DEAD-034, 2026-08-18 audit).

### Locale build pipeline
1. `scripts/fetch_dye_names.py` (Python, run **manually**) hits XIVAPI v2 → `dyenames.csv`. XIVAPI only serves en/ja/de/fr — **Korean and Chinese names are sourced manually** from market-board HTML and pasted into the CSV.
2. `scripts/build-locales.ts` reads `localize.yaml` (label structure), `dyenames.csv` (per-language names), and `src/data/dyes.json` (categories) → emits `src/data/locales/{en,ja,de,fr,ko,zh}.json`.
3. `tsc -p tsconfig.build.json` compiles to `dist/`.
4. `scripts/copy-locales.ts` copies the generated JSON into `dist/`.

`build-locales.ts` is **idempotent**: before writing, it compares the freshly built payload against the file already on disk, ignoring `meta.generated`. If nothing else differs it keeps the existing file untouched — same bytes, same mtime. Rebuilding from unchanged sources therefore leaves a clean working tree, and `meta.generated` marks when the locale data last *changed* rather than when the build last ran.

## Consumers

Internal apps:
- `apps/web-app` — Vite browser bundle, uses `dyeDatabase` JSON import, `ColorService`, `DyeService`, `LocalizationService`, `PaletteService`, `APIService`.
- `apps/discord-worker` — Cloudflare Worker, uses `DyeService`, `LocalizationService`, `APIService` with a KV-backed `ICacheBackend`.
- `apps/api-worker` — public dye/color-matching API (accepts the retired `hyab` / `oklch-weighted` at its boundary and normalises them to `ciede2000`).
- `apps/og-worker` — uses the stateless `LocaleLoader/Registry/TranslationProvider` trio.
- `apps/stoat-worker` — Revolt bot.

Internal packages:
- (formerly `@xivdyetools/color-blending`) — the self-contained blending module now lives at `src/blending/`, exported as `@xivdyetools/core/blending`.
- `@xivdyetools/svg` — uses `ColorService`, `DyeService`.
- `@xivdyetools/bot-logic` — uses `DyeService`, `LocalizationService`, `filterDyes`, harmony types.

## Internal Dependencies

- `@xivdyetools/types` — branded types (`HexColor`, `Dye`, `LocaleCode`, etc.) and `AppError` / `ErrorCode`.
- `@xivdyetools/logger` — pluggable `Logger` with `NoOpLogger` default.

External: `spectral.js` (Kubelka-Munk).

## Dead-code gate (knip)

`pnpm run lint` = `eslint src && pnpm run lint:dead`, and `lint:dead` is
`knip --directory ../.. --workspace packages/core`. It runs against the **root**
`knip.jsonc` (never a local one) because core's consumers live in other
workspaces: `--workspace` filters which workspace's issues are *reported*, but
knip still loads and traverses `apps/*` and `packages/{svg,bot-logic}`, so an
export only `apps/web-app` imports counts as used. Resolution is
build-independent — knip maps `@xivdyetools/core` through this package's
`exports` map and rewrites `dist/** → src/**` from `tsconfig.json`'s
`outDir`/`rootDir`, without touching `dist/`.

`includeEntryExports` is on for this package, so **barrel exports are in scope**.
Every symbol in `src/index.ts` that no workspace imports must carry a
`/** @public */` JSDoc tag on its export specifier, which the config's
`"tags": ["-public"]` excludes from the report. `@public` means *published API,
deliberately kept without an in-repo consumer* — the ~76 already tagged are the
2026-08-18 audit's KEEP list (companion types, `facewearColors`,
`LEGACY_FACEWEAR_ITEM_IDS`, `RATIO_BANDS`, `MemoryCacheBackend`,
`SUPPORTED_LOCALES`, the `utils` survivors, the API/Universalis tunables). A new
export with neither a consumer nor a tag fails `lint`; delete it or tag it on
purpose. knip 6 has no `classMembers` rule, so unused public **methods** are
still invisible here.

## Publishing

Publishing goes through the **Publish Packages to npm** GitHub Actions workflow, which authenticates via npm trusted publishing (OIDC). There is no npm token — see the root `CLAUDE.md` for the full flow and the break-glass local path.

```bash
# 1. Bump version in packages/core/package.json and merge to main
# 2. Build + test
pnpm turbo run build test --filter=@xivdyetools/core

# 3. Actions → "Publish Packages to npm" → package: @xivdyetools/core
```

If you've made **manual locale fixes** (e.g., Korean/Chinese name corrections) that aren't reproducible from `dyenames.csv` / `localize.yaml`, `build:locales` will detect the difference and regenerate over them during the publish build. Fold such corrections back into the source CSV/YAML rather than editing the generated JSON, or use `--ignore-scripts` on a break-glass local publish.
