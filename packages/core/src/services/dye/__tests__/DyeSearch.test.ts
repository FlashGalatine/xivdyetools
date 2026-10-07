import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DyeSearch } from '../DyeSearch.js';
import { DyeDatabase } from '../DyeDatabase.js';
import type { Dye } from '@xivdyetools/types';

describe('DyeSearch', () => {
  let database: DyeDatabase;
  let search: DyeSearch;

  const mockDyes: Dye[] = [
    {
      itemID: 5729,
      id: 5729,
      stainID: 5729,
      name: 'Snow White',
      hex: '#FFFFFF',
      rgb: { r: 255, g: 255, b: 255 },
      hsv: { h: 0, s: 0, v: 100 },
      category: 'Neutral',
      acquisition: 'Dye Vendor',
      cost: 200,
      currency: 'Gil',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,

      isIshgardian: false,

      consolidationType: null,
    },
    {
      itemID: 5740,
      id: 5740,
      stainID: 5740,
      name: 'Wine Red',
      hex: '#4D1818',
      rgb: { r: 77, g: 24, b: 24 },
      hsv: { h: 0, s: 69, v: 30 },
      category: 'Reds',
      acquisition: 'The Firmament',
      cost: 0,
      currency: 'Gil',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,

      isIshgardian: false,

      consolidationType: null,
    },
    {
      itemID: 5741,
      id: 5741,
      stainID: 5741,
      name: 'Rust Red',
      hex: '#6B2929',
      rgb: { r: 107, g: 41, b: 41 },
      hsv: { h: 0, s: 62, v: 42 },
      category: 'Reds',
      acquisition: 'Dye Vendor',
      cost: 200,
      currency: 'Gil',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,

      isIshgardian: false,

      consolidationType: null,
    },
    {
      itemID: 5742,
      id: 5742,
      stainID: 5742,
      name: 'Sky Blue',
      hex: '#87CEEB',
      rgb: { r: 135, g: 206, b: 235 },
      hsv: { h: 197, s: 43, v: 92 },
      category: 'Blues',
      acquisition: 'Dye Vendor',
      cost: 200,
      currency: 'Gil',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,

      isIshgardian: false,

      consolidationType: null,
    },
    {
      itemID: 5743,
      id: 5743,
      stainID: 5743,
      name: 'Forest Green',
      hex: '#228B22',
      rgb: { r: 34, g: 139, b: 34 },
      hsv: { h: 120, s: 76, v: 55 },
      category: 'Greens',
      acquisition: 'The Firmament',
      cost: 0,
      currency: 'Gil',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,

      isIshgardian: false,

      consolidationType: null,
    },
    {
      itemID: 13116,
      id: 13116,
      stainID: 13116,
      name: 'Metallic Silver',
      hex: '#8C8C8C',
      rgb: { r: 140, g: 140, b: 140 },
      hsv: { h: 0, s: 0, v: 55 },
      category: 'Neutral',
      acquisition: 'Ixali Vendor',
      cost: 10000,
      currency: 'Gil',
      isMetallic: true,
      isPastel: false,
      isDark: false,
      isCosmic: false,

      isIshgardian: false,

      consolidationType: null,
    },
    {
      itemID: 9999,
      id: 9999,
      stainID: null,
      name: 'Facewear Red',
      hex: '#FF0000',
      rgb: { r: 255, g: 0, b: 0 },
      hsv: { h: 0, s: 100, v: 100 },
      category: 'Facewear',
      acquisition: 'Special',
      cost: 50000,
      currency: 'Gil',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,

      isIshgardian: false,

      consolidationType: null,
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

    it('should return empty array for null query', () => {
      const results = search.searchByName(null as unknown as string);
      expect(results).toHaveLength(0);
    });

    it('should return empty array for undefined query', () => {
      const results = search.searchByName(undefined as unknown as string);
      expect(results).toHaveLength(0);
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

  // BUG-138 (2026-10-04 deep-dive): `findClosestDye` returns `Dye | null`
  // and vitest's `toBeDefined()` is `!== undefined`, so `expect(null)
  // .toBeDefined()` passes — and the optional-chained follow-ups
  // (`closest?.id).not.toBe(...)`, `?.category).not.toBe(...)`) pass on
  // undefined too. Likewise `.every(...)`, `toBeLessThanOrEqual(n)` and
  // `Array.isArray` all pass on `[]`. Every case below asserts a real
  // result and pins the dye that must win (values from running the fixture;
  // Facewear Red is an exact #FF0000 match, so it would win every red query
  // below if the Facewear exclusion broke).
  describe('findClosestDye', () => {
    it('should find exact color match', () => {
      const closest = search.findClosestDye('#FFFFFF');
      expect(closest).not.toBeNull();
      expect(closest!.name).toBe('Snow White');
      expect(closest!.hex).toBe('#FFFFFF');
    });

    it('should find nearest color', () => {
      // Color close to wine red
      const closest = search.findClosestDye('#4D1919');
      expect(closest).not.toBeNull();
      expect(closest!.name).toBe('Wine Red');
    });

    it('should exclude specified IDs', () => {
      // With Snow White excluded, the next-closest to white (dE2000 ≈ 22) wins.
      const closest = search.findClosestDye('#FFFFFF', { excludeIds: [5729] });
      expect(closest).not.toBeNull();
      expect(closest!.id).not.toBe(5729);
      expect(closest!.name).toBe('Sky Blue');
    });

    it('should exclude Facewear dyes', () => {
      // Facewear Red (#FF0000) would be an exact match; the closest real dye
      // to pure red in this fixture is Rust Red (not Wine Red).
      const closest = search.findClosestDye('#FF0000');
      expect(closest).not.toBeNull();
      expect(closest!.category).not.toBe('Facewear');
      expect(closest!.name).toBe('Rust Red');
    });

    it('should return null for invalid hex', () => {
      const closest = search.findClosestDye('invalid');
      expect(closest).toBeNull();
    });

    it('should handle 3-digit hex colors', () => {
      // #FFF must expand to #FFFFFF and pick the same dye.
      const closest = search.findClosestDye('#FFF');
      expect(closest).not.toBeNull();
      expect(closest!.name).toBe('Snow White');
    });
  });

  describe('findDyesWithinDistance', () => {
    it('should find dyes within distance threshold', () => {
      const results = search.findDyesWithinDistance('#FFFFFF', {
        maxDistance: 50,
        matchingMethod: 'ciede2000',
      });
      // dE2000 from white: Snow White 0, Sky Blue ≈22, Metallic Silver ≈29,
      // Forest Green ≈45; Rust Red ≈66 and Wine Red ≈77 fall outside.
      expect(results.map((d) => d.name)).toEqual([
        'Snow White',
        'Sky Blue',
        'Metallic Silver',
        'Forest Green',
      ]);
    });

    it('should respect distance limit', () => {
      // Explicit 'rgb': the assertion below checks raw RGB channel deltas,
      // which is an RGB-scale property, not a perceptual (ciede2000) one.
      const results = search.findDyesWithinDistance('#FFFFFF', {
        maxDistance: 10,
        matchingMethod: 'rgb',
      });
      // Very tight distance should only find white itself
      expect(results.map((d) => d.name)).toEqual(['Snow White']);
      expect(
        results.every((d) => {
          const r = Math.abs(d.rgb.r - 255);
          const g = Math.abs(d.rgb.g - 255);
          const b = Math.abs(d.rgb.b - 255);
          return r + g + b <= 10;
        }),
      ).toBe(true);
    });

    it('should apply limit parameter', () => {
      // Six dyes are within 200; the limit keeps the two closest.
      const results = search.findDyesWithinDistance('#FFFFFF', {
        maxDistance: 200,
        limit: 2,
        matchingMethod: 'ciede2000',
      });
      expect(results.map((d) => d.name)).toEqual(['Snow White', 'Sky Blue']);
    });

    it('should apply limit parameter on the rgb (k-d tree) path', () => {
      const results = search.findDyesWithinDistance('#FFFFFF', {
        maxDistance: 200,
        limit: 2,
        matchingMethod: 'rgb',
      });
      expect(results.map((d) => d.name)).toEqual(['Snow White', 'Sky Blue']);
    });

    it('should exclude Facewear dyes', () => {
      const results = search.findDyesWithinDistance('#FF0000', {
        maxDistance: 100,
        matchingMethod: 'ciede2000',
      });
      // Facewear Red is distance 0 and would lead the list if not excluded.
      expect(results.length).toBe(6);
      expect(results[0].name).toBe('Rust Red');
      expect(results.every((d) => d.category !== 'Facewear')).toBe(true);
    });

    it('should return empty array for invalid hex', () => {
      const results = search.findDyesWithinDistance('invalid', { maxDistance: 50 });
      expect(results).toHaveLength(0);
    });

    it('should return empty array for zero distance', () => {
      const results = search.findDyesWithinDistance('#123456', { maxDistance: 0 });
      expect(results).toHaveLength(0);
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
        expect(closest).not.toBeNull();
        expect(closest!.name).toBe('Snow White');
      });

      it('should find nearest color using linear search', () => {
        const closest = fallbackSearch.findClosestDye('#4D1919');
        expect(closest).not.toBeNull();
        expect(closest!.name).toBe('Wine Red');
      });

      // core-data-14: `findClosestDye` returns `Dye | null`, and vitest's
      // `toBeDefined()` is `!== undefined` -- so `expect(null).toBeDefined()`
      // PASSES. Both of these, and the optional-chained follow-ups
      // (`closest?.id`, `closest?.category`), stayed green if the linear-scan
      // fallback started returning null for every input. Assert non-null, and
      // name the dye that must win.
      it('should exclude specified IDs using linear search', () => {
        const closest = fallbackSearch.findClosestDye('#FFFFFF', { excludeIds: [5729] });
        expect(closest).not.toBeNull();
        expect(closest?.id).not.toBe(5729);
        expect(closest!.name).toBe('Sky Blue');
      });

      it('should exclude Facewear dyes using linear search', () => {
        const closest = fallbackSearch.findClosestDye('#FF0000');
        expect(closest).not.toBeNull();
        expect(closest?.category).not.toBe('Facewear');
        expect(closest!.name).toBe('Rust Red');
      });

      it('should return null for invalid hex in linear search', () => {
        const closest = fallbackSearch.findClosestDye('invalid');
        expect(closest).toBeNull();
      });

      it('should handle 3-digit hex colors in linear search', () => {
        const closest = fallbackSearch.findClosestDye('#FFF');
        // Fully vacuous before: `toBeDefined()` was the ONLY assertion, so
        // "3-digit hex colours resolve in the linear scan" was asserted by
        // nothing at all. #FFF must expand to #FFFFFF and pick the same dye.
        expect(closest).not.toBeNull();
        expect(closest?.id).toBe(fallbackSearch.findClosestDye('#FFFFFF')?.id);
      });

      it('should find closest to a mid-range color using linear search', () => {
        const closest = fallbackSearch.findClosestDye('#228B22');
        expect(closest).not.toBeNull();
        expect(closest!.name).toBe('Forest Green');
      });
    });

    describe('findDyesWithinDistance fallback', () => {
      it('should find dyes within distance threshold using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 50,
          matchingMethod: 'ciede2000',
        });
        expect(results.map((d) => d.name)).toEqual([
          'Snow White',
          'Sky Blue',
          'Metallic Silver',
          'Forest Green',
        ]);
      });

      it('should respect distance limit using linear search', () => {
        // Explicit 'rgb': the assertion below checks raw RGB channel deltas,
        // which is an RGB-scale property, not a perceptual (ciede2000) one.
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 10,
          matchingMethod: 'rgb',
        });
        expect(results.map((d) => d.name)).toEqual(['Snow White']);
        expect(
          results.every((d) => {
            const r = Math.abs(d.rgb.r - 255);
            const g = Math.abs(d.rgb.g - 255);
            const b = Math.abs(d.rgb.b - 255);
            return r + g + b <= 10;
          }),
        ).toBe(true);
      });

      it('should apply limit parameter using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 200,
          limit: 2,
          matchingMethod: 'ciede2000',
        });
        expect(results.map((d) => d.name)).toEqual(['Snow White', 'Sky Blue']);
      });

      it('should exclude Facewear dyes using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'ciede2000',
        });
        expect(results.length).toBe(6);
        expect(results[0].name).toBe('Rust Red');
        expect(results.every((d) => d.category !== 'Facewear')).toBe(true);
      });

      it('should return empty array for invalid hex using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('invalid', { maxDistance: 50 });
        expect(results).toHaveLength(0);
      });

      it('should return empty array for zero distance using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#123456', { maxDistance: 0 });
        expect(results).toHaveLength(0);
      });

      it('should sort results by distance using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 200,
          matchingMethod: 'ciede2000',
        });
        // Full order, not just the head: the fixture's own order also starts
        // with Snow White, so `results[0]` alone could not tell a sorted list
        // from an unsorted one.
        expect(results.map((d) => d.name)).toEqual([
          'Snow White',
          'Sky Blue',
          'Metallic Silver',
          'Forest Green',
          'Rust Red',
          'Wine Red',
        ]);
      });

      it('should handle limit of 0 using linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 200,
          limit: 0,
        });
        // When limit is 0, if(limit) evaluates to false, so no limit is applied
        expect(results.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Perceptual Matching Methods - Branch Coverage
  // ============================================================================

  // BUG-138: every case below used to assert only `not.toBeNull()` or
  // `Array.isArray(results)`, so a method that returned the wrong dye, or
  // nothing at all, stayed green. Each now pins the answer.
  describe('perceptual matching methods', () => {
    describe('findClosestDye with perceptual methods', () => {
      // Rust Red wins pure red under EVERY method, so a #FF0000 probe could
      // not tell the methods apart: a dispatch that ignored `matchingMethod`,
      // or a changed default, stayed green. With Rust Red excluded the
      // methods split — ciede2000 alone ranks the grey Metallic Silver ahead
      // of the dark Wine Red (the order its within-distance list below pins
      // too). Facewear Red is still an exact match, so it must never win.
      // Values from running the fixture.
      const RUST_RED = 5741;
      it.each([
        ['ciede2000', 'Metallic Silver'],
        ['rgb', 'Wine Red'],
        ['cie76', 'Wine Red'],
        ['oklab', 'Wine Red'],
        ['redmean', 'Wine Red'],
        ['distinguish', 'Wine Red'],
      ] as const)('should find closest dye using %s method', (matchingMethod, expected) => {
        const closest = search.findClosestDye('#FF0000', {
          excludeIds: [RUST_RED],
          matchingMethod,
        });
        expect(closest).not.toBeNull();
        expect(closest!.name).toBe(expected);
      });

      // A second split, between the two perceptual-space methods and the
      // RGB/LAB-Euclidean ones, so oklab is told apart from ciede2000 too.
      it.each([
        ['ciede2000', 'Metallic Silver'],
        ['oklab', 'Metallic Silver'],
        ['rgb', 'Rust Red'],
        ['cie76', 'Rust Red'],
        ['redmean', 'Rust Red'],
        ['distinguish', 'Rust Red'],
      ] as const)('ranks #996633 by the %s method', (matchingMethod, expected) => {
        expect(search.findClosestDye('#996633', { matchingMethod })?.name).toBe(expected);
      });

      it('uses the suite default (ciede2000) when no method is given', () => {
        const options = { excludeIds: [RUST_RED] };
        const byDefault = search.findClosestDye('#FF0000', options);
        const ciede2000 = search.findClosestDye('#FF0000', {
          ...options,
          matchingMethod: 'ciede2000',
        });
        const rgb = search.findClosestDye('#FF0000', { ...options, matchingMethod: 'rgb' });

        expect(byDefault).not.toBeNull();
        expect(byDefault!.name).toBe('Metallic Silver');
        expect(byDefault!.id).toBe(ciede2000!.id);
        // The probe is one the methods disagree on, so this can fail
        expect(byDefault!.id).not.toBe(rgb!.id);
      });
    });

    describe('findDyesWithinDistance with perceptual methods (k-d tree path)', () => {
      // Ordered closest-first; the lists differ between methods because the
      // metrics rank the mid-distance dyes differently.
      it.each([
        ['cie76', 100, ['Rust Red', 'Wine Red']],
        [
          'ciede2000',
          100,
          ['Rust Red', 'Metallic Silver', 'Wine Red', 'Snow White', 'Sky Blue', 'Forest Green'],
        ],
        [
          'oklab',
          100,
          ['Rust Red', 'Wine Red', 'Metallic Silver', 'Snow White', 'Sky Blue', 'Forest Green'],
        ],
        // redmean is on a ~0-765 scale: Rust Red ≈264, Wine Red ≈296 from
        // pure red, so a 100 radius (the old value) found nothing at all.
        ['redmean', 300, ['Rust Red', 'Wine Red']],
        [
          'distinguish',
          100,
          ['Rust Red', 'Wine Red', 'Metallic Silver', 'Forest Green', 'Sky Blue', 'Snow White'],
        ],
        // rgb runs on the k-d tree: Rust Red ≈159, Wine Red ≈181.
        ['rgb', 200, ['Rust Red', 'Wine Red']],
      ] as const)(
        'should find dyes within distance using %s method',
        (matchingMethod, maxDistance, expected) => {
          const results = search.findDyesWithinDistance('#FF0000', {
            maxDistance,
            matchingMethod,
          });
          expect(results.map((d) => d.name)).toEqual(expected);
        },
      );

      it('should apply limit with perceptual methods', () => {
        const results = search.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 200,
          matchingMethod: 'oklab',
          limit: 2,
        });
        expect(results.map((d) => d.name)).toEqual(['Snow White', 'Sky Blue']);
      });

      it('should sort results by perceptual distance', () => {
        const results = search.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 300,
          matchingMethod: 'oklab',
        });
        // The whole order, not just the head — the fixture's own order also
        // starts with Snow White, so `results[0]` alone could not tell a
        // sorted list from an unsorted one.
        expect(results.map((d) => d.name)).toEqual([
          'Snow White',
          'Sky Blue',
          'Metallic Silver',
          'Forest Green',
          'Rust Red',
          'Wine Red',
        ]);
      });

      it('should handle perceptual methods with small maxDistance', () => {
        // No fixture dye is within dE2000 1 of #123456.
        const results = search.findDyesWithinDistance('#123456', {
          maxDistance: 1,
          matchingMethod: 'ciede2000',
        });
        expect(results).toEqual([]);
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
        expect(results.map((d) => d.name)).toEqual(['Rust Red', 'Wine Red']);
      });

      it('should find dyes using oklab method with linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FF0000', {
          maxDistance: 100,
          matchingMethod: 'oklab',
        });
        expect(results.map((d) => d.name)).toEqual([
          'Rust Red',
          'Wine Red',
          'Metallic Silver',
          'Snow White',
          'Sky Blue',
          'Forest Green',
        ]);
      });

      it('should find dyes using rgb method with linear search', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FF0000', {
          maxDistance: 200,
          matchingMethod: 'rgb',
        });
        expect(results.map((d) => d.name)).toEqual(['Rust Red', 'Wine Red']);
      });

      it('should apply limit with linear search perceptual methods', () => {
        const results = fallbackSearch.findDyesWithinDistance('#FFFFFF', {
          maxDistance: 200,
          matchingMethod: 'oklab',
          limit: 2,
        });
        expect(results.map((d) => d.name)).toEqual(['Snow White', 'Sky Blue']);
      });
    });
  });
});
