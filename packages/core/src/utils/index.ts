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
import type { Logger } from '@xivdyetools/logger/library';

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
   * Move an entry to the end of the Map (most recently used position).
   *
   * BUG-006: Extracted for clarity. In JavaScript's single-threaded event loop,
   * synchronous Map.delete() + Map.set() within a single microtask cannot be
   * interrupted — no interleaving is possible between the two operations.
   * This makes the pattern safe in synchronous contexts.
   */
  private moveToEnd(key: K, value: V): void {
    this.cache.delete(key);
    this.cache.set(key, value);
  }

  /**
   * Get a value from the cache
   *
   * @param key - The key to look up
   * @returns The cached value or undefined if not found
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.moveToEnd(key, value);
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

// ============================================================================
// Math Utilities
// ============================================================================

/**
 * @internal
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
 * @internal
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
 * @internal
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
 * @internal
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
 * @internal
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
  logger?: Logger,
  // OPT-014 (2026-07-18 audit): optional predicate so callers can skip
  // retrying deterministic failures (e.g. HTTP 4xx). Default preserves the
  // historical retry-everything behavior.
  shouldRetry: (error: unknown) => boolean = () => true,
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

      // OPT-014: deterministic failures fail fast instead of burning backoff
      if (!shouldRetry(error)) {
        throw lastError;
      }

      if (i < attempts - 1) {
        await sleep(delayMs * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  throw lastError ?? new Error('All retry attempts failed');
}

// ============================================================================
// Text Utilities
// ============================================================================

/**
 * Three-character axis code for a localized dye name (the bot's 14C triangle
 * and 13C·1 contrast plot).
 *
 * The order of operations is the whole point, and it is why this lives in
 * core rather than being re-derived per generator:
 *
 * 1. **Uppercase before slicing.** `'ß'.toUpperCase()` is `'SS'` — two
 *    characters — so slicing first and uppercasing after silently yields a
 *    four-character code for German names.
 * 2. **Strip punctuation.** `Ul'dahbrauner` must abbreviate to `ULD`, not
 *    `UL'` — an apostrophe carries no identifying signal in a 3-char code.
 * 3. **CJK keeps its first three characters** and is not uppercased: those
 *    scripts have no case, and each glyph already carries a full word's
 *    worth of meaning.
 *
 * A code is deliberately **not** globally unique — the nine Metallics all
 * abbreviate to `MET`, the Dark run to `DAR`, and every German
 * `Schnee-`/`Schiefer-` name collides on `SCH`. That is accepted because a
 * code never appears alone: the swatch pair sits on the same row, so colour
 * disambiguates the letters and the letters disambiguate the colour.
 *
 * @param name - The dye name, already localized
 * @param locale - Locale code; `ja`/`zh`/`ko` take the CJK path
 * @returns A code of at most three characters
 *
 * @example
 * ```typescript
 * abbreviateDyeName("Ul'dahbrauner", 'de')   // 'ULD'
 * abbreviateDyeName('Rußschwarzer', 'de')    // 'RUS'  (ß → SS, then sliced)
 * abbreviateDyeName('Metallic Gold', 'en')   // 'MET'
 * abbreviateDyeName('ダラガブレッド', 'ja')      // 'ダラガ'
 * ```
 */
export function abbreviateDyeName(name: string, locale: string): string {
  if (locale === 'ja' || locale === 'zh' || locale === 'ko') return name.slice(0, 3);
  return name
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 3);
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
