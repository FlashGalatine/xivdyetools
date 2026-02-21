# Deep-Dive Code Analysis & Security Audit

## Scope: `packages/core/` and `packages/types/`

**Date**: 2025-01-24  
**Version audited**: core v1.17.1, types (latest)  
**Methodology**: Full source code review of all 57+ source files across both packages

---

## Summary

| Category | Critical | High | Medium | Low | Info |
|----------|----------|------|--------|-----|------|
| Bugs | 0 | 1 | 2 | 3 | 0 |
| Security | 0 | 0 | 1 | 2 | 0 |
| Refactoring | 0 | 0 | 2 | 2 | 1 |
| Optimization | 0 | 0 | 0 | 3 | 0 |

Overall the codebase is **well-engineered** with extensive validation, caching, DI patterns, prototype pollution protection, ReDoS prevention, and thorough test coverage (30 test files in core alone). The findings below are genuine improvement opportunities, not indicators of poor quality.

---

## Bugs

### BUG-001: Cache returns mutable shared references in ColorConverter

**Severity**: High  
**File**: `packages/core/src/services/color/ColorConverter.ts`  
**Lines**: ~155, ~223, ~270, ~502, ~540

**Description**: All six LRU caches in `ColorConverter` return the cached object directly without cloning. If any consumer mutates the returned `RGB`, `HSV`, `LAB`, or `HexColor` object, it silently corrupts the cache entry, causing all subsequent lookups of that key to return the mutated value.

**Example attack surface**:
```typescript
const rgb = ColorConverter.hexToRgb('#FF0000'); // { r: 255, g: 0, b: 0 }
rgb.r = 0; // Mutates the CACHED object
const rgb2 = ColorConverter.hexToRgb('#FF0000'); // Returns { r: 0, g: 0, b: 0 } ← WRONG
```

This also affects `rgbToHsv`, `hsvToRgb`, `hexToHsv`, `rgbToLab`, and `rgbToHex`.

**Suggested fix**: Return frozen shallow copies from cache hits:
```typescript
// Option A: Freeze on cache insertion (zero cost on reads)
const result = Object.freeze({ r, g, b });
this.hexToRgbCache.set(cacheKey, result);
return result;

// Option B: Spread on cache hit (safe even if caller mutates)
const cached = this.hexToRgbCache.get(cacheKey);
if (cached) return { ...cached };
```

Option A is preferred — `Object.freeze` has negligible cost and will throw in strict mode if mutation is attempted, making the bug immediately visible.

---

### BUG-002: CharacterColorService lazy loading has no error recovery

**Severity**: Medium  
**File**: `packages/core/src/services/CharacterColorService.ts`  
**Lines**: ~139–165

**Description**: `loadHairColors()` and `loadSkinColors()` store a loading promise and null it out only in the `.then()` callback. If the dynamic `import()` rejects (e.g., bundler misconfiguration, network error in lazy-load environments), `this.hairColorsLoading` remains set to the rejected promise. All subsequent calls to `getHairColors()` will receive the same rejected promise forever — there's no retry or recovery path.

```typescript
// Current code:
this.hairColorsLoading = import('../data/character_colors/race_specific/hair_colors.json')
  .then((module) => {
    this.hairColorsData = module.default as RaceColorData;
    this.hairColorsLoading = null; // ← only cleared on success
    return this.hairColorsData;
  });
// If import() rejects, hairColorsLoading is never cleared
```

**Suggested fix**: Add a `.catch()` handler that clears the loading sentinel:
```typescript
this.hairColorsLoading = import(
  '../data/character_colors/race_specific/hair_colors.json'
).then((module) => {
  this.hairColorsData = module.default as RaceColorData;
  this.hairColorsLoading = null;
  return this.hairColorsData;
}).catch((err) => {
  this.hairColorsLoading = null; // Allow retry on next call
  throw err; // Re-throw so callers see the error
});
```

Apply the same fix to `loadSkinColors()`.

---

### BUG-003: Inconsistent distance metric in CharacterColorService.findDyesWithinDistance

**Severity**: Medium  
**File**: `packages/core/src/services/CharacterColorService.ts`  
**Lines**: ~296–318

**Description**: `findClosestDyes()` supports configurable `MatchingMethod` (defaulting to `'oklab'`), but `findDyesWithinDistance()` always uses plain RGB Euclidean distance via the private `calculateDistance()` method. A user who finds their closest dyes using OKLAB and then wants to find "all dyes within distance X" gets results using a completely different metric, making the distance threshold meaningless.

```typescript
// findClosestDyes defaults to 'oklab' matching
findClosestDyes(color, dyeService, { matchingMethod: 'oklab' })

// findDyesWithinDistance always uses RGB
findDyesWithinDistance(color, dyeService, 50) // ← 50 means RGB distance, not OKLAB
```

**Suggested fix**: Add `CharacterMatchOptions` parameter to `findDyesWithinDistance`:
```typescript
findDyesWithinDistance(
  color: CharacterColor,
  dyeService: DyeService,
  maxDistance: number,
  options: CharacterMatchOptions = {}
): CharacterColorMatch[] {
  const { matchingMethod = 'oklab', weights } = options;
  // Use calculateDistanceWithMethod instead of calculateDistance
  const distance = this.calculateDistanceWithMethod(color.rgb, dye.rgb, matchingMethod, weights);
```

---

### BUG-004: PaletteService.samplePixels produces NaN index when maxSamples = 1

**Severity**: Low  
**File**: `packages/core/src/services/PaletteService.ts`  
**Lines**: ~298–310

**Description**: The sampling formula `Math.round((i * (pixels.length - 1)) / (maxSamples - 1))` divides by zero when `maxSamples = 1`, producing `NaN`. `pixels[NaN]` is `undefined`, which would cause k-means to crash on `undefined.r`.

The default `maxSamples` is 10000, but the parameter is user-controllable and not clamped.

**Suggested fix**: Clamp `maxSamples` to at least 2 when sampling is needed, or add a guard:
```typescript
private samplePixels(pixels: RGB[], maxSamples: number): RGB[] {
  if (pixels.length <= maxSamples) return pixels;
  if (maxSamples <= 1) return [pixels[0]]; // Edge case: single sample

  const samples: RGB[] = [];
  for (let i = 0; i < maxSamples; i++) {
    const index = Math.round((i * (pixels.length - 1)) / (maxSamples - 1));
    samples.push(pixels[index]);
  }
  return samples;
}
```

---

### BUG-005: sRGB linearization threshold inconsistency

**Severity**: Low  
**File**: `packages/core/src/services/color/ColorAccessibility.ts` (line ~24)  
**File**: `packages/core/src/services/color/ColorConverter.ts` (line ~970)

**Description**: Two separate sRGB linearization implementations use different threshold constants:

| Location | Threshold | Source |
|----------|-----------|--------|
| `ColorAccessibility.toLinear()` | `0.03928` | WCAG 2.0 spec |
| `ColorConverter.srgbToLinear()` | `0.04045` | sRGB IEC 61966-2-1 |

While both are used in literature, the difference means the same color can produce slightly different luminance/LAB values depending on which code path is taken. For a system that prides itself on color accuracy, this inconsistency could cause subtle discrepancies between WCAG contrast checks and OKLAB conversions.

**Suggested fix**: Standardize on `0.04045` (the sRGB IEC standard value) in `ColorAccessibility.toLinear()`, or extract a shared `srgbToLinear` utility.

---

### BUG-006: generateChecksum is key-order-dependent

**Severity**: Low  
**File**: `packages/core/src/utils/index.ts`  
**Lines**: ~878–888

**Description**: `generateChecksum` uses `JSON.stringify(data)` which produces different strings for `{a:1,b:2}` vs `{b:2,a:1}`. While V8 maintains insertion order, data from different code paths or API responses could have different key orders for semantically identical objects.

In practice this is mitigated because the cache code always constructs objects in the same code path (same key order), but it's a latent fragility.

**Suggested fix**: If key-order-independent checksums are desired:
```typescript
export function generateChecksum(data: unknown): string {
  const str = JSON.stringify(data, Object.keys(data as object).sort());
  // ...
}
```

However, the current behavior is acceptable given the usage pattern — note this only if cross-origin cache sharing is ever introduced.

---

## Security

### SEC-001: Memory exhaustion via unbounded response.text()

**Severity**: Medium  
**File**: `packages/core/src/services/APIService.ts`  
**Lines**: ~700–720

**Description**: `fetchWithTimeout` reads the entire HTTP response body into memory with `response.text()` before checking the size limit. When the `Content-Length` header is absent (which is common with chunked transfer encoding), a malicious or misbehaving upstream API could return a multi-gigabyte response, exhausting worker/process memory before the `text.length > API_MAX_RESPONSE_SIZE` check executes.

```typescript
// Current: reads ALL bytes THEN checks
const text = await response.text(); // ← Could be 2GB
if (text.length > API_MAX_RESPONSE_SIZE) { // ← Too late
  throw new Error(`Response too large...`);
}
```

**Suggested fix**: Use streaming reads with incremental size checking:
```typescript
const reader = response.body?.getReader();
if (!reader) throw new Error('No response body');

const chunks: Uint8Array[] = [];
let totalSize = 0;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  totalSize += value.length;
  if (totalSize > API_MAX_RESPONSE_SIZE) {
    reader.cancel();
    throw new Error(`Response too large: exceeded ${API_MAX_RESPONSE_SIZE} bytes`);
  }
  chunks.push(value);
}

const text = new TextDecoder().decode(Buffer.concat(chunks));
```

Or, for simpler Cloudflare Workers environments where `ReadableStream` might not be available in all contexts, use the existing `AbortController` timeout as a backstop and document the 1MB limit as sufficient protection.

**Mitigating factors**: The `AbortController` timeout of 5 seconds limits exposure, and the Universalis API is a trusted upstream. This is more of a defense-in-depth concern.

---

### SEC-002: Unsound type assertion on parsed JSON

**Severity**: Low  
**File**: `packages/core/src/services/APIService.ts`  
**Line**: ~715

**Description**: `JSON.parse(text) as { results?: UniversalisItemResult[] }` uses an `as` cast which is a "trust me" assertion. If the API returns unexpected fields (e.g., an array instead of an object, or extra properties), the type system won't catch it.

**Mitigating factors**: Downstream methods (`parseApiResponse`, `parseBatchApiResponse`) validate structure with `typeof data !== 'object'`, `Array.isArray(data.results)`, and field-level type checks. The risk of exploitation is low.

**Suggested fix**: Add a top-level shape guard:
```typescript
const parsed: unknown = JSON.parse(text);
if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
  throw new Error('Expected JSON object response');
}
return parsed as { results?: UniversalisItemResult[] };
```

---

### SEC-003: DiscordSnowflake maximum value not validated

**Severity**: Low  
**File**: `packages/types/src/auth/discord-snowflake.ts`  
**Lines**: ~30–35

**Description**: `SNOWFLAKE_PATTERN` validates `/^\d{17,20}$/` which allows the string `"99999999999999999999"` (20 nines), which is ~10^20 and exceeds JavaScript's `Number.MAX_SAFE_INTEGER` (2^53 - 1 ≈ 9.007 × 10^15). If ever parsed with `parseInt()`, precision loss would silently produce a wrong value.

**Mitigating factors**: Snowflakes are consistently handled as strings throughout the codebase, never parsed to numbers. This is more a robustness note.

**Suggested fix**: To be fully defensive, validate max value against BigInt:
```typescript
export function isValidSnowflake(value: string): boolean {
  if (!SNOWFLAKE_PATTERN.test(value)) return false;
  // Discord epoch starts at 2015-01-01: snowflake 0 = timestamp 0
  // Sanity check: must be less than 2^63
  return BigInt(value) <= BigInt('9223372036854775807');
}
```

---

## Refactoring Opportunities

### REF-001: TranslationProvider's boilerplate duplication

**Severity**: Medium  
**File**: `packages/core/src/services/localization/TranslationProvider.ts`  
**Lines**: 1–402

**Description**: All 10 translation methods follow the identical pattern:
1. Get locale data from registry
2. Try requested locale's map
3. Fallback to English
4. Return original key or formatted key

This is ~150 lines of near-identical code that could be ~30 lines with a generic helper.

**Suggested fix**:
```typescript
private resolveTranslation<K extends string>(
  locale: LocaleCode,
  accessor: (data: LocaleData) => Record<string, string> | undefined,
  key: K,
  fallback?: string
): string {
  const localeData = this.registry.getLocale(locale);
  const localeMap = localeData ? accessor(localeData) : undefined;
  if (localeMap?.[key]) return localeMap[key];

  if (locale !== 'en') {
    const englishData = this.registry.getLocale('en');
    const englishMap = englishData ? accessor(englishData) : undefined;
    if (englishMap?.[key]) return englishMap[key];
  }

  return fallback ?? this.formatKey(key);
}

// Then each method becomes a one-liner:
getLabel(key: TranslationKey, locale: LocaleCode): string {
  return this.resolveTranslation(locale, d => d.labels, key);
}

getCategory(category: string, locale: LocaleCode): string {
  return this.resolveTranslation(locale, d => d.categories, category, category);
}
```

---

### REF-002: Triple duplication of color distance calculation

**Severity**: Medium  
**Files**:
- `packages/core/src/services/dye/DyeSearch.ts` (~lines 19–55)
- `packages/core/src/services/CharacterColorService.ts` (~lines 235–262 and ~lines 340–347)

**Description**: Three independent implementations of color distance calculation exist:
1. `DyeSearch.calculateDistance()` — dispatches to `ColorConverter.getDeltaE` / `getDeltaE_Oklab` / etc.
2. `CharacterColorService.calculateDistanceWithMethod()` — dispatches to `ColorConverter.getDeltaE` / `getDeltaE_Oklab` / etc.
3. `CharacterColorService.calculateDistance()` — plain RGB Euclidean

The first two are nearly identical dispatchers. They should share a single implementation.

**Suggested fix**: Extract a `ColorDistance.calculate(hex1, hex2, method, weights?)` static utility and import it in both services.

---

### REF-003: Instance + Static method duplication pattern

**Severity**: Low  
**Files**: `ColorConverter.ts` (1472 lines), `LocalizationService.ts` (558 lines)

**Description**: Both classes implement every public method twice: once as an instance method and once as a static method that delegates to the singleton. In `ColorConverter` alone, this adds ~300 lines of pure boilerplate (`static foo(...) { return this.getDefault().foo(...); }`).

**Suggested fix**: This is an intentional API design choice (supporting both DI and static convenience). Consider a TypeScript decorator or code generator to auto-generate the static wrappers, or document the pattern in a contributing guide.

---

### REF-004: PaletteService extracts palette and matches separately

**Severity**: Low  
**File**: `packages/core/src/services/PaletteService.ts`  
**Lines**: ~370–400

**Description**: `extractAndMatchPalette` calls `extractPalette` then iterates results to find dye matches. The `rgbDistance` used for the distance in `PaletteMatch` is RGB Euclidean, but the user might expect perceptual matching (consistent with `DyeService.findClosestDye` which uses k-d tree + perceptual re-ranking).

This is more a design inconsistency than a bug — `extractAndMatchPalette` calls `dyeService.findClosestDye(hex)` (which does perceptual matching via k-d tree) but then reports distance using `rgbDistance(ex.color, matchedDye.rgb)` (plain RGB Euclidean). The reported distance doesn't match the metric used for matching.

---

### REF-005: ColorConverter.resetInstance is missing (unlike LocalizationService)

**Severity**: Info  
**File**: `packages/core/src/services/color/ColorConverter.ts`

**Description**: `LocalizationService` has `resetInstance()` for test isolation. `ColorConverter` has `clearCaches()` but no `resetInstance()`. While clearing caches is sufficient for most tests, it doesn't reset any future instance state that might be added.

---

## Optimization Opportunities

### OPT-001: K-means double cluster assignment

**Severity**: Low  
**File**: `packages/core/src/services/PaletteService.ts`  
**Lines**: ~262–275

**Description**: `kMeansClustering` calls `assignToClusters` inside the convergence loop and then again after the loop to get final cluster sizes. The last iteration of the loop already computed the correct clusters, but they're discarded.

```typescript
// In loop:
const { clusters } = assignToClusters(pixels, centroids); // computed but discarded
const { newCentroids, maxMovement } = updateCentroids(centroids, clusters);
// After loop:
const { clusters } = assignToClusters(pixels, centroids); // recomputed unnecessarily
```

**Suggested fix**: Track the last clusters from the loop:
```typescript
let lastClusters: RGB[][] = [];
for (let iter = 0; iter < maxIterations; iter++) {
  const { clusters } = assignToClusters(pixels, centroids);
  lastClusters = clusters;
  const { newCentroids, maxMovement } = updateCentroids(centroids, clusters);
  centroids = newCentroids;
  if (maxMovement < convergenceThreshold) break;
}
// If no iterations ran, do one final assignment
if (lastClusters.length === 0) {
  const { clusters } = assignToClusters(pixels, centroids);
  lastClusters = clusters;
}
const clusterSizes = lastClusters.map(c => c.length);
```

This saves one O(n×k) pass over the pixel data.

---

### OPT-002: TranslationProvider repeated English locale lookup

**Severity**: Low  
**File**: `packages/core/src/services/localization/TranslationProvider.ts`

**Description**: Every fallback path calls `this.registry.getLocale('en')`, which does a Map lookup. While Map lookups are O(1), this creates unnecessary overhead when the English locale is used as fallback for every single translation call in non-English locales. Caching the English data reference would eliminate this.

**Suggested fix**: Cache English data eagerly or lazily:
```typescript
private get englishData(): LocaleData | null {
  return this.registry.getLocale('en');
}
```

---

### OPT-003: ColorblindnessSimulator unnecessary copy for normal vision

**Severity**: Low  
**File**: `packages/core/src/services/color/ColorblindnessSimulator.ts`  
**Line**: ~49

**Description**: For `visionType === 'normal'`, the method returns `{ ...rgb }` — a spread copy. When called in loops (e.g., testing all vision types), this creates unnecessary allocations for the no-op case.

**Suggested fix**: Return the original object if callers are trusted, or freeze-and-return to avoid copies.

---

## Positive Findings (Strengths)

These are notable well-implemented patterns worth preserving:

1. **Prototype pollution protection** (`DyeDatabase.safeClone` with `DANGEROUS_KEYS` set) — thorough and tested
2. **ReDoS prevention** (`isValidHexColor` checks length before regex) — simple and effective
3. **Eager singleton initialization** (avoids race conditions per Issue #6) — across ColorConverter, LocalizationService, DyeDatabase
4. **Deferred promise pattern** in `APIService.getPriceData` prevents concurrent duplicate requests with atomic synchronous promise registration
5. **URL injection prevention** via `sanitizeDataCenterId` — regex-based allowlist
6. **Cache key collision prevention** with type prefixes (`dc:`, `world:`, `global:`) in `APIService.buildCacheKey`
7. **Input validation** is pervasive — every public method validates inputs and throws typed `AppError` with error codes
8. **Test coverage** is comprehensive — 30 test files including integration tests, performance benchmarks, and prototype pollution tests
9. **API response size limiting** with both Content-Length header check and body size check
10. **K-means++ initialization** with O(n×k) complexity (CORE-PERF-003 optimization)
11. **K-d tree** with optimized index-based construction (CORE-PERF-002) and boundary checking fix (CORE-BUG-003)
12. **Branded types** for `HexColor`, `DyeId`, etc. — runtime validation with compile-time type safety

---

## Recommendations Priority

| Priority | Finding | Impact | Effort |
|----------|---------|--------|--------|
| 1 | BUG-001 (Cache mutability) | Silent data corruption | Low — add `Object.freeze` |
| 2 | SEC-001 (Response size) | Memory DoS potential | Medium — streaming reads |
| 3 | BUG-002 (Lazy load recovery) | Permanent failure state | Low — add `.catch()` |
| 4 | REF-001 (TranslationProvider) | Maintainability | Low — extract helper |
| 5 | BUG-003 (Distance inconsistency) | User confusion | Low — add parameter |
| 6 | REF-002 (Distance duplication) | DRY violation | Low — extract utility |
| 7 | BUG-004 (samplePixels /0) | Edge case crash | Low — add guard |
| 8 | BUG-005 (Threshold inconsistency) | Subtle accuracy issue | Low — change constant |
| 9 | OPT-001 (K-means double pass) | Performance | Low — reuse clusters |
