# [DEAD-034]: core — ~40 public class methods with zero production callers across the monorepo (~655 src / ~790 test lines) — knip's blind spot

## Category
Unused Export (TEST-ONLY class members; DOCUMENTED-PUBLIC-API)

## Location
`packages/core/src/services/**` — every row: ext-src 0 **and** no core non-test caller other than its own facade wrapper (survey script `members.py`, `evidence/track-B-core.md` §4):

| Class.member | Lines | Notes |
|---|---|---|
| `APIService.getPricesForItems` (1025-1094) | 70 | web-app (sole consumer) uses `getPriceData`/`getPricesForDataCenter`; README:238, CLAUDE.md:146 |
| `APIService.getPriceTrend` (1222-1242, static) | 21 | README:249 |
| `APIService.getCacheStats` (544-550), `resetMetrics` (552-563) + `CacheMetrics` type + metrics bookkeeping | ≈40 | README:242 |
| `DyeService.getDyesByIds` / `getDyesByStainIds` / `getLastLoadedTime` → `DyeDatabase.*` | 6+10, 13+17, 6+6 | apps use singular `getByStainId` (×13) |
| `DyeService.getDyesSortedBy{Brightness,Saturation,Hue}` → `DyeSearch.*` (342-382) | 18+39 | web-app tests only (mocks) |
| `DyeService.findCompoundDyes` / `findShadesDyes` → `HarmonyGenerator` (282-323) | 16+28 | web-app `harmony-generator.ts:82-83` implements compound/shades itself; bot-logic harmony has neither |
| `DyeService.getLocalizedDyeById` (400-426), `getLocalizedDyeByStainId` (428-449), `getAllLocalizedDyes` (451-477), `getNonMetallicDyes` (479-497) | 95 | apps localise via `LocalizationService.getDyeName` (23 ext src) |
| `ColorService.mixColorsOklch` (726-752), `mixColorsLch` (754-781), `mixColorsHsv` (812-838) | 82 | web-app `MixingMode = rgb\|lab\|oklab\|ryb\|hsl\|spectral`; bot uses `/blending`; CLAUDE.md:110 |
| `ColorService.mixMultipleSpectral` (869-878), `gradientSpectral` (880-893), `isSpectralAvailable` (895-902) → `SpectralMixer.mixMultiple` (67-107), `gradient` (109-137), `isAvailable` (139-150) | 32+82 | only `SpectralMixer.mixColors` is live; CLAUDE.md:209 |
| `ColorConverter.getDeltaE_HyAB` (921-956) + `DeltaEFormula` `'hyab'` + `getDeltaE` case | 36+3 | retired v4 method; `normalizeMatchingMethod('hyab') → 'ciede2000'`; og-worker lists 'hyab' only as a legacy token |
| `PresetService.getPresetCountByCategory` (156-166), `getPresetsByTag` (212-220), `resolvePresets` (289-300), `getVersion`, `getLastUpdated`, `getPresetCount` (306-328) | 53 | sole consumer is web-app `hybrid-preset-service.ts`; `getVersion`/`getLastUpdated` are the only readers of `presets.json`'s two meta fields |
| `CharacterColorService.preloadRaceData` (265-272), `getSharedColorByIndex` (425-431), `getRaceSpecificColorByIndex` (433-444), `getAvailableSubraces` (450-455), `getVersion` (457-462), `getGridColumns` (464-469) | 45 | |
| `PaletteService.pixelDataToRGB` (475-495) | 21 | README:213; apps use `pixelDataToRGBFiltered` |
| `KDTree.getSize` | small | test-only |

Tests that would go with them: `APIService.test.ts` getPriceTrend/getPricesForItems blocks; `DyeService.test.ts:454-560`; `PresetService.test.ts:431-750`; `SpectralMixer.test.ts:17-200`; `HarmonyGenerator.test.ts:367-410, 616-650`; `DyeSearch.test.ts:378-460`.

**Not proposed** (documented colour-science surface with in-core or ext-test use): `hsvToRgb`, `getRedmeanDistance`, `getDistinguishabilityPercent`, the oklab/oklch/lch/hsl/cmyk/ryb converters, `interpolateHue`, `clearCaches`, etc.

## Evidence
knip's `classMembers` rule is off; found by the per-class public-method survey bucketing `\.method(` occurrences into ext-src / ext-test / core-src / core-test over tracked files.

## Why It Exists
`@xivdyetools/core` was designed as a complete colour/dye SDK; the three consuming surfaces (web-app, bot-logic, api-worker) each use a subset and the union is well short of the API.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (usage) |
| **Blast Radius** | In-repo NONE; npm-published + README/CLAUDE-documented → semver-minor for hypothetical external consumers (DEPRECATIONS.md and CHANGELOG name only workspace consumers) |
| **Reversibility** | EASY |
| **Hidden Consumers** | Facade delegation was traced (`ColorService` → `SpectralMixer`, `DyeService` → `DyeDatabase`/`DyeSearch`/`HarmonyGenerator`) so no member is removed while its facade stays |

## Recommendation
**REMOVE WITH CAUTION** — as one deliberate "core API tightening" minor release with a CHANGELOG list, done facade-first (`DyeService` → its delegates, `ColorService` → `SpectralMixer`) so `tsc` catches every ripple; update README/CLAUDE method lists. If the owner prefers to keep core as a broad SDK, mark these `@internal`-free but note in CLAUDE.md that they have no in-repo consumer so the next audit does not re-derive this.
