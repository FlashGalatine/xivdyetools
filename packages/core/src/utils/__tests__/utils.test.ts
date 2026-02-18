/**
 * Utils tests
 *
 * Comprehensive tests for all utility functions in utils/index.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  clamp,
  lerp,
  round,
  distance,
  unique,
  groupBy,
  sortByProperty,
  filterNulls,
  isValidHexColor,
  isValidRGB,
  isValidHSV,
  isString,
  isNumber,
  isArray,
  isObject,
  isNullish,
  sleep,
  retry,
  generateChecksum,
  LRUCache,
  AsyncLRUCache,
} from '../index.js';

describe('Utils', () => {
  // ============================================================================
  // Math Utilities
  // ============================================================================

  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(50, 0, 100)).toBe(50);
    });

    it('should clamp to min when value is below', () => {
      expect(clamp(-10, 0, 100)).toBe(0);
    });

    it('should clamp to max when value is above', () => {
      expect(clamp(150, 0, 100)).toBe(100);
    });

    it('should handle edge cases at boundaries', () => {
      expect(clamp(0, 0, 100)).toBe(0);
      expect(clamp(100, 0, 100)).toBe(100);
    });

    it('should return NaN for NaN input', () => {
      expect(clamp(NaN, 0, 100)).toBeNaN();
    });

    it('should return NaN for NaN min', () => {
      expect(clamp(50, NaN, 100)).toBeNaN();
    });

    it('should return NaN for NaN max', () => {
      expect(clamp(50, 0, NaN)).toBeNaN();
    });

    it('should clamp Infinity to max', () => {
      expect(clamp(Infinity, 0, 100)).toBe(100);
    });

    it('should clamp -Infinity to min', () => {
      expect(clamp(-Infinity, 0, 100)).toBe(0);
    });
  });

  describe('lerp', () => {
    it('should interpolate at 0', () => {
      expect(lerp(0, 100, 0)).toBe(0);
    });

    it('should interpolate at 1', () => {
      expect(lerp(0, 100, 1)).toBe(100);
    });

    it('should interpolate at 0.5', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
    });

    it('should interpolate at 0.25', () => {
      expect(lerp(10, 20, 0.25)).toBe(12.5);
    });

    it('should extrapolate when t > 1', () => {
      expect(lerp(0, 100, 2)).toBe(200);
    });

    it('should extrapolate when t < 0', () => {
      expect(lerp(0, 100, -1)).toBe(-100);
    });

    it('should return NaN for NaN a', () => {
      expect(lerp(NaN, 100, 0.5)).toBeNaN();
    });

    it('should return NaN for NaN b', () => {
      expect(lerp(0, NaN, 0.5)).toBeNaN();
    });

    it('should return NaN for NaN t', () => {
      expect(lerp(0, 100, NaN)).toBeNaN();
    });
  });

  describe('round', () => {
    it('should round to integer by default', () => {
      expect(round(3.7)).toBe(4);
      expect(round(3.2)).toBe(3);
    });

    it('should round to 2 decimal places', () => {
      expect(round(3.14159, 2)).toBe(3.14);
    });

    it('should round to 1 decimal place', () => {
      expect(round(123.456, 1)).toBe(123.5);
    });

    it('should handle negative numbers', () => {
      expect(round(-2.5)).toBe(-2);
      expect(round(-2.6)).toBe(-3);
    });

    it('should return NaN for NaN', () => {
      expect(round(NaN)).toBeNaN();
    });

    it('should preserve Infinity', () => {
      expect(round(Infinity)).toBe(Infinity);
      expect(round(-Infinity)).toBe(-Infinity);
    });

    it('should handle negative decimals', () => {
      expect(round(12345, -2)).toBe(12300);
    });
  });

  describe('distance', () => {
    it('should calculate distance between two points', () => {
      expect(distance(0, 0, 3, 4)).toBe(5);
    });

    it('should return 0 for same point', () => {
      expect(distance(5, 5, 5, 5)).toBe(0);
    });

    it('should calculate diagonal distance', () => {
      expect(distance(1, 1, 4, 5)).toBe(5);
    });

    it('should return NaN for NaN x1', () => {
      expect(distance(NaN, 0, 3, 4)).toBeNaN();
    });

    it('should return NaN for NaN y1', () => {
      expect(distance(0, NaN, 3, 4)).toBeNaN();
    });

    it('should return NaN for NaN x2', () => {
      expect(distance(0, 0, NaN, 4)).toBeNaN();
    });

    it('should return NaN for NaN y2', () => {
      expect(distance(0, 0, 3, NaN)).toBeNaN();
    });

    it('should handle negative coordinates', () => {
      expect(distance(-1, -1, 2, 3)).toBe(5);
    });
  });

  // ============================================================================
  // Array Utilities
  // ============================================================================

  describe('unique', () => {
    it('should return unique values', () => {
      expect(unique([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
    });

    it('should work with strings', () => {
      expect(unique(['a', 'b', 'a'])).toEqual(['a', 'b']);
    });

    it('should return empty array for empty input', () => {
      expect(unique([])).toEqual([]);
    });

    it('should handle single element', () => {
      expect(unique([1])).toEqual([1]);
    });

    it('should preserve order of first occurrences', () => {
      expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
    });
  });

  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { type: 'fruit', name: 'apple' },
        { type: 'fruit', name: 'banana' },
        { type: 'vegetable', name: 'carrot' },
      ];
      const grouped = groupBy(items, (item) => item.type);
      expect(grouped.fruit).toHaveLength(2);
      expect(grouped.vegetable).toHaveLength(1);
    });

    it('should return empty object for empty array', () => {
      const grouped = groupBy([], (item: { type: string }) => item.type);
      expect(grouped).toEqual({});
    });

    it('should group by numeric key', () => {
      const items = [
        { score: 1, name: 'a' },
        { score: 2, name: 'b' },
        { score: 1, name: 'c' },
      ];
      const grouped = groupBy(items, (item) => item.score);
      expect(grouped[1]).toHaveLength(2);
      expect(grouped[2]).toHaveLength(1);
    });
  });

  describe('sortByProperty', () => {
    it('should sort ascending by default', () => {
      const items = [{ age: 30 }, { age: 20 }, { age: 25 }];
      const sorted = sortByProperty(items, 'age');
      expect(sorted[0].age).toBe(20);
      expect(sorted[2].age).toBe(30);
    });

    it('should sort descending', () => {
      const items = [{ age: 30 }, { age: 20 }, { age: 25 }];
      const sorted = sortByProperty(items, 'age', 'desc');
      expect(sorted[0].age).toBe(30);
      expect(sorted[2].age).toBe(20);
    });

    it('should not mutate original array', () => {
      const items = [{ age: 30 }, { age: 20 }];
      const sorted = sortByProperty(items, 'age');
      expect(items[0].age).toBe(30); // Original unchanged
      expect(sorted[0].age).toBe(20);
    });

    it('should handle equal values (stable)', () => {
      const items = [
        { age: 20, name: 'a' },
        { age: 20, name: 'b' },
      ];
      const sorted = sortByProperty(items, 'age');
      expect(sorted).toHaveLength(2);
    });

    it('should sort strings', () => {
      const items = [{ name: 'charlie' }, { name: 'alpha' }, { name: 'bravo' }];
      const sorted = sortByProperty(items, 'name');
      expect(sorted[0].name).toBe('alpha');
    });
  });

  describe('filterNulls', () => {
    it('should remove null values', () => {
      expect(filterNulls([1, null, 2])).toEqual([1, 2]);
    });

    it('should remove undefined values', () => {
      expect(filterNulls([1, undefined, 2])).toEqual([1, 2]);
    });

    it('should remove both null and undefined', () => {
      expect(filterNulls([1, null, 2, undefined, 3])).toEqual([1, 2, 3]);
    });

    it('should keep falsy values (0, false, empty string)', () => {
      expect(filterNulls([0, false, ''])).toEqual([0, false, '']);
    });

    it('should return empty array for all null/undefined', () => {
      expect(filterNulls([null, undefined])).toEqual([]);
    });
  });

  // ============================================================================
  // Validation Utilities
  // ============================================================================

  describe('isValidHexColor', () => {
    it('should accept valid 6-digit hex', () => {
      expect(isValidHexColor('#FF0000')).toBe(true);
      expect(isValidHexColor('#00ff00')).toBe(true);
    });

    it('should accept valid 3-digit hex', () => {
      expect(isValidHexColor('#F00')).toBe(true);
      expect(isValidHexColor('#abc')).toBe(true);
    });

    it('should reject without hash', () => {
      expect(isValidHexColor('FF0000')).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(isValidHexColor('#GGGGGG')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidHexColor('')).toBe(false);
    });

    it('should reject non-string', () => {
      expect(isValidHexColor(123 as unknown as string)).toBe(false);
    });

    it('should reject wrong length', () => {
      expect(isValidHexColor('#FF00')).toBe(false);
      expect(isValidHexColor('#FF00000')).toBe(false);
    });
  });

  describe('isValidRGB', () => {
    it('should accept valid RGB values', () => {
      expect(isValidRGB(255, 0, 0)).toBe(true);
      expect(isValidRGB(0, 128, 255)).toBe(true);
    });

    it('should accept edge values', () => {
      expect(isValidRGB(0, 0, 0)).toBe(true);
      expect(isValidRGB(255, 255, 255)).toBe(true);
    });

    it('should reject values above 255', () => {
      expect(isValidRGB(256, 0, 0)).toBe(false);
    });

    it('should reject negative values', () => {
      expect(isValidRGB(-1, 0, 0)).toBe(false);
    });

    it('should reject NaN', () => {
      expect(isValidRGB(NaN, 0, 0)).toBe(false);
    });

    it('should reject Infinity', () => {
      expect(isValidRGB(Infinity, 0, 0)).toBe(false);
    });
  });

  describe('isValidHSV', () => {
    it('should accept valid HSV values', () => {
      expect(isValidHSV(180, 50, 100)).toBe(true);
      expect(isValidHSV(0, 0, 0)).toBe(true);
    });

    it('should accept edge values', () => {
      expect(isValidHSV(360, 100, 100)).toBe(true);
    });

    it('should reject hue above 360', () => {
      expect(isValidHSV(361, 50, 50)).toBe(false);
    });

    it('should reject saturation above 100', () => {
      expect(isValidHSV(180, 101, 50)).toBe(false);
    });

    it('should reject value above 100', () => {
      expect(isValidHSV(180, 50, 101)).toBe(false);
    });

    it('should reject negative values', () => {
      expect(isValidHSV(-1, 50, 50)).toBe(false);
      expect(isValidHSV(180, -1, 50)).toBe(false);
      expect(isValidHSV(180, 50, -1)).toBe(false);
    });

    it('should reject NaN', () => {
      expect(isValidHSV(NaN, 50, 50)).toBe(false);
    });
  });

  // ============================================================================
  // Type Guards
  // ============================================================================

  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('hello')).toBe(true);
      expect(isString('')).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
    });

    it('should return false for String object', () => {
      // eslint-disable-next-line no-new-wrappers
      expect(isString(new String(''))).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should return true for finite numbers', () => {
      expect(isNumber(42)).toBe(true);
      expect(isNumber(0)).toBe(true);
      expect(isNumber(-3.14)).toBe(true);
    });

    it('should return false for NaN', () => {
      expect(isNumber(NaN)).toBe(false);
    });

    it('should return false for Infinity', () => {
      expect(isNumber(Infinity)).toBe(false);
      expect(isNumber(-Infinity)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isNumber('123')).toBe(false);
      expect(isNumber(null)).toBe(false);
    });
  });

  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray([])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray('not array')).toBe(false);
      expect(isArray({ length: 0 })).toBe(false);
      expect(isArray(null)).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(isObject({ a: 1 })).toBe(true);
      expect(isObject({})).toBe(true);
    });

    it('should return false for arrays', () => {
      expect(isObject([])).toBe(false);
    });

    it('should return false for null', () => {
      expect(isObject(null)).toBe(false);
    });

    it('should return true for object instances', () => {
      expect(isObject(new Date())).toBe(true);
    });

    it('should return false for primitives', () => {
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
    });
  });

  describe('isNullish', () => {
    it('should return true for null', () => {
      expect(isNullish(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isNullish(undefined)).toBe(true);
    });

    it('should return false for 0', () => {
      expect(isNullish(0)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isNullish('')).toBe(false);
    });

    it('should return false for false', () => {
      expect(isNullish(false)).toBe(false);
    });
  });

  // ============================================================================
  // Async Utilities
  // ============================================================================

  describe('sleep', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve after delay', async () => {
      vi.useFakeTimers();
      const promise = sleep(100);
      vi.advanceTimersByTime(100);
      await promise;
    });

    it('should clamp negative values to 0', async () => {
      vi.useFakeTimers();
      const promise = sleep(-100);
      vi.advanceTimersByTime(0);
      await promise;
    });

    it('should handle 0 delay', async () => {
      vi.useFakeTimers();
      const promise = sleep(0);
      vi.advanceTimersByTime(0);
      await promise;
    });
  });

  describe('retry', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn, 3, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail 1')).mockResolvedValue('success');

      vi.useFakeTimers();
      const promise = retry(fn, 3, 10);
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));

      // Use real timers with short delay to avoid unhandled rejection issues
      await expect(retry(fn, 2, 1)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use default values', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn);
      expect(result).toBe('success');
    });

    it('should ensure at least 1 attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retry(fn, 0, 10);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should convert non-Error to Error', async () => {
      const fn = vi.fn().mockRejectedValueOnce('string error').mockResolvedValue('success');

      vi.useFakeTimers();
      const promise = retry(fn, 3, 10);
      await vi.advanceTimersByTimeAsync(10);
      const result = await promise;

      expect(result).toBe('success');
    });

    it('should apply exponential backoff', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      vi.useFakeTimers();
      const promise = retry(fn, 4, 100);

      // First attempt: immediate
      expect(fn).toHaveBeenCalledTimes(1);

      // Second attempt: after 100ms (100 * 2^0)
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);

      // Third attempt: after 200ms (100 * 2^1)
      await vi.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  // ============================================================================
  // Data Integrity
  // ============================================================================

  describe('generateChecksum', () => {
    it('should generate deterministic checksum', () => {
      const data = { a: 1, b: 2 };
      const checksum1 = generateChecksum(data);
      const checksum2 = generateChecksum(data);
      expect(checksum1).toBe(checksum2);
    });

    it('should generate different checksum for different data', () => {
      const checksum1 = generateChecksum({ a: 1 });
      const checksum2 = generateChecksum({ a: 2 });
      expect(checksum1).not.toBe(checksum2);
    });

    it('should work with strings', () => {
      const checksum = generateChecksum('hello');
      expect(typeof checksum).toBe('string');
    });

    it('should work with arrays', () => {
      const checksum = generateChecksum([1, 2, 3]);
      expect(typeof checksum).toBe('string');
    });

    it('should work with nested objects', () => {
      const checksum = generateChecksum({ a: { b: { c: 1 } } });
      expect(typeof checksum).toBe('string');
    });

    it('should throw on circular references', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      expect(() => generateChecksum(obj)).toThrow();
    });
  });

  // ============================================================================
  // LRUCache Tests
  // ============================================================================

  describe('LRUCache', () => {
    it('should store and retrieve values', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
    });

    it('should return undefined for missing keys', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should evict least recently used when full', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // Should evict 'a'
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });

    it('should update LRU order on get', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a'); // Touch 'a', making 'b' the LRU
      cache.set('c', 3); // Should evict 'b'
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });

    it('should update LRU order on set of existing key', () => {
      const cache = new LRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('a', 10); // Update 'a', making 'b' the LRU
      cache.set('c', 3); // Should evict 'b'
      expect(cache.get('a')).toBe(10);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });

    it('should track size correctly', () => {
      const cache = new LRUCache<string, number>(3);
      expect(cache.size).toBe(0);
      cache.set('a', 1);
      expect(cache.size).toBe(1);
      cache.set('b', 2);
      expect(cache.size).toBe(2);
      cache.set('a', 10); // Update, not new
      expect(cache.size).toBe(2);
    });

    it('should clear all entries', () => {
      const cache = new LRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });

    it('should use default maxSize of 1000', () => {
      const cache = new LRUCache<number, number>();
      // Fill beyond default size
      for (let i = 0; i < 1005; i++) {
        cache.set(i, i);
      }
      expect(cache.size).toBe(1000);
      // First 5 should be evicted
      expect(cache.get(0)).toBeUndefined();
      expect(cache.get(4)).toBeUndefined();
      expect(cache.get(5)).toBe(5);
    });
  });

  // ============================================================================
  // AsyncLRUCache Tests
  // ============================================================================

  describe('AsyncLRUCache', () => {
    it('should store and retrieve values', () => {
      const cache = new AsyncLRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
    });

    it('should return undefined for missing keys', () => {
      const cache = new AsyncLRUCache<string, number>(3);
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should evict least recently used when full', () => {
      const cache = new AsyncLRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3); // Should evict 'a'
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });

    it('should update LRU order on get', () => {
      const cache = new AsyncLRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a'); // Touch 'a', making 'b' the LRU
      cache.set('c', 3); // Should evict 'b'
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });

    it('should update LRU order on set of existing key', () => {
      const cache = new AsyncLRUCache<string, number>(2);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('a', 10); // Update 'a', making 'b' the LRU
      cache.set('c', 3); // Should evict 'b'
      expect(cache.get('a')).toBe(10);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
    });

    it('should track size and pendingSize correctly', () => {
      const cache = new AsyncLRUCache<string, number>(3);
      expect(cache.size).toBe(0);
      expect(cache.pendingSize).toBe(0);
      cache.set('a', 1);
      expect(cache.size).toBe(1);
    });

    it('should clear cache and pending operations', () => {
      const cache = new AsyncLRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.pendingSize).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });

    it('should use default maxSize of 1000', () => {
      const cache = new AsyncLRUCache<number, number>();
      // Fill beyond default size
      for (let i = 0; i < 1005; i++) {
        cache.set(i, i);
      }
      expect(cache.size).toBe(1000);
    });

    describe('getOrCompute', () => {
      it('should compute and cache value for missing key', async () => {
        const cache = new AsyncLRUCache<string, number>(3);
        const compute = vi.fn().mockResolvedValue(42);
        const result = await cache.getOrCompute('a', compute);
        expect(result).toBe(42);
        expect(compute).toHaveBeenCalledTimes(1);
        expect(cache.get('a')).toBe(42);
      });

      it('should return cached value without computing', async () => {
        const cache = new AsyncLRUCache<string, number>(3);
        cache.set('a', 1);
        const compute = vi.fn().mockResolvedValue(99);
        const result = await cache.getOrCompute('a', compute);
        expect(result).toBe(1);
        expect(compute).not.toHaveBeenCalled();
      });

      it('should deduplicate concurrent requests for same key', async () => {
        const cache = new AsyncLRUCache<string, number>(3);
        let resolveCompute: (value: number) => void;
        const compute = vi.fn().mockImplementation(
          () =>
            new Promise<number>((resolve) => {
              resolveCompute = resolve;
            })
        );

        // Start two concurrent requests
        const promise1 = cache.getOrCompute('a', compute);
        const promise2 = cache.getOrCompute('a', compute);

        expect(cache.pendingSize).toBe(1);
        expect(compute).toHaveBeenCalledTimes(1);

        // Resolve the computation
        resolveCompute!(42);

        const [result1, result2] = await Promise.all([promise1, promise2]);
        expect(result1).toBe(42);
        expect(result2).toBe(42);
        expect(cache.pendingSize).toBe(0);
        expect(cache.get('a')).toBe(42);
      });

      it('should handle computation errors without caching', async () => {
        const cache = new AsyncLRUCache<string, number>(3);
        const error = new Error('Computation failed');
        const compute = vi.fn().mockRejectedValue(error);

        await expect(cache.getOrCompute('a', compute)).rejects.toThrow('Computation failed');
        expect(cache.get('a')).toBeUndefined();
        expect(cache.pendingSize).toBe(0);
      });

      it('should update LRU order on cache hit', async () => {
        const cache = new AsyncLRUCache<string, number>(2);
        cache.set('a', 1);
        cache.set('b', 2);
        // Access 'a' via getOrCompute to make 'b' the LRU
        await cache.getOrCompute('a', async () => 99);
        cache.set('c', 3); // Should evict 'b'
        expect(cache.get('a')).toBe(1);
        expect(cache.get('b')).toBeUndefined();
        expect(cache.get('c')).toBe(3);
      });
    });
  });
});
