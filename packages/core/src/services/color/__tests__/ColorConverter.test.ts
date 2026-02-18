/**
 * ColorConverter Comprehensive Tests
 * Phase 3.1: Target 60-80 tests covering all conversion methods, caching, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ColorConverter } from '../ColorConverter.js';
import { AppError } from '../../../types/index.js';

describe('ColorConverter', () => {
  // ============================================================================
  // Instance-based API Tests
  // ============================================================================

  describe('Instance API', () => {
    let converter: ColorConverter;

    beforeEach(() => {
      converter = new ColorConverter();
    });

    afterEach(() => {
      converter.clearCaches();
    });

    describe('constructor', () => {
      it('should create instance with default cache size', () => {
        const instance = new ColorConverter();
        expect(instance).toBeInstanceOf(ColorConverter);
        const stats = instance.getCacheStats();
        expect(stats.hexToRgb).toBe(0);
      });

      it('should create instance with custom cache size', () => {
        const instance = new ColorConverter({ cacheSize: 100 });
        expect(instance).toBeInstanceOf(ColorConverter);
      });

      it('should handle zero cache size', () => {
        const instance = new ColorConverter({ cacheSize: 0 });
        expect(instance).toBeInstanceOf(ColorConverter);
      });
    });

    // ==========================================================================
    // hexToRgb Tests
    // ==========================================================================

    describe('hexToRgb', () => {
      describe('valid conversions', () => {
        it('should convert #FF0000 to red RGB', () => {
          const result = converter.hexToRgb('#FF0000');
          expect(result).toEqual({ r: 255, g: 0, b: 0 });
        });

        it('should convert #00FF00 to green RGB', () => {
          const result = converter.hexToRgb('#00FF00');
          expect(result).toEqual({ r: 0, g: 255, b: 0 });
        });

        it('should convert #0000FF to blue RGB', () => {
          const result = converter.hexToRgb('#0000FF');
          expect(result).toEqual({ r: 0, g: 0, b: 255 });
        });

        it('should convert #000000 to black RGB', () => {
          const result = converter.hexToRgb('#000000');
          expect(result).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('should convert #FFFFFF to white RGB', () => {
          const result = converter.hexToRgb('#FFFFFF');
          expect(result).toEqual({ r: 255, g: 255, b: 255 });
        });

        it('should convert #808080 to gray RGB', () => {
          const result = converter.hexToRgb('#808080');
          expect(result).toEqual({ r: 128, g: 128, b: 128 });
        });

        it('should convert mixed color #AB12CD correctly', () => {
          const result = converter.hexToRgb('#AB12CD');
          expect(result).toEqual({ r: 171, g: 18, b: 205 });
        });
      });

      describe('shorthand format (#RGB)', () => {
        it('should expand #F00 to full red', () => {
          const result = converter.hexToRgb('#F00');
          expect(result).toEqual({ r: 255, g: 0, b: 0 });
        });

        it('should expand #0F0 to full green', () => {
          const result = converter.hexToRgb('#0F0');
          expect(result).toEqual({ r: 0, g: 255, b: 0 });
        });

        it('should expand #00F to full blue', () => {
          const result = converter.hexToRgb('#00F');
          expect(result).toEqual({ r: 0, g: 0, b: 255 });
        });

        it('should expand #FFF to white', () => {
          const result = converter.hexToRgb('#FFF');
          expect(result).toEqual({ r: 255, g: 255, b: 255 });
        });

        it('should expand #000 to black', () => {
          const result = converter.hexToRgb('#000');
          expect(result).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('should expand #ABC correctly', () => {
          const result = converter.hexToRgb('#ABC');
          expect(result).toEqual({ r: 170, g: 187, b: 204 });
        });
      });

      describe('case insensitivity', () => {
        it('should handle lowercase hex', () => {
          const result = converter.hexToRgb('#ff0000');
          expect(result).toEqual({ r: 255, g: 0, b: 0 });
        });

        it('should handle mixed case hex', () => {
          const result = converter.hexToRgb('#fF00Ff');
          expect(result).toEqual({ r: 255, g: 0, b: 255 });
        });

        it('should handle lowercase shorthand', () => {
          const result = converter.hexToRgb('#abc');
          expect(result).toEqual({ r: 170, g: 187, b: 204 });
        });
      });

      describe('error handling', () => {
        it('should throw AppError for hex without #', () => {
          expect(() => converter.hexToRgb('FF0000')).toThrow(AppError);
        });

        it('should throw AppError for invalid characters', () => {
          expect(() => converter.hexToRgb('#GGGGGG')).toThrow(AppError);
        });

        it('should throw AppError for too short hex', () => {
          expect(() => converter.hexToRgb('#FF')).toThrow(AppError);
        });

        it('should throw AppError for too long hex', () => {
          expect(() => converter.hexToRgb('#FF00000')).toThrow(AppError);
        });

        it('should throw AppError for empty string', () => {
          expect(() => converter.hexToRgb('')).toThrow(AppError);
        });

        it('should include helpful message in error', () => {
          try {
            converter.hexToRgb('invalid');
          } catch (e) {
            expect(e).toBeInstanceOf(AppError);
            expect((e as AppError).message).toContain('Invalid hex color');
          }
        });
      });
    });

    // ==========================================================================
    // rgbToHex Tests
    // ==========================================================================

    describe('rgbToHex', () => {
      describe('valid conversions', () => {
        it('should convert red RGB to #FF0000', () => {
          const result = converter.rgbToHex(255, 0, 0);
          expect(result).toBe('#FF0000');
        });

        it('should convert green RGB to #00FF00', () => {
          const result = converter.rgbToHex(0, 255, 0);
          expect(result).toBe('#00FF00');
        });

        it('should convert blue RGB to #0000FF', () => {
          const result = converter.rgbToHex(0, 0, 255);
          expect(result).toBe('#0000FF');
        });

        it('should convert black RGB to #000000', () => {
          const result = converter.rgbToHex(0, 0, 0);
          expect(result).toBe('#000000');
        });

        it('should convert white RGB to #FFFFFF', () => {
          const result = converter.rgbToHex(255, 255, 255);
          expect(result).toBe('#FFFFFF');
        });

        it('should handle single digit values with padding', () => {
          const result = converter.rgbToHex(1, 2, 3);
          expect(result).toBe('#010203');
        });

        it('should convert mid-range values correctly', () => {
          const result = converter.rgbToHex(128, 64, 192);
          expect(result).toBe('#8040C0');
        });
      });

      describe('error handling', () => {
        it('should throw AppError for negative r value', () => {
          expect(() => converter.rgbToHex(-1, 0, 0)).toThrow(AppError);
        });

        it('should throw AppError for negative g value', () => {
          expect(() => converter.rgbToHex(0, -1, 0)).toThrow(AppError);
        });

        it('should throw AppError for negative b value', () => {
          expect(() => converter.rgbToHex(0, 0, -1)).toThrow(AppError);
        });

        it('should throw AppError for r > 255', () => {
          expect(() => converter.rgbToHex(256, 0, 0)).toThrow(AppError);
        });

        it('should throw AppError for g > 255', () => {
          expect(() => converter.rgbToHex(0, 256, 0)).toThrow(AppError);
        });

        it('should throw AppError for b > 255', () => {
          expect(() => converter.rgbToHex(0, 0, 256)).toThrow(AppError);
        });

        it('should throw AppError for NaN values', () => {
          expect(() => converter.rgbToHex(NaN, 0, 0)).toThrow(AppError);
        });

        it('should throw AppError for Infinity values', () => {
          expect(() => converter.rgbToHex(Infinity, 0, 0)).toThrow(AppError);
        });
      });
    });

    // ==========================================================================
    // rgbToHsv Tests
    // ==========================================================================

    describe('rgbToHsv', () => {
      describe('valid conversions', () => {
        it('should convert red to HSV (0, 100, 100)', () => {
          const result = converter.rgbToHsv(255, 0, 0);
          expect(result.h).toBeCloseTo(0, 1);
          expect(result.s).toBeCloseTo(100, 1);
          expect(result.v).toBeCloseTo(100, 1);
        });

        it('should convert green to HSV (120, 100, 100)', () => {
          const result = converter.rgbToHsv(0, 255, 0);
          expect(result.h).toBeCloseTo(120, 1);
          expect(result.s).toBeCloseTo(100, 1);
          expect(result.v).toBeCloseTo(100, 1);
        });

        it('should convert blue to HSV (240, 100, 100)', () => {
          const result = converter.rgbToHsv(0, 0, 255);
          expect(result.h).toBeCloseTo(240, 1);
          expect(result.s).toBeCloseTo(100, 1);
          expect(result.v).toBeCloseTo(100, 1);
        });

        it('should convert black to HSV (0, 0, 0)', () => {
          const result = converter.rgbToHsv(0, 0, 0);
          expect(result.h).toBe(0);
          expect(result.s).toBe(0);
          expect(result.v).toBe(0);
        });

        it('should convert white to HSV (0, 0, 100)', () => {
          const result = converter.rgbToHsv(255, 255, 255);
          expect(result.h).toBe(0);
          expect(result.s).toBe(0);
          expect(result.v).toBeCloseTo(100, 1);
        });

        it('should convert gray to HSV with 0 saturation', () => {
          const result = converter.rgbToHsv(128, 128, 128);
          expect(result.h).toBe(0);
          expect(result.s).toBe(0);
          expect(result.v).toBeCloseTo(50.2, 0);
        });

        it('should convert yellow to HSV (60, 100, 100)', () => {
          const result = converter.rgbToHsv(255, 255, 0);
          expect(result.h).toBeCloseTo(60, 1);
          expect(result.s).toBeCloseTo(100, 1);
          expect(result.v).toBeCloseTo(100, 1);
        });

        it('should convert cyan to HSV (180, 100, 100)', () => {
          const result = converter.rgbToHsv(0, 255, 255);
          expect(result.h).toBeCloseTo(180, 1);
          expect(result.s).toBeCloseTo(100, 1);
          expect(result.v).toBeCloseTo(100, 1);
        });

        it('should convert magenta to HSV (300, 100, 100)', () => {
          const result = converter.rgbToHsv(255, 0, 255);
          expect(result.h).toBeCloseTo(300, 1);
          expect(result.s).toBeCloseTo(100, 1);
          expect(result.v).toBeCloseTo(100, 1);
        });
      });

      describe('error handling', () => {
        it('should throw AppError for invalid RGB values', () => {
          expect(() => converter.rgbToHsv(300, 0, 0)).toThrow(AppError);
        });

        it('should throw AppError for negative values', () => {
          expect(() => converter.rgbToHsv(-10, 0, 0)).toThrow(AppError);
        });
      });
    });

    // ==========================================================================
    // hsvToRgb Tests
    // ==========================================================================

    describe('hsvToRgb', () => {
      describe('valid conversions', () => {
        it('should convert HSV red (0, 100, 100) to RGB red', () => {
          const result = converter.hsvToRgb(0, 100, 100);
          expect(result).toEqual({ r: 255, g: 0, b: 0 });
        });

        it('should convert HSV green (120, 100, 100) to RGB green', () => {
          const result = converter.hsvToRgb(120, 100, 100);
          expect(result).toEqual({ r: 0, g: 255, b: 0 });
        });

        it('should convert HSV blue (240, 100, 100) to RGB blue', () => {
          const result = converter.hsvToRgb(240, 100, 100);
          expect(result).toEqual({ r: 0, g: 0, b: 255 });
        });

        it('should convert HSV black (0, 0, 0) to RGB black', () => {
          const result = converter.hsvToRgb(0, 0, 0);
          expect(result).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('should convert HSV white (0, 0, 100) to RGB white', () => {
          const result = converter.hsvToRgb(0, 0, 100);
          expect(result).toEqual({ r: 255, g: 255, b: 255 });
        });

        it('should handle hue at 360 degrees (same as 0)', () => {
          const result = converter.hsvToRgb(360, 100, 100);
          expect(result).toEqual({ r: 255, g: 0, b: 0 });
        });

        it('should handle hue in range 60-120 (yellow-green)', () => {
          const result = converter.hsvToRgb(90, 100, 100);
          expect(result.r).toBeLessThan(result.g);
          expect(result.b).toBe(0);
        });

        it('should handle hue in range 180-240 (cyan-blue)', () => {
          const result = converter.hsvToRgb(210, 100, 100);
          expect(result.r).toBe(0);
          expect(result.g).toBeLessThan(result.b);
        });

        it('should handle hue in range 300-360 (magenta-red)', () => {
          const result = converter.hsvToRgb(330, 100, 100);
          expect(result.r).toBe(255);
          expect(result.g).toBe(0);
          expect(result.b).toBeGreaterThan(0);
        });
      });

      describe('saturation variations', () => {
        it('should return gray when saturation is 0', () => {
          const result = converter.hsvToRgb(180, 0, 50);
          expect(result.r).toBe(result.g);
          expect(result.g).toBe(result.b);
        });

        it('should return fully saturated at 100%', () => {
          const result = converter.hsvToRgb(0, 100, 100);
          expect(result.g).toBe(0);
          expect(result.b).toBe(0);
        });
      });

      describe('value/brightness variations', () => {
        it('should return black when value is 0', () => {
          const result = converter.hsvToRgb(180, 100, 0);
          expect(result).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('should return dim color when value is low', () => {
          const result = converter.hsvToRgb(0, 100, 25);
          expect(result.r).toBe(64);
          expect(result.g).toBe(0);
          expect(result.b).toBe(0);
        });
      });

      describe('error handling', () => {
        it('should throw AppError for hue > 360', () => {
          expect(() => converter.hsvToRgb(361, 50, 50)).toThrow(AppError);
        });

        it('should throw AppError for negative hue', () => {
          expect(() => converter.hsvToRgb(-1, 50, 50)).toThrow(AppError);
        });

        it('should throw AppError for saturation > 100', () => {
          expect(() => converter.hsvToRgb(180, 101, 50)).toThrow(AppError);
        });

        it('should throw AppError for negative saturation', () => {
          expect(() => converter.hsvToRgb(180, -1, 50)).toThrow(AppError);
        });

        it('should throw AppError for value > 100', () => {
          expect(() => converter.hsvToRgb(180, 50, 101)).toThrow(AppError);
        });

        it('should throw AppError for negative value', () => {
          expect(() => converter.hsvToRgb(180, 50, -1)).toThrow(AppError);
        });
      });
    });

    // ==========================================================================
    // hexToHsv Tests
    // ==========================================================================

    describe('hexToHsv', () => {
      it('should convert #FF0000 to HSV red', () => {
        const result = converter.hexToHsv('#FF0000');
        expect(result.h).toBeCloseTo(0, 1);
        expect(result.s).toBeCloseTo(100, 1);
        expect(result.v).toBeCloseTo(100, 1);
      });

      it('should convert #00FF00 to HSV green', () => {
        const result = converter.hexToHsv('#00FF00');
        expect(result.h).toBeCloseTo(120, 1);
        expect(result.s).toBeCloseTo(100, 1);
        expect(result.v).toBeCloseTo(100, 1);
      });

      it('should convert #0000FF to HSV blue', () => {
        const result = converter.hexToHsv('#0000FF');
        expect(result.h).toBeCloseTo(240, 1);
        expect(result.s).toBeCloseTo(100, 1);
        expect(result.v).toBeCloseTo(100, 1);
      });

      it('should handle shorthand format', () => {
        const result = converter.hexToHsv('#F00');
        expect(result.h).toBeCloseTo(0, 1);
        expect(result.s).toBeCloseTo(100, 1);
        expect(result.v).toBeCloseTo(100, 1);
      });

      it('should throw AppError for invalid hex', () => {
        expect(() => converter.hexToHsv('invalid')).toThrow(AppError);
      });
    });

    // ==========================================================================
    // hsvToHex Tests
    // ==========================================================================

    describe('hsvToHex', () => {
      it('should convert HSV red to #FF0000', () => {
        const result = converter.hsvToHex(0, 100, 100);
        expect(result).toBe('#FF0000');
      });

      it('should convert HSV green to #00FF00', () => {
        const result = converter.hsvToHex(120, 100, 100);
        expect(result).toBe('#00FF00');
      });

      it('should convert HSV blue to #0000FF', () => {
        const result = converter.hsvToHex(240, 100, 100);
        expect(result).toBe('#0000FF');
      });

      it('should convert HSV black to #000000', () => {
        const result = converter.hsvToHex(0, 0, 0);
        expect(result).toBe('#000000');
      });

      it('should convert HSV white to #FFFFFF', () => {
        const result = converter.hsvToHex(0, 0, 100);
        expect(result).toBe('#FFFFFF');
      });
    });

    // ==========================================================================
    // normalizeHex Tests
    // ==========================================================================

    describe('normalizeHex', () => {
      it('should expand shorthand #F00 to #FF0000', () => {
        const result = converter.normalizeHex('#F00');
        expect(result).toBe('#FF0000');
      });

      it('should expand shorthand #ABC to #AABBCC', () => {
        const result = converter.normalizeHex('#ABC');
        expect(result).toBe('#AABBCC');
      });

      it('should uppercase lowercase hex', () => {
        const result = converter.normalizeHex('#ff00ff');
        expect(result).toBe('#FF00FF');
      });

      it('should leave valid uppercase hex unchanged', () => {
        const result = converter.normalizeHex('#FF00FF');
        expect(result).toBe('#FF00FF');
      });

      it('should throw AppError for invalid hex', () => {
        expect(() => converter.normalizeHex('invalid')).toThrow(AppError);
      });
    });

    // ==========================================================================
    // getColorDistance Tests
    // ==========================================================================

    describe('getColorDistance', () => {
      it('should return 0 for identical colors', () => {
        const result = converter.getColorDistance('#FF0000', '#FF0000');
        expect(result).toBe(0);
      });

      it('should return max distance for black vs white', () => {
        const result = converter.getColorDistance('#000000', '#FFFFFF');
        // sqrt(255^2 + 255^2 + 255^2) ≈ 441.67
        expect(result).toBeCloseTo(441.67, 1);
      });

      it('should calculate distance between primary colors', () => {
        // Red to green: sqrt((255-0)^2 + (0-255)^2 + 0) = sqrt(2*255^2) ≈ 360.62
        const result = converter.getColorDistance('#FF0000', '#00FF00');
        expect(result).toBeCloseTo(360.62, 1);
      });

      it('should return same distance regardless of order', () => {
        const result1 = converter.getColorDistance('#FF0000', '#00FF00');
        const result2 = converter.getColorDistance('#00FF00', '#FF0000');
        expect(result1).toBe(result2);
      });

      it('should handle shorthand hex format', () => {
        const result = converter.getColorDistance('#F00', '#0F0');
        expect(result).toBeCloseTo(360.62, 1);
      });

      it('should throw AppError for invalid first hex', () => {
        expect(() => converter.getColorDistance('invalid', '#FF0000')).toThrow(AppError);
      });

      it('should throw AppError for invalid second hex', () => {
        expect(() => converter.getColorDistance('#FF0000', 'invalid')).toThrow(AppError);
      });
    });

    // ==========================================================================
    // Cache Behavior Tests
    // ==========================================================================

    describe('cache behavior', () => {
      it('should cache hexToRgb results', () => {
        converter.hexToRgb('#FF0000');
        const stats = converter.getCacheStats();
        expect(stats.hexToRgb).toBe(1);
      });

      it('should return cached result on second call', () => {
        const result1 = converter.hexToRgb('#FF0000');
        const result2 = converter.hexToRgb('#FF0000');
        expect(result1).toEqual(result2);
        expect(converter.getCacheStats().hexToRgb).toBe(1);
      });

      it('should cache rgbToHex results', () => {
        converter.rgbToHex(255, 0, 0);
        expect(converter.getCacheStats().rgbToHex).toBe(1);
      });

      it('should cache rgbToHsv results', () => {
        converter.rgbToHsv(255, 0, 0);
        expect(converter.getCacheStats().rgbToHsv).toBe(1);
      });

      it('should cache hsvToRgb results', () => {
        converter.hsvToRgb(0, 100, 100);
        expect(converter.getCacheStats().hsvToRgb).toBe(1);
      });

      it('should cache hexToHsv results', () => {
        converter.hexToHsv('#FF0000');
        expect(converter.getCacheStats().hexToHsv).toBe(1);
      });

      it('should clear all caches', () => {
        converter.hexToRgb('#FF0000');
        converter.rgbToHex(255, 0, 0);
        converter.rgbToHsv(255, 0, 0);
        converter.hsvToRgb(0, 100, 100);
        converter.hexToHsv('#00FF00');

        converter.clearCaches();

        const stats = converter.getCacheStats();
        expect(stats.hexToRgb).toBe(0);
        expect(stats.rgbToHex).toBe(0);
        expect(stats.rgbToHsv).toBe(0);
        expect(stats.hsvToRgb).toBe(0);
        expect(stats.hexToHsv).toBe(0);
      });

      it('should normalize case for cache key consistency', () => {
        converter.hexToRgb('#ff0000');
        converter.hexToRgb('#FF0000');
        // Should be same cache entry
        expect(converter.getCacheStats().hexToRgb).toBe(1);
      });

      it('should normalize shorthand for cache key consistency', () => {
        converter.hexToRgb('#F00');
        converter.hexToRgb('#FF0000');
        // Should be same cache entry after normalization
        expect(converter.getCacheStats().hexToRgb).toBe(1);
      });
    });

    // ==========================================================================
    // LRU Eviction Tests
    // ==========================================================================

    describe('LRU cache eviction', () => {
      it('should evict oldest entries when cache is full', () => {
        const smallCache = new ColorConverter({ cacheSize: 3 });

        smallCache.hexToRgb('#FF0000');
        smallCache.hexToRgb('#00FF00');
        smallCache.hexToRgb('#0000FF');
        expect(smallCache.getCacheStats().hexToRgb).toBe(3);

        // This should evict #FF0000 (oldest)
        smallCache.hexToRgb('#FFFFFF');
        expect(smallCache.getCacheStats().hexToRgb).toBe(3);

        // Verify by adding another - #00FF00 should be evicted
        smallCache.hexToRgb('#000000');
        expect(smallCache.getCacheStats().hexToRgb).toBe(3);
      });

      it('should refresh entry position on cache hit', () => {
        const smallCache = new ColorConverter({ cacheSize: 3 });

        smallCache.hexToRgb('#FF0000');
        smallCache.hexToRgb('#00FF00');
        smallCache.hexToRgb('#0000FF');

        // Access #FF0000 again to refresh it
        smallCache.hexToRgb('#FF0000');

        // Now #00FF00 is oldest, add new entry
        smallCache.hexToRgb('#FFFFFF');

        // Access #FF0000 should still be cached (was refreshed)
        const result = smallCache.hexToRgb('#FF0000');
        expect(result).toEqual({ r: 255, g: 0, b: 0 });
      });
    });
  });

  // ============================================================================
  // Static API Tests
  // ============================================================================

  describe('Static API', () => {
    beforeEach(() => {
      ColorConverter.clearCaches();
    });

    afterEach(() => {
      ColorConverter.clearCaches();
    });

    describe('hexToRgb (static)', () => {
      it('should convert #FF0000 to red RGB', () => {
        const result = ColorConverter.hexToRgb('#FF0000');
        expect(result).toEqual({ r: 255, g: 0, b: 0 });
      });

      it('should handle shorthand format', () => {
        const result = ColorConverter.hexToRgb('#F00');
        expect(result).toEqual({ r: 255, g: 0, b: 0 });
      });
    });

    describe('rgbToHex (static)', () => {
      it('should convert red RGB to #FF0000', () => {
        const result = ColorConverter.rgbToHex(255, 0, 0);
        expect(result).toBe('#FF0000');
      });
    });

    describe('rgbToHsv (static)', () => {
      it('should convert red RGB to HSV', () => {
        const result = ColorConverter.rgbToHsv(255, 0, 0);
        expect(result.h).toBeCloseTo(0, 1);
        expect(result.s).toBeCloseTo(100, 1);
        expect(result.v).toBeCloseTo(100, 1);
      });
    });

    describe('hsvToRgb (static)', () => {
      it('should convert HSV red to RGB', () => {
        const result = ColorConverter.hsvToRgb(0, 100, 100);
        expect(result).toEqual({ r: 255, g: 0, b: 0 });
      });
    });

    describe('hexToHsv (static)', () => {
      it('should convert #FF0000 to HSV red', () => {
        const result = ColorConverter.hexToHsv('#FF0000');
        expect(result.h).toBeCloseTo(0, 1);
        expect(result.s).toBeCloseTo(100, 1);
        expect(result.v).toBeCloseTo(100, 1);
      });
    });

    describe('hsvToHex (static)', () => {
      it('should convert HSV red to #FF0000', () => {
        const result = ColorConverter.hsvToHex(0, 100, 100);
        expect(result).toBe('#FF0000');
      });
    });

    describe('normalizeHex (static)', () => {
      it('should expand shorthand #F00 to #FF0000', () => {
        const result = ColorConverter.normalizeHex('#F00');
        expect(result).toBe('#FF0000');
      });
    });

    describe('getColorDistance (static)', () => {
      it('should return 0 for identical colors', () => {
        const result = ColorConverter.getColorDistance('#FF0000', '#FF0000');
        expect(result).toBe(0);
      });
    });

    describe('getCacheStats (static)', () => {
      it('should return cache statistics', () => {
        ColorConverter.hexToRgb('#FF0000');
        const stats = ColorConverter.getCacheStats();
        expect(stats.hexToRgb).toBeGreaterThanOrEqual(1);
      });
    });

    describe('clearCaches (static)', () => {
      it('should clear all caches', () => {
        ColorConverter.hexToRgb('#FF0000');
        ColorConverter.clearCaches();
        const stats = ColorConverter.getCacheStats();
        expect(stats.hexToRgb).toBe(0);
      });
    });
  });

  // ============================================================================
  // LAB Color Space Tests
  // ============================================================================

  describe('LAB Color Space', () => {
    const converter = new ColorConverter();

    describe('rgbToLab (instance)', () => {
      it('should convert red RGB to LAB', () => {
        const lab = converter.rgbToLab(255, 0, 0);
        expect(lab.L).toBeGreaterThan(50);
        expect(lab.a).toBeGreaterThan(0); // Red has positive a
        expect(lab.b).toBeGreaterThan(0); // Red has positive b
      });

      it('should convert green RGB to LAB', () => {
        const lab = converter.rgbToLab(0, 255, 0);
        expect(lab.L).toBeGreaterThan(80); // Green is bright
        expect(lab.a).toBeLessThan(0); // Green has negative a
      });

      it('should convert blue RGB to LAB', () => {
        const lab = converter.rgbToLab(0, 0, 255);
        expect(lab.L).toBeGreaterThan(30);
        expect(lab.a).toBeGreaterThan(0);
        expect(lab.b).toBeLessThan(0); // Blue has negative b
      });

      it('should convert black to LAB (L=0)', () => {
        const lab = converter.rgbToLab(0, 0, 0);
        expect(lab.L).toBeCloseTo(0, 1);
        expect(lab.a).toBeCloseTo(0, 1);
        expect(lab.b).toBeCloseTo(0, 1);
      });

      it('should convert white to LAB (L=100)', () => {
        const lab = converter.rgbToLab(255, 255, 255);
        expect(lab.L).toBeCloseTo(100, 1);
        expect(lab.a).toBeCloseTo(0, 1);
        expect(lab.b).toBeCloseTo(0, 1);
      });

      it('should cache LAB results', () => {
        const freshConverter = new ColorConverter();
        freshConverter.rgbToLab(255, 0, 0);
        expect(freshConverter.getCacheStats().rgbToLab).toBe(1);
      });

      it('should throw AppError for invalid RGB values', () => {
        expect(() => converter.rgbToLab(300, 0, 0)).toThrow(AppError);
      });
    });

    describe('rgbToLab (static)', () => {
      it('should convert RGB to LAB via static method', () => {
        const lab = ColorConverter.rgbToLab(255, 0, 0);
        expect(lab.L).toBeGreaterThan(50);
      });
    });

    describe('hexToLab', () => {
      it('should convert hex to LAB (instance)', () => {
        const lab = converter.hexToLab('#FF0000');
        expect(lab.L).toBeGreaterThan(50);
      });

      it('should convert hex to LAB (static)', () => {
        const lab = ColorConverter.hexToLab('#00FF00');
        expect(lab.a).toBeLessThan(0);
      });
    });

    describe('labToRgb', () => {
      it('should convert LAB to RGB (instance)', () => {
        const rgb = converter.labToRgb(53.23, 80.11, 67.22);
        expect(rgb.r).toBeGreaterThan(200);
        expect(rgb.g).toBeLessThan(50);
        expect(rgb.b).toBeLessThan(50);
      });

      it('should convert LAB to RGB (static)', () => {
        const rgb = ColorConverter.labToRgb(100, 0, 0);
        expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
      });

      it('should convert LAB black', () => {
        const rgb = converter.labToRgb(0, 0, 0);
        expect(rgb.r).toBe(0);
        expect(rgb.g).toBe(0);
        expect(rgb.b).toBe(0);
      });

      it('should clamp out-of-gamut colors', () => {
        // Extreme LAB values that might be out of sRGB gamut
        const rgb = converter.labToRgb(50, 100, 100);
        expect(rgb.r).toBeGreaterThanOrEqual(0);
        expect(rgb.r).toBeLessThanOrEqual(255);
      });
    });

    describe('labToHex', () => {
      it('should convert LAB to hex (instance)', () => {
        const hex = converter.labToHex(100, 0, 0);
        expect(hex).toBe('#FFFFFF');
      });

      it('should convert LAB to hex (static)', () => {
        const hex = ColorConverter.labToHex(0, 0, 0);
        expect(hex).toBe('#000000');
      });
    });
  });

  // ============================================================================
  // DeltaE Color Difference Tests
  // ============================================================================

  describe('DeltaE Color Difference', () => {
    const converter = new ColorConverter();

    describe('getDeltaE76', () => {
      it('should return 0 for identical LAB colors (instance)', () => {
        const lab = { L: 50, a: 25, b: 25 };
        expect(converter.getDeltaE76(lab, lab)).toBe(0);
      });

      it('should return 0 for identical LAB colors (static)', () => {
        const lab = { L: 50, a: 25, b: 25 };
        expect(ColorConverter.getDeltaE76(lab, lab)).toBe(0);
      });

      it('should calculate distance between different LAB colors', () => {
        const lab1 = { L: 50, a: 0, b: 0 };
        const lab2 = { L: 100, a: 0, b: 0 };
        expect(converter.getDeltaE76(lab1, lab2)).toBeCloseTo(50, 1);
      });
    });

    describe('getDeltaE2000', () => {
      it('should return 0 for identical LAB colors (instance)', () => {
        const lab = { L: 50, a: 25, b: 25 };
        expect(converter.getDeltaE2000(lab, lab)).toBe(0);
      });

      it('should return 0 for identical LAB colors (static)', () => {
        const lab = { L: 50, a: 25, b: 25 };
        expect(ColorConverter.getDeltaE2000(lab, lab)).toBe(0);
      });

      it('should handle colors with zero chroma', () => {
        const lab1 = { L: 50, a: 0, b: 0 };
        const lab2 = { L: 80, a: 0, b: 0 };
        const deltaE = converter.getDeltaE2000(lab1, lab2);
        expect(deltaE).toBeGreaterThan(0);
      });

      it('should handle opposite hues', () => {
        const lab1 = { L: 50, a: 50, b: 0 };
        const lab2 = { L: 50, a: -50, b: 0 };
        const deltaE = converter.getDeltaE2000(lab1, lab2);
        expect(deltaE).toBeGreaterThan(30);
      });
    });

    describe('getDeltaE', () => {
      it('should use cie76 by default (instance)', () => {
        const deltaE = converter.getDeltaE('#FF0000', '#FF0001');
        expect(deltaE).toBeGreaterThanOrEqual(0);
      });

      it('should use cie76 by default (static)', () => {
        const deltaE = ColorConverter.getDeltaE('#FF0000', '#FF0001');
        expect(deltaE).toBeGreaterThanOrEqual(0);
      });

      it('should use cie2000 when specified (instance)', () => {
        const deltaE = converter.getDeltaE('#FF0000', '#00FF00', 'cie2000');
        expect(deltaE).toBeGreaterThan(50);
      });

      it('should use cie2000 when specified (static)', () => {
        const deltaE = ColorConverter.getDeltaE('#FF0000', '#00FF00', 'cie2000');
        expect(deltaE).toBeGreaterThan(50);
      });

      it('should return small deltaE for similar colors', () => {
        const deltaE = ColorConverter.getDeltaE('#FF0000', '#FE0000');
        expect(deltaE).toBeLessThan(5);
      });
    });
  });

  // ============================================================================
  // OKLAB/OKLCH Color Space Tests
  // ============================================================================

  describe('OKLAB Color Space', () => {
    const converter = new ColorConverter();

    describe('rgbToOklab', () => {
      it('should convert red RGB to OKLAB (instance)', () => {
        const oklab = converter.rgbToOklab(255, 0, 0);
        expect(oklab.L).toBeGreaterThan(0.5);
        expect(oklab.L).toBeLessThan(1);
        expect(oklab.a).toBeGreaterThan(0);
      });

      it('should convert red RGB to OKLAB (static)', () => {
        const oklab = ColorConverter.rgbToOklab(255, 0, 0);
        expect(oklab.L).toBeGreaterThan(0.5);
      });

      it('should convert black to OKLAB (L=0)', () => {
        const oklab = converter.rgbToOklab(0, 0, 0);
        expect(oklab.L).toBeCloseTo(0, 3);
      });

      it('should convert white to OKLAB (L=1)', () => {
        const oklab = converter.rgbToOklab(255, 255, 255);
        expect(oklab.L).toBeCloseTo(1, 3);
      });

      it('should throw AppError for invalid RGB', () => {
        expect(() => converter.rgbToOklab(300, 0, 0)).toThrow(AppError);
      });
    });

    describe('oklabToRgb', () => {
      it('should convert OKLAB to RGB (instance)', () => {
        const rgb = converter.oklabToRgb(0.628, 0.225, 0.126);
        expect(rgb.r).toBeGreaterThan(200);
      });

      it('should convert OKLAB to RGB (static)', () => {
        const rgb = ColorConverter.oklabToRgb(1, 0, 0);
        expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
      });

      it('should convert OKLAB black', () => {
        const rgb = converter.oklabToRgb(0, 0, 0);
        expect(rgb.r).toBe(0);
        expect(rgb.g).toBe(0);
        expect(rgb.b).toBe(0);
      });
    });

    describe('hexToOklab', () => {
      it('should convert hex to OKLAB (instance)', () => {
        const oklab = converter.hexToOklab('#FF0000');
        expect(oklab.L).toBeGreaterThan(0.5);
      });

      it('should convert hex to OKLAB (static)', () => {
        const oklab = ColorConverter.hexToOklab('#0000FF');
        expect(oklab.b).toBeLessThan(0);
      });
    });

    describe('oklabToHex', () => {
      it('should convert OKLAB to hex (instance)', () => {
        const hex = converter.oklabToHex(1, 0, 0);
        expect(hex).toBe('#FFFFFF');
      });

      it('should convert OKLAB to hex (static)', () => {
        const hex = ColorConverter.oklabToHex(0, 0, 0);
        expect(hex).toBe('#000000');
      });
    });
  });

  describe('OKLCH Color Space', () => {
    const converter = new ColorConverter();

    describe('rgbToOklch', () => {
      it('should convert red RGB to OKLCH (instance)', () => {
        const oklch = converter.rgbToOklch(255, 0, 0);
        expect(oklch.L).toBeGreaterThan(0.5);
        expect(oklch.C).toBeGreaterThan(0);
        expect(oklch.h).toBeGreaterThanOrEqual(0);
        expect(oklch.h).toBeLessThan(360);
      });

      it('should convert red RGB to OKLCH (static)', () => {
        const oklch = ColorConverter.rgbToOklch(255, 0, 0);
        expect(oklch.C).toBeGreaterThan(0);
      });
    });

    describe('oklchToRgb', () => {
      it('should convert OKLCH to RGB (instance)', () => {
        const rgb = converter.oklchToRgb(0.628, 0.258, 29.23);
        expect(rgb.r).toBeDefined();
        expect(rgb.g).toBeDefined();
        expect(rgb.b).toBeDefined();
      });

      it('should convert OKLCH to RGB (static)', () => {
        const rgb = ColorConverter.oklchToRgb(0.5, 0.1, 180);
        expect(rgb.r).toBeGreaterThanOrEqual(0);
        expect(rgb.r).toBeLessThanOrEqual(255);
      });
    });

    describe('hexToOklch', () => {
      it('should convert hex to OKLCH (instance)', () => {
        const oklch = converter.hexToOklch('#FF00FF');
        expect(oklch.h).toBeGreaterThan(0);
      });

      it('should convert hex to OKLCH (static)', () => {
        const oklch = ColorConverter.hexToOklch('#00FF00');
        expect(oklch.C).toBeGreaterThan(0);
      });
    });

    describe('oklchToHex', () => {
      it('should convert OKLCH to hex (instance)', () => {
        const hex = converter.oklchToHex(0.5, 0.1, 180);
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should convert OKLCH to hex (static)', () => {
        const hex = ColorConverter.oklchToHex(0.8, 0.05, 90);
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      });
    });
  });

  // ============================================================================
  // LCH Color Space Tests
  // ============================================================================

  describe('LCH Color Space', () => {
    const converter = new ColorConverter();

    describe('labToLch', () => {
      it('should convert LAB to LCH (instance)', () => {
        const lch = converter.labToLch(53, 80, 67);
        expect(lch.L).toBeCloseTo(53, 0);
        expect(lch.C).toBeGreaterThan(0);
        expect(lch.h).toBeGreaterThanOrEqual(0);
      });

      it('should convert LAB to LCH (static)', () => {
        const lch = ColorConverter.labToLch(50, 0, 50);
        expect(lch.h).toBeCloseTo(90, 0);
      });

      it('should handle achromatic LAB (a=0, b=0)', () => {
        const lch = converter.labToLch(50, 0, 0);
        expect(lch.C).toBeCloseTo(0, 1);
      });
    });

    describe('lchToLab', () => {
      it('should convert LCH to LAB (instance)', () => {
        const lab = converter.lchToLab(50, 50, 90);
        expect(lab.L).toBeCloseTo(50, 0);
        expect(lab.a).toBeCloseTo(0, 0);
        expect(lab.b).toBeCloseTo(50, 0);
      });

      it('should convert LCH to LAB (static)', () => {
        const lab = ColorConverter.lchToLab(50, 50, 0);
        expect(lab.a).toBeCloseTo(50, 0);
        expect(lab.b).toBeCloseTo(0, 0);
      });
    });

    describe('rgbToLch', () => {
      it('should convert RGB to LCH (instance)', () => {
        const lch = converter.rgbToLch(255, 0, 0);
        expect(lch.L).toBeGreaterThan(50);
        expect(lch.C).toBeGreaterThan(0);
      });

      it('should convert RGB to LCH (static)', () => {
        const lch = ColorConverter.rgbToLch(0, 255, 0);
        expect(lch.h).toBeGreaterThan(0);
      });
    });

    describe('lchToRgb', () => {
      it('should convert LCH to RGB (instance)', () => {
        const rgb = converter.lchToRgb(50, 50, 90);
        expect(rgb.r).toBeGreaterThanOrEqual(0);
        expect(rgb.r).toBeLessThanOrEqual(255);
      });

      it('should convert LCH to RGB (static)', () => {
        const rgb = ColorConverter.lchToRgb(100, 0, 0);
        expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
      });
    });

    describe('hexToLch', () => {
      it('should convert hex to LCH (instance)', () => {
        const lch = converter.hexToLch('#00FF00');
        expect(lch.h).toBeGreaterThan(0);
      });

      it('should convert hex to LCH (static)', () => {
        const lch = ColorConverter.hexToLch('#FF0000');
        expect(lch.C).toBeGreaterThan(0);
      });
    });

    describe('lchToHex', () => {
      it('should convert LCH to hex (instance)', () => {
        const hex = converter.lchToHex(50, 50, 180);
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
      });

      it('should convert LCH to hex (static)', () => {
        const hex = ColorConverter.lchToHex(100, 0, 0);
        expect(hex).toBe('#FFFFFF');
      });
    });
  });

  // ============================================================================
  // HSL Color Space Tests
  // ============================================================================

  describe('HSL Color Space', () => {
    const converter = new ColorConverter();

    describe('rgbToHsl', () => {
      it('should convert red RGB to HSL (instance)', () => {
        const hsl = converter.rgbToHsl(255, 0, 0);
        expect(hsl.h).toBeCloseTo(0, 0);
        expect(hsl.s).toBeCloseTo(100, 0);
        expect(hsl.l).toBeCloseTo(50, 0);
      });

      it('should convert red RGB to HSL (static)', () => {
        const hsl = ColorConverter.rgbToHsl(255, 0, 0);
        expect(hsl.h).toBeCloseTo(0, 0);
      });

      it('should convert green RGB to HSL', () => {
        const hsl = converter.rgbToHsl(0, 255, 0);
        expect(hsl.h).toBeCloseTo(120, 0);
        expect(hsl.s).toBe(100);
        expect(hsl.l).toBe(50);
      });

      it('should convert blue RGB to HSL', () => {
        const hsl = converter.rgbToHsl(0, 0, 255);
        expect(hsl.h).toBeCloseTo(240, 0);
      });

      it('should handle achromatic (gray) colors', () => {
        const hsl = converter.rgbToHsl(128, 128, 128);
        expect(hsl.s).toBe(0);
      });

      it('should handle black', () => {
        const hsl = converter.rgbToHsl(0, 0, 0);
        expect(hsl.l).toBe(0);
      });

      it('should handle white', () => {
        const hsl = converter.rgbToHsl(255, 255, 255);
        expect(hsl.l).toBe(100);
      });

      it('should throw AppError for invalid RGB', () => {
        expect(() => converter.rgbToHsl(300, 0, 0)).toThrow(AppError);
      });
    });

    describe('hslToRgb', () => {
      it('should convert HSL red to RGB (instance)', () => {
        const rgb = converter.hslToRgb(0, 100, 50);
        expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
      });

      it('should convert HSL red to RGB (static)', () => {
        const rgb = ColorConverter.hslToRgb(0, 100, 50);
        expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
      });

      it('should convert HSL green to RGB', () => {
        const rgb = converter.hslToRgb(120, 100, 50);
        expect(rgb).toEqual({ r: 0, g: 255, b: 0 });
      });

      it('should convert HSL blue to RGB', () => {
        const rgb = converter.hslToRgb(240, 100, 50);
        expect(rgb).toEqual({ r: 0, g: 0, b: 255 });
      });

      it('should handle achromatic (saturation=0)', () => {
        const rgb = converter.hslToRgb(180, 0, 50);
        expect(rgb.r).toBe(rgb.g);
        expect(rgb.g).toBe(rgb.b);
      });

      it('should handle black (lightness=0)', () => {
        const rgb = converter.hslToRgb(180, 100, 0);
        expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
      });

      it('should handle white (lightness=100)', () => {
        const rgb = converter.hslToRgb(180, 100, 100);
        expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
      });

      it('should normalize hue >= 360', () => {
        const rgb = converter.hslToRgb(360, 100, 50);
        expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
      });

      it('should clamp saturation and lightness', () => {
        const rgb = converter.hslToRgb(0, 150, 150);
        expect(rgb.r).toBeLessThanOrEqual(255);
      });
    });

    describe('hexToHsl', () => {
      it('should convert hex to HSL (instance)', () => {
        const hsl = converter.hexToHsl('#FF0000');
        expect(hsl.h).toBeCloseTo(0, 0);
        expect(hsl.s).toBe(100);
        expect(hsl.l).toBe(50);
      });

      it('should convert hex to HSL (static)', () => {
        const hsl = ColorConverter.hexToHsl('#00FF00');
        expect(hsl.h).toBeCloseTo(120, 0);
      });
    });

    describe('hslToHex', () => {
      it('should convert HSL to hex (instance)', () => {
        const hex = converter.hslToHex(0, 100, 50);
        expect(hex).toBe('#FF0000');
      });

      it('should convert HSL to hex (static)', () => {
        const hex = ColorConverter.hslToHex(120, 100, 50);
        expect(hex).toBe('#00FF00');
      });

      it('should convert HSL white to hex', () => {
        const hex = converter.hslToHex(0, 0, 100);
        expect(hex).toBe('#FFFFFF');
      });

      it('should convert HSL black to hex', () => {
        const hex = converter.hslToHex(0, 0, 0);
        expect(hex).toBe('#000000');
      });
    });
  });

  // ============================================================================
  // Roundtrip Conversion Tests
  // ============================================================================

  describe('Roundtrip conversions', () => {
    const converter = new ColorConverter();

    it('should roundtrip hex -> rgb -> hex', () => {
      const original = '#AB12CD';
      const rgb = converter.hexToRgb(original);
      const result = converter.rgbToHex(rgb.r, rgb.g, rgb.b);
      expect(result).toBe(original);
    });

    it('should roundtrip rgb -> hsv -> rgb', () => {
      const original = { r: 128, g: 64, b: 192 };
      const hsv = converter.rgbToHsv(original.r, original.g, original.b);
      const result = converter.hsvToRgb(hsv.h, hsv.s, hsv.v);
      expect(result.r).toBeCloseTo(original.r, 0);
      expect(result.g).toBeCloseTo(original.g, 0);
      expect(result.b).toBeCloseTo(original.b, 0);
    });

    it('should roundtrip hex -> hsv -> hex', () => {
      const original = '#808080';
      const hsv = converter.hexToHsv(original);
      const result = converter.hsvToHex(hsv.h, hsv.s, hsv.v);
      expect(result).toBe(original);
    });

    it('should roundtrip hsv -> rgb -> hsv for saturated color', () => {
      const original = { h: 180, s: 75, v: 80 };
      const rgb = converter.hsvToRgb(original.h, original.s, original.v);
      const result = converter.rgbToHsv(rgb.r, rgb.g, rgb.b);
      expect(result.h).toBeCloseTo(original.h, 0);
      expect(result.s).toBeCloseTo(original.s, 0);
      expect(result.v).toBeCloseTo(original.v, 0);
    });

    it('should roundtrip multiple primary colors', () => {
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

      for (const color of colors) {
        const rgb = converter.hexToRgb(color);
        const back = converter.rgbToHex(rgb.r, rgb.g, rgb.b);
        expect(back).toBe(color);
      }
    });
  });
});
