# Code Audit: xivdyetools-core

**Version:** 1.3.7
**Date:** 2025-12-14
**Total Findings:** 12 (1 CRITICAL, 3 HIGH, 6 MEDIUM, 2 LOW)

---

## Summary Table

| ID | Title | Severity | Category | File |
|----|-------|----------|----------|------|
| CORE-BUG-001 | Floating-Point Cache Mismatch | CRITICAL | Bug | ColorConverter.ts |
| CORE-PERF-001 | Race Condition in LRU Cache | HIGH | Concurrency | ColorConverter.ts |
| CORE-PERF-002 | Inefficient K-d Tree Construction | HIGH | Performance | kd-tree.ts |
| CORE-PERF-003 | K-means Initialization O(n*k²) | HIGH | Performance | PaletteService.ts |
| CORE-BUG-002 | K-d Tree Boundary Bug | MEDIUM | Bug | kd-tree.ts |
| CORE-BUG-003 | Harmony Generator 10-Dye Limit | MEDIUM | Bug | HarmonyGenerator.ts |
| CORE-BUG-004 | HSV Boundary Precision | MEDIUM | Precision | ColorConverter.ts |
| CORE-BUG-005 | Facewear Exclusion Inconsistency | MEDIUM | Consistency | DyeSearch.ts |
| CORE-SEC-001 | Cache Key Injection | MEDIUM | Security | APIService.ts |
| CORE-PERF-004 | Slow Palette Pixel Sampling | MEDIUM | Performance | PaletteService.ts |
| CORE-PERF-005 | Pixel Sampling Out-of-Bounds | LOW | Bug | PaletteService.ts |
| CORE-PERF-006 | getAllDyes() Defensive Copy | LOW | Performance | DyeDatabase.ts |

---

## CRITICAL Findings

### CORE-BUG-001: Floating-Point Cache Mismatch

**Severity:** CRITICAL
**Category:** Bug / Performance

**Location:**
- **File:** `src/services/color/ColorConverter.ts`
- **Lines:** 276-304 (rgbToHsv method), 333 (cache key)
- **Function:** `rgbToHsv()`, `hsvToRgb()`

**Description:**
The HSV conversion uses floating-point arithmetic that accumulates rounding errors. The cache key uses `round(h, 2)` but the hue value can be calculated with floating-point imprecision, creating cache key mismatches for visually identical colors.

**Evidence:**
```typescript
// Line 342: Normalization with potential precision loss
const hNorm = (h % HUE_MAX) / 60;

// Line 333: Cache key with rounded values
const cacheKey = `${round(h, 2)},${round(s, 2)},${round(v, 2)}`;
```

**Example Scenario:**
- Input HSV: h=359.99999999 (should normalize to ~0)
- After normalization: h becomes ~0.5 after division
- Cache key: "0.5,50,100"
- Next time: h=0.0000001 creates different cache key "0.0,50,100"
- **Result:** Same visual color, different cache keys = cache thrashing

**Impact:**
- Cache hit rate significantly reduced
- Performance degradation in color-heavy operations
- Potential for inconsistent color matching results

**Recommendation:**
```typescript
private normalizeHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

// Apply BEFORE caching:
hsvToRgb(h: number, s: number, v: number): RGB {
  h = this.normalizeHue(h);  // Normalize first
  const cacheKey = `${round(h, 2)},${round(s, 2)},${round(v, 2)}`;
  // ...
}
```

**Effort:** Low (30 minutes)

---

## HIGH Findings

### CORE-PERF-001: Race Condition in LRU Cache

**Severity:** HIGH
**Category:** Concurrency

**Location:**
- **File:** `src/services/color/ColorConverter.ts`
- **Lines:** 80-103 (defaultInstance and cache operations)
- **Also:** Lines 30-47 in LRU cache implementation

**Description:**
The LRU cache's move-to-end operation is not atomic. In Node.js with concurrent async operations, multiple operations could interleave between `delete` and `set`, causing cache state inconsistency.

**Evidence:**
```typescript
// LRU Cache get() method - not atomic
get(key: K): V | undefined {
  const value = this.cache.get(key);
  if (value !== undefined) {
    this.cache.delete(key);  // <-- Another operation could insert here
    this.cache.set(key, value);
  }
  return value;
}
```

**Impact:**
- Cache entries could be lost or duplicated
- Cache size could temporarily exceed maxSize
- Incorrect LRU ordering

**Recommendation:**
```typescript
get(key: K): V | undefined {
  if (!this.cache.has(key)) return undefined;
  const value = this.cache.get(key)!;
  // Move to end atomically
  this.cache.delete(key);
  this.cache.set(key, value);
  return value;
}
```

**Effort:** Low (30 minutes)

---

### CORE-PERF-002: Inefficient K-d Tree Construction

**Severity:** HIGH
**Category:** Performance

**Location:**
- **File:** `src/utils/kd-tree.ts`
- **Lines:** 58-89 (buildTree method)
- **Function:** `buildTree()`

**Description:**
The k-d tree implementation creates excessive temporary arrays during construction. Each recursive call uses `.slice()` which allocates new memory, resulting in O(n²logn) space complexity instead of optimal O(n log n).

**Evidence:**
```typescript
private buildTree(points: Point3D[], depth: number): KDNode | null {
  // ...
  const sorted = [...points].sort(...);  // O(n) copy + O(n logn) sort
  // ...
  node.left = this.buildTree(sorted.slice(0, median), depth + 1);   // O(n) copy!
  node.right = this.buildTree(sorted.slice(median + 1), depth + 1); // O(n) copy!
}
```

**Complexity Analysis:**
- Current Time: O(n log² n)
- Current Space: O(n log n) due to slice copies
- Optimal Time: O(n log n)
- Optimal Space: O(n)

With 136 dyes, this creates ~408 temporary arrays of decreasing size.

**Impact:**
- Slow initialization (noticeable on mobile devices)
- Memory pressure during startup
- GC pauses during tree construction

**Recommendation:**
Use indices instead of slicing:
```typescript
private buildTree(
  points: Point3D[],
  indices: number[],
  depth: number
): KDNode | null {
  if (indices.length === 0) return null;

  const dimension = depth % 3;
  indices.sort((a, b) => {
    const aVal = dimension === 0 ? points[a].x : ...;
    const bVal = dimension === 0 ? points[b].x : ...;
    return aVal - bVal;
  });

  const median = Math.floor(indices.length / 2);
  // Use index slicing (smaller arrays) instead of point slicing
  // ...
}
```

**Effort:** High (2-3 hours)

---

### CORE-PERF-003: K-means Initialization O(n*k²)

**Severity:** HIGH
**Category:** Performance

**Location:**
- **File:** `src/services/PaletteService.ts`
- **Lines:** 123-175 (kMeansPlusPlusInit function)
- **Function:** `kMeansPlusPlusInit()`

**Description:**
K-means++ initialization recalculates distances to all existing centroids for each new centroid selection, resulting in O(n*k²) complexity instead of optimal O(n*k).

**Evidence:**
```typescript
for (let i = 1; i < k; i++) {
  // For each new centroid...
  for (const pixel of pixels) {     // O(n)
    for (const centroid of centroids) {  // O(i) where i increases
      const dist = rgbDistance(pixel, centroid);
      if (dist < minDist) {
        minDist = dist;
      }
    }
  }
}
```

**Impact:**
For a 10,000-pixel image with k=5:
- Current: ~125,000 distance calculations
- Optimal: ~50,000 distance calculations
- 2.5x slower than necessary

**Recommendation:**
Cache distances:
```typescript
let distances: number[] = pixels.map(() => Infinity);

for (let i = 1; i < k; i++) {
  const newCentroid = centroids[centroids.length - 1];

  // Only compute distance to newest centroid
  for (let j = 0; j < pixels.length; j++) {
    const distToNew = rgbDistance(pixels[j], newCentroid);
    distances[j] = Math.min(distances[j], distToNew);
  }

  // Select next centroid using cached distances
  // ...
}
```

**Effort:** Medium (1-2 hours)

---

## MEDIUM Findings

### CORE-BUG-002: K-d Tree Nearest Neighbor Boundary Bug

**Severity:** MEDIUM
**Category:** Bug

**Location:**
- **File:** `src/utils/kd-tree.ts`
- **Lines:** 154-161 (searchNearest method)
- **Function:** `searchNearest()`

**Description:**
The algorithm can skip the far side of the tree when it shouldn't, using `<` instead of `<=` for the distance comparison.

**Evidence:**
```typescript
if (farChild && best) {
  const axisDistance = Math.abs(targetValue - nodeValue);
  if (axisDistance < best.distance) {  // <-- Should be <=
    best = this.searchNearest(farChild, target, depth + 1, best, excludeData);
  }
}
```

**Impact:**
- When target is exactly on splitting plane with excluded nearest point, far side is never checked
- Could return suboptimal nearest neighbor in edge cases

**Recommendation:**
```typescript
if (axisDistance <= best.distance) {  // Use <= instead of <
```

**Effort:** Low (15 minutes)

---

### CORE-BUG-003: Harmony Generator 10-Dye Limit

**Severity:** MEDIUM
**Category:** Bug

**Location:**
- **File:** `src/services/dye/HarmonyGenerator.ts`
- **Lines:** 43-59 (findClosestNonFacewearDye method)
- **Function:** `findClosestNonFacewearDye()`

**Description:**
The loop has a hard-coded limit of 10 iterations. If all 10 closest dyes are Facewear, returns null instead of the 11th dye.

**Evidence:**
```typescript
for (let i = 0; i < 10; i++) {  // Hard-coded limit
  const candidate = this.search.findClosestDye(hex, allExcluded);
  if (!candidate) return null;

  if (candidate.category !== 'Facewear') {
    return candidate;
  }

  allExcluded.push(candidate.id);
}

return null;  // If there are >10 Facewear dyes nearby
```

**Impact:**
- Could fail to find valid dye when many Facewear dyes cluster near target color
- User sees unexpected "no match" result

**Recommendation:**
```typescript
const totalDyes = this.database.getDyesInternal().length;

for (let i = 0; i < totalDyes; i++) {
  // ...
}
```

**Effort:** Low (15 minutes)

---

### CORE-BUG-004: HSV Boundary Precision

**Severity:** MEDIUM
**Category:** Precision

**Location:**
- **File:** `src/services/color/ColorConverter.ts`
- **Lines:** 317-379 (hsvToRgb method)
- **Function:** `hsvToRgb()`

**Description:**
HSV to RGB conversion has precision issues at hue boundaries. When h = 359.9999, rounding errors can push it to different sector than h = 0.

**Evidence:**
```typescript
const hNorm = (h % HUE_MAX) / 60;  // Line 342
// When h = 359.9999: hNorm = 5.9999833...
// When h = 360: hNorm = 0 (due to modulo)
```

**Impact:**
- Colors near red (h ≈ 0 or h ≈ 360) may produce slightly different RGB values
- Affects gradient generation and color interpolation

**Recommendation:**
```typescript
hsvToRgb(h: number, s: number, v: number): RGB {
  // Normalize hue to [0, 360) FIRST
  h = ((h % 360) + 360) % 360;
  // ... rest of method
}
```

**Effort:** Low (15 minutes)

---

### CORE-BUG-005: Facewear Exclusion Inconsistency

**Severity:** MEDIUM
**Category:** Consistency

**Location:**
- **File:** `src/services/dye/DyeSearch.ts`
- **Lines:** 85-136 (findClosestDye method)
- **Function:** `findClosestDye()`

**Description:**
Facewear dyes are excluded in fallback search but not in k-d tree search, causing behavior divergence.

**Evidence:**
```typescript
// K-d tree path (line 100-103) - NO Facewear check
const nearest = kdTree.nearestNeighbor(targetPoint, (data) => {
  const dye = data as Dye;
  return excludeSet.has(dye.id);  // Missing: || dye.category === 'Facewear'
});

// Fallback path (line 117) - HAS Facewear check
if (excludeSet.has(dye.id) || dye.category === 'Facewear') {
  continue;
}
```

**Impact:**
- K-d tree might return Facewear dye that fallback wouldn't
- Inconsistent behavior based on code path taken

**Recommendation:**
```typescript
const nearest = kdTree.nearestNeighbor(targetPoint, (data) => {
  const dye = data as Dye;
  return excludeSet.has(dye.id) || dye.category === 'Facewear';
});
```

**Effort:** Low (15 minutes)

---

### CORE-SEC-001: Cache Key Injection

**Severity:** MEDIUM
**Category:** Security

**Location:**
- **File:** `src/services/APIService.ts`
- **Lines:** 618-628 (buildCacheKey method)
- **Function:** `buildCacheKey()`

**Description:**
Cache keys use simple concatenation which could allow crafted dataCenterID values to collide with other cache entries.

**Evidence:**
```typescript
private buildCacheKey(itemID: number, worldID?: number, dataCenterID?: string): string {
  if (dataCenterID) {
    const sanitized = this.sanitizeDataCenterId(dataCenterID);
    return `${itemID}_${sanitized}`;  // Simple concatenation
  }
  // ...
}
```

**Impact:**
- Attacker could craft dataCenterID to match other cache patterns
- Potential for cache poisoning (DoS)

**Recommendation:**
```typescript
private buildCacheKey(...): string {
  const parts = [itemID];

  if (dataCenterID) {
    parts.push('dc', this.sanitizeDataCenterId(dataCenterID));
  } else if (worldID) {
    parts.push('world', String(worldID));
  } else {
    parts.push('global');
  }

  return parts.join(':');  // Use delimiter
}
```

**Effort:** Low (15 minutes)

---

### CORE-PERF-004: Slow Palette Pixel Sampling

**Severity:** MEDIUM
**Category:** Performance

**Location:**
- **File:** `src/services/PaletteService.ts`
- **Lines:** 312-326 (samplePixels method)
- **Function:** `samplePixels()`

**Description:**
Pixel sampling uses floating-point step calculation that can cause index out-of-bounds on edge cases.

**Evidence:**
```typescript
const step = pixels.length / maxSamples;
for (let i = 0; i < maxSamples; i++) {
  const index = Math.floor(i * step);  // Can exceed pixels.length - 1
  samples.push(pixels[index]);
}
```

**Impact:**
- Potential undefined access on last iteration
- With 10,003 pixels and 10,000 samples: last index = 10,003 (out of bounds)

**Recommendation:**
```typescript
const index = Math.min(Math.floor(i * step), pixels.length - 1);
```

**Effort:** Low (10 minutes)

---

## LOW Findings

### CORE-PERF-005: Pixel Sampling Index Error (same as CORE-PERF-004)

*Consolidated with CORE-PERF-004*

---

### CORE-PERF-006: getAllDyes() Defensive Copy Overhead

**Severity:** LOW
**Category:** Performance

**Location:**
- **File:** `src/services/dye/DyeDatabase.ts`
- **Lines:** 310-315 (getAllDyes method)
- **Function:** `getAllDyes()`

**Description:**
Every call creates a full array copy of 136 dyes. Frequently called methods compound this overhead.

**Evidence:**
```typescript
getAllDyes(): Dye[] {
  this.ensureLoaded();
  return [...this.dyes];  // O(n) copy every time
}
```

**Impact:**
- If called 136 times in a loop: 18,496 object allocations
- Minor GC pressure

**Recommendation:**
Add a read-only variant:
```typescript
getDyesReadOnly(): readonly Dye[] {
  this.ensureLoaded();
  return this.dyes as readonly Dye[];
}
```

**Effort:** Low (10 minutes)

---

## Test Coverage Gaps

| Area | Missing Tests |
|------|---------------|
| ColorConverter | HSV values at boundaries (360°, 100%) |
| KDTree | Duplicate coordinates, empty clusters |
| PaletteService | 0 pixels, all identical pixels |
| APIService | Cache corruption, concurrent requests |

---

## Recommendations Summary

### Immediate (Day 1)
1. Fix floating-point cache normalization (CORE-BUG-001)

### This Sprint
2. Optimize k-d tree construction (CORE-PERF-002)
3. Optimize K-means initialization (CORE-PERF-003)
4. Fix LRU cache atomicity (CORE-PERF-001)

### Next Sprint
5. Fix k-d tree boundary condition (CORE-BUG-002)
6. Make Facewear exclusion consistent (CORE-BUG-005)
7. Fix harmony generator fallback (CORE-BUG-003)
8. Improve cache key generation (CORE-SEC-001)
9. Add HSV boundary normalization (CORE-BUG-004)

### Backlog
10. Add bounds checking to pixel sampling (CORE-PERF-004)
11. Add readonly variant for getAllDyes() (CORE-PERF-006)
