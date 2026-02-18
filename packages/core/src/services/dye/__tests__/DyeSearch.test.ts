import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DyeSearch } from '../DyeSearch.js';
import { DyeDatabase } from '../DyeDatabase.js';
import type { Dye } from '../../../types/index.js';

describe('DyeSearch', () => {
  let database: DyeDatabase;
  let search: DyeSearch;

  const mockDyes: Dye[] = [
    {
      itemID: 5729,
      id: 5729,
      name: 'Snow White',
      hex: '#FFFFFF',
      rgb: { r: 255, g: 255, b: 255 },
      hsv: { h: 0, s: 0, v: 100 },
      category: 'Neutral',
      acquisition: 'Dye Vendor',
      cost: 200,
    },
    {
      itemID: 5740,
      id: 5740,
      name: 'Wine Red',
      hex: '#4D1818',
      rgb: { r: 77, g: 24, b: 24 },
      hsv: { h: 0, s: 69, v: 30 },
      category: 'Reds',
      acquisition: 'Crafting',
      cost: 0,
    },
    {
      itemID: 5741,
      id: 5741,
      name: 'Rust Red',
      hex: '#6B2929',
      rgb: { r: 107, g: 41, b: 41 },
      hsv: { h: 0, s: 62, v: 42 },
      category: 'Reds',
      acquisition: 'Dye Vendor',
      cost: 200,
    },
    {
      itemID: 5742,
      id: 5742,
      name: 'Sky Blue',
      hex: '#87CEEB',
      rgb: { r: 135, g: 206, b: 235 },
      hsv: { h: 197, s: 43, v: 92 },
      category: 'Blues',
      acquisition: 'Dye Vendor',
      cost: 200,
    },
    {
      itemID: 5743,
      id: 5743,
      name: 'Forest Green',
      hex: '#228B22',
      rgb: { r: 34, g: 139, b: 34 },
      hsv: { h: 120, s: 76, v: 55 },
      category: 'Greens',
      acquisition: 'Crafting',
      cost: 0,
    },
    {
      itemID: 13116,
      id: 13116,
      name: 'Metallic Silver',
      hex: '#8C8C8C',
      rgb: { r: 140, g: 140, b: 140 },
      hsv: { h: 0, s: 0, v: 55 },
      category: 'Neutral',
      acquisition: 'Ixali Vendor',
      cost: 10000,
    },
    {
      itemID: 9999,
      id: 9999,
      name: 'Facewear Red',
      hex: '#FF0000',
      rgb: { r: 255, g: 0, b: 0 },
      hsv: { h: 0, s: 100, v: 100 },
      category: 'Facewear',
      acquisition: 'Special',
      cost: 50000,
    },
  ];

  beforeEach(() => {
    database = new DyeDatabase();
    database.initialize(mockDyes);
    search = new DyeSearch(database);
  });

  describe('searchByName', () => {
    it('should find dyes by exact name', () => {
      const results = search.searchByName('Snow White');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Snow White');
    });

    it('should be case-insensitive', () => {
      const results = search.searchByName('snow white');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Snow White');
    });

    it('should find dyes by partial match', () => {
      const results = search.searchByName('Red');
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((d) => d.name === 'Wine Red')).toBe(true);
      expect(results.some((d) => d.name === 'Rust Red')).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const results = search.searchByName('Nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return empty array for empty query', () => {
      const results = search.searchByName('');
      expect(results).toHaveLength(0);
    });

    it('should trim whitespace', () => {
      const results = search.searchByName('  Snow White  ');
      expect(results).toHaveLength(1);
    });

    it('should find multiple matches', () => {
      const results = search.searchByName('Metallic');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((d) => d.name === 'Metallic Silver')).toBe(true);
    });
  });

  describe('searchByCategory', () => {
    it('should find all dyes in Reds category', () => {
      const results = search.searchByCategory('Reds');
      expect(results).toHaveLength(2);
      expect(results.every((d) => d.category === 'Reds')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const results = search.searchByCategory('reds');
      expect(results).toHaveLength(2);
    });

    it('should find Neutral category', () => {
      const results = search.searchByCategory('Neutral');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for non-existent category', () => {
      const results = search.searchByCategory('Nonexistent');
      expect(results).toHaveLength(0);
    });

    it('should find single-item categories', () => {
      const results = search.searchByCategory('Blues');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Sky Blue');
    });
  });

  describe('filterDyes', () => {
    it('should return all dyes with no filter', () => {
      const results = search.filterDyes();
      expect(results).toHaveLength(7);
    });

    it('should filter by category', () => {
      const results = search.filterDyes({ category: 'Reds' });
      expect(results).toHaveLength(2);
      expect(results.every((d) => d.category === 'Reds')).toBe(true);
    });

    it('should filter by excludeIds', () => {
      const results = search.filterDyes({ excludeIds: [5729, 5740] });
      expect(results).toHaveLength(5);
      expect(results.every((d) => d.id !== 5729 && d.id !== 5740)).toBe(true);
    });

    it('should filter by minPrice', () => {
      const results = search.filterDyes({ minPrice: 200 });
      const allAboveMin = results.every((d) => d.cost >= 200);
      expect(allAboveMin).toBe(true);
    });

    it('should filter by maxPrice', () => {
      const results = search.filterDyes({ maxPrice: 200 });
      const allBelowMax = results.every((d) => d.cost <= 200);
      expect(allBelowMax).toBe(true);
    });

    it('should filter by price range', () => {
      const results = search.filterDyes({ minPrice: 100, maxPrice: 500 });
      const inRange = results.every((d) => d.cost >= 100 && d.cost <= 500);
      expect(inRange).toBe(true);
    });

    it('should combine multiple filters', () => {
      const results = search.filterDyes({
        category: 'Reds',
        minPrice: 0,
        excludeIds: [5740],
      });

      expect(results.every((d) => d.category === 'Reds')).toBe(true);
      expect(results.every((d) => d.id !== 5740)).toBe(true);
    });

    it('should handle empty excludeIds array', () => {
      const results = search.filterDyes({ excludeIds: [] });
      expect(results).toHaveLength(7);
    });
  });

  describe('findClosestDye', () => {
    it('should find exact color match', () => {
      const closest = search.findClosestDye('#FFFFFF');
      expect(closest).toBeDefined();
      expect(closest?.hex).toBe('#FFFFFF');
    });

    it('should find nearest color', () => {
      // Color close to wine red
      const closest = search.findClosestDye('#4D1919');
      expect(closest).toBeDefined();
      expect(closest?.name).toBe('Wine Red');
    });

    it('should exclude specified IDs', () => {
      const closest = search.findClosestDye('#FFFFFF', [5729]);
      expect(closest).toBeDefined();
      expect(closest?.id).not.toBe(5729);
    });

    it('should exclude Facewear dyes', () => {
      // Pure red should match Wine Red, not Facewear Red
      const closest = search.findClosestDye('#FF0000');
      expect(closest).toBeDefined();
      expect(closest?.category).not.toBe('Facewear');
    });

    it('should return null for invalid hex', () => {
      const closest = search.findClosestDye('invalid');
      expect(closest).toBeNull();
    });

    it('should handle 3-digit hex colors', () => {
      const closest = search.findClosestDye('#FFF');
      expect(closest).toBeDefined();
    });
  });

  describe('findDyesWithinDistance', () => {
    it('should find dyes within distance threshold', () => {
      const results = search.findDyesWithinDistance('#FFFFFF', 50);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect distance limit', () => {
      const results = search.findDyesWithinDistance('#FFFFFF', 10);
      // Very tight distance should only find white or very close colors
      expect(
        results.every((d) => {
          const r = Math.abs(d.rgb.r - 255);
          const g = Math.abs(d.rgb.g - 255);
          const b = Math.abs(d.rgb.b - 255);
          return r + g + b <= 10;
        })
      ).toBe(true);
    });

    it('should apply limit parameter', () => {
      const results = search.findDyesWithinDistance('#FFFFFF', 200, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should exclude Facewear dyes', () => {
      const results = search.findDyesWithinDistance('#FF0000', 100);
      expect(results.every((d) => d.category !== 'Facewear')).toBe(true);
    });

    it('should return empty array for invalid hex', () => {
      const results = search.findDyesWithinDistance('invalid', 50);
      expect(results).toHaveLength(0);
    });

    it('should return empty array for zero distance', () => {
      const results = search.findDyesWithinDistance('#123456', 0);
      expect(results).toHaveLength(0);
    });
  });

  describe('getDyesSortedByBrightness', () => {
    it('should sort by brightness ascending', () => {
      const results = search.getDyesSortedByBrightness(true);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].hsv.v).toBeLessThanOrEqual(results[i + 1].hsv.v);
      }
    });

    it('should sort by brightness descending', () => {
      const results = search.getDyesSortedByBrightness(false);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].hsv.v).toBeGreaterThanOrEqual(results[i + 1].hsv.v);
      }
    });

    it('should have Snow White as brightest', () => {
      const results = search.getDyesSortedByBrightness(false);
      expect(results[0].name).toBe('Snow White');
      expect(results[0].hsv.v).toBe(100);
    });

    it('should return all dyes', () => {
      const results = search.getDyesSortedByBrightness();
      expect(results).toHaveLength(7);
    });
  });

  describe('getDyesSortedBySaturation', () => {
    it('should sort by saturation ascending', () => {
      const results = search.getDyesSortedBySaturation(true);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].hsv.s).toBeLessThanOrEqual(results[i + 1].hsv.s);
      }
    });

    it('should sort by saturation descending', () => {
      const results = search.getDyesSortedBySaturation(false);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].hsv.s).toBeGreaterThanOrEqual(results[i + 1].hsv.s);
      }
    });

    it('should have neutral colors as least saturated', () => {
      const results = search.getDyesSortedBySaturation(true);
      const first = results[0];
      expect(first.hsv.s).toBe(0);
      expect(first.category).toBe('Neutral');
    });

    it('should return all dyes', () => {
      const results = search.getDyesSortedBySaturation();
      expect(results).toHaveLength(7);
    });
  });

  describe('getDyesSortedByHue', () => {
    it('should sort by hue ascending', () => {
      const results = search.getDyesSortedByHue(true);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].hsv.h).toBeLessThanOrEqual(results[i + 1].hsv.h);
      }
    });

    it('should sort by hue descending', () => {
      const results = search.getDyesSortedByHue(false);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].hsv.h).toBeGreaterThanOrEqual(results[i + 1].hsv.h);
      }
    });

    it('should group similar hues together', () => {
      const results = search.getDyesSortedByHue(true);
      // Reds (h=0) should be early, greens (h=120) middle, blues (h=197) later
      const redIndex = results.findIndex((d) => d.category === 'Reds');
      const greenIndex = results.findIndex((d) => d.category === 'Greens');
      const blueIndex = results.findIndex((d) => d.category === 'Blues');

      expect(redIndex).toBeLessThan(greenIndex);
      expect(greenIndex).toBeLessThan(blueIndex);
    });

    it('should return all dyes', () => {
      const results = search.getDyesSortedByHue();
      expect(results).toHaveLength(7);
    });
  });

  describe('defensive copies', () => {
    it('should return defensive copies from sorting methods', () => {
      const results1 = search.getDyesSortedByBrightness();
      const results2 = search.getDyesSortedByBrightness();

      expect(results1).not.toBe(results2);
      expect(results1).toEqual(results2);
    });

    it('should not affect original data', () => {
      const original = database.getAllDyes();
      const sorted = search.getDyesSortedByHue();

      // Modifying sorted should not affect original
      sorted.pop();
      expect(database.getDyeCount()).toBe(7);
    });
  });

  describe('error handling', () => {
    it('should throw when database not loaded', () => {
      const emptyDB = new DyeDatabase();
      const emptySearch = new DyeSearch(emptyDB);

      expect(() => emptySearch.searchByName('test')).toThrow();
    });

    it('should handle malformed color gracefully', () => {
      expect(() => search.findClosestDye('not-a-color')).not.toThrow();
      expect(search.findClosestDye('not-a-color')).toBeNull();
    });
  });

  describe('linear search fallback (no k-d tree)', () => {
    let fallbackDatabase: DyeDatabase;
    let fallbackSearch: DyeSearch;

    beforeEach(() => {
      fallbackDatabase = new DyeDatabase();
      fallbackDatabase.initialize(mockDyes);
      // Mock getKdTree to return null to force linear search fallback
      vi.spyOn(fallbackDatabase, 'getKdTree').mockReturnValue(null);
      fallbackSearch = new DyeSearch(fallbackDatabase);
    });

    describe('findClosestDye fallback', () => {
      it('should find exact color match using linear search', () => {
        const closest = fallbackSearch.findClosestDye('#FFFFFF');
        expect(closest).toBeDefined();
        expect(closest?.hex).toBe('#FFFFFF');
      });

      it('should find nearest color using linear search', () => {
        const closest = fallbackSearch.findClosestDye('#4D1919');
        expect(closest).toBeDefined();
        expect(closest?.name).toBe('Wine Red');
      });

      it('should exclude specified IDs using linear search', () => {
        const closest = fallbackSearch.findClosestDye('#FFFFFF', [5729]);
        expect(closest).toBeDefined();
        expect(closest?.id).not.toBe(5729);
      });

      it('should exclude Facewear dyes using linear search', () => {
        const closest = fallbackSearch.findClosestDye('#FF0000');
        expect(closest).toBeDefined();
        expect(closest?.category).not.toBe('Facewear');
      });

      it('should return null for invalid hex in linear search', () => {
        const closest = fallbackSearch.findClosestDye('invalid');
        expect(closest).toBeNull();
      });

      it('should handle 3-digit hex colors in linear search', () => {
        const closest = fallbackSearch.findClosestDye('#FFF');
        expect(closest).toBeDefined();
      });

      it('should find closest to a mid-range color using linear search', () => {
        const closest = fallbackSearch.findClosestDye('#228B22');
        expect(closest).toBeDefined();
        expect(closest?.name).toBe('Forest Green');
      });
    });

    describe('findDyesWithinDistance fallback', () => {
      it('should find dyes within distance threshold using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', 50);
        expect(results.length).toBeGreaterThan(0);
      });

      it('should respect distance limit using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', 10);
        expect(
          results.every((d) => {
            const r = Math.abs(d.rgb.r - 255);
            const g = Math.abs(d.rgb.g - 255);
            const b = Math.abs(d.rgb.b - 255);
            return r + g + b <= 10;
          })
        ).toBe(true);
      });

      it('should apply limit parameter using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', 200, 2);
        expect(results.length).toBeLessThanOrEqual(2);
      });

      it('should exclude Facewear dyes using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FF0000', 100);
        expect(results.every((d) => d.category !== 'Facewear')).toBe(true);
      });

      it('should return empty array for invalid hex using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('invalid', 50);
        expect(results).toHaveLength(0);
      });

      it('should return empty array for zero distance using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#123456', 0);
        expect(results).toHaveLength(0);
      });

      it('should sort results by distance using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', 200);
        // Results should be sorted by distance - Snow White (exact match) should be first
        if (results.length > 0) {
          expect(results[0].hex).toBe('#FFFFFF');
        }
      });

      it('should handle limit of 0 using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', 200, 0);
        // When limit is 0, if(limit) evaluates to false, so no limit is applied
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Perceptual Matching Methods - Branch Coverage
  // ============================================================================

  describe('perceptual matching methods', () => {
    describe('findClosestDye with perceptual methods', () => {
      it('should find closest dye using rgb method', () => {
        const closest = search.findClosestDye('#FF0000', undefined, { matchingMethod: 'rgb' });
        expect(closest).not.toBeNull();
      });

      it('should find closest dye using cie76 method', () => {
        const closest = search.findClosestDye('#FF0000', undefined, { matchingMethod: 'cie76' });
        expect(closest).not.toBeNull();
      });

      it('should find closest dye using ciede2000 method', () => {
        const closest = search.findClosestDye('#FF0000', undefined, {
          matchingMethod: 'ciede2000',
        });
        expect(closest).not.toBeNull();
      });

      it('should find closest dye using oklab method', () => {
        const closest = search.findClosestDye('#FF0000', undefined, { matchingMethod: 'oklab' });
        expect(closest).not.toBeNull();
      });

      it('should find closest dye using hyab method', () => {
        const closest = search.findClosestDye('#FF0000', undefined, { matchingMethod: 'hyab' });
        expect(closest).not.toBeNull();
      });

      it('should find closest dye using oklch-weighted method', () => {
        const closest = search.findClosestDye('#FF0000', undefined, {
          matchingMethod: 'oklch-weighted',
        });
        expect(closest).not.toBeNull();
      });

      it('should find closest dye using oklch-weighted with custom weights', () => {
        const closest = search.findClosestDye('#FF0000', undefined, {
          matchingMethod: 'oklch-weighted',
          weights: { L: 1, C: 1.5, h: 2 },
        });
        expect(closest).not.toBeNull();
      });
    });

    describe('findDyesWithinDistance with perceptual methods (k-d tree path)', () => {
      it('should find dyes within distance using cie76 method', () => {
        // Using k-d tree path (perceptual matching with candidates)
        const results = search.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'cie76',
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should find dyes within distance using ciede2000 method', () => {
        const results = search.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'ciede2000',
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should find dyes within distance using oklab method', () => {
        const results = search.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'oklab',
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should find dyes within distance using hyab method', () => {
        const results = search.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'hyab',
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should find dyes within distance using oklch-weighted method', () => {
        const results = search.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'oklch-weighted',
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should find dyes within distance using oklch-weighted with custom weights', () => {
        const results = search.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'oklch-weighted',
          weights: { L: 1, C: 1.5, h: 2 },
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should apply limit with perceptual methods', () => {
        const results = search.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 200,
          matchingMethod: 'oklab',
          limit: 2,
        });
        expect(results.length).toBeLessThanOrEqual(2);
      });

      it('should sort results by perceptual distance', () => {
        const results = search.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 300,
          matchingMethod: 'oklab',
        });
        // Results should be sorted (closest first)
        if (results.length > 1) {
          // First result should be Snow White (exact match)
          expect(results[0].name).toBe('Snow White');
        }
      });

      it('should handle perceptual methods with small maxDistance', () => {
        // Very small distance - may not find anything
        const results = search.findDyesWithinDistance('#123456', {
          maxDistance: 1,
          matchingMethod: 'ciede2000',
        });
        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('perceptual methods with linear search fallback', () => {
      let fallbackSearch: DyeSearch;

      beforeEach(() => {
        // Create database without k-d tree by mocking getKdTree to return null
        const fallbackDatabase = new DyeDatabase();
        fallbackDatabase.initialize(mockDyes);
        // Override getKdTree to return null
        vi.spyOn(fallbackDatabase, 'getKdTree').mockReturnValue(null);
        fallbackSearch = new DyeSearch(fallbackDatabase);
      });

      it('should find dyes using cie76 method with linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'cie76',
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should find dyes using oklab method with linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'oklab',
        });
        expect(Array.isArray(results)).toBe(true);
      });

      it('should apply limit with linear search perceptual methods', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 200,
          matchingMethod: 'oklab',
          limit: 2,
        });
        expect(results.length).toBeLessThanOrEqual(2);
      });
    });
  });
});
