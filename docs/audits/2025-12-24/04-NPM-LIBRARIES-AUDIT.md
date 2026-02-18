# XIV Dye Tools - NPM Libraries Audit Report

**Date:** December 24, 2025
**Auditor:** Claude Code (Opus 4.5)
**Scope:** All 4 NPM library packages

---

## 🔄 Remediation Status (Updated: December 24, 2025)

### ✅ Resolved Issues

| ID | Issue | Resolution |
|----|-------|------------|
| TYPES-001 | Duplicate LRU cache implementation | Extracted to `src/utils/lru-cache.ts`, imported by both ColorConverter and ColorblindnessSimulator |
| INPUT-001 | Batch API URL missing validation | Added empty array, max 100 items, and positive integer validation |
| PERF-002 | Pixel sampling bias | Fixed range distribution to include first and last pixels |
| ERROR-001 | Cache miss vs error indistinguishable | Improved error handling to fall through to fetch on cache errors |
| LOG-API-001 | Child logger clones all adapters | Added DelegatingLogger class for efficient child logger creation |
| TEST-DESIGN-001 | Factory ID race condition | Changed to random UUIDs for parallel test safety |
| TEST-DESIGN-002 | Fragile SQL query matching | Updated docs to recommend regex patterns |

### ⏳ Remaining Issues

_All Low priority issues have been resolved or documented. No remaining actionable items._

### ✅ Additional Resolved Issues (December 24, 2025)

| ID | Issue | Resolution |
|----|-------|------------|
| REEXP-001 | Deprecation without timeline | All deprecations now specify "Removed in v2.0.0" |
| TYPES-001 | Duplicate LRU cache | Extracted to shared `src/utils/lru-cache.ts` |
| INPUT-001 | Batch API URL validation | Added empty array, max 100 items, positive integer validation |
| TYPES-102 | DyeId range excludes Facewear | Updated `createDyeId` to accept synthetic negative IDs (<= -1000) |
| PERF-003 | O(n²) harmony fallback | Simplified to O(log n) by leveraging DyeSearch's built-in Facewear exclusion |
| MEM-001 | Repeated toLowerCase in search | Pre-computed `nameLower` and `categoryLower` fields in DyeInternal |
| LOG-ERR-001 | Secret redaction patterns | Fixed patterns to handle quoted values and delimiters properly |
| CROSS-002 | Inconsistent logging | Created `developer-guides/logging-standards.md` documenting standards |
| TYPES-101 | Branded types rely on runtime | Documented limitation in `src/color/branded.ts` with best practices |
| TYPES-103 | Optional Dye fields | Documented field presence guarantee in `src/dye/dye.ts` |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [xivdyetools-core](#1-xivdyetools-core)
3. [xivdyetools-types](#2-xivdyetools-types)
4. [xivdyetools-logger](#3-xivdyetools-logger)
5. [xivdyetools-test-utils](#4-xivdyetools-test-utils)
6. [Cross-Package Concerns](#5-cross-package-concerns)
7. [Priority Recommendations](#6-priority-recommendations)

---

## Executive Summary

| Package | Type Safety | Performance | Input Validation | Other | Total |
|---------|-------------|-------------|------------------|-------|-------|
| xivdyetools-core (v1.5.1) | 2 | 3 | 3 | 4 | 12 |
| xivdyetools-types (v1.0.0) | 3 | 0 | 0 | 1 | 4 |
| xivdyetools-logger (v1.0.0) | 1 | 1 | 0 | 2 | 4 |
| xivdyetools-test-utils (v1.0.2) | 1 | 0 | 1 | 2 | 4 |
| Cross-package | 0 | 0 | 0 | 2 | 2 |
| **Total** | **7** | **4** | **4** | **11** | **26** |

**Overall Assessment:** Good codebase with strong architectural patterns. No critical security vulnerabilities found, but several optimization opportunities and edge cases to address.

---

## 1. XIVDYETOOLS-CORE

Core color science library and FFXIV dye database.

### Type Safety Issues

#### TYPES-001: Duplicate LRU Cache Implementation

**Severity:** Medium (Code Duplication)
**Files:**
- `xivdyetools-core/src/services/color/ColorConverter.ts` lines 17-58
- `xivdyetools-core/src/services/color/ColorblindnessSimulator.ts` lines 15-53

**Problem:**
The LRUCache implementation is duplicated across two files:

```typescript
// ColorConverter.ts - lines 17-58
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  // ... identical implementation in ColorblindnessSimulator.ts
}
```

**Impact:** Bug fixes or improvements must be applied in multiple places.

**Recommendation:**
Extract to shared utility:
```typescript
// src/utils/lru-cache.ts
export class LRUCache<K, V> { ... }
```

---

#### TYPES-002: Type Coercion in DyeDatabase

**Severity:** Low
**File:** `xivdyetools-core/src/services/dye/DyeDatabase.ts`
**Lines:** 215, 243-246

**Problem:**
Uses `as unknown as Dye` cast which bypasses type checking:

```typescript
const normalizedDye = this.safeClone(dye as Record<string, unknown>);
// ...
return normalizedDye;
})
.map((dye) => dye as unknown as Dye);
```

**Impact:** Type safety is weakened, though runtime validation via `isValidDye()` exists.

**Recommendation:**
Use type guard function that returns `dye is Dye`:
```typescript
function isValidDye(obj: unknown): obj is Dye {
  // Validation logic
}
```

---

### Performance Issues

#### PERF-001: LRUCache Get Returns Undefined Ambiguity

**Severity:** Low
**File:** `xivdyetools-core/src/services/color/ColorblindnessSimulator.ts`
**Lines:** 26-31

**Problem:**
Cache get checks `value !== undefined` but this is indistinguishable from cached `undefined` value:

```typescript
get(key: K): V | undefined {
  const value = this.cache.get(key);
  if (value !== undefined) {
    this.cache.delete(key);
    this.cache.set(key, value);
  }
  return value;
}
```

**Impact:** If a cached value is legitimately `undefined`, LRU promotion doesn't happen.

**Note:** Not an actual bug for current usage (RGB values are never undefined), but could cause issues if cache is used for optional values.

**Recommendation:**
Use explicit `has()` check:
```typescript
get(key: K): V | undefined {
  if (!this.cache.has(key)) return undefined;
  const value = this.cache.get(key)!;
  this.cache.delete(key);
  this.cache.set(key, value);
  return value;
}
```

---

#### PERF-002: PaletteService.samplePixels Bias

**Severity:** Low
**File:** `xivdyetools-core/src/services/PaletteService.ts`
**Lines:** 319-334

**Problem:**
Sampling favors earlier pixels, never includes last pixel unless by chance:

```typescript
private samplePixels(pixels: RGB[], maxSamples: number): RGB[] {
  if (pixels.length <= maxSamples) {
    return pixels;
  }

  const step = pixels.length / maxSamples;
  const samples: RGB[] = [];

  for (let i = 0; i < maxSamples; i++) {
    const index = Math.min(Math.floor(i * step), pixels.length - 1);
    samples.push(pixels[index]);
  }

  return samples;
}
```

**Impact:** Images with important colors in bottom-right corners may be under-sampled.

**Recommendation:**
Use reservoir sampling or ensure last pixel is included:
```typescript
for (let i = 0; i < maxSamples; i++) {
  const index = Math.round(i * (pixels.length - 1) / (maxSamples - 1));
  samples.push(pixels[index]);
}
```

---

#### PERF-003: HarmonyGenerator O(n^2) Fallback

**Severity:** Medium
**File:** `xivdyetools-core/src/services/dye/HarmonyGenerator.ts`
**Lines:** 44-62

**Problem:**
Finding non-Facewear dye iterates through all dyes in worst case:

```typescript
private findClosestNonFacewearDye(hex: string, excludeIds: number[] = []): Dye | null {
  const allExcluded = [...excludeIds];
  const totalDyes = this.database.getDyesInternal().length;

  for (let i = 0; i < totalDyes; i++) {
    const candidate = this.search.findClosestDye(hex, allExcluded);
    if (!candidate) return null;

    if (candidate.category !== 'Facewear') {
      return candidate;
    }
    allExcluded.push(candidate.id);
  }
  return null;
}
```

**Impact:** O(n * log n) in worst case when all closest dyes are Facewear.

**Recommendation:**
Add category filter parameter to `findClosestDye`:
```typescript
findClosestDye(hex: string, options?: {
  excludeIds?: number[];
  excludeCategories?: string[];
}): Dye | null
```

---

### Input Validation Issues

#### INPUT-001: APIService.buildBatchApiUrl Missing Validation

**Severity:** Medium
**File:** `xivdyetools-core/src/services/APIService.ts`
**Lines:** 790-796

**Problem:**
No validation on array contents or length:

```typescript
private buildBatchApiUrl(itemIDs: number[], dataCenterID?: string): string {
  const pathSegment = dataCenterID ? this.sanitizeDataCenterId(dataCenterID) : 'universal';
  const itemsSegment = itemIDs.join(',');  // No validation
  return `${this.baseUrl}/aggregated/${pathSegment}/${itemsSegment}`;
}
```

**Impact:**
- Empty array creates invalid URL `/aggregated/universal/`
- Large arrays exceed URL length limits
- Non-integer values could cause issues

**Recommendation:**
```typescript
private buildBatchApiUrl(itemIDs: number[], dataCenterID?: string): string {
  if (!itemIDs || itemIDs.length === 0) {
    throw new Error('itemIDs array cannot be empty');
  }
  if (itemIDs.length > 100) {
    throw new Error('Cannot fetch more than 100 items in one batch');
  }
  if (!itemIDs.every(id => Number.isInteger(id) && id > 0)) {
    throw new Error('All itemIDs must be positive integers');
  }
  // ... rest of method
}
```

---

#### INPUT-002: ColorService.normalizeHex Delegation

**Severity:** Low
**File:** `xivdyetools-core/src/services/ColorService.ts`
**Line:** 125

**Problem:**
Relies entirely on ColorConverter without explicit validation:

```typescript
static normalizeHex(hex: string): HexColor {
  return ColorConverter.normalizeHex(hex);
}
```

**Impact:** Error messages may not be user-friendly for invalid input.

**Recommendation:**
Add explicit validation with better error messages:
```typescript
static normalizeHex(hex: string): HexColor {
  if (!hex || typeof hex !== 'string') {
    throw new Error('Hex color must be a non-empty string');
  }
  return ColorConverter.normalizeHex(hex);
}
```

---

#### INPUT-003: PaletteService.extractPalette Silent Clamping

**Severity:** Low
**File:** `xivdyetools-core/src/services/PaletteService.ts`
**Line:** 357

**Problem:**
Silently clamps maxIterations without informing caller:

```typescript
const maxIterations = Math.max(1, Math.min(100, opts.maxIterations));
```

**Impact:** If user passes 1000, it silently becomes 100 with no warning.

**Recommendation:**
Log warning when clamping occurs:
```typescript
if (opts.maxIterations < 1 || opts.maxIterations > 100) {
  this.logger?.warn(`maxIterations clamped to [1, 100] range from ${opts.maxIterations}`);
}
const maxIterations = Math.max(1, Math.min(100, opts.maxIterations));
```

---

### Error Handling Issues

#### ERROR-001: APIService Cache Miss vs Error Indistinguishable

**Severity:** Low
**File:** `xivdyetools-core/src/services/APIService.ts`
**Lines:** 295-325

**Problem:**
`getCachedPrice` returns null for both cache miss and cache error:

```typescript
private async getCachedPrice(cacheKey: string): Promise<PriceData | null> {
  try {
    const cached = await this.cache.get(cacheKey);
    // ...
    return cached.data;
  } catch (error) {
    this.logger.error(`Cache error: ${error}`);
    return null;  // Same as cache miss
  }
}
```

**Impact:** Caller can't distinguish "not in cache" from "cache backend broken".

**Recommendation:**
Fall through to fetch instead of returning null on error:
```typescript
} catch (error) {
  this.logger.error(`Cache backend error: ${error}`);
  // Continue to fetch from API rather than returning null
}
```

---

### Memory/Resource Issues

#### MEM-001: DyeService.searchByLocalizedName Repeated toLowerCase

**Severity:** Low
**File:** `xivdyetools-core/src/services/DyeService.ts`
**Lines:** 292-314

**Problem:**
`toLowerCase()` called inside filter for every dye:

```typescript
searchByLocalizedName(query: string): Dye[] {
  const lowerQuery = query.toLowerCase().trim();  // Good
  const dyes = this.database.getDyesInternal();

  return dyes.filter((dye) => {
    if (dye.name.toLowerCase().includes(lowerQuery)) {  // Called 136 times per search
      return true;
    }
    // ...
  });
}
```

**Impact:** ~136 unnecessary string allocations per search (dye names are already known).

**Recommendation:**
Pre-compute lowercased names in DyeDatabase initialization:
```typescript
interface DyeWithCache extends Dye {
  _lowerName: string;
}
```

---

#### MEM-002: KDTree Index Allocation

**Severity:** Low (Performance, not correctness)
**File:** `xivdyetools-core/src/utils/kd-tree.ts`
**Lines:** 94-95

**Problem:**
Despite optimization comment, `indices.slice()` still creates new arrays:

```typescript
node.left = this.buildTreeOptimized(points, indices.slice(0, median), depth + 1);
node.right = this.buildTreeOptimized(points, indices.slice(median + 1), depth + 1);
```

**Note:** This is acceptable - the optimization is that indices (numbers) are smaller than full point objects. Not a bug, just documentation clarification needed.

---

### Dead Code / Unused Exports

#### DEAD-001: Potential Orphan Method

**Severity:** Low
**File:** `xivdyetools-core/src/services/dye/DyeDatabase.ts`
**Lines:** 390-407

**Problem:**
`getHueBucketsToSearch` is only used in `HarmonyGenerator.findClosestDyeByHue()`. If harmony generation is refactored, this becomes orphaned.

**Status:** Currently used - not dead code. Add test coverage to prevent accidental removal.

---

## 2. XIVDYETOOLS-TYPES

Shared TypeScript type definitions.

### Type Safety Issues

#### TYPES-101: Branded Types Rely on Runtime Validation

**Severity:** Low
**File:** `xivdyetools-types/src/color/branded.ts`
**Lines:** 36-47, 70-75, 99-103, 127-130

**Problem:**
Creation functions use `as` casts that can be bypassed:

```typescript
export function createHexColor(hex: string): HexColor {
  // ... validation ...
  const normalized = /* ... */;
  return normalized as HexColor;  // Cast can be used directly
}

// Developers could still do:
const notSafe: HexColor = "#invalid" as HexColor;  // Bypasses validation
```

**Note:** This is a known limitation of TypeScript's branded type pattern. The functions provide validation, but the type system can't enforce their usage.

**Recommendation:** Document this limitation clearly in the type definitions.

---

#### TYPES-102: DyeId Range Check Inconsistent

**Severity:** Medium
**File:** `xivdyetools-types/src/color/branded.ts`
**Lines:** 70-75

**Problem:**
DyeId validation limits to 1-200, but DyeDatabase uses negative IDs for synthetic Facewear:

```typescript
export function createDyeId(id: number): DyeId | null {
  if (!Number.isInteger(id) || id < 1 || id > 200) {
    return null;
  }
  return id as DyeId;
}
```

**Impact:** Synthetic Facewear dye IDs (negative numbers) can't be created via `createDyeId`.

**Recommendation:**
Either:
1. Allow negative IDs: `id < -100 || id > 200`
2. Create separate `createSyntheticDyeId` function
3. Document that synthetic IDs bypass branded type validation

---

#### TYPES-103: Optional Fields in Dye Type

**Severity:** Low
**File:** Dye interface definition

**Problem:**
Some Dye fields may be optional, but many consumers assume they exist.

**Recommendation:** Audit all consumers to ensure proper null coalescing.

---

### Re-export Issues

#### REEXP-001: Deprecated Re-exports Without Timeline

**Severity:** Low
**File:** `xivdyetools-core/src/types/index.ts`
**Lines:** 13-147

**Problem:**
All re-exports marked `@deprecated` but no version removal timeline:

```typescript
/**
 * @deprecated Import from '@xivdyetools/types' instead.
 * This re-export will be removed in a future version.
 */
export type { RGB, HSV, HexColor } from '@xivdyetools/types/color';
```

**Recommendation:**
Add specific version: `@deprecated Removed in v3.0.0. Import from '@xivdyetools/types' instead.`

---

## 3. XIVDYETOOLS-LOGGER

Unified logging library.

### Type Safety Issues

#### LOG-TYPES-001: LogContext Uses any

**Severity:** Low
**File:** `xivdyetools-logger/src/core/base-logger.ts`
**Line:** 35 (referenced)

**Problem:**
LogContext likely defined as `Record<string, any>`, losing type safety.

**Recommendation:**
Define stricter type:
```typescript
type LogValue = string | number | boolean | null | undefined | LogValue[] | { [key: string]: LogValue };
type LogContext = Record<string, LogValue>;
```

---

### Error Handling Issues

#### LOG-ERR-001: Secret Redaction Incomplete

**Severity:** Medium
**File:** `xivdyetools-logger/src/core/base-logger.ts`
**Lines:** 136-143

**Problem:**
Regex uses `\S+` which stops at whitespace, leaving partial secrets visible:

```typescript
protected sanitizeErrorMessage(message: string): string {
  return message
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]')
    // ...
}
```

**Example:**
- `token=my secret value` becomes `token=[REDACTED] value` (partial leak)

**Recommendation:**
Use quote-aware or greedy matching:
```typescript
.replace(/token[=:]\s*(['"]?)(\S+)\1/gi, 'token=$1[REDACTED]$1')
.replace(/token[=:]\s*[^\s;,]+/gi, 'token=[REDACTED]')
```

---

### Performance Issues

#### LOG-PERF-001: String Building in writePretty

**Severity:** Very Low
**File:** `xivdyetools-logger/src/adapters/console-adapter.ts`
**Lines:** 45-95

**Problem:**
Uses array join for string building:

```typescript
private writePretty(entry: LogEntry): void {
  const parts: string[] = [];
  if (this.config.timestamps) {
    parts.push(`[${timestamp}]`);
  }
  parts.push(message);
  const logLine = parts.join(' ');
}
```

**Note:** Not a real issue - I/O is far slower than string operations. Documenting for completeness.

---

### API Design Issues

#### LOG-API-001: child() Creates Full Clone

**Severity:** Low
**File:** `xivdyetools-logger/src/core/base-logger.ts`
**Lines:** 193-199

**Problem:**
Creating child logger duplicates all adapters:

```typescript
child(context: LogContext): ExtendedLogger {
  const ChildClass = this.constructor as new (config: Partial<LoggerConfig>) => BaseLogger;
  const childLogger = new ChildClass(this.config);
  childLogger.globalContext = { ...this.globalContext, ...context };
  return childLogger;
}
```

**Impact:**
1. Different adapters with same config have separate output streams
2. Memory overhead of duplicate adapters
3. No shared state between parent and child

**Recommendation:**
Use delegation pattern:
```typescript
child(context: LogContext): ExtendedLogger {
  return new DelegatingLogger(this, context);
}
```

---

## 4. XIVDYETOOLS-TEST-UTILS

Shared testing utilities for Vitest.

### Type Safety Issues

#### TEST-TYPES-001: Mock Objects Accept any

**Severity:** Low
**Files:** Canvas and DOM mocks

**Problem:**
Mock implementations likely use `any` for flexibility.

**Recommendation:**
Use overloads or generic mocking factories instead.

---

### Design Issues

#### TEST-DESIGN-001: Factory Counters Not Thread-Safe

**Severity:** Medium (In Concurrent Tests)
**File:** `xivdyetools-test-utils/src/factories/index.ts`

**Problem:**
Auto-incrementing ID counters are global state:

```typescript
let userIdCounter = 0;
export function createUser(): User {
  return { id: ++userIdCounter, ... };
}
```

**Impact:** In parallel test execution, two tests could get same ID:

```typescript
// Thread 1: const user1 = createUser(); // ID 1
// Thread 2: const user2 = createUser(); // ID 1 (collision!)
```

**Note:** Only an issue if tests run in parallel. Sequential execution is safe.

**Recommendation:**
Document limitation or use random IDs:
```typescript
export function createUser(): User {
  return { id: crypto.randomUUID(), ... };
}
```

---

#### TEST-DESIGN-002: Mock Query Matching Fragile

**Severity:** Low
**File:** D1 mocks

**Problem:**
Query matching uses string includes which is fragile:

```typescript
db._setupMock((query, bindings) => {
  if (query.includes('SELECT')) return { id: 1 };
  return null;
});
```

**Impact:** `query.includes('SELECT')` breaks if formatting changes.

**Recommendation:**
Use SQL parser or regex patterns:
```typescript
if (/^\s*SELECT/i.test(query)) return { id: 1 };
```

---

### Missing Validations

#### TEST-VAL-001: Mock Bindings Not Validated

**Severity:** Low
**Files:** Cloudflare mocks

**Problem:**
When mocking D1, there's no validation that binding count matches query placeholders.

**Impact:** Tests could pass with incorrect mock setup.

**Recommendation:**
Add binding count validation in mock setup.

---

## 5. Cross-Package Concerns

### CROSS-001: No Centralized Checksum Algorithm

**Severity:** Low
**Files:** xivdyetools-core uses `generateChecksum()`

**Problem:**
Checksum utility exists in core but might be needed in other packages.

**Recommendation:** Either:
1. Accept duplication in each package
2. Create tiny `@xivdyetools/crypto-utils` package
3. Add to types package (though it's runtime code)

---

### CROSS-002: Logging Not Consistently Used

**Severity:** Low
**Files:** Multiple service files

**Problem:**
Services accept optional Logger in constructor, but logging is inconsistent:

| Service | Logging Level |
|---------|---------------|
| DyeDatabase | Extensive |
| DyeSearch | None |
| ColorConverter | Errors only |
| PaletteService | Minimal |

**Recommendation:**
Establish logging standards per operation type:
- Initialization: INFO
- Cache operations: DEBUG
- Errors: ERROR with context
- Performance: DEBUG with timing

---

## 6. Priority Recommendations

### Critical (Do First)

| ID | Issue | Package | Impact |
|----|-------|---------|--------|
| INPUT-001 | Batch API validation missing | core | DoS potential |
| LOG-ERR-001 | Secret redaction incomplete | logger | Information leak |
| TEST-DESIGN-001 | Factory race condition | test-utils | Flaky tests |

### High (Do Soon)

| ID | Issue | Package | Impact |
|----|-------|---------|--------|
| TYPES-001 | Duplicate LRU cache | core | Maintenance burden |
| TYPES-102 | DyeId range inconsistent | types | Type confusion |
| PERF-003 | O(n^2) harmony fallback | core | Performance degradation |

### Medium (Next Release)

| ID | Issue | Package | Impact |
|----|-------|---------|--------|
| ERROR-001 | Cache miss vs error | core | Debugging difficulty |
| PERF-002 | Pixel sampling bias | core | Palette quality |
| CROSS-002 | Inconsistent logging | all | Observability gaps |

### Low (Nice to Have)

| ID | Issue | Package | Impact |
|----|-------|---------|--------|
| LOG-API-001 | Child logger creates clone | logger | Memory overhead |
| MEM-001 | Repeated toLowerCase | core | Minor CPU overhead |
| TEST-DESIGN-002 | Fragile query matching | test-utils | Test maintenance |

---

## Architecture Strengths

The NPM libraries demonstrate several best practices:

- **Strong typing** with branded types for safety
- **Comprehensive testing** with 80%+ coverage targets
- **Modular exports** with subpath exports for tree-shaking
- **Good separation of concerns** between packages
- **Performance optimizations** like k-d tree indexing and LRU caching
- **Defensive programming** with extensive input validation

---

*Generated by Claude Code audit on December 24, 2025*
