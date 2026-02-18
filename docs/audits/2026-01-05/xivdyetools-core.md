# 🔒 Security Audit Report: xivdyetools-core

**Audit Date:** January 5, 2026  
**Package Version:** 1.5.4  
**Auditor:** GitHub Copilot  
**Scope:** Full source code review

---

## Executive Summary

The `xivdyetools-core` library demonstrates **good security practices** overall. The codebase shows evidence of security-conscious development with prototype pollution protections, input validation, and data sanitization. However, there are a few areas that could be strengthened.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 2 |
| 🔵 Low | 4 |
| ⚪ Informational | 6 |

---

## Dependency Analysis

### npm audit Results
```
found 0 vulnerabilities
```

✅ **No known vulnerabilities** in direct or transitive dependencies.

### Dependencies Review

| Package | Version | Risk Level | Notes |
|---------|---------|------------|-------|
| `@xivdyetools/types` | ^1.1.1 | Low | Internal package |
| `@xivdyetools/logger` | ^1.0.2 | Low | Internal package |

The package has only 2 runtime dependencies, both internal packages. This minimal dependency footprint significantly reduces supply chain attack surface.

---

## Detailed Findings

### 🟡 Medium Severity

#### MED-001: Potential ReDoS in Hex Color Validation
**Location:** `src/constants/index.ts#L89`

```typescript
export const PATTERNS = {
    HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
    RGB_COLOR: /^rgb\(\d+,\s*\d+,\s*\d+\)$/,
} as const;
```

**Description:** While the current regex patterns are safe, the RGB_COLOR pattern with `\d+` and `\s*` could theoretically be exploited with maliciously crafted input on some regex engines. The current implementation is low-risk but worth monitoring.

**Recommendation:** The patterns are currently safe. For defense in depth, consider adding input length limits before regex validation:
```typescript
export function isValidHexColor(hex: string): boolean {
  if (typeof hex !== 'string' || hex.length > 10) {
    return false;
  }
  return PATTERNS.HEX_COLOR.test(hex);
}
```

---

#### MED-002: Error Messages May Leak Internal State
**Location:** `src/services/APIService.ts#L452-L456`

```typescript
throw new AppError(
  ErrorCode.API_CALL_FAILED,
  `Failed to fetch price data for item ${itemID}: ${error instanceof Error ? error.message : 'Unknown error'}`,
  'warning'
);
```

**Description:** Error messages propagate upstream error details which could reveal internal implementation details or external API structure to consumers. While this is a library (not user-facing), consumers may inadvertently expose these errors to end users.

**Recommendation:** Consider categorizing errors without forwarding raw upstream messages:
```typescript
// Option 1: Generic error with logged details
this.logger.error(`API error for item ${itemID}`, error);
throw new AppError(
  ErrorCode.API_CALL_FAILED,
  `Failed to fetch price data for item ${itemID}`,
  'warning'
);
```

---

### 🔵 Low Severity

#### LOW-001: Unbounded Cache Growth Potential
**Location:** `src/services/APIService.ts#L118-L137`

```typescript
export class MemoryCacheBackend implements ICacheBackend {
  private cache: Map<string, CachedData<PriceData>> = new Map();

  set(key: string, value: CachedData<PriceData>): void {
    this.cache.set(key, value);  // No size limit
  }
}
```

**Description:** The `MemoryCacheBackend` has no maximum size limit. In long-running applications with many unique queries, this could lead to memory exhaustion.

**Recommendation:** Add a maximum cache size with LRU eviction:
```typescript
constructor(private maxSize: number = 10000) {}

set(key: string, value: CachedData<PriceData>): void {
  if (this.cache.size >= this.maxSize) {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) this.cache.delete(firstKey);
  }
  this.cache.set(key, value);
}
```

---

#### LOW-002: Console Warning in Production Code
**Location:** `src/utils/index.ts#L647-L649`

```typescript
if (isAbortError(error)) {
  console.warn(`Request timed out (attempt ${i + 1}/${attempts})`);
}
```

**Description:** The `retry` utility uses `console.warn` directly instead of the injectable logger pattern used elsewhere. This could leak operational details in production environments.

**Recommendation:** Accept an optional logger parameter or remove the console statement:
```typescript
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
  logger?: { warn: (msg: string) => void }
): Promise<T> {
  // ...
  if (isAbortError(error)) {
    logger?.warn(`Request timed out (attempt ${i + 1}/${attempts})`);
  }
}
```

---

#### LOW-003: Missing Input Validation for Pixel Data
**Location:** `src/services/PaletteService.ts#L419-L430`

```typescript
static pixelDataToRGB(data: Uint8ClampedArray | number[]): RGB[] {
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
    });
  }
  return pixels;
}
```

**Description:** No validation that the array length is a multiple of 4, or that values are within 0-255 range. Malformed input could produce undefined RGB values.

**Recommendation:** Add defensive validation:
```typescript
static pixelDataToRGB(data: Uint8ClampedArray | number[]): RGB[] {
  if (data.length % 4 !== 0) {
    throw new AppError(ErrorCode.INVALID_INPUT, 
      'Pixel data length must be a multiple of 4 (RGBA format)', 'warning');
  }
  // ... rest of implementation
}
```

---

#### LOW-004: JSON.stringify Circular Reference Risk
**Location:** `src/utils/index.ts#L707-L713`

```typescript
export function generateChecksum(data: unknown): string {
  const str = JSON.stringify(data); // Throws on circular references
  // ...
}
```

**Description:** While documented in comments, the function will throw an unhandled error if passed circular references. Since this is used for cache validation, a malformed cache object could crash the application.

**Recommendation:** Add try-catch wrapper:
```typescript
export function generateChecksum(data: unknown): string {
  try {
    const str = JSON.stringify(data);
    // ... hash calculation
  } catch (error) {
    throw new AppError(
      ErrorCode.INVALID_INPUT,
      'Cannot generate checksum: data contains circular references or is not serializable',
      'warning'
    );
  }
}
```

---

### ⚪ Informational

#### INFO-001: Excellent Prototype Pollution Protection ✅
**Location:** `src/services/dye/DyeDatabase.ts#L66-L84`

```typescript
private static readonly DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

private safeClone(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(obj)) {
    if (DyeDatabase.DANGEROUS_KEYS.has(key)) {
      continue; // Skip dangerous keys
    }
    // ... recursive cloning
  }
  return result;
}
```

**Assessment:** Excellent implementation of prototype pollution protection when loading external dye data. Uses `Object.create(null)` and filters dangerous keys.

---

#### INFO-002: Good URL Sanitization ✅
**Location:** `src/services/APIService.ts#L810-L815`

```typescript
private sanitizeDataCenterId(dataCenterID: string): string {
  return dataCenterID.replace(/[^a-zA-Z0-9]/g, '');
}
```

**Assessment:** Properly sanitizes datacenter IDs before URL construction, preventing path traversal or injection attacks.

---

#### INFO-003: Good Input Validation for Batch Requests ✅
**Location:** `src/services/APIService.ts#L795-L815`

```typescript
private buildBatchApiUrl(itemIDs: number[], dataCenterID?: string): string {
  if (!itemIDs || itemIDs.length === 0) {
    throw new AppError(ErrorCode.INVALID_INPUT, 'itemIDs array cannot be empty', 'warning');
  }
  if (itemIDs.length > 100) {
    throw new AppError(ErrorCode.INVALID_INPUT, 
      `Cannot fetch more than 100 items in one batch (got ${itemIDs.length})`, 'warning');
  }
  const invalidIds = itemIDs.filter((id) => !Number.isInteger(id) || id < 1);
  if (invalidIds.length > 0) {
    throw new AppError(ErrorCode.INVALID_INPUT, 
      `Invalid item IDs: all IDs must be positive integers`, 'warning');
  }
  // ...
}
```

**Assessment:** Comprehensive validation of batch request parameters with size limits and type checking.

---

#### INFO-004: DoS Protection in K-means Algorithm ✅
**Location:** `src/services/PaletteService.ts#L350-L359`

```typescript
if (opts.maxIterations < 1 || opts.maxIterations > 100) {
  this.logger.warn(
    `PaletteService.extractPalette: maxIterations ${opts.maxIterations} clamped to [1, 100] range`
  );
}
const maxIterations = Math.max(1, Math.min(100, opts.maxIterations));
```

**Assessment:** Good protection against algorithmic complexity attacks by clamping iteration limits.

---

#### INFO-005: Response Size Limits ✅
**Location:** `src/services/APIService.ts#L542-L555`

```typescript
const contentLength = response.headers.get('content-length');
if (contentLength) {
  const size = parseInt(contentLength, 10);
  if (!isNaN(size) && size > API_MAX_RESPONSE_SIZE) {
    throw new Error(`Response too large: ${size} bytes (max: ${API_MAX_RESPONSE_SIZE} bytes)`);
  }
}
const text = await response.text();
if (text.length > API_MAX_RESPONSE_SIZE) {
  throw new Error(`Response too large: ${text.length} bytes`);
}
```

**Assessment:** Proper protection against memory exhaustion from oversized API responses.

---

#### INFO-006: Cache Key Collision Prevention ✅
**Location:** `src/services/APIService.ts#L829-L846`

```typescript
private buildCacheKey(itemID: number, worldID?: number, dataCenterID?: string): string {
  const parts: (string | number)[] = [itemID];
  if (dataCenterID) {
    // Type prefix 'dc' ensures datacenter keys don't collide with world/global keys
    const sanitized = this.sanitizeDataCenterId(dataCenterID);
    parts.push('dc', sanitized);
  } else if (worldID) {
    parts.push('world', worldID);
  } else {
    parts.push('global');
  }
  return parts.join(':');
}
```

**Assessment:** Excellent design preventing cache key collisions through type prefixes and colon delimiters.

---

## Security Strengths

1. **Minimal Dependencies:** Only 2 runtime dependencies (both internal), reducing supply chain risk
2. **Prototype Pollution Protection:** Active protection when loading external data
3. **Input Validation:** Consistent validation for color values, IDs, and API parameters
4. **URL Sanitization:** Proper sanitization of user-provided URL path segments
5. **Response Size Limits:** Protection against memory exhaustion from API responses
6. **Algorithmic Complexity Limits:** DoS protection in computationally expensive operations
7. **Type Safety:** Strong TypeScript typing throughout reduces runtime errors
8. **Error Handling:** Consistent use of typed AppError with severity levels
9. **Dependency Injection:** Testable architecture allows security testing with mocks

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| Medium | Add input length limits before regex validation |
| Medium | Sanitize error messages before propagation |
| Low | Add size limits to MemoryCacheBackend |
| Low | Replace console.warn with injected logger in retry() |
| Low | Add pixel data validation in PaletteService |
| Low | Add error handling to generateChecksum() |

---

## Conclusion

The `xivdyetools-core` library demonstrates security-conscious development practices. The identified issues are low severity and mostly relate to edge cases. The codebase already implements many security best practices including prototype pollution protection, input sanitization, and resource limits.

**Overall Security Rating: Good** ✅
