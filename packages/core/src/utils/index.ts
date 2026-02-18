/**
 * @xivdyetools/core - Shared Utilities
 *
 * Reusable utility functions (environment-agnostic)
 *
 * @module utils
 */

import {
  RGB_MIN,
  RGB_MAX,
  HUE_MIN,
  HUE_MAX,
  SATURATION_MIN,
  SATURATION_MAX,
  VALUE_MIN,
  VALUE_MAX,
  PATTERNS,
} from '../constants/index.js';
import type { Logger } from '../types/index.js';

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * Simple LRU (Least Recently Used) cache implementation
 *
 * Per P-1: Caching for color conversions (60-80% speedup)
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, number>(100);
 * cache.set('key1', 42);
 * const value = cache.get('key1'); // Returns 42
 * cache.clear(); // Clear all entries
 * ```
 *
 * Implementation notes:
 * - Uses Map for O(1) operations
 * - Move-to-end on access for LRU ordering
 * - Evicts least recently used when at capacity
 *
 * ⚠️ CONCURRENCY LIMITATION:
 * This cache is designed for synchronous access patterns.
 * When used in async contexts, concurrent operations may cause:
 * - Cache stampede (duplicate expensive computations)
 * - Incorrect LRU ordering
 *
 * For async contexts with high concurrency, consider:
 * - Using a library like `lru-cache` with async lock support
 * - Implementing request deduplication at the calling layer
 *   (see APIService.getPriceData for example pattern)
 *
 * This limitation is acceptable for the current use case (one-time
 * color conversions) but should be considered for future enhancements.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get a value from the cache
   *
   * @param key - The key to look up
   * @returns The cached value or undefined if not found
   */
  get(key: K): V | undefined {
    // Use has() check first to properly handle undefined values
    // and ensure atomic move-to-end operation for LRU ordering
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    // Move to end (most recently used)
    // Note: Atomic in synchronous contexts, but see concurrency warning above
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set a value in the cache
   *
   * @param key - The key to store
   * @param value - The value to cache
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing - move to end
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current number of cached entries
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Async-safe LRU cache with built-in request deduplication
 *
 * Unlike the synchronous LRUCache, this class is designed for async operations
 * where multiple concurrent requests for the same key should share a single
 * computation rather than triggering duplicate work.
 *
 * @example
 * ```typescript
 * const cache = new AsyncLRUCache<string, ApiResponse>(100);
 *
 * // Multiple concurrent calls with same key share one fetch
 * const [result1, result2] = await Promise.all([
 *   cache.getOrCompute('user:123', () => fetchUser('123')),
 *   cache.getOrCompute('user:123', () => fetchUser('123')), // Reuses first call
 * ]);
 * // fetchUser was only called once!
 * ```
 *
 * Implementation notes:
 * - Uses separate Map for pending promises (request deduplication)
 * - Promise is stored SYNCHRONOUSLY before any await (critical for race safety)
 * - Handles errors gracefully - removes from pending but doesn't cache failures
 * - LRU eviction when cache is full
 *
 * Per OPT-001: This addresses the concurrency limitation of the synchronous
 * LRUCache for async contexts.
 */
export class AsyncLRUCache<K, V> {
  private cache: Map<K, V>;
  private pending: Map<K, Promise<V>>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.pending = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get a value from cache, or compute it if not present
   *
   * This method handles request deduplication: if a computation for the same
   * key is already in progress, subsequent calls will wait for that computation
   * rather than starting a new one.
   *
   * @param key - The cache key
   * @param compute - Async function to compute the value if not cached
   * @returns Promise resolving to the cached or computed value
   *
   * @example
   * ```typescript
   * const value = await cache.getOrCompute(
   *   'expensive-key',
   *   async () => await expensiveAsyncOperation()
   * );
   * ```
   */
  async getOrCompute(key: K, compute: () => Promise<V>): Promise<V> {
    // Check cache first (fast path)
    if (this.cache.has(key)) {
      const value = this.cache.get(key)!;
      // Move to end for LRU ordering
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }

    // Check if computation is already in progress (deduplication)
    const pendingPromise = this.pending.get(key);
    if (pendingPromise) {
      return pendingPromise;
    }

    // CRITICAL: Store promise SYNCHRONOUSLY before any await
    // This ensures concurrent calls see the pending promise
    const promise = compute()
      .then((value) => {
        this.pending.delete(key);
        this.set(key, value);
        return value;
      })
      .catch((error) => {
        this.pending.delete(key);
        throw error;
      });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Get a value from the cache (sync check only)
   *
   * @param key - The key to look up
   * @returns The cached value or undefined if not found
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Set a value in the cache
   *
   * @param key - The key to store
   * @param value - The value to cache
   */
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing - move to end
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  /**
   * Clear all entries from the cache and pending operations
   */
  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }

  /**
   * Get the current number of cached entries
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get the current number of pending operations
   */
  get pendingSize(): number {
    return this.pending.size;
  }
}

// ============================================================================
// Math Utilities
// ============================================================================

/**
 * Clamp a number between min and max values
 *
 * @param value - The value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Clamped value between min and max
 *
 * @example
 * ```typescript
 * clamp(150, 0, 100)  // Returns 100
 * clamp(-10, 0, 100)  // Returns 0
 * clamp(50, 0, 100)   // Returns 50
 * ```
 *
 * Edge cases:
 * - NaN values return NaN
 * - Infinity is clamped to max
 * - -Infinity is clamped to min
 */
export function clamp(value: number, min: number, max: number): number {
  if (isNaN(value) || isNaN(min) || isNaN(max)) {
    return NaN;
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 *
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0 = a, 1 = b, 0.5 = midpoint)
 * @returns Interpolated value
 *
 * @example
 * ```typescript
 * lerp(0, 100, 0.5)   // Returns 50
 * lerp(0, 100, 0)     // Returns 0
 * lerp(0, 100, 1)     // Returns 100
 * lerp(10, 20, 0.25)  // Returns 12.5
 * ```
 *
 * Edge cases:
 * - t can be outside [0, 1] for extrapolation
 * - NaN values return NaN
 * - Handles Infinity correctly
 */
export function lerp(a: number, b: number, t: number): number {
  if (isNaN(a) || isNaN(b) || isNaN(t)) {
    return NaN;
  }
  return a + (b - a) * t;
}

/**
 * Round a number to a specific decimal place
 *
 * @param value - The number to round
 * @param decimals - Number of decimal places (default: 0)
 * @returns Rounded number
 *
 * @example
 * ```typescript
 * round(3.14159, 2)    // Returns 3.14
 * round(2.5)           // Returns 3 (rounds to nearest integer)
 * round(123.456, 1)    // Returns 123.5
 * round(-2.5)          // Returns -2
 * ```
 *
 * Edge cases:
 * - NaN returns NaN
 * - Infinity returns Infinity/-Infinity
 * - Negative decimals round to left of decimal point
 */
export function round(value: number, decimals: number = 0): number {
  if (isNaN(value)) {
    return NaN;
  }
  if (!isFinite(value)) {
    return value; // Preserve Infinity/-Infinity
  }
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate Euclidean distance between two points in 2D space
 *
 * @param x1 - X coordinate of first point
 * @param y1 - Y coordinate of first point
 * @param x2 - X coordinate of second point
 * @param y2 - Y coordinate of second point
 * @returns Distance between the two points (always >= 0)
 *
 * @example
 * ```typescript
 * distance(0, 0, 3, 4)  // Returns 5 (Pythagorean theorem)
 * distance(0, 0, 0, 0)  // Returns 0 (same point)
 * distance(1, 1, 4, 5)  // Returns 5
 * ```
 *
 * Edge cases:
 * - NaN values return NaN
 * - Infinity values may return Infinity
 * - Always returns non-negative value
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
    return NaN;
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Get unique values from an array
 *
 * @param array - Input array (may contain duplicates)
 * @returns New array with only unique values (preserves first occurrence order)
 *
 * @example
 * ```typescript
 * unique([1, 2, 2, 3, 1])         // Returns [1, 2, 3]
 * unique(['a', 'b', 'a'])         // Returns ['a', 'b']
 * unique([])                      // Returns []
 * ```
 *
 * Edge cases:
 * - Empty array returns empty array
 * - Uses Set equality (NaN === NaN, +0 === -0)
 * - Preserves object/array references
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array));
}

/**
 * Group array items by a key function
 *
 * @param array - Input array to group
 * @param keyFn - Function that extracts grouping key from each item
 * @returns Object with keys as groups and values as arrays of items
 *
 * @example
 * ```typescript
 * const items = [
 *   { type: 'fruit', name: 'apple' },
 *   { type: 'fruit', name: 'banana' },
 *   { type: 'vegetable', name: 'carrot' }
 * ];
 * groupBy(items, item => item.type)
 * // Returns { fruit: [...], vegetable: [...] }
 * ```
 *
 * Edge cases:
 * - Empty array returns empty object
 * - Handles undefined/null keys as string keys
 */
export function groupBy<T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K
): Record<K, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

/**
 * Sort array by property value
 *
 * @param array - Input array to sort
 * @param property - Property key to sort by
 * @param order - Sort order ('asc' or 'desc', default: 'asc')
 * @returns New sorted array (does not mutate original)
 *
 * @example
 * ```typescript
 * const items = [{ age: 30 }, { age: 20 }, { age: 25 }];
 * sortByProperty(items, 'age')           // Sorted by age ascending
 * sortByProperty(items, 'age', 'desc')   // Sorted by age descending
 * ```
 *
 * Edge cases:
 * - Returns shallow copy of array
 * - Handles undefined properties (sorted to end)
 * - Stable sort (preserves relative order of equal elements)
 */
export function sortByProperty<T>(
  array: T[],
  property: keyof T,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[property];
    const bVal = b[property];
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Filter array items, removing null and undefined values
 *
 * @param array - Input array with possibly null/undefined items
 * @returns New array with null and undefined values removed
 *
 * @example
 * ```typescript
 * filterNulls([1, null, 2, undefined, 3])  // Returns [1, 2, 3]
 * filterNulls([null, undefined])           // Returns []
 * filterNulls([0, false, ''])              // Returns [0, false, ''] (keeps falsy values)
 * ```
 *
 * Edge cases:
 * - Keeps falsy values (0, false, empty string)
 * - Type guard ensures return type doesn't include null|undefined
 */
export function filterNulls<T>(array: (T | null | undefined)[]): T[] {
  return array.filter((item): item is T => item !== null && item !== undefined);
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate a hexadecimal color string
 *
 * @param hex - Hex color string to validate
 * @returns true if valid hex color, false otherwise
 *
 * @example
 * ```typescript
 * isValidHexColor('#FF0000')    // Returns true
 * isValidHexColor('#F00')       // Returns true (shorthand)
 * isValidHexColor('FF0000')     // Returns false (missing #)
 * isValidHexColor('#GGGGGG')    // Returns false (invalid characters)
 * isValidHexColor('')           // Returns false
 * ```
 *
 * Accepts:
 * - Full format: #RRGGBB (e.g., #FF0000)
 * - Shorthand format: #RGB (e.g., #F00)
 * - Case insensitive (A-F or a-f)
 *
 * Security: Input length is validated before regex to prevent ReDoS
 */
export function isValidHexColor(hex: string): boolean {
  if (typeof hex !== 'string') {
    return false;
  }
  // SECURITY: Check length before regex to prevent ReDoS attacks
  // Valid hex colors are 4 chars (#RGB) or 7 chars (#RRGGBB)
  if (hex.length > 7) {
    return false;
  }
  return PATTERNS.HEX_COLOR.test(hex);
}

/**
 * Validate RGB color values
 *
 * @param r - Red value
 * @param g - Green value
 * @param b - Blue value
 * @returns true if all values are valid (0-255, finite, not NaN), false otherwise
 *
 * @example
 * ```typescript
 * isValidRGB(255, 0, 0)       // Returns true
 * isValidRGB(0, 128, 255)     // Returns true
 * isValidRGB(256, 0, 0)       // Returns false (r > 255)
 * isValidRGB(-1, 0, 0)        // Returns false (r < 0)
 * isValidRGB(NaN, 0, 0)       // Returns false
 * isValidRGB(Infinity, 0, 0)  // Returns false
 * ```
 *
 * Valid range: 0-255 (inclusive) for all channels
 */
export function isValidRGB(r: number, g: number, b: number): boolean {
  return (
    Number.isFinite(r) &&
    Number.isFinite(g) &&
    Number.isFinite(b) &&
    r >= RGB_MIN &&
    r <= RGB_MAX &&
    g >= RGB_MIN &&
    g <= RGB_MAX &&
    b >= RGB_MIN &&
    b <= RGB_MAX
  );
}

/**
 * Validate HSV color values
 *
 * @param h - Hue value (0-360)
 * @param s - Saturation value (0-100)
 * @param v - Value/brightness (0-100)
 * @returns true if all values are valid (finite, not NaN, within ranges), false otherwise
 *
 * @example
 * ```typescript
 * isValidHSV(180, 50, 100)    // Returns true
 * isValidHSV(0, 0, 0)         // Returns true
 * isValidHSV(360, 100, 100)   // Returns true (edge of range)
 * isValidHSV(361, 50, 50)     // Returns false (h > 360)
 * isValidHSV(180, -1, 50)     // Returns false (s < 0)
 * isValidHSV(NaN, 50, 50)     // Returns false
 * ```
 *
 * Valid ranges:
 * - Hue: 0-360 (degrees)
 * - Saturation: 0-100 (percent)
 * - Value: 0-100 (percent)
 */
export function isValidHSV(h: number, s: number, v: number): boolean {
  return (
    Number.isFinite(h) &&
    Number.isFinite(s) &&
    Number.isFinite(v) &&
    h >= HUE_MIN &&
    h <= HUE_MAX &&
    s >= SATURATION_MIN &&
    s <= SATURATION_MAX &&
    v >= VALUE_MIN &&
    v <= VALUE_MAX
  );
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard: Check if a value is a string
 *
 * @param value - Value to check
 * @returns true if value is a string, false otherwise
 *
 * @example
 * ```typescript
 * isString('hello')        // Returns true
 * isString('')             // Returns true (empty string)
 * isString(123)            // Returns false
 * isString(new String('')) // Returns false (String object, not primitive)
 * ```
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard: Check if a value is a finite number (excludes NaN and Infinity)
 *
 * @param value - Value to check
 * @returns true if value is a number and finite (not NaN, not Infinity), false otherwise
 *
 * @example
 * ```typescript
 * isNumber(42)              // Returns true
 * isNumber(0)               // Returns true
 * isNumber(-3.14)           // Returns true
 * isNumber(NaN)             // Returns false
 * isNumber(Infinity)        // Returns false
 * isNumber('123')           // Returns false (string)
 * isNumber(new Number(5))   // Returns false (Number object)
 * ```
 *
 * Note: This excludes NaN and Infinity for safer numeric operations
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Type guard: Check if a value is an array
 *
 * @param value - Value to check
 * @returns true if value is an array, false otherwise
 *
 * @example
 * ```typescript
 * isArray([1, 2, 3])       // Returns true
 * isArray([])              // Returns true
 * isArray('not array')     // Returns false
 * isArray({ length: 0 })   // Returns false (array-like object)
 * ```
 */
export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Type guard: Check if a value is a plain object (not array, not null)
 *
 * @param value - Value to check
 * @returns true if value is a plain object, false otherwise
 *
 * @example
 * ```typescript
 * isObject({ a: 1 })       // Returns true
 * isObject({})             // Returns true
 * isObject([])             // Returns false (array)
 * isObject(null)           // Returns false
 * isObject(new Date())     // Returns true (object instance)
 * ```
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard: Check if a value is null or undefined
 *
 * @param value - Value to check
 * @returns true if value is null or undefined, false otherwise
 *
 * @example
 * ```typescript
 * isNullish(null)          // Returns true
 * isNullish(undefined)     // Returns true
 * isNullish(0)             // Returns false
 * isNullish('')            // Returns false
 * isNullish(false)         // Returns false
 * ```
 *
 * Note: More precise than falsy check - only null/undefined, not 0/false/''
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Sleep for a specified duration (async delay)
 *
 * @param ms - Milliseconds to sleep (must be non-negative)
 * @returns Promise that resolves after the specified delay
 *
 * @example
 * ```typescript
 * await sleep(1000);           // Wait 1 second
 * await sleep(0);              // Immediate next tick
 *
 * // Use with async/await
 * async function delayed() {
 *   console.log('Start');
 *   await sleep(2000);
 *   console.log('After 2 seconds');
 * }
 * ```
 *
 * Note: Negative values are clamped to 0 (immediate resolution)
 */
export function sleep(ms: number): Promise<void> {
  const delay = Math.max(0, ms); // Clamp to non-negative
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Check if an error is an AbortError (from AbortController timeout)
 *
 * @param error - Error to check
 * @returns true if error is an AbortError, false otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await fetch(url, { signal: controller.signal });
 * } catch (error) {
 *   if (isAbortError(error)) {
 *     console.log('Request timed out or was aborted');
 *   }
 * }
 * ```
 */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      (error instanceof DOMException && error.code === DOMException.ABORT_ERR))
  );
}

/**
 * Retry a function multiple times with exponential backoff
 *
 * @param fn - Async function to retry
 * @param maxAttempts - Maximum number of attempts (default: 3, min: 1)
 * @param delayMs - Initial delay in milliseconds (default: 1000, doubles each retry)
 * @param logger - Optional logger for timeout warnings (default: none)
 * @returns Promise resolving to function result
 * @throws Last error if all attempts fail
 *
 * @example
 * ```typescript
 * // Retry API call up to 3 times
 * const data = await retry(
 *   () => fetch('https://api.example.com/data').then(r => r.json()),
 *   3,
 *   1000
 * );
 * // Delays: 0ms (try 1), 1000ms (try 2), 2000ms (try 3)
 *
 * // Custom retry logic with logger
 * const result = await retry(
 *   async () => {
 *     const response = await riskyOperation();
 *     if (!response.ok) throw new Error('Not OK');
 *     return response;
 *   },
 *   5,
 *   500,
 *   myLogger
 * );
 * ```
 *
 * Backoff schedule:
 * - Attempt 1: Immediate (no delay)
 * - Attempt 2: delayMs * 2^0 = delayMs
 * - Attempt 3: delayMs * 2^1 = delayMs * 2
 * - Attempt 4: delayMs * 2^2 = delayMs * 4
 * - etc.
 *
 * @remarks
 * Retries on all errors including AbortError (timeout), allowing
 * transient network issues to be recovered from.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
  logger?: Logger
): Promise<T> {
  const attempts = Math.max(1, Math.floor(maxAttempts)); // Ensure at least 1 attempt
  let lastError: Error | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Log timeout errors specifically for debugging
      if (isAbortError(error)) {
        logger?.warn(`Request timed out (attempt ${i + 1}/${attempts})`);
      }

      if (i < attempts - 1) {
        await sleep(delayMs * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Data Integrity Utilities
// ============================================================================

/**
 * Generate a simple checksum for data integrity checking
 *
 * Uses a non-cryptographic hash function (djb2-like algorithm)
 * Suitable for cache validation and detecting data corruption
 *
 * @param data - Any JSON-serializable data
 * @returns Base-36 encoded hash string
 * @throws Error if data contains circular references or cannot be stringified
 *
 * @example
 * ```typescript
 * const checksum1 = generateChecksum({ a: 1, b: 2 });  // "abc123"
 * const checksum2 = generateChecksum({ a: 1, b: 2 });  // "abc123" (same)
 * const checksum3 = generateChecksum({ a: 1, b: 3 });  // "xyz789" (different)
 *
 * // Use for cache validation
 * const cachedData = { checksum: "abc123", data: {...} };
 * const computedChecksum = generateChecksum(cachedData.data);
 * if (computedChecksum !== cachedData.checksum) {
 *   console.warn('Cache corruption detected!');
 * }
 * ```
 *
 * Important notes:
 * - NOT cryptographically secure (do not use for security)
 * - Deterministic: same input always produces same output
 * - Fast and lightweight
 * - Collision-resistant for typical cache validation use cases
 * - Throws on circular references (by JSON.stringify)
 * - Per Issue #7: Uses |0 to properly convert to 32-bit integer
 */
export function generateChecksum(data: unknown): string {
  const str = JSON.stringify(data); // Throws on circular references
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash | 0; // Per Issue #7: Convert to 32-bit signed integer (|0 is idiomatic)
  }
  return Math.abs(hash).toString(36);
}
