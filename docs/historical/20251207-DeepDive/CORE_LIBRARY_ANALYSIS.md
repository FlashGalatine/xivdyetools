# xivdyetools-core Deep-Dive Analysis

**Date:** December 7, 2025
**Library Version:** 1.3.6
**Analyst:** Claude Code

## Executive Summary

The `xivdyetools-core` library is a well-architected, production-ready color science and FFXIV dye database library with strong fundamentals. This deep-dive identified **8 security considerations**, **10 optimization opportunities**, and **12 refactoring opportunities**.

### Overall Assessment

| Category | Rating | Notes |
|----------|--------|-------|
| Security | **Good** | Prototype pollution protection, input validation, API safeguards in place |
| Performance | **Good** | k-d tree, LRU caching, hue bucketing implemented |
| Code Quality | **Very Good** | 96.5% test coverage, clear separation of concerns |
| Maintainability | **Good** | Facade patterns, dependency injection, but some inconsistencies |

---

## Table of Contents

1. [Security Analysis](#1-security-analysis)
   - [Existing Security Measures](#11-existing-security-measures)
   - [Security Considerations](#12-security-considerations)
2. [Optimization Opportunities](#2-optimization-opportunities)
   - [Existing Optimizations](#21-existing-optimizations)
   - [Potential Improvements](#22-potential-improvements)
3. [Refactoring Opportunities](#3-refactoring-opportunities)
4. [Recommendations Summary](#4-recommendations-summary)
5. [File Reference Index](#5-file-reference-index)

---

## 1. Security Analysis

### 1.1 Existing Security Measures

The library already implements several important security patterns:

#### Prototype Pollution Protection
**File:** `src/services/dye/DyeDatabase.ts:47`

```typescript
private static readonly DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
```

The `safeClone()` method (lines 61-75) recursively filters dangerous keys when processing untrusted dye data. This is a **best practice** for preventing prototype pollution attacks.

#### Input Validation
**File:** `src/services/dye/DyeDatabase.ts:83-183`

The `isValidDye()` method validates:
- Required fields (id/itemID)
- Name is non-empty string
- Hex format matches `/^#[A-Fa-f0-9]{6}$/`
- RGB values are 0-255
- HSV values are in valid ranges

#### API Response Safeguards
**File:** `src/services/APIService.ts:449-497`

- **Timeout handling** via AbortController (line 434-435)
- **Content-Type validation** - requires `application/json` (lines 444-447)
- **Response size limits** - 1MB maximum (lines 450-466)
- **JSON parse error handling** (lines 468-493)

#### Cache Integrity
**File:** `src/services/APIService.ts:276-283`

Cache entries are validated with:
- Version checking (line 264)
- TTL expiration (lines 270-273)
- Checksum validation (lines 276-283)

---

### 1.2 Security Considerations

#### SEC-1: Cache Key Injection (Low Risk)

**Location:** `src/services/APIService.ts:609-617`

```typescript
private buildCacheKey(itemID: number, worldID?: number, dataCenterID?: string): string {
  if (dataCenterID) {
    return `${itemID}_${dataCenterID}`;
  }
  // ...
}
```

**Issue:** The `dataCenterID` parameter is a string that's directly concatenated into cache keys without sanitization. While this is low risk (cache is in-memory and data center names are typically controlled), in shared-tenant scenarios a malicious user could potentially pollute cache keys.

**Recommendation:** Validate `dataCenterID` against a known allowlist of valid data center names, or sanitize to alphanumeric characters only.

**Severity:** Low
**Priority:** P3

---

#### SEC-2: Unguarded Console Output in Production

**Location:** `src/utils/index.ts:579`

```typescript
if (isAbortError(error)) {
  console.warn(`Request timed out (attempt ${i + 1}/${attempts})`);
}
```

**Issue:** Direct `console.warn` calls bypass the configurable logger system. This can:
- Leak information in browser console
- Clutter server logs in Node.js deployments
- Be inconsistent with the library's logging architecture

**Recommendation:** Replace with `this.logger?.warn()` or make the retry utility accept a logger parameter.

**Severity:** Low
**Priority:** P3

---

#### SEC-3: Non-Cryptographic Checksum

**Location:** `src/utils/index.ts:627-636`

```typescript
export function generateChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash | 0;
  }
  return Math.abs(hash).toString(36);
}
```

**Issue:** The djb2-like hash is fast but has limited collision resistance. It's appropriate for cache validation but should not be used for:
- Data integrity in transit
- Security-critical verification
- Content-addressable storage

**Current Usage:** Cache corruption detection - **appropriate use case**.

**Recommendation:** Document clearly that this is for cache validation only. If stronger integrity is needed in future, consider using SubtleCrypto (Web Crypto API).

**Severity:** Informational
**Priority:** P4

---

#### SEC-4: Global Rate Limiting Only

**Location:** `src/services/APIService.ts:75-94`

```typescript
export class DefaultRateLimiter implements RateLimiter {
  private lastRequestTime: number = 0;
  // ...
}
```

**Issue:** The rate limiter tracks time since last request globally, not per-user. In multi-tenant scenarios (e.g., shared server), one user's API calls affect rate limiting for all users.

**Recommendation:**
- For current use cases (single-user apps): **No action needed**
- For future shared deployments: Consider per-user rate limiting with user ID tracking

**Severity:** Low
**Priority:** P4 (future consideration)

---

#### SEC-5: Missing Input Validation in Palette Service

**Location:** `src/services/PaletteService.ts:343-346`

```typescript
const opts = { ...PaletteService.DEFAULT_OPTIONS, ...options };
const colorCount = Math.max(1, Math.min(10, opts.colorCount));
// maxIterations is not validated!
```

**Issue:** While `colorCount` is properly clamped (1-10), `maxIterations` has no upper bound. A malicious actor could pass `maxIterations: Infinity` or an extremely large number to cause CPU exhaustion.

**Recommendation:** Clamp `maxIterations` to a reasonable maximum (e.g., 100-200).

```typescript
const maxIterations = Math.max(1, Math.min(200, opts.maxIterations));
```

**Severity:** Medium
**Priority:** P2

---

#### SEC-6: K-means Initialization Uses Math.random()

**Location:** `src/services/PaletteService.ts:131`

```typescript
const firstIndex = Math.floor(Math.random() * pixels.length);
```

**Issue:** `Math.random()` is not cryptographically secure. While this isn't a security vulnerability per se (palette extraction doesn't require security), the non-deterministic behavior makes:
- Testing harder (results vary between runs)
- Debugging difficult
- Reproducibility impossible

**Recommendation:** Accept an optional seed parameter for deterministic k-means++ initialization during testing.

**Severity:** Informational
**Priority:** P4

---

#### SEC-7: Error Messages May Leak Internal State

**Location:** Multiple files

**Examples:**
```typescript
// APIService.ts:400-404
throw new AppError(
  ErrorCode.API_CALL_FAILED,
  `Failed to fetch price data for item ${itemID}: ${error instanceof Error ? error.message : 'Unknown error'}`,
  'warning'
);

// DyeDatabase.ts:115
this.logger.warn(`Dye ${idForLog} has invalid hex format: ${hexForLog}`);
```

**Issue:** Error messages include specific internal values that could aid attackers in reconnaissance. This is minimal risk for a client-side library but worth noting.

**Recommendation:** Consider log levels that separate user-facing messages from debug details.

**Severity:** Informational
**Priority:** P4

---

#### SEC-8: LRU Cache Lacks Per-Context Isolation

**Location:** `src/services/color/ColorConverter.ts:17-57`

**Issue:** The singleton ColorConverter shares its cache across all consumers. In multi-tenant environments, this means:
- Cache pollution between contexts
- Potential information leakage (though colors aren't sensitive)
- Unpredictable cache eviction patterns

**Recommendation:** For current single-tenant use: **No action needed**. The design is appropriate for the current architecture.

**Severity:** Informational
**Priority:** P4

---

## 2. Optimization Opportunities

### 2.1 Existing Optimizations

The library already implements several performance optimizations:

| Optimization | Location | Impact |
|--------------|----------|--------|
| **k-d Tree** | `src/utils/kd-tree.ts` | O(log n) nearest neighbor vs O(n) linear |
| **LRU Caching** | `ColorConverter.ts:17-57` | 60-80% speedup for repeated conversions |
| **Hue Bucketing** | `DyeDatabase.ts:32` | 70-90% speedup for harmony lookups |
| **Request Deduplication** | `APIService.ts:342-364` | Prevents duplicate API calls |
| **Pixel Sampling** | `PaletteService.ts:312-326` | Limits memory usage to 10,000 pixels |

---

### 2.2 Potential Improvements

#### OPT-1: Unnecessary Array Copy in Pixel Sampling

**Location:** `src/services/PaletteService.ts:312-326`

```typescript
private samplePixels(pixels: RGB[], maxSamples: number): RGB[] {
  if (pixels.length <= maxSamples) {
    return pixels;  // Returns reference (good!)
  }
  // ...creates new array...
}
```

**Current State:** Already returns reference when sampling not needed. **No change required.**

---

#### OPT-2: Defensive Copies on Every getAllDyes() Call

**Location:** `src/services/dye/DyeDatabase.ts:311-315`

```typescript
getAllDyes(): Dye[] {
  this.ensureLoaded();
  return [...this.dyes];  // Creates new array every call
}
```

**Issue:** Every call creates a new array via spread operator. For 136 dyes, this is ~5KB allocation per call.

**Recommendation Options:**
1. **Lazy Freeze Pattern:** Return `Object.freeze(this.dyes)` and document immutability
2. **Memoization:** Cache the frozen copy, invalidate on reload
3. **Keep as-is:** 5KB is negligible for most use cases

**Impact:** Low
**Priority:** P4

---

#### OPT-3: k-d Tree Build Uses Full Sort

**Location:** `src/utils/kd-tree.ts:71-75`

```typescript
const sorted = [...points].sort((a, b) => {
  const aVal = dimension === 0 ? a.x : dimension === 1 ? a.y : a.z;
  const bVal = dimension === 0 ? b.x : dimension === 1 ? b.y : b.z;
  return aVal - bVal;
});
```

**Issue:** Full O(n log n) sort at each recursion level when only median is needed.

**Current Impact:** With 136 dyes, this is negligible (~0.1ms build time).

**Recommendation:** For current dataset size, **no change needed**. If dataset grows to thousands of entries, consider quickselect O(n) median finding.

**Impact:** Low (current), Medium (future)
**Priority:** P4

---

#### OPT-4: Sequential Batch API Calls

**Location:** `src/services/APIService.ts:626-637`

```typescript
async getPricesForItems(itemIDs: number[]): Promise<Map<number, PriceData>> {
  const results = new Map<number, PriceData>();
  for (const itemID of itemIDs) {
    const price = await this.getPriceData(itemID);  // Sequential!
    if (price) {
      results.set(itemID, price);
    }
  }
  return results;
}
```

**Issue:** Items are fetched sequentially. For N items with 200ms rate limit, this takes N × 200ms minimum.

**Recommendation:**
1. Use Universalis batch endpoint: `/api/v2/aggregated/{dc}/{item1,item2,item3}`
2. Or parallelize with Promise.allSettled() respecting rate limits

**Potential Impact:** 5-10x speedup for batch operations
**Priority:** P2

---

#### OPT-5: Pre-computed Sorted Arrays

**Location:** `src/services/dye/DyeSearch.ts:202-239`

```typescript
getDyesSortedByBrightness(ascending: boolean = true): Dye[] {
  return [...this.database.getDyesInternal()].sort((a, b) => {
    // Sort logic...
  });
}
```

**Issue:** Sorting is done on every call. With stable dye data, sorted arrays could be pre-computed during database initialization.

**Recommendation:** Add pre-sorted index arrays to DyeDatabase:
```typescript
private dyesByBrightnessAsc: Dye[] = [];
private dyesByBrightnessDesc: Dye[] = [];
// Initialize during initialize()
```

**Impact:** Minor (sorting 136 items is ~0.05ms)
**Priority:** P4

---

#### OPT-6: ColorConverter Cache Key Computation

**Location:** `src/services/color/ColorConverter.ts:169-178`

```typescript
// Normalize hex for cache key
let hexForCache = hex.toUpperCase().replace('#', '');
if (hexForCache.length === 3) {
  hexForCache = hexForCache.split('').map((c) => c + c).join('');
}
const cacheKey = hexForCache;
```

**Issue:** String operations performed even when cache hit expected. The normalization could be done only on cache miss.

**Recommendation:** Check cache with both short and long forms, or use a normalization LRU layer.

**Impact:** Micro-optimization
**Priority:** P5

---

#### OPT-7: Consolidate LRU Caches

**Location:** `src/services/color/ColorConverter.ts:74-78`

```typescript
private readonly hexToRgbCache: LRUCache<string, RGB>;
private readonly rgbToHexCache: LRUCache<string, HexColor>;
private readonly rgbToHsvCache: LRUCache<string, HSV>;
private readonly hsvToRgbCache: LRUCache<string, RGB>;
private readonly hexToHsvCache: LRUCache<string, HSV>;
```

**Issue:** 5 separate cache Maps with 5 separate LRU tracking. Could consolidate into single cache with prefixed keys.

**Trade-off:** Consolidation saves memory overhead but adds key prefix string concatenation.

**Recommendation:** Keep separate caches - the memory overhead is minimal (~50KB total) and separate caches provide better cache utilization per conversion type.

**Impact:** Minimal
**Priority:** P5

---

#### OPT-8: HarmonyGenerator Early Exit

**Location:** `src/services/dye/HarmonyGenerator.ts:231-264`

```typescript
private findClosestDyeByHue(targetHue: number, usedIds: Set<number>, tolerance: number): Dye | null {
  let withinTolerance: { dye: Dye; diff: number } | null = null;
  let bestOverall: { dye: Dye; diff: number } | null = null;

  for (const bucket of bucketsToSearch) {
    // Searches ALL buckets even after finding exact match
  }
}
```

**Issue:** The loop continues searching all buckets even after finding a perfect match (diff = 0).

**Recommendation:** Add early exit when exact match found:
```typescript
if (diff === 0 && !usedIds.has(dye.id)) {
  return dye;  // Perfect match, no need to continue
}
```

**Impact:** Minor speedup in best case
**Priority:** P4

---

#### OPT-9: LocalizationService.preloadLocales Overhead

**Location:** `src/services/LocalizationService.ts:476-478`

```typescript
async preloadLocales(locales: LocaleCode[]): Promise<void> {
  await Promise.all(locales.map((locale) => this.setLocale(locale)));
}
```

**Issue:** `setLocale()` checks registry first, but wrapping in Promise.all creates unnecessary promise wrapper objects for already-loaded locales.

**Recommendation:** Filter to only unloaded locales first:
```typescript
const unloaded = locales.filter(l => !this.registry.hasLocale(l));
await Promise.all(unloaded.map(l => this.setLocale(l)));
```

**Impact:** Micro-optimization
**Priority:** P5

---

#### OPT-10: Memory Usage in Large Pixel Arrays

**Location:** `src/services/PaletteService.ts`

**Issue:** When processing images, the `pixelDataToRGB()` and `pixelDataToRGBFiltered()` methods create new RGB objects for each pixel. For a 1920×1080 image, that's 2M+ object allocations.

**Current Mitigation:** `maxSamples: 10000` limits this by default.

**Recommendation:** Consider using typed arrays internally for large-scale processing, or document the sampling behavior more prominently.

**Impact:** Medium for edge cases
**Priority:** P3

---

## 3. Refactoring Opportunities

### REF-1: Dual API Pattern (Static + Instance) Repetition

**Location:** `ColorConverter.ts`, `LocalizationService.ts`

**Issue:** Both services duplicate every method as static wrapper + instance method:

```typescript
// Instance method
hexToRgb(hex: string): RGB { /* implementation */ }

// Static wrapper
static hexToRgb(hex: string): RGB {
  return this.getDefault().hexToRgb(hex);
}
```

**Impact:** Code duplication, maintenance burden, larger bundle size.

**Recommendation Options:**
1. **Decorator/Mixin Pattern:** Create `createStaticWrapper(class)` utility
2. **Proxy Pattern:** Export a Proxy that delegates to singleton
3. **Keep as-is:** Current pattern is explicit and debuggable

**Priority:** P3

---

### REF-2: Inconsistent Error Handling Patterns

**Locations:**
- `ColorConverter.hexToRgb()` - throws `AppError`
- `DyeSearch.findClosestDye()` - returns `null` on error
- `APIService.getPriceData()` - returns `null` and logs
- `HarmonyGenerator.findComplementaryPair()` - catches and returns `null`

**Issue:** Mixed error handling strategies make it hard to predict behavior.

**Recommendation:** Standardize on one of:
1. **Option A:** Always throw, let consumers catch
2. **Option B:** Return Result type `{ success: true, data } | { success: false, error }`
3. **Option C:** Document the pattern for each method category

**Priority:** P3

---

### REF-3: Logger Injection Inconsistency

**Examples:**
```typescript
// Options object pattern (preferred)
class APIService {
  constructor(options?: APIServiceOptions) { /* logger via options.logger */ }
}

// Constructor param pattern
class DyeDatabase {
  constructor(config: DyeDatabaseConfig = {}) { /* logger via config.logger */ }
}

// No logger support
class KDTree {
  constructor(points: Point3D[]) { /* no logger */ }
}
```

**Recommendation:** Standardize on options object pattern with `{ logger?: Logger }` across all services.

**Priority:** P4

---

### REF-4: Magic Numbers in Harmony Generation

**Location:** `src/services/dye/HarmonyGenerator.ts`

```typescript
// Line 69: angle = 30
// Line 82: offsets [120, 240]
// Line 92: offsets [90, 180, 270]
// Line 103: offsets [60, 180, 240]
// Line 128: hueDiff <= 15
// Line 152: offsets [30, -30, 180], tolerance: 35
// Line 175: tolerance: 5
```

**Issue:** Harmony angles and tolerances are hardcoded throughout the file.

**Recommendation:** Extract to constants:
```typescript
const HARMONY_ANGLES = {
  triadic: [120, 240],
  square: [90, 180, 270],
  tetradic: [60, 180, 240],
  analogous: 30,
  // ...
} as const;
```

**Priority:** P3

---

### REF-5: Branded Types Underutilized

**Defined types:** `HexColor`, `DyeId`, `Hue`, `Saturation`

**Usage analysis:**
```typescript
// Good: Uses HexColor
rgbToHex(r: number, g: number, b: number): HexColor

// Inconsistent: Returns plain string
interface Dye {
  hex: string;  // Should be HexColor
}

// Missing: Methods accept plain string
findClosestDye(hex: string, ...)  // Should be HexColor
```

**Recommendation:** Gradually adopt branded types at API boundaries for better type safety.

**Priority:** P4

---

### REF-6: Test-Related Code in Production

**Location:** `src/services/LocalizationService.ts:517-520`

```typescript
static resetInstance(): void {
  this.defaultInstance.clear();
  this.defaultInstance = new LocalizationService();
}
```

**Issue:** `resetInstance()` exists solely for testing but ships in production bundle.

**Recommendation Options:**
1. Move to separate test utilities export
2. Use conditional compilation/dead code elimination
3. Accept as minimal overhead (the method is tiny)

**Priority:** P5

---

### REF-7: DyeSearch and HarmonyGenerator Coupling

**Location:** `src/services/dye/HarmonyGenerator.ts:17-20`

```typescript
export class HarmonyGenerator {
  constructor(
    private database: DyeDatabase,
    private search: DyeSearch
  ) {}
```

**Issue:** HarmonyGenerator depends on both DyeDatabase AND DyeSearch, but DyeSearch already wraps DyeDatabase. This creates a confusing dependency graph.

**Recommendation:** HarmonyGenerator should only depend on DyeSearch, accessing database through search when needed.

**Priority:** P3

---

### REF-8: Verbose Re-exports in index.ts

**Current pattern:**
```typescript
export { ColorService } from './services/ColorService.js';
export { DyeService } from './services/DyeService.js';
// ... 30+ lines of exports
```

**Recommendation:** Consider barrel exports with namespace grouping:
```typescript
export * as Color from './services/color/index.js';
export * as Dye from './services/dye/index.js';
```

**Trade-off:** Tree-shaking may be affected.

**Priority:** P5

---

### REF-9: Async/Await Pattern in Sync Code

**Location:** `src/services/LocalizationService.ts:212`

```typescript
async setLocale(locale: LocaleCode): Promise<void> {
  // ...
  await Promise.resolve(); // Satisfy async requirement while maintaining sync behavior
  const localeData = this.loader.loadLocale(locale);  // Sync operation!
  // ...
}
```

**Issue:** Method is async but the underlying operation is synchronous. The `await Promise.resolve()` is a workaround.

**Recommendation:**
1. If sync is acceptable: Remove async, change return type to `void`
2. If async needed for API compat: Document the async signature is for future-proofing

**Priority:** P4

---

### REF-10: Point3D Generic Could Be Typed

**Location:** `src/utils/kd-tree.ts:12-17`

```typescript
export interface Point3D {
  x: number;
  y: number;
  z: number;
  data?: unknown;  // Loose typing
}
```

**Issue:** The `data` property is `unknown`, requiring casts throughout the codebase:
```typescript
const dye = data as Dye;  // Unsafe cast
```

**Recommendation:** Make KDTree generic:
```typescript
interface Point3D<T = unknown> {
  x: number;
  y: number;
  z: number;
  data?: T;
}

class KDTree<T = unknown> {
  nearestNeighbor(target: Point3D<T>): Point3D<T> | null;
}
```

**Priority:** P3

---

### REF-11: Separate Configuration from Defaults

**Issue:** Default values are scattered:
- `APIService`: Imports from constants
- `PaletteService`: `static readonly DEFAULT_OPTIONS`
- `ColorConverter`: `config.cacheSize ?? 1000`
- `LocalizationService`: `'en'` hardcoded

**Recommendation:** Centralize defaults in `constants/index.ts`:
```typescript
export const DEFAULTS = {
  cacheSize: 1000,
  locale: 'en' as const,
  paletteOptions: { colorCount: 4, maxIterations: 25, ... },
} as const;
```

**Priority:** P4

---

### REF-12: getDyesInternal() Documentation

**Location:** `src/services/dye/DyeDatabase.ts:418-440`

**Current:**
```typescript
/**
 * @internal
 * @returns Direct reference to internal dyes array - DO NOT MODIFY
 */
getDyesInternal(): Dye[] {
  return this.dyes;
}
```

**Issue:** Despite `@internal` JSDoc tag, this method is `public` and exported. TypeScript/bundlers don't enforce `@internal`.

**Recommendation Options:**
1. Make method `protected` (requires refactoring DyeSearch)
2. Use TypeScript's `/** @internal */` with `stripInternal: true`
3. Rename to `_getDyesInternal()` to indicate internal use

**Priority:** P4

---

## 4. Recommendations Summary

### High Priority (P1-P2)

| ID | Category | Issue | Recommendation |
|----|----------|-------|----------------|
| SEC-5 | Security | maxIterations not clamped | Add `Math.min(200, ...)` clamp |
| OPT-4 | Performance | Sequential batch API calls | Use batch endpoint or parallelize |

### Medium Priority (P3)

| ID | Category | Issue | Recommendation |
|----|----------|-------|----------------|
| SEC-1 | Security | Cache key injection | Validate dataCenterID |
| OPT-10 | Performance | Memory in large pixel arrays | Document sampling behavior |
| REF-1 | Refactoring | Dual API repetition | Consider decorator pattern |
| REF-2 | Refactoring | Inconsistent error handling | Standardize patterns |
| REF-4 | Refactoring | Magic numbers | Extract to constants |
| REF-7 | Refactoring | HarmonyGenerator coupling | Simplify dependencies |
| REF-10 | Refactoring | Point3D loose typing | Make KDTree generic |

### Low Priority (P4-P5)

| ID | Category | Issue | Recommendation |
|----|----------|-------|----------------|
| SEC-2 | Security | console.warn in production | Use configurable logger |
| SEC-3 | Security | Non-crypto checksum | Document limitations |
| SEC-4 | Security | Global rate limiting | Per-user for multi-tenant |
| OPT-2 | Performance | Defensive copies | Consider frozen arrays |
| REF-3 | Refactoring | Logger inconsistency | Standardize options pattern |
| REF-5 | Refactoring | Branded types | Adopt at API boundaries |

---

## 5. File Reference Index

| File | Lines | Purpose | Key Findings |
|------|-------|---------|--------------|
| `src/services/APIService.ts` | 730 | Universalis API integration | SEC-1, SEC-2, OPT-4 |
| `src/services/dye/DyeDatabase.ts` | 442 | Dye data management | Security ✓, OPT-2 |
| `src/services/dye/DyeSearch.ts` | 241 | Search operations | OPT-5 |
| `src/services/dye/HarmonyGenerator.ts` | 266 | Color harmonies | REF-4, REF-7, OPT-8 |
| `src/services/color/ColorConverter.ts` | 476 | Color conversions | REF-1, OPT-6, OPT-7 |
| `src/services/LocalizationService.ts` | 522 | i18n support | REF-1, REF-9, OPT-9 |
| `src/services/PaletteService.ts` | 480 | K-means clustering | SEC-5, SEC-6, OPT-10 |
| `src/utils/index.ts` | 637 | Utilities | SEC-2, SEC-3 |
| `src/utils/kd-tree.ts` | 251 | Spatial indexing | OPT-3, REF-10 |
| `src/types/index.ts` | 545 | Type definitions | REF-5 |
| `src/constants/index.ts` | 119 | Configuration | REF-11 |

---

## Appendix: Test Coverage Gaps

Based on the exploration, these areas have lower branch coverage:

| Module | Branch Coverage | Gap Areas |
|--------|-----------------|-----------|
| DyeDatabase | 68.75% | Validation edge cases, error paths |
| APIService | 85.71% | Error recovery scenarios |
| ColorblindnessSimulator | 86.66% | Edge case vision types |

**Recommendation:** Add edge case tests for malformed input handling in DyeDatabase validation.

---

*Report generated by Claude Code deep-dive analysis*
