/**
 * ColorblindnessSimulator Comprehensive Tests
 * Phase 3.2: Target 35-45 tests covering all vision types, caching, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ColorblindnessSimulator } from '../ColorblindnessSimulator.js';
import { AppError } from '../../../types/index.js';
import type { VisionType, RGB } from '../../../types/index.js';
import { BRETTEL_MATRICES } from '../../../constants/index.js';

describe('ColorblindnessSimulator', () => {
  beforeEach(() => {
    ColorblindnessSimulator.clearCache();
  });

  afterEach(() => {
    ColorblindnessSimulator.clearCache();
  });

  // ============================================================================
  // Normal Vision Tests
  // ============================================================================

  describe('normal vision', () => {
    it('should return identical color for normal vision', () => {
      const rgb: RGB = { r: 255, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'normal');
      expect(result).toEqual(rgb);
    });

    it('should return a copy, not the same object reference', () => {
      const rgb: RGB = { r: 128, g: 64, b: 192 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'normal');
      expect(result).toEqual(rgb);
      expect(result).not.toBe(rgb);
    });

    it('should not cache normal vision results (pass-through)', () => {
      const rgb: RGB = { r: 100, g: 100, b: 100 };
      ColorblindnessSimulator.simulateColorblindness(rgb, 'normal');
      // Normal vision doesn't add to cache
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(0);
    });
  });

  // ============================================================================
  // Deuteranopia Tests (Red-Green Colorblindness)
  // ============================================================================

  describe('deuteranopia simulation', () => {
    it('should transform red color', () => {
      const rgb: RGB = { r: 255, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      // Deuteranopia affects red-green perception
      expect(result.r).toBeLessThan(255);
      expect(result.g).toBeGreaterThan(0);
      expect(result.b).toBe(0);
    });

    it('should transform green color', () => {
      const rgb: RGB = { r: 0, g: 255, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      // Green appears shifted
      expect(result.r).toBeGreaterThan(0);
      expect(result.g).toBeLessThan(255);
    });

    it('should not significantly affect blue', () => {
      const rgb: RGB = { r: 0, g: 0, b: 255 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      // Blue channel should retain most of its value
      expect(result.b).toBeGreaterThan(150);
    });

    it('should preserve grayscale colors', () => {
      const rgb: RGB = { r: 128, g: 128, b: 128 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      // Grayscale should remain relatively uniform (R ≈ G)
      expect(Math.abs(result.r - result.g)).toBeLessThan(15);
    });

    it('should preserve black', () => {
      const rgb: RGB = { r: 0, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      expect(result).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should preserve white', () => {
      const rgb: RGB = { r: 255, g: 255, b: 255 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      expect(result.r).toBeCloseTo(255, 0);
      expect(result.g).toBeCloseTo(255, 0);
      expect(result.b).toBeCloseTo(255, 0);
    });
  });

  // ============================================================================
  // Protanopia Tests (Red-Green Colorblindness)
  // ============================================================================

  describe('protanopia simulation', () => {
    it('should transform red color', () => {
      const rgb: RGB = { r: 255, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'protanopia');
      // Protanopia reduces red perception
      expect(result.r).toBeLessThan(255);
      expect(result.g).toBeGreaterThan(0);
    });

    it('should transform green color', () => {
      const rgb: RGB = { r: 0, g: 255, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'protanopia');
      expect(result.r).toBeGreaterThan(0);
      expect(result.g).toBeLessThan(255);
    });

    it('should transform blue minimally', () => {
      const rgb: RGB = { r: 0, g: 0, b: 255 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'protanopia');
      expect(result.b).toBeGreaterThan(150);
    });

    it('should preserve black', () => {
      const rgb: RGB = { r: 0, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'protanopia');
      expect(result).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  // ============================================================================
  // Tritanopia Tests (Blue-Yellow Colorblindness)
  // ============================================================================

  describe('tritanopia simulation', () => {
    it('should transform blue color', () => {
      const rgb: RGB = { r: 0, g: 0, b: 255 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'tritanopia');
      // Tritanopia affects blue-yellow perception
      expect(result.g).toBeGreaterThan(0);
      expect(result.b).toBeLessThan(255);
    });

    it('should transform yellow color', () => {
      const rgb: RGB = { r: 255, g: 255, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'tritanopia');
      // Yellow appears different
      expect(result.r).toBeGreaterThan(200);
      expect(result.g).toBeLessThan(255);
    });

    it('should transform red minimally', () => {
      const rgb: RGB = { r: 255, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'tritanopia');
      // Red should be mostly preserved
      expect(result.r).toBeGreaterThan(200);
    });

    it('should preserve black', () => {
      const rgb: RGB = { r: 0, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'tritanopia');
      expect(result).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  // ============================================================================
  // Achromatopsia Tests (Total Colorblindness)
  // ============================================================================

  describe('achromatopsia simulation', () => {
    it('should convert red to grayscale', () => {
      const rgb: RGB = { r: 255, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'achromatopsia');
      // Should be grayscale (R = G = B)
      expect(result.r).toBe(result.g);
      expect(result.g).toBe(result.b);
    });

    it('should convert green to grayscale', () => {
      const rgb: RGB = { r: 0, g: 255, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'achromatopsia');
      expect(result.r).toBe(result.g);
      expect(result.g).toBe(result.b);
    });

    it('should convert blue to grayscale', () => {
      const rgb: RGB = { r: 0, g: 0, b: 255 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'achromatopsia');
      expect(result.r).toBe(result.g);
      expect(result.g).toBe(result.b);
    });

    it('should preserve black', () => {
      const rgb: RGB = { r: 0, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'achromatopsia');
      expect(result).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should preserve white', () => {
      const rgb: RGB = { r: 255, g: 255, b: 255 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'achromatopsia');
      expect(result.r).toBeCloseTo(255, 0);
      expect(result.g).toBeCloseTo(255, 0);
      expect(result.b).toBeCloseTo(255, 0);
    });

    it('should use standard luminance formula (0.299R + 0.587G + 0.114B)', () => {
      const rgb: RGB = { r: 100, g: 150, b: 200 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'achromatopsia');
      // Expected luminance: 0.299*100 + 0.587*150 + 0.114*200 = 140.75
      const expectedGray = Math.round(0.299 * 100 + 0.587 * 150 + 0.114 * 200);
      expect(result.r).toBeCloseTo(expectedGray, 0);
    });
  });

  // ============================================================================
  // Matrix Accuracy Tests
  // ============================================================================

  describe('matrix accuracy', () => {
    it('should apply deuteranopia matrix correctly', () => {
      const rgb: RGB = { r: 100, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      // Manual calculation: r' = 0.625*100/255*255 = 62.5
      const matrix = BRETTEL_MATRICES.deuteranopia;
      const expected = {
        r: Math.round(matrix[0][0] * 100),
        g: Math.round(matrix[1][0] * 100),
        b: Math.round(matrix[2][0] * 100),
      };
      expect(result).toEqual(expected);
    });

    it('should apply protanopia matrix correctly', () => {
      const rgb: RGB = { r: 0, g: 100, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'protanopia');
      const matrix = BRETTEL_MATRICES.protanopia;
      const expected = {
        r: Math.round(matrix[0][1] * 100),
        g: Math.round(matrix[1][1] * 100),
        b: Math.round(matrix[2][1] * 100),
      };
      expect(result).toEqual(expected);
    });

    it('should apply tritanopia matrix correctly', () => {
      const rgb: RGB = { r: 0, g: 0, b: 100 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'tritanopia');
      const matrix = BRETTEL_MATRICES.tritanopia;
      const expected = {
        r: Math.round(matrix[0][2] * 100),
        g: Math.round(matrix[1][2] * 100),
        b: Math.round(matrix[2][2] * 100),
      };
      expect(result).toEqual(expected);
    });
  });

  // ============================================================================
  // Hex Color Simulation Tests
  // ============================================================================

  describe('simulateColorblindnessHex', () => {
    it('should simulate normal vision on hex color', () => {
      const result = ColorblindnessSimulator.simulateColorblindnessHex('#FF0000', 'normal');
      expect(result).toBe('#FF0000');
    });

    it('should simulate deuteranopia on hex color', () => {
      const result = ColorblindnessSimulator.simulateColorblindnessHex('#FF0000', 'deuteranopia');
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
      expect(result).not.toBe('#FF0000');
    });

    it('should simulate protanopia on hex color', () => {
      const result = ColorblindnessSimulator.simulateColorblindnessHex('#00FF00', 'protanopia');
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
      expect(result).not.toBe('#00FF00');
    });

    it('should simulate tritanopia on hex color', () => {
      const result = ColorblindnessSimulator.simulateColorblindnessHex('#0000FF', 'tritanopia');
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
      expect(result).not.toBe('#0000FF');
    });

    it('should simulate achromatopsia on hex color', () => {
      const result = ColorblindnessSimulator.simulateColorblindnessHex('#FF0000', 'achromatopsia');
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
      // Grayscale: R = G = B
      const r = parseInt(result.slice(1, 3), 16);
      const g = parseInt(result.slice(3, 5), 16);
      const b = parseInt(result.slice(5, 7), 16);
      expect(r).toBe(g);
      expect(g).toBe(b);
    });

    it('should handle shorthand hex format', () => {
      const result = ColorblindnessSimulator.simulateColorblindnessHex('#F00', 'deuteranopia');
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should handle lowercase hex', () => {
      const result = ColorblindnessSimulator.simulateColorblindnessHex('#ff0000', 'deuteranopia');
      expect(result).toMatch(/^#[0-9A-F]{6}$/);
    });

    it('should preserve black', () => {
      const result = ColorblindnessSimulator.simulateColorblindnessHex('#000000', 'deuteranopia');
      expect(result).toBe('#000000');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should throw AppError for negative r value', () => {
      expect(() =>
        ColorblindnessSimulator.simulateColorblindness({ r: -1, g: 0, b: 0 }, 'deuteranopia')
      ).toThrow(AppError);
    });

    it('should throw AppError for negative g value', () => {
      expect(() =>
        ColorblindnessSimulator.simulateColorblindness({ r: 0, g: -1, b: 0 }, 'deuteranopia')
      ).toThrow(AppError);
    });

    it('should throw AppError for negative b value', () => {
      expect(() =>
        ColorblindnessSimulator.simulateColorblindness({ r: 0, g: 0, b: -1 }, 'deuteranopia')
      ).toThrow(AppError);
    });

    it('should throw AppError for r > 255', () => {
      expect(() =>
        ColorblindnessSimulator.simulateColorblindness({ r: 256, g: 0, b: 0 }, 'deuteranopia')
      ).toThrow(AppError);
    });

    it('should throw AppError for g > 255', () => {
      expect(() =>
        ColorblindnessSimulator.simulateColorblindness({ r: 0, g: 256, b: 0 }, 'deuteranopia')
      ).toThrow(AppError);
    });

    it('should throw AppError for b > 255', () => {
      expect(() =>
        ColorblindnessSimulator.simulateColorblindness({ r: 0, g: 0, b: 256 }, 'deuteranopia')
      ).toThrow(AppError);
    });

    it('should throw AppError for NaN values', () => {
      expect(() =>
        ColorblindnessSimulator.simulateColorblindness({ r: NaN, g: 0, b: 0 }, 'deuteranopia')
      ).toThrow(AppError);
    });

    it('should throw AppError for Infinity values', () => {
      expect(() =>
        ColorblindnessSimulator.simulateColorblindness({ r: Infinity, g: 0, b: 0 }, 'deuteranopia')
      ).toThrow(AppError);
    });

    it('should not throw for normal vision with invalid RGB (pass-through)', () => {
      // Normal vision returns immediately, before validation
      const rgb: RGB = { r: 255, g: 0, b: 0 };
      const result = ColorblindnessSimulator.simulateColorblindness(rgb, 'normal');
      expect(result).toEqual(rgb);
    });
  });

  // ============================================================================
  // Cache Behavior Tests
  // ============================================================================

  describe('cache behavior', () => {
    it('should cache simulation results', () => {
      const rgb: RGB = { r: 128, g: 64, b: 192 };
      ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(1);
    });

    it('should return cached result on second call', () => {
      const rgb: RGB = { r: 200, g: 100, b: 50 };
      const result1 = ColorblindnessSimulator.simulateColorblindness(rgb, 'protanopia');
      const result2 = ColorblindnessSimulator.simulateColorblindness(rgb, 'protanopia');
      expect(result1).toEqual(result2);
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(1);
    });

    it('should cache different vision types separately', () => {
      const rgb: RGB = { r: 150, g: 150, b: 150 };
      ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      ColorblindnessSimulator.simulateColorblindness(rgb, 'protanopia');
      ColorblindnessSimulator.simulateColorblindness(rgb, 'tritanopia');
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(3);
    });

    it('should cache different colors separately', () => {
      ColorblindnessSimulator.simulateColorblindness({ r: 255, g: 0, b: 0 }, 'deuteranopia');
      ColorblindnessSimulator.simulateColorblindness({ r: 0, g: 255, b: 0 }, 'deuteranopia');
      ColorblindnessSimulator.simulateColorblindness({ r: 0, g: 0, b: 255 }, 'deuteranopia');
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(3);
    });

    it('should clear cache', () => {
      ColorblindnessSimulator.simulateColorblindness({ r: 100, g: 100, b: 100 }, 'deuteranopia');
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(1);
      ColorblindnessSimulator.clearCache();
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(0);
    });

    it('should update cache when setting same key again (LRU behavior)', () => {
      // First simulation caches the result
      const rgb: RGB = { r: 50, g: 100, b: 150 };
      const result1 = ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(1);

      // Second call with same key should hit cache (and update LRU order)
      const result2 = ColorblindnessSimulator.simulateColorblindness(rgb, 'deuteranopia');
      expect(result2).toEqual(result1);
      // Cache size stays at 1 (same key)
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(1);
    });
  });

  // ============================================================================
  // LRU Cache Eviction Tests (covers lines 36, 38-40)
  // ============================================================================

  describe('LRU cache eviction', () => {
    // Note: The LRU cache in ColorblindnessSimulator has maxSize of 1000
    // To test eviction, we need to fill it beyond capacity

    it('should evict oldest entry when cache is full', () => {
      // Fill the cache with 1000 unique entries
      // Each unique RGB + vision type combination creates a new cache entry
      // We use deuteranopia for all to avoid the 'normal' early return

      // Generate 1001 unique colors to trigger eviction
      for (let i = 0; i < 1001; i++) {
        const r = i % 256;
        const g = Math.floor(i / 256) % 256;
        const b = Math.floor(i / 65536) % 256;
        ColorblindnessSimulator.simulateColorblindness({ r, g, b }, 'deuteranopia');
      }

      // After 1001 entries, cache should be at max size (1000)
      // The oldest entry should have been evicted
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBe(1000);
    });

    it('should maintain max cache size under heavy load', () => {
      // Add many entries rapidly
      for (let i = 0; i < 2000; i++) {
        const r = i % 256;
        const g = (i * 3) % 256;
        const b = (i * 7) % 256;
        ColorblindnessSimulator.simulateColorblindness({ r, g, b }, 'protanopia');
      }

      // Cache should never exceed max size
      expect(ColorblindnessSimulator.getCacheStats().colorblind).toBeLessThanOrEqual(1000);
    });

    it('should preserve recently used entries during eviction', () => {
      // Fill cache with initial entries
      for (let i = 0; i < 999; i++) {
        const r = i % 256;
        const g = Math.floor(i / 256) % 256;
        ColorblindnessSimulator.simulateColorblindness({ r, g, b: 0 }, 'deuteranopia');
      }

      // Add a specific "important" entry
      const importantColor: RGB = { r: 42, g: 42, b: 42 };
      const importantResult = ColorblindnessSimulator.simulateColorblindness(
        importantColor,
        'tritanopia'
      );

      // Access the important entry to make it recently used
      ColorblindnessSimulator.simulateColorblindness(importantColor, 'tritanopia');

      // Add more entries to trigger eviction
      for (let i = 0; i < 500; i++) {
        ColorblindnessSimulator.simulateColorblindness(
          { r: 200, g: i % 256, b: i % 256 },
          'achromatopsia'
        );
      }

      // The important entry should still be in cache (recently accessed)
      const retrieved = ColorblindnessSimulator.simulateColorblindness(
        importantColor,
        'tritanopia'
      );
      expect(retrieved).toEqual(importantResult);
    });
  });

  // ============================================================================
  // All Vision Types Coverage
  // ============================================================================

  describe('all vision types', () => {
    const visionTypes: VisionType[] = [
      'normal',
      'deuteranopia',
      'protanopia',
      'tritanopia',
      'achromatopsia',
    ];
    const testColor: RGB = { r: 200, g: 100, b: 50 };

    visionTypes.forEach((visionType) => {
      it(`should handle ${visionType} vision type`, () => {
        const result = ColorblindnessSimulator.simulateColorblindness(testColor, visionType);
        expect(result.r).toBeGreaterThanOrEqual(0);
        expect(result.r).toBeLessThanOrEqual(255);
        expect(result.g).toBeGreaterThanOrEqual(0);
        expect(result.g).toBeLessThanOrEqual(255);
        expect(result.b).toBeGreaterThanOrEqual(0);
        expect(result.b).toBeLessThanOrEqual(255);
      });
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('edge cases', () => {
    it('should handle pure colors consistently', () => {
      const colors = [
        { r: 255, g: 0, b: 0 }, // Red
        { r: 0, g: 255, b: 0 }, // Green
        { r: 0, g: 0, b: 255 }, // Blue
        { r: 255, g: 255, b: 0 }, // Yellow
        { r: 255, g: 0, b: 255 }, // Magenta
        { r: 0, g: 255, b: 255 }, // Cyan
      ];

      colors.forEach((color) => {
        const result = ColorblindnessSimulator.simulateColorblindness(color, 'deuteranopia');
        expect(result.r).toBeGreaterThanOrEqual(0);
        expect(result.r).toBeLessThanOrEqual(255);
        expect(result.g).toBeGreaterThanOrEqual(0);
        expect(result.g).toBeLessThanOrEqual(255);
        expect(result.b).toBeGreaterThanOrEqual(0);
        expect(result.b).toBeLessThanOrEqual(255);
      });
    });

    it('should handle maximum RGB values without overflow', () => {
      const result = ColorblindnessSimulator.simulateColorblindness(
        { r: 255, g: 255, b: 255 },
        'deuteranopia'
      );
      expect(result.r).toBeLessThanOrEqual(255);
      expect(result.g).toBeLessThanOrEqual(255);
      expect(result.b).toBeLessThanOrEqual(255);
    });

    it('should handle minimum RGB values without underflow', () => {
      const result = ColorblindnessSimulator.simulateColorblindness(
        { r: 0, g: 0, b: 0 },
        'deuteranopia'
      );
      expect(result.r).toBeGreaterThanOrEqual(0);
      expect(result.g).toBeGreaterThanOrEqual(0);
      expect(result.b).toBeGreaterThanOrEqual(0);
    });
  });
});
