/**
 * Unit tests for PaletteService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaletteService } from '../PaletteService.js';
import type { RGB } from '@xivdyetools/types';

// Mock DyeService for testing extractAndMatchPalette
const createMockDyeService = () => ({
  findClosestDye: vi.fn((_hex: string, _opts?: { matchingMethod?: string }) => ({
    id: 1,
    itemID: 30116,
    name: 'Dalamud Red',
    hex: '#AA1111',
    rgb: { r: 170, g: 17, b: 17 },
    hsv: { h: 0, s: 90, v: 67 },
    category: 'Red',
    acquisition: 'Marketboard',
    cost: 0,
    currency: 'Gil',
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

    it('returns one cluster for a single-color image, not colorCount copies of it (BUG-036)', () => {
      const pixels: RGB[] = Array(100).fill({ r: 128, g: 128, b: 128 });

      const result = service.extractPalette(pixels, { colorCount: 3 });

      expect(result).toEqual([
        { color: { r: 128, g: 128, b: 128 }, dominance: 100, pixelCount: 100 },
      ]);
    });

    it('returns only the colors an image holds when it has fewer than colorCount (BUG-036)', () => {
      // A flat two-colour icon asked for five colours. k used to be capped at
      // the PIXEL count, so k-means++ cloned an existing centroid for each of
      // the three surplus slots and they came back as 0-pixel clusters. The
      // counts are unequal so the dominance order does not depend on the
      // random first seed.
      const pixels: RGB[] = [
        ...Array(60).fill({ r: 255, g: 0, b: 0 }),
        ...Array(40).fill({ r: 0, g: 0, b: 255 }),
      ];

      const result = service.extractPalette(pixels, { colorCount: 5 });

      expect(result).toEqual([
        { color: { r: 255, g: 0, b: 0 }, dominance: 60, pixelCount: 60 },
        { color: { r: 0, g: 0, b: 255 }, dominance: 40, pixelCount: 40 },
      ]);
    });

    it('seeds no more centroids than the image has distinct colors (BUG-036)', () => {
      // The cap itself. k-means++ draws one Math.random() per seed, so a
      // two-colour image asked for five colours must draw two — not five, three
      // of which could only clone an existing centroid. The empty-cluster
      // filter would hide such clones from the result; this pins that they are
      // never seeded at all.
      const random = vi.spyOn(Math, 'random');
      try {
        const pixels: RGB[] = [
          ...Array(60).fill({ r: 255, g: 0, b: 0 }),
          ...Array(40).fill({ r: 0, g: 0, b: 255 }),
        ];

        service.extractPalette(pixels, { colorCount: 5 });

        expect(random).toHaveBeenCalledTimes(2);
      } finally {
        random.mockRestore();
      }
    });

    it('never returns an empty cluster, even when k-means strands a centroid (BUG-036)', () => {
      // Three distinct colours and colorCount 3, so the distinct-colour cap
      // does not apply. Math.random() → 0 seeds every centroid on pixel 0
      // (red); the strict `<` tie-break then hands every tie to the lowest
      // index, so the third centroid never wins a pixel. Lloyd's algorithm can
      // strand a centroid like this on real input too — the result must still
      // carry only clusters that hold pixels.
      const random = vi.spyOn(Math, 'random').mockReturnValue(0);
      try {
        const pixels: RGB[] = [
          ...Array(10).fill({ r: 255, g: 0, b: 0 }),
          ...Array(45).fill({ r: 0, g: 0, b: 255 }),
          ...Array(45).fill({ r: 0, g: 255, b: 0 }),
        ];

        const result = service.extractPalette(pixels, { colorCount: 3 });

        expect(result.length).toBeGreaterThan(0);
        for (const cluster of result) {
          expect(cluster.pixelCount).toBeGreaterThan(0);
          expect(cluster.dominance).toBeGreaterThan(0);
        }
        expect(result.reduce((sum, c) => sum + c.pixelCount, 0)).toBe(pixels.length);
      } finally {
        random.mockRestore();
      }
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

      // Too high - should clamp to 10. The input needs MORE than 10 distinct
      // colours: k is also capped at the distinct-colour count (BUG-036), so a
      // flat image returns one cluster with or without this clamp.
      const manyColors: RGB[] = Array.from({ length: 50 }, (_, i) => ({ r: i * 5, g: 0, b: 0 }));
      const resultHigh = service.extractPalette(manyColors, { colorCount: 100 });
      expect(resultHigh).toHaveLength(10);

      // Too low - should clamp to 1
      const resultLow = service.extractPalette(pixels, { colorCount: -5 });
      expect(resultLow.length).toBeGreaterThanOrEqual(1);
    });

    // Twelve well-separated colours keep the BUG-036 distinct-colour cap above
    // every k the colorCount tests below ask for, and k-means++ draws one
    // Math.random() per seed, so the call count is k.
    const twelveColors: RGB[] = Array.from({ length: 12 }, (_, i) => ({
      r: i * 20,
      g: 255 - i * 20,
      b: (i * 67) % 256,
    }));

    describe('a colorCount that is not a finite number uses the default 4', () => {
      // The BUG-036 cap counts distinct colours only until it reaches k, and
      // `seen.size >= NaN` is never true — so a NaN k (or an explicit
      // `colorCount: undefined`, which the clamp turned into NaN) made k EVERY
      // distinct colour in the sample. Before that cap the same NaN gave one
      // cluster; neither is the documented default.
      it.each([
        ['NaN', { colorCount: NaN }],
        ['an explicit undefined', { colorCount: undefined }],
        ['+Infinity', { colorCount: Infinity }],
        ['-Infinity', { colorCount: -Infinity }],
      ])('%s seeds 4 centroids and logs one warning', (_label, options) => {
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const random = vi.spyOn(Math, 'random');
        try {
          const result = new PaletteService({ logger }).extractPalette(twelveColors, options);

          expect(random).toHaveBeenCalledTimes(4);
          expect(result.length).toBeGreaterThan(0);
          expect(result.length).toBeLessThanOrEqual(4);
          expect(logger.warn).toHaveBeenCalledTimes(1);
          expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('is not a finite number'),
          );
        } finally {
          random.mockRestore();
        }
      });

      it('leaves a finite colorCount alone, with no warning', () => {
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const random = vi.spyOn(Math, 'random');
        try {
          new PaletteService({ logger }).extractPalette(twelveColors, { colorCount: 6 });

          expect(random).toHaveBeenCalledTimes(6);
          expect(logger.warn).not.toHaveBeenCalled();
        } finally {
          random.mockRestore();
        }
      });
    });

    describe('a fractional colorCount is floored, never rounded up', () => {
      // colorCount is a MAXIMUM, so 2.5 means "at most 2". The distinct-colour
      // cap counts until `seen.size >= limit`, which for 2.5 only stops at 3 —
      // so a fractional count seeded one centroid more than it allows and the
      // result could hold 3 entries.
      it.each([
        [2.5, 2],
        [1.2, 1],
      ])('colorCount %s seeds %i centroid(s) and returns at most that many', (colorCount, k) => {
        const random = vi.spyOn(Math, 'random');
        try {
          const result = service.extractPalette(twelveColors, { colorCount });

          expect(random).toHaveBeenCalledTimes(k);
          expect(result.length).toBeGreaterThan(0);
          expect(result.length).toBeLessThanOrEqual(k);
        } finally {
          random.mockRestore();
        }
      });
    });

    describe('a maxSamples that is not a finite number uses the default 10000', () => {
      // An explicit `{ maxSamples: undefined }` survives the options spread,
      // and neither it nor NaN trips the `< 2` guard, so Math.max(2, NaN)
      // handed samplePixels a NaN bound: `length <= NaN` is false and
      // `i < NaN` never runs, so every pixel was dropped and the call returned
      // [] without a word. 20000 pixels exceed the default, so the summed
      // pixelCount is the sample size.
      const pixels: RGB[] = [
        ...Array(12000).fill({ r: 255, g: 0, b: 0 }),
        ...Array(8000).fill({ r: 0, g: 0, b: 255 }),
      ];

      it.each([
        ['NaN', { maxSamples: NaN }],
        ['an explicit undefined', { maxSamples: undefined }],
        ['+Infinity', { maxSamples: Infinity }],
        ['-Infinity', { maxSamples: -Infinity }],
      ])('%s samples 10000 pixels and logs one warning', (_label, options) => {
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

        const result = new PaletteService({ logger }).extractPalette(pixels, {
          colorCount: 2,
          ...options,
        });

        expect(result.reduce((sum, c) => sum + c.pixelCount, 0)).toBe(10000);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringMatching(/maxSamples .* is not a finite number/),
        );
      });

      // A fractional bound ran samplePixels' loop ceil(n) times with the
      // spacing computed from the fraction, so the last index ran past the
      // array: 2.5 on 100 pixels read pixels[132] and threw a TypeError.
      it('floors a fractional maxSamples instead of reading past the array', () => {
        const hundred: RGB[] = Array.from({ length: 100 }, (_, i) => ({ r: i, g: 0, b: 0 }));

        const result = new PaletteService().extractPalette(hundred, {
          colorCount: 2,
          maxSamples: 2.5,
        });

        expect(result.reduce((sum, c) => sum + c.pixelCount, 0)).toBe(2);
      });

      it('leaves a finite maxSamples alone, with no warning', () => {
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

        const result = new PaletteService({ logger }).extractPalette(pixels, {
          colorCount: 2,
          maxSamples: 1000,
        });

        expect(result.reduce((sum, c) => sum + c.pixelCount, 0)).toBe(1000);
        expect(logger.warn).not.toHaveBeenCalled();
      });
    });

    describe('a maxIterations that is not a finite number uses the default 25', () => {
      // `{ maxIterations: undefined }` and NaN slipped past both sides of the
      // [1, 100] clamp, so `iter < NaN` skipped every Lloyd iteration and the
      // palette was just the k-means++ seeds. Math.random() → 0 seeds the one
      // centroid on pixel 0 (black); any iteration moves it to the mean.
      const pixels: RGB[] = [
        ...Array(50).fill({ r: 0, g: 0, b: 0 }),
        ...Array(50).fill({ r: 200, g: 200, b: 200 }),
      ];

      it.each([
        ['NaN', { maxIterations: NaN }],
        ['an explicit undefined', { maxIterations: undefined }],
        ['+Infinity', { maxIterations: Infinity }],
        ['-Infinity', { maxIterations: -Infinity }],
      ])('%s runs the k-means iterations and logs one warning', (_label, options) => {
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const random = vi.spyOn(Math, 'random').mockReturnValue(0);
        try {
          const result = new PaletteService({ logger }).extractPalette(pixels, {
            colorCount: 1,
            ...options,
          });

          expect(result).toEqual([
            { color: { r: 100, g: 100, b: 100 }, dominance: 100, pixelCount: 100 },
          ]);
          expect(logger.warn).toHaveBeenCalledTimes(1);
          expect(logger.warn).toHaveBeenCalledWith(
            expect.stringMatching(/maxIterations .* is not a finite number/),
          );
        } finally {
          random.mockRestore();
        }
      });
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

    it('matches a dye only for colors the image holds when it has fewer than colorCount (BUG-036)', () => {
      // The Discord /extractor path: a surplus 0-pixel cluster used to get its
      // own (fabricated) dye recommendation and a 0% row on the card.
      const mockDyeService = createMockDyeService();
      const pixels: RGB[] = [
        ...Array(60).fill({ r: 255, g: 0, b: 0 }),
        ...Array(40).fill({ r: 0, g: 0, b: 255 }),
      ];

      const result = service.extractAndMatchPalette(pixels, mockDyeService as any, {
        colorCount: 5,
      });

      expect(mockDyeService.findClosestDye).toHaveBeenCalledTimes(2);
      expect(result.map((m) => [m.extracted, m.dominance])).toEqual([
        [{ r: 255, g: 0, b: 0 }, 60],
        [{ r: 0, g: 0, b: 255 }, 40],
      ]);
    });

    it('forwards matchingMethod to DyeService.findClosestDye (default: none → DyeService default)', () => {
      const mockDyeService = createMockDyeService();
      const pixels: RGB[] = [
        ...Array(50).fill({ r: 255, g: 0, b: 0 }),
        ...Array(30).fill({ r: 0, g: 0, b: 255 }),
      ];

      service.extractAndMatchPalette(pixels, mockDyeService as any, { colorCount: 2 });
      // No method requested → the search's own default applies (nothing forced)
      for (const call of mockDyeService.findClosestDye.mock.calls) {
        expect(call[1]?.matchingMethod).toBeUndefined();
      }

      mockDyeService.findClosestDye.mockClear();
      service.extractAndMatchPalette(pixels, mockDyeService as any, {
        colorCount: 2,
        matchingMethod: 'redmean',
      });
      expect(mockDyeService.findClosestDye).toHaveBeenCalledTimes(2);
      for (const call of mockDyeService.findClosestDye.mock.calls) {
        expect(call[1]).toEqual({ matchingMethod: 'redmean' });
      }
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
