/**
 * Tests for Timing-Safe Comparison Utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { timingSafeEqual, timingSafeEqualBytes } from './timing.js';

describe('timing.ts', () => {
  describe('timingSafeEqual', () => {
    it('should return true for equal strings', async () => {
      const result = await timingSafeEqual('hello', 'hello');
      expect(result).toBe(true);
    });

    it('should return false for different strings', async () => {
      const result = await timingSafeEqual('hello', 'world');
      expect(result).toBe(false);
    });

    it('should return false for strings of different lengths', async () => {
      const result = await timingSafeEqual('short', 'much longer string');
      expect(result).toBe(false);
    });

    it('should return true for empty strings', async () => {
      const result = await timingSafeEqual('', '');
      expect(result).toBe(true);
    });

    it('should return false when one string is empty', async () => {
      const result = await timingSafeEqual('hello', '');
      expect(result).toBe(false);
    });

    it('should handle unicode strings', async () => {
      const result = await timingSafeEqual('こんにちは', 'こんにちは');
      expect(result).toBe(true);
    });

    it('should correctly compare similar strings', async () => {
      // These strings differ only in the last character
      const result = await timingSafeEqual('password1', 'password2');
      expect(result).toBe(false);
    });

    it('should correctly compare strings that differ only in first character', async () => {
      const result = await timingSafeEqual('apassword', 'bpassword');
      expect(result).toBe(false);
    });

    describe('fallback implementation', () => {
      beforeEach(() => {
        // Make timingSafeEqual throw to test fallback
        vi.stubGlobal('crypto', {
          ...crypto,
          subtle: {
            ...crypto.subtle,
            timingSafeEqual: () => {
              throw new Error('Not available');
            },
          },
        });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('should use fallback when crypto.subtle.timingSafeEqual throws', async () => {
        const result = await timingSafeEqual('hello', 'hello');
        expect(result).toBe(true);
      });

      it('should correctly compare different strings in fallback', async () => {
        const result = await timingSafeEqual('hello', 'world');
        expect(result).toBe(false);
      });

      it('should handle different lengths in fallback', async () => {
        const result = await timingSafeEqual('short', 'longer');
        expect(result).toBe(false);
      });
    });
  });

  describe('timingSafeEqualBytes', () => {
    it('should return true for equal byte arrays', async () => {
      const a = new Uint8Array([1, 2, 3, 4, 5]);
      const b = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await timingSafeEqualBytes(a, b);
      expect(result).toBe(true);
    });

    it('should return false for different byte arrays', async () => {
      const a = new Uint8Array([1, 2, 3, 4, 5]);
      const b = new Uint8Array([1, 2, 3, 4, 6]);
      const result = await timingSafeEqualBytes(a, b);
      expect(result).toBe(false);
    });

    it('should return false for arrays of different lengths', async () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await timingSafeEqualBytes(a, b);
      expect(result).toBe(false);
    });

    it('should return true for empty arrays', async () => {
      const a = new Uint8Array([]);
      const b = new Uint8Array([]);
      const result = await timingSafeEqualBytes(a, b);
      expect(result).toBe(true);
    });
  });
});
