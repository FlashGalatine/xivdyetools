# Core Library Algorithms

**Performance-optimized algorithms in @xivdyetools/core**

---

## k-d Tree for Dye Matching

The dye database uses a k-d tree (k-dimensional tree) for efficient nearest-neighbor lookup in RGB color space.

### How It Works

```
                    (128, 64, 192)
                    /            \
          (64, 32, 128)        (192, 96, 240)
          /          \          /          \
    (32, 16, 64)  (96, 48, 160)  ...       ...
```

1. **Build Phase (startup)**: Dyes sorted by RGB values, tree constructed
2. **Query Phase**: Binary search through tree, pruning branches that can't contain closer matches

### Performance

| Operation | Brute Force | k-d Tree | Improvement |
|-----------|-------------|----------|-------------|
| Single lookup | O(n) | O(log n) | ~7x faster |
| k-nearest | O(n * k) | O(k log n) | ~7x faster |

For 125 dyes:
- **Brute force**: Check all 125 dyes = 125 comparisons
- **k-d tree**: ~7 comparisons average (log₂ 125 ≈ 7)

> **Note**: perceptual distance methods use an **exact linear scan**, not the k-d tree
> (core v2.7.0, REFACTOR-003). A k-d radius search can return an in-radius worse dye while the
> true nearest sits just outside the radius, because perceptual distance is not the metric the
> tree is indexed on.

### Implementation

`DyeDatabase` (`src/services/dye/DyeDatabase.ts`) and `KDTree`
(`src/utils/kd-tree.ts`) are **internal** — neither is exported from the package
barrel. `DyeService` is the public entry point.

```typescript
// Construction takes a config; the data arrives in initialize()
const db = new DyeDatabase();          // DyeDatabaseConfig, not the dye array
db.initialize(dyeData);                // validates, derives, indexes, builds the tree

db.getKdTree();                        // KDTree | null
db.getDyesByHueBucket(bucket);         // one of 36 × 10° buckets

// KDTree itself is a plain 3D structure over Point3D { x, y, z, data }
const tree = new KDTree(points);
tree.nearestNeighbor(target);                       // Point3D | null
tree.nearestNeighbor(target, (d) => shouldSkip(d)); // with an exclusion predicate
tree.pointsWithinDistance(target, radius);
tree.isEmpty();
```

There is no `nearest(point, k)`, no `findNearest` / `findKNearest`, and no
`{ dimensions }` constructor option. The public N-nearest API is
`DyeService.findDyesWithinDistance(hex, { maxDistance, limit, matchingMethod })`.

---

## Hue Bucketing for Harmony Generation

Generating color harmonies requires finding dyes at specific hue angles. Rather than scanning all dyes, we use hue bucketing.

### How It Works

1. **Preprocessing**: Dyes sorted into 36 buckets (10° each)
2. **Query**: Direct bucket access for target hue ± tolerance

```
Bucket 0:   0° - 10°   → [Snow White, Pure White, ...]
Bucket 1:  10° - 20°   → [...]
...
Bucket 35: 350° - 360° → [...]
```

### Finding Complementary Colors

```typescript
// Example: Find complementary (180° opposite) for hue 45°
const targetHue = 45 + 180;  // = 225°
const bucket = Math.floor(targetHue / 10);  // = bucket 22

// Search bucket 22 and adjacent buckets for best match
const candidates = [
  ...buckets[21],  // 210°-220°
  ...buckets[22],  // 220°-230°
  ...buckets[23]   // 230°-240°
];
```

### Performance

| Operation | Without Bucketing | With Bucketing | Improvement |
|-----------|-------------------|----------------|-------------|
| Find complementary | O(n) = 125 checks | O(n/36) ≈ 4 checks | ~34x faster |
| Find triadic | O(n) × 2 = 250 checks | ~8 checks | ~34x faster |

---

## Harmony generation

`generateHarmonySlots` is the **one** implementation the web app, the Discord
bot and the OG card share. Before it existed the three surfaces each rotated hue
differently and disagreed for 89-100 % of base dyes on every harmony type.

### The offsets table

A harmony type is a **row in a table**, not a bespoke method — which is why
`compound` and `shades` work without any new code. `HARMONY_OFFSETS`
(`src/constants/index.ts`) has ten keys:

```typescript
export const HARMONY_OFFSETS: Record<string, number[]> = {
  complementary: [180],
  analogous: [30, 330],
  triadic: [120, 240],
  'split-complementary': [150, 210],
  tetradic: [60, 180, 240],
  'inverted-tetradic': [120, 180, 300],
  square: [90, 180, 270],
  monochromatic: [0],
  compound: [30, 180, 330],
  shades: [15, 345],
};
```

Validate an incoming type with `isKnownHarmonyType(s)` — it is an own-property
check, because `HARMONY_OFFSETS['toString']` is truthy and a `!offsets` guard
sails straight past it into a throw. The web app reads this key out of a share
URL, so it really can be arbitrary.

### Selection

```typescript
import { generateHarmonySlots, DyeService, dyeDatabase } from '@xivdyetools/core';

const dyeService = new DyeService(dyeDatabase);

const slots = generateHarmonySlots(
  '#FF6B6B',                    // base: supplies H, S and V
  'triadic',                    // a key of HARMONY_OFFSETS
  dyeService.getAllDyes(),      // candidates — callers pre-filter this pool
  {
    usePerceptualMatching: true,  // rank by ΔE against an S/V-preserving target
    matchingMethod: 'ciede2000',  // ignored when usePerceptualMatching is false
    wheel: 'ryb',                 // default 'rgb'
    companionCount: 2,            // runners-up per slot, default 0
    preventDuplicates: true,
  },
  { excludeItemIDs: [5741], pinned: new Map([[0, someDye]]) },
);
```

Each `HarmonySlot` carries `{ index, offset, targetHue, wheelHue, targetHex,
dye, deviance, companions }` — the ideal the slot wanted **and** the dye that
was found for it, which is what a card outlines side by side. `dye` is `null`
when no candidate was available.

Candidates are pre-filtered by the caller: this function knows nothing about
anyone's dye-filter shape, and pre-filtering is what makes the answer "the
nearest *allowed* dye to the ideal" rather than "the nearest allowed dye to a
dye that was thrown away". Facewear entries are skipped unconditionally.

### Colour wheels

`config.wheel` selects which wheel the offsets are measured on. The registry
(`src/services/dye/wheels/`) is the one list every surface reads:

```typescript
import {
  COLOR_WHEEL_IDS,        // ['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness']
  DEFAULT_COLOR_WHEEL,    // 'rgb'
  COLOR_WHEEL_TAGS,       // { rgb: 'RGB', ryb: 'RYB', munsell: 'MUNSELL', … }
  getColorWheel,
  parseColorWheelId,      // → ColorWheelId | undefined
  normalizeColorWheelId,  // → ColorWheelId ('absent or unknown means rgb')
} from '@xivdyetools/core';
```

| Wheel | What it preserves |
|-------|-------------------|
| `rgb` | HSV hue directly — byte-identical to pre-5.2.0 behaviour, and the default |
| `ryb` | Artist's red-yellow-blue wheel (the 25-pair NodeBox/Paletton/Adobe hue-warp table) |
| `munsell` | Munsell renotation hues, from the committed `munsell-hues.json` |
| `oklch-hue` | Perceptual OKLCH hue, from the committed `oklch-hue-table.json` |
| `oklch-lightness` | The base's OKLab **L and C** instead of its HSV S/V |

Each `ColorWheel` exposes `hueOf(hex)` (where a colour sits on the wheel, 0-360),
`target(baseHex, wheelHue)` (`{ targetHex, targetHue }` — the ideal colour for a
slot), `ringStops(count)` (ring paint at evenly spaced angles) and the
`carriesBaseHsv` flag.

That flag is load-bearing: `oklch-lightness` sets it `false`, and the selector
then forces ΔE ranking for it regardless of `usePerceptualMatching`, because
scoring by degrees of hue would discard the very lightness the wheel was chosen
for. Never hand-roll a `toLowerCase()` + membership test on a wheel id — use
`normalizeColorWheelId`.

`oklch-hue-table.json` and `munsell-hues.json` are **generated and committed**,
not derived at import (`pnpm run build:oklch-hue`, `pnpm run build:munsell`).
Regenerating either is a deliberate re-baseline of the harmony golden tests.

### Matching methods and bands

Ranking uses one `MatchingMethod` — `ciede2000` (default), `oklab`, `cie76`,
`redmean`, `rgb` or `distinguish` — via
`ColorService.getDistanceForMethod(hex1, hex2, method)`. Because each method has
its own scale, a raw distance is never comparable across methods; the shared
vocabulary for that is `BAND_VOCABULARY` in `config/band-vocabulary.ts`, which
holds calibrated tier cuts **per context and per method**:

```
match:      ciede2000 [5, 10, 20]   oklab [0.033, 0.081, 0.174]   cie76 [5.4, 12.6, 26.2] …
harmony:    ciede2000 [6, 12, 20]   oklab [0.041, 0.101, 0.174]   cie76 [6.7, 14.5, 26.2] …
separation: ciede2000 [8, 15, 30]   oklab [0.08, 0.144, 0.281]    cie76 [10.4, 19.3, 38.4] …
```

`classifyBandTier(distance, context, method)` returns the `BandTier`;
`roundToBandDisplay` applies the per-method decimal places (`BAND_METHOD_DP`).
`RATIO_BANDS` covers WCAG contrast, which is a ratio rather than a distance and
prints last.

The legacy `HarmonyGenerator.find*Dyes()` methods still accept
`HarmonyOptions.colorSpace` (`'hsv' | 'oklch' | 'lch' | 'hsl'`), but that option
is **deprecated since 5.2.0**: it rotates hue without carrying the base's
saturation and value, so it answers a different question from every shipped
surface. `'oklch'` gamut-maps (CSS Color 4); `'lch'` and `'hsl'` still clip per
channel and can therefore change hue.

---

## K-means++ Palette Extraction

Extracts dominant colors from images using the K-means++ algorithm for better centroid initialization.

### K-means++ vs K-means

| Aspect | Standard K-means | K-means++ |
|--------|------------------|-----------|
| Initial centroids | Random | Distance-weighted random |
| Convergence | ~20 iterations | ~10 iterations |
| Quality | Variable | Consistently good |

### Algorithm Steps

```
1. INITIALIZE CENTROIDS (K-means++)
   a. Choose first centroid randomly from data points
   b. For each remaining centroid:
      - Calculate distance from each point to nearest existing centroid
      - Choose next centroid with probability proportional to distance²

2. ITERATE UNTIL CONVERGENCE
   a. Assign each pixel to nearest centroid (by RGB distance)
   b. Recalculate centroids as mean of assigned pixels
   c. Repeat until centroids stop moving (or max iterations)

3. OUTPUT
   - Return K centroids as ExtractedColor entries, sorted by dominance
```

### Implementation

`extractPalette` is a **synchronous instance method** that consumes an `RGB[]`
and returns `ExtractedColor[]`. Convert `ImageData` first with the static
`pixelDataToRGBFiltered`.

```typescript
import { PaletteService, DyeService, dyeDatabase } from '@xivdyetools/core';

const paletteService = new PaletteService();
const pixels = PaletteService.pixelDataToRGBFiltered(imageData.data, 128);

const palette = paletteService.extractPalette(pixels, { colorCount: 4 });
// [{ color: { r, g, b }, dominance: 45, pixelCount: 4500 }, ...]

// Same extraction, each centroid matched to its nearest dye
const matches = paletteService.extractAndMatchPalette(pixels, new DyeService(dyeDatabase), {
  colorCount: 4,
  matchingMethod: 'ciede2000',
});
// [{ extracted: RGB, matchedDye: Dye, distance, dominance }, ...]
```

### Extraction Options

There is no `quality` setting. `PaletteExtractionOptions`:

| Option | Default | Meaning |
|--------|---------|---------|
| `colorCount` | 4 | Colours to extract. Clamped to 1-10 (a clamp is logged). |
| `maxIterations` | 25 | K-means iteration ceiling. |
| `convergenceThreshold` | 1.0 | Stop once centroids move less than this in RGB distance. |
| `maxSamples` | 10000 | Pixels sampled from the input. |
| `matchingMethod` | `ciede2000` | `extractAndMatchPalette` only — how each centroid picks its dye. |

---

## Color Difference (Delta E)

The library calculates color difference using CIE deltaE for perceptual accuracy.

### RGB Distance vs Delta E

```
RGB Distance = √[(R₁-R₂)² + (G₁-G₂)² + (B₁-B₂)²]

Delta E (CIE76) = √[(L₁-L₂)² + (a₁-a₂)² + (b₁-b₂)²]
                  (in LAB color space)
```

**Why Delta E is better:**
- RGB distance treats all channels equally
- Human vision is more sensitive to some colors than others
- LAB color space models human perception
- Delta E ≈ 1 is barely perceptible difference

### Delta E Interpretation

| Delta E | Interpretation |
|---------|----------------|
| 0-1 | Not perceptible |
| 1-2 | Perceptible through close observation |
| 2-10 | Perceptible at a glance |
| 11-49 | Colors are similar |
| 50-100 | Colors are different |

### Implementation

CIE76 in the shape core computes it. Note `LAB.L` is **capitalised**, and the
conversions take scalars:

```typescript
import { ColorService } from '@xivdyetools/core';

function cie76(hex1: string, hex2: string): number {
  const a = ColorService.hexToLab(hex1);
  const b = ColorService.hexToLab(hex2);

  return Math.sqrt(
    Math.pow(a.L - b.L, 2) +
    Math.pow(a.a - b.a, 2) +
    Math.pow(a.b - b.b, 2)
  );
}

// In practice, call the library rather than reimplementing.
// DeltaEFormula = 'cie76' | 'ciede2000' | 'oklab' (+ 'cie2000', a legacy alias);
// getDeltaE's own parameter default is 'cie76'.
ColorService.getDeltaE(hex1, hex2, 'ciede2000');

// Or go through the 5.0 matching vocabulary, whose default is 'ciede2000':
ColorService.getDistanceForMethod(hex1, hex2, DEFAULT_MATCHING_METHOD);
```

---

## Colorblindness Simulation (Brettel 1997)

The library implements the Brettel algorithm for accurate colorblindness simulation.

### How Colorblindness Works

| Type | Affected Cone | Effect |
|------|---------------|--------|
| Protanopia | L (long) | Can't distinguish red from green |
| Deuteranopia | M (medium) | Can't distinguish green from red |
| Tritanopia | S (short) | Can't distinguish blue from yellow |

### Algorithm

The Brettel algorithm projects colors onto a reduced color space:

```
1. Convert RGB to LMS (Long, Medium, Short cone response)
2. Apply confusion matrix based on colorblindness type
3. Convert back to RGB

For protanopia:
L_simulated = 2.02344 × M - 2.52581 × S
(L cone response estimated from M and S)
```

### Confusion Matrices

Two sets ship, both exported from the barrel. `BRETTEL_MATRICES` is applied to
**gamma-encoded sRGB** by the legacy simulator (`simulateColorblindness`), and
each set includes an `achromatopsia` row that is a luminance grayscale rather
than a dichromacy model.

```typescript
// src/constants/index.ts — verbatim
export const BRETTEL_MATRICES: ColorblindMatrices = {
  deuteranopia: [
    [0.625, 0.375, 0.0],
    [0.7, 0.3, 0.0],
    [0.0, 0.3, 0.7],
  ],
  protanopia: [
    [0.567, 0.433, 0.0],
    [0.558, 0.442, 0.0],
    [0.0, 0.242, 0.758],
  ],
  tritanopia: [
    [0.95, 0.05, 0.0],
    [0.0, 0.433, 0.567],
    [0.0, 0.475, 0.525],
  ],
  achromatopsia: [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
  ],
};
```

`MACHADO_MATRICES` (Machado, Oliveira & Fernandes 2009, severity 1.0) is defined
over **linear RGB** — reach it only through
`simulateColorblindnessMachado(Hex)`, which linearizes, transforms and
re-encodes. The 5.0 SEPARATION band calibration was computed against this set,
so any recomputation of those bands must use the Machado path, not Brettel.

```typescript
export const MACHADO_MATRICES: ColorblindMatrices = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
  achromatopsia: [
    [0.2126, 0.7152, 0.0722],   // Rec. 709 luminance, in linear light
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
  ],
};
```

---

## LRU Caching

ColorConverter maintains LRU (Least Recently Used) caches for repeated conversions.

### Cache Configuration

`ColorConverter` builds **seven** LRU caches, each sized by a single
`ColorConverterConfig.cacheSize` (default 1000):

```
hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, hexToHsv, rgbToLab, rgbToOklab
```

There is no `labToRgb` cache. `ColorService.clearCaches()` empties all seven and
`ColorService.getCacheStats()` reports on them.

### How LRU Works

```
Cache: [oldest ... newest]

1. Cache miss: Compute result, add to end
2. Cache hit: Move to end (most recently used)
3. Cache full: Remove from beginning (least recently used)
```

### Performance Impact

For repeated color operations:
- **Without cache**: Full computation every time
- **With cache**: O(1) lookup for cached values
- Typical hit rate: 60-80% in real-world usage

---

## Related Documentation

- [Services](services.md) - Service API reference
- [Types](types.md) - Type definitions
- [Overview](overview.md) - Quick start guide
