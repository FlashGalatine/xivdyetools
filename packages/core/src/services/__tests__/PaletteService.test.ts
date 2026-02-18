/**
 * Unit tests for PaletteService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaletteService } from '../PaletteService.js';
import type { RGB } from '../../types/index.js';

// Mock DyeService for testing extractAndMatchPalette
const createMockDyeService = () => ({
  findClosestDye: vi.fn((_hex: string) => ({
    id: 1,
    itemID: 30116,
    name: 'Dalamud Red',
    hex: '#AA1111',
    rgb: { r: 170, g: 17, b: 17 },
    hsv: { h: 0, s: 90, v: 67 },
    category: 'Red',
    acquisition: 'Marketboard',
    cost: 0,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
  })),
});

describe('PaletteService', () => {
  let service: PaletteService;

  beforeEach(() => {
    service = new PaletteService();
  });

  describe('extractPalette', () => {
    it('should return empty array for empty pixel input', () => {
      const result = service.extractPalette([]);
      expect(result).toEqual([]);
    });

    it('should extract correct number of colors', () => {
      // Generate 100 red, 50 blue, 30 green pixels
      const pixels: RGB[] = [
        ...Array(100).fill({ r: 255, g: 0, b: 0 }),
        ...Array(50).fill({ r: 0, g: 0, b: 255 }),
        ...Array(30).fill({ r: 0, g: 255, b: 0 }),
      ];

      const result = service.extractPalette(pixels, { colorCount: 3 });

      expect(result).toHaveLength(3);
    });

    it('should return colors sorted by dominance (most dominant first)', () => {
      // Generate distinct clusters with known sizes
      const pixels: RGB[] = [
        ...Array(100).fill({ r: 255, g: 0, b: 0 }), // 100 red pixels
        ...Array(50).fill({ r: 0, g: 0, b: 255 }), // 50 blue pixels
        ...Array(30).fill({ r: 0, g: 255, b: 0 }), // 30 green pixels
      ];

      const result = service.extractPalette(pixels, { colorCount: 3 });

      // First color should have highest dominance
      expect(result[0].dominance).toBeGreaterThanOrEqual(result[1].dominance);
      expect(result[1].dominance).toBeGreaterThanOrEqual(result[2].dominance);
    });

    it('should handle single-color images', () => {
      const pixels: RGB[] = Array(100).fill({ r: 128, g: 128, b: 128 });

      const result = service.extractPalette(pixels, { colorCount: 3 });

      // Should still return requested colors (though they'll be similar)
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should calculate dominance percentages correctly', () => {
      // 60% red, 40% blue
      const pixels: RGB[] = [
        ...Array(60).fill({ r: 255, g: 0, b: 0 }),
        ...Array(40).fill({ r: 0, g: 0, b: 255 }),
      ];

      const result = service.extractPalette(pixels, { colorCount: 2 });

      // Dominance should sum to ~100%
      const totalDominance = result.reduce((sum, c) => sum + c.dominance, 0);
      expect(totalDominance).toBeGreaterThanOrEqual(98);
      expect(totalDominance).toBeLessThanOrEqual(102); // Allow rounding tolerance
    });

    it('should extract red as dominant color from red-heavy image', () => {
      const pixels: RGB[] = [
        ...Array(100).fill({ r: 200, g: 50, b: 50 }), // 100 reddish pixels
        ...Array(20).fill({ r: 50, g: 50, b: 200 }), // 20 bluish pixels
      ];

      const result = service.extractPalette(pixels, { colorCount: 2 });

      // First (most dominant) color should be reddish
      const dominant = result[0].color;
      expect(dominant.r).toBeGreaterThan(dominant.g);
      expect(dominant.r).toBeGreaterThan(dominant.b);
    });

    it('should sample pixels when exceeding maxSamples', () => {
      // Create more pixels than default maxSamples
      const pixels: RGB[] = Array(20000).fill({ r: 100, g: 150, b: 200 });

      // Should complete without error and return results
      const result = service.extractPalette(pixels, { colorCount: 2, maxSamples: 1000 });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should respect maxIterations option', () => {
      const pixels: RGB[] = [
        ...Array(50).fill({ r: 255, g: 0, b: 0 }),
        ...Array(50).fill({ r: 0, g: 0, b: 255 }),
      ];

      // Should complete even with low iterations
      const result = service.extractPalette(pixels, { colorCount: 2, maxIterations: 1 });

      expect(result).toHaveLength(2);
    });

    it('should clamp colorCount to valid range', () => {
      const pixels: RGB[] = Array(50).fill({ r: 100, g: 100, b: 100 });

      // Too high - should clamp to 10
      const resultHigh = service.extractPalette(pixels, { colorCount: 100 });
      expect(resultHigh.length).toBeLessThanOrEqual(10);

      // Too low - should clamp to 1
      const resultLow = service.extractPalette(pixels, { colorCount: -5 });
      expect(resultLow.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('extractAndMatchPalette', () => {
    it('should return matched dyes for each extracted color', () => {
      const mockDyeService = createMockDyeService();
      const pixels: RGB[] = [
        ...Array(50).fill({ r: 255, g: 0, b: 0 }),
        ...Array(30).fill({ r: 0, g: 0, b: 255 }),
      ];

      const result = service.extractAndMatchPalette(pixels, mockDyeService as any, {
        colorCount: 2,
      });

      expect(result).toHaveLength(2);
      expect(mockDyeService.findClosestDye).toHaveBeenCalledTimes(2);

      // Each result should have matched dye info
      result.forEach((match) => {
        expect(match.extracted).toBeDefined();
        expect(match.matchedDye).toBeDefined();
        expect(typeof match.distance).toBe('number');
        expect(typeof match.dominance).toBe('number');
      });
    });

    it('should preserve dominance order from extraction', () => {
      const mockDyeService = createMockDyeService();
      const pixels: RGB[] = [
        ...Array(80).fill({ r: 255, g: 0, b: 0 }), // 80% red
        ...Array(20).fill({ r: 0, g: 0, b: 255 }), // 20% blue
      ];

      const result = service.extractAndMatchPalette(pixels, mockDyeService as any, {
        colorCount: 2,
      });

      // First match should have higher dominance
      expect(result[0].dominance).toBeGreaterThanOrEqual(result[1].dominance);
    });
  });

  describe('pixelDataToRGB', () => {
    it('should convert flat RGBA array to RGB objects', () => {
      // RGBA data: 2 pixels
      const data = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // Red, fully opaque
        0,
        255,
        0,
        128, // Green, semi-transparent
      ]);

      const result = PaletteService.pixelDataToRGB(data);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ r: 255, g: 0, b: 0 });
      expect(result[1]).toEqual({ r: 0, g: 255, b: 0 });
    });

    it('should handle empty array', () => {
      const data = new Uint8ClampedArray([]);
      const result = PaletteService.pixelDataToRGB(data);
      expect(result).toEqual([]);
    });

    it('should work with regular number array', () => {
      const data = [100, 150, 200, 255];
      const result = PaletteService.pixelDataToRGB(data);
      expect(result).toEqual([{ r: 100, g: 150, b: 200 }]);
    });
  });

  describe('pixelDataToRGBFiltered', () => {
    it('should filter out transparent pixels', () => {
      const data = new Uint8ClampedArray([
        255,
        0,
        0,
        255, // Red, opaque - include
        0,
        255,
        0,
        0, // Green, transparent - exclude
        0,
        0,
        255,
        200, // Blue, mostly opaque - include
      ]);

      const result = PaletteService.pixelDataToRGBFiltered(data);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ r: 255, g: 0, b: 0 });
      expect(result[1]).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should respect custom alpha threshold', () => {
      const data = new Uint8ClampedArray([
        255,
        0,
        0,
        100, // Red, alpha 100
        0,
        255,
        0,
        150, // Green, alpha 150
        0,
        0,
        255,
        200, // Blue, alpha 200
      ]);

      // With threshold 120, only green and blue should pass
      const result = PaletteService.pixelDataToRGBFiltered(data, 120);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ r: 0, g: 255, b: 0 });
      expect(result[1]).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should include all pixels with threshold 0', () => {
      const data = new Uint8ClampedArray([
        255,
        0,
        0,
        0, // Red, alpha 0
        0,
        255,
        0,
        1, // Green, alpha 1
      ]);

      const result = PaletteService.pixelDataToRGBFiltered(data, 0);

      expect(result).toHaveLength(2);
    });
  });

  describe('K-means clustering behavior', () => {
    it('should converge to stable centroids', () => {
      // Run extraction twice with same input
      const pixels: RGB[] = [
        ...Array(50).fill({ r: 255, g: 0, b: 0 }),
        ...Array(50).fill({ r: 0, g: 255, b: 0 }),
      ];

      const result1 = service.extractPalette(pixels, { colorCount: 2, maxIterations: 50 });
      const result2 = service.extractPalette(pixels, { colorCount: 2, maxIterations: 50 });

      // Both runs should find similar clusters (order might differ due to random init)
      // But dominance totals should be similar
      const total1 = result1.reduce((sum, c) => sum + c.dominance, 0);
      const total2 = result2.reduce((sum, c) => sum + c.dominance, 0);

      expect(Math.abs(total1 - total2)).toBeLessThan(5);
    });

    it('should handle images with many similar colors', () => {
      // Gradient-like image with slight variations
      const pixels: RGB[] = [];
      for (let i = 0; i < 100; i++) {
        pixels.push({ r: 100 + i, g: 50, b: 50 }); // Red gradient
      }

      const result = service.extractPalette(pixels, { colorCount: 3 });

      expect(result).toHaveLength(3);
      // All extracted colors should be reddish
      result.forEach((extracted) => {
        expect(extracted.color.r).toBeGreaterThan(extracted.color.g);
        expect(extracted.color.r).toBeGreaterThan(extracted.color.b);
      });
    });
  });
});
