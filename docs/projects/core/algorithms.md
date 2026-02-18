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

For 136 dyes:
- **Brute force**: Check all 136 dyes = 136 comparisons
- **k-d tree**: ~7 comparisons average (log₂ 136 ≈ 7)

### Implementation

```typescript
// DyeDatabase internally builds k-d tree on initialization
class DyeDatabase {
  private kdTree: KDTree<Dye>;

  constructor(dyes: Dye[]) {
    // Build tree using RGB as 3D coordinates
    this.kdTree = new KDTree(dyes, {
      dimensions: ['rgb.r', 'rgb.g', 'rgb.b']
    });
  }

  findNearest(rgb: RGB): DyeMatch {
    // O(log n) lookup
    return this.kdTree.nearest(rgb, 1)[0];
  }

  findKNearest(rgb: RGB, k: number): DyeMatch[] {
    // O(k log n) lookup
    return this.kdTree.nearest(rgb, k);
  }
}
```

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
| Find complementary | O(n) = 136 checks | O(n/36) ≈ 4 checks | ~34x faster |
| Find triadic | O(n) × 2 = 272 checks | ~8 checks | ~34x faster |

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
   - Return K centroid colors as hex strings
```

### Implementation

```typescript
class PaletteService {
  static async extractPalette(
    imageData: ImageData,
    options: { numColors: number; quality: 'low' | 'medium' | 'high' }
  ): Promise<HexColor[]> {
    // Sample pixels (quality determines sample rate)
    const pixels = samplePixels(imageData, options.quality);

    // K-means++ initialization
    const centroids = initializeCentroids(pixels, options.numColors);

    // Iterate until convergence
    let iterations = 0;
    while (iterations < 100) {
      const assignments = assignToCentroids(pixels, centroids);
      const newCentroids = recalculateCentroids(pixels, assignments);

      if (centroidsConverged(centroids, newCentroids)) break;

      centroids = newCentroids;
      iterations++;
    }

    return centroids.map(rgb => rgbToHex(rgb));
  }
}
```

### Quality Settings

| Quality | Sample Rate | Typical Time (1000×1000 image) |
|---------|-------------|--------------------------------|
| low | 1/100 pixels | ~10ms |
| medium | 1/25 pixels | ~50ms |
| high | 1/4 pixels | ~200ms |

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

```typescript
function calculateDeltaE(color1: RGB, color2: RGB): number {
  const lab1 = rgbToLab(color1);
  const lab2 = rgbToLab(color2);

  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}
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

```typescript
const BRETTEL_MATRICES = {
  protanopia: [
    [0.0, 2.02344, -2.52581],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, 1.0]
  ],
  deuteranopia: [
    [1.0, 0.0, 0.0],
    [0.49421, 0.0, 1.24827],
    [0.0, 0.0, 1.0]
  ],
  tritanopia: [
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [-0.86744, 1.86727, 0.0]
  ]
};
```

---

## LRU Caching

ColorConverter maintains LRU (Least Recently Used) caches for repeated conversions.

### Cache Configuration

```typescript
const CACHE_CONFIG = {
  hexToRgb: { maxSize: 1000 },
  rgbToHex: { maxSize: 1000 },
  rgbToHsv: { maxSize: 1000 },
  rgbToLab: { maxSize: 1000 },
  labToRgb: { maxSize: 1000 }
};
```

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
