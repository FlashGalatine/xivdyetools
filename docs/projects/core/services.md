# Core Library Services

**API reference for @xivdyetools/core services**

---

## Service Architecture

The library uses a facade pattern — high-level service classes delegate to
focused sub-services:

```
ColorService (facade, all-static)
├── ColorConverter          - format conversion + LRU caches
├── ColorAccessibility      - WCAG contrast, perceived luminance
├── ColorManipulator        - brightness / saturation / hue adjustment
└── ColorblindnessSimulator - Brettel + Machado CVD simulation

DyeService (instance)
├── DyeDatabase             - load, validate, index, k-d tree
├── DyeSearch               - nearest-dye search
└── HarmonyGenerator        - the legacy per-type find*Dyes() methods
```

Colour *mixing* is not a class: it lives in `src/blending/` and is reached
through `ColorService.mixColors*` or the `@xivdyetools/core/blending` subpath.

---

## ColorService

Every method is **static** and takes **scalars**, not objects.

### Conversion

```typescript
import { ColorService } from '@xivdyetools/core';

ColorService.hexToRgb('#FF6B6B');            // { r: 255, g: 107, b: 107 }
ColorService.rgbToHex(255, 107, 107);        // HexColor — three arguments
ColorService.rgbToHsv(255, 107, 107);        // HSV — NOT rgbToHsv(rgbObject)
ColorService.rgbToLab(255, 107, 107);        // LAB { L, a, b } — capital L
ColorService.labToRgb(65.2, 48.1, 20.4);
ColorService.normalizeHex('#f6b');           // expands shorthand, upper-cases
```

Nine colour spaces are covered — RGB, HSV, HSL, LAB, OKLAB, OKLCH, LCH, CMYK and
RYB — each with the full `rgbTo*` / `*ToRgb` / `hexTo*` / `*ToHex` set, all
taking scalars. See [`packages/core/README.md`](../../../packages/core/README.md)
for the exhaustive list.

### Manipulation

```typescript
ColorService.adjustBrightness('#FF6B6B', 20);   // signed amount
ColorService.adjustSaturation('#FF6B6B', -15);
ColorService.rotateHue('#FF6B6B', 120);         // HSV hue rotation
ColorService.rotateHueLch('#FF6B6B', 120);      // LCh hue rotation
ColorService.invert('#FF6B6B');
ColorService.desaturate('#FF6B6B');             // one argument — full desaturation
```

There is no `lighten` / `darken` / `saturate`; `adjustBrightness` and
`adjustSaturation` take a signed amount instead.

### Mixing

Six modes, all `(hex1, hex2, ratio = 0.5)`. There is no `ColorService.blend()`.

```typescript
ColorService.mixColorsRgb('#0000FF', '#FFFF00');
ColorService.mixColorsLab('#0000FF', '#FFFF00');
ColorService.mixColorsOklab('#0000FF', '#FFFF00');
ColorService.mixColorsHsl('#0000FF', '#FFFF00');
ColorService.mixColorsRyb('#0000FF', '#FFFF00');
ColorService.mixColorsSpectral('#0000FF', '#FFFF00');  // Kubelka-Munk → green
```

`ratio` `0` is all of `hex1`, `1` all of `hex2`. The `/blending` subpath exposes
the same engine as `blendColors(hex1, hex2, mode, ratio)`.

### Distance and accessibility

```typescript
ColorService.getColorDistance(hex1, hex2);                    // Euclidean RGB
ColorService.getRedmeanDistance(hex1, hex2);
ColorService.getDeltaE(hex1, hex2, 'ciede2000');              // DeltaEFormula
ColorService.getDistanceForMethod(hex1, hex2, 'ciede2000');   // MatchingMethod
ColorService.getDistinguishabilityPercent(hex1, hex2);

ColorService.getPerceivedLuminance('#FF6B6B');
ColorService.getContrastRatio('#FF6B6B', '#FFFFFF');          // 1-21
ColorService.meetsWCAGAA('#FF6B6B', '#FFFFFF');               // largeText? third arg
ColorService.meetsWCAGAAA('#FF6B6B', '#FFFFFF');
ColorService.isLightColor('#FF6B6B');
ColorService.getOptimalTextColor('#FF6B6B');
```

There is no `evaluateWCAG` and no `getRelativeLuminance`.

### Colourblindness

`simulateColorblindness` takes an **RGB**; the hex convenience form has its own
name.

```typescript
ColorService.simulateColorblindness({ r: 255, g: 107, b: 107 }, 'protanopia');
ColorService.simulateColorblindnessHex('#FF6B6B', 'protanopia');
ColorService.simulateColorblindnessMachado(rgb, 'deuteranopia');       // linear-light
ColorService.simulateColorblindnessMachadoHex('#FF6B6B', 'tritanopia');
```

`VisionType` has five members: `normal`, `protanopia`, `deuteranopia`,
`tritanopia`, `achromatopsia`.

### Caches

`ColorService.clearCaches()` and `ColorService.getCacheStats()` cover the seven
LRU caches (see [Algorithms](algorithms.md)).

---

## DyeService

An instance class — construct it with the bundled JSON.

```typescript
import { DyeService, dyeDatabase } from '@xivdyetools/core';

const dyeService = new DyeService(dyeDatabase);

dyeService.getAllDyes();            // Dye[] (125)
dyeService.getDyeById(13115);       // by itemID (= Dye.id) → Dye | null
dyeService.getByStainId(102);       // by stainID (canonical key) → Dye | null
dyeService.getDyeCount();
dyeService.isLoadedStatus();
dyeService.getCategories();
// ['Neutral', 'Reds', 'Browns', 'Yellows', 'Greens', 'Blues', 'Purples', 'Special']
```

`dyeDatabase` is the raw JSON array, **not** a service — call the methods on the
`DyeService` you built from it.

### Search and matching

```typescript
dyeService.searchByName('black');
dyeService.searchByCategory('Reds');            // exact match against DYE_CATEGORIES
dyeService.searchByLocalizedName('スノウ', 'ja');
dyeService.filterDyes({ category: 'Special', excludeIds: [5752] });

dyeService.findClosestDye('#FF6B6B');           // → Dye | null (not a match object)
dyeService.findClosestDye('#FF6B6B', { matchingMethod: 'oklab' });
dyeService.findDyesWithinDistance('#FF6B6B', { maxDistance: 20, limit: 5 });
```

`findClosestDye` returns the `Dye` itself. For the N nearest, use
`findDyesWithinDistance({ maxDistance, limit, matchingMethod })` — there is no
`findClosestDyes`, and no result wrapper carrying `deltaE`.

### Harmony

Prefer `generateHarmonySlots` — the one implementation every surface shares (see
[Algorithms](algorithms.md#harmony-generation)). The per-type methods remain for
callers that want a plain dye list: `findComplementaryPair` (→ `Dye | null`),
`findTriadicDyes`, `findAnalogousDyes(hex, angle)`,
`findSplitComplementaryDyes`, `findTetradicDyes`, `findInvertedTetradicDyes`,
`findSquareDyes`, `findMonochromaticDyes(hex, limit)` (all → `Dye[]`).

`HarmonyOptions.colorSpace` is **deprecated since 5.2.0**.

---

## PaletteService

An instance class; extraction is **synchronous** and consumes an `RGB[]`.

```typescript
const paletteService = new PaletteService();
const pixels = PaletteService.pixelDataToRGBFiltered(imageData.data);  // static

const palette = paletteService.extractPalette(pixels, { colorCount: 4 });
// ExtractedColor[] = { color: RGB, dominance: number, pixelCount: number }[]

const matches = paletteService.extractAndMatchPalette(pixels, dyeService, { colorCount: 4 });
// PaletteMatch[] = { extracted: RGB, matchedDye: Dye, distance, dominance }[]
```

There is no `quality` option and no hex-string return. Options are `colorCount`
(4), `maxIterations` (25), `convergenceThreshold` (1.0), `maxSamples` (10000) and
`matchingMethod` — see [Algorithms](algorithms.md#extraction-options).

---

## APIService

Universalis market-board client with a pluggable cache.

```typescript
import { APIService, MemoryCacheBackend } from '@xivdyetools/core';

const api = new APIService({ cacheBackend: new MemoryCacheBackend() });

// getPriceData(itemID, worldID?: number, dataCenterID?: string)
// The second argument is a numeric WORLD ID, not a world name.
await api.getPriceData(52254, undefined, 'Aether');
await api.getPricesForDataCenter([52254, 52255], 'Aether');
```

Also: `isAPIAvailable()`, `getAPIStatus()` → `{ available, latency }`,
`clearCache()`, and the static `APIService.formatPrice(price)`.

`ICacheBackend` has **five** members and each may be sync or async:

```typescript
interface ICacheBackend {
  get(key: string): Promise<CachedData<PriceData> | null> | CachedData<PriceData> | null;
  set(key: string, value: CachedData<PriceData>): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
  keys(): Promise<string[]> | string[];
}
```

`APIServiceOptions` = `{ cacheBackend?, fetchClient?, rateLimiter?, logger?, baseUrl? }`.

---

## PresetService

An instance class over the bundled `presetData`.

```typescript
import { PresetService, presetData } from '@xivdyetools/core';

const presets = new PresetService(presetData);   // instance, not static

presets.getAllPresets();                                 // PresetPalette[]
presets.getPreset('season-spring');                      // PresetPalette | undefined
presets.getPresetWithDyes('season-spring', dyeService);  // ResolvedPreset | undefined
```

Also: `getCategories()` → `(CategoryMeta & { id })[]`, `getCategoryMeta(category)`,
`getPresetsByCategory(category)`, `searchPresets(query, dyeService?)`,
`getRandomPreset(category?)`. There are no static `PresetService.getPresets()`
helpers.

---

## LocalizationService

Both an instance class and a static singleton facade. `setLocale` is **async**
because it loads the locale file.

```typescript
import { LocalizationService, SUPPORTED_LOCALES } from '@xivdyetools/core';

SUPPORTED_LOCALES;                              // ['en','ja','de','fr','ko','zh']

await LocalizationService.setLocale('ja');
LocalizationService.getCurrentLocale();         // 'ja'
LocalizationService.getDyeName(5729);           // string | null
LocalizationService.getLabel('metallic');       // TranslationKey
```

There is no `translate()` and no `getLocale()`. Lookups are per-vocabulary:
`getLabel`, `getDyeName`, `getCategory`, `getAcquisition`, `getCurrency`,
`getHarmonyType`, `getColorWheelName`, `getVisionType` / `getVisionShort`,
`getToolName`, `getSheetName`, `getRace`, `getClan`, `getFacewearColorName` —
each also taking an optional explicit `locale`. `getAvailableLocales()` and
`isLocaleLoaded()` report state; every method exists both on an instance and as
a static on the singleton facade.

For stateless, explicit-locale callers (og-worker), `LocaleLoader` /
`LocaleRegistry` / `TranslationProvider` are exported directly.

---

## Full reference

Package README: [`packages/core/README.md`](../../../packages/core/README.md)

## Related Documentation

- [Overview](overview.md) - Quick start and installation
- [Types](types.md) - Type system and branded types
- [Algorithms](algorithms.md) - Implementation details
