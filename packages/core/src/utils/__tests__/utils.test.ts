/**
 * Utils tests
 *
 * Comprehensive tests for all utility functions in utils/index.ts
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  clamp,
  round,
  isValidHexColor,
  isValidRGB,
  isValidHSV,
  sleep,
  retry,
  isAbortError,
  generateChecksum,
  abbreviateDyeName,
  LRUCache,
} from '../index.js';

describe('Utils', () => {
  // ============================================================================
  // Text Utilities
  // ============================================================================

  describe('abbreviateDyeName', () => {
    it('strips punctuation rather than spending a slot on it', () => {
      // Ul'dahbrauner must not become UL'
      expect(abbreviateDyeName("Ul'dahbrauner", 'de')).toBe('ULD');
    });

    it('uppercases BEFORE slicing, so eszett does not overflow the code', () => {
      // 'ss'.toUpperCase() is two characters; slicing first would give RUSS
      expect(abbreviateDyeName('Rußschwarzer', 'de')).toBe('RUS');
      expect(abbreviateDyeName('Rußschwarzer', 'de')).toHaveLength(3);
    });

    it('collides by design on shared prefixes', () => {
      // Accepted: the swatch pair on the same row disambiguates the code
      expect(abbreviateDyeName('Metallic Gold', 'en')).toBe('MET');
      expect(abbreviateDyeName('Metallic Cobalt Green', 'en')).toBe('MET');
    });

    it('takes the first three characters for CJK, uncased', () => {
      // Dalamud Red / Soot Black / Soot Black — read from core's locale data,
      // never hand-written (an invented name eventually gets reasoned from)
      expect(abbreviateDyeName('ダラガブレッド', 'ja')).toBe('ダラガ');
      expect(abbreviateDyeName('숯검정색', 'ko')).toBe('숯검정');
      expect(abbreviateDyeName('煤烟黑', 'zh')).toBe('煤烟黑');
    });

    it('never exceeds three characters, whatever the input', () => {
      for (const name of ['Snow White', "Ul'dahbrauner", 'Rußschwarzer', 'A', '']) {
        expect(abbreviateDyeName(name, 'en').length).toBeLessThanOrEqual(3);
      }
    });

    it('returns an empty code for a name with no letters or digits', () => {
      expect(abbreviateDyeName('---', 'en')).toBe('');
    });
  });

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
  // Abort Error Detection
  // ============================================================================

  describe('isAbortError', () => {
    it('should return true for AbortError', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      expect(isAbortError(error)).toBe(true);
    });

    it('should return true for TimeoutError', () => {
      const error = new Error('timed out');
      error.name = 'TimeoutError';
      expect(isAbortError(error)).toBe(true);
    });

    it('should return true for DOMException with ABORT_ERR code', () => {
      const error = new DOMException('The operation was aborted', 'AbortError');
      expect(isAbortError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      expect(isAbortError(new Error('something went wrong'))).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isAbortError('AbortError')).toBe(false);
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError(undefined)).toBe(false);
      expect(isAbortError(42)).toBe(false);
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
});
