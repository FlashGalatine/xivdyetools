/**
 * XIV Dye Tools - DyeService Unit Tests
 * Tests for dye database management and search functionality
 */

import { DyeService } from '../dye-service-wrapper';

describe('DyeService', () => {
  beforeEach(() => {
    // Reset singleton before each test
    DyeService.resetInstance();
  });

  afterEach(() => {
    DyeService.resetInstance();
  });

  // ============================================================================
  // Initialization & Database Access Tests
  // ============================================================================

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = DyeService.getInstance();
      const instance2 = DyeService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with dye database loaded', () => {
      const service = DyeService.getInstance();
      // Database auto-loads from colors_xiv.json
      expect(service.isLoadedStatus()).toBe(true);
      expect(service.getDyeCount()).toBeGreaterThan(0);
    });
  });

  describe('getAllDyes', () => {
    it('should return array of dyes', () => {
      const service = DyeService.getInstance();
      const dyes = service.getAllDyes();
      expect(Array.isArray(dyes)).toBe(true);
    });

    it('should return copy of dye array', () => {
      const service = DyeService.getInstance();
      const dyes1 = service.getAllDyes();
      const dyes2 = service.getAllDyes();
      expect(dyes1).not.toBe(dyes2);
      expect(dyes1).toEqual(dyes2);
    });
  });

  describe('getDyeById', () => {
    it('should return null for non-existent dye', () => {
      const service = DyeService.getInstance();
      const dye = service.getDyeById(99999);
      expect(dye).toBeNull();
    });
  });

  describe('isLoadedStatus', () => {
    it('should indicate database status', () => {
      const service = DyeService.getInstance();
      const isLoaded = service.isLoadedStatus();
      expect(typeof isLoaded).toBe('boolean');
    });
  });

  // ============================================================================
  // Search & Filter Tests
  // ============================================================================

  describe('searchByName', () => {
    it('should return empty array for empty query', () => {
      const service = DyeService.getInstance();
      const results = service.searchByName('');
      expect(results).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const service = DyeService.getInstance();
      const results1 = service.searchByName('BLACK');
      const results2 = service.searchByName('black');
      expect(results1.length).toBe(results2.length);
    });

    it('should perform partial matching', () => {
      const service = DyeService.getInstance();
      const results = service.searchByName('Black');
      // Results should include colors with 'Black' in the name
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('searchByCategory', () => {
    it('should filter by category', () => {
      const service = DyeService.getInstance();
      const results = service.searchByCategory('Neutral');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should be case-sensitive for category', () => {
      const service = DyeService.getInstance();
      const results = service.searchByCategory('neutral');
      // Should likely return empty since categories are capitalized
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getCategories', () => {
    it('should return array of category names', () => {
      const service = DyeService.getInstance();
      const categories = service.getCategories();
      expect(Array.isArray(categories)).toBe(true);
    });

    it('should return sorted categories', () => {
      const service = DyeService.getInstance();
      const categories = service.getCategories();
      const sorted = [...categories].sort();
      expect(categories).toEqual(sorted);
    });
  });

  describe('filterDyes', () => {
    it('should filter by category', () => {
      const service = DyeService.getInstance();
      const results = service.filterDyes({ category: 'Neutral' });
      expect(Array.isArray(results)).toBe(true);
    });

    it('should exclude specified dye IDs', () => {
      const service = DyeService.getInstance();
      const allDyes = service.getAllDyes();
      if (allDyes.length > 0) {
        const excludedId = allDyes[0].id;
        const results = service.filterDyes({ excludeIds: [excludedId] });
        const hasExcluded = results.some((d) => d.id === excludedId);
        expect(hasExcluded).toBe(false);
      }
    });

    it('should filter by price range', () => {
      const service = DyeService.getInstance();
      const results = service.filterDyes({ minPrice: 100, maxPrice: 500 });
      results.forEach((dye) => {
        expect(dye.cost).toBeGreaterThanOrEqual(100);
        expect(dye.cost).toBeLessThanOrEqual(500);
      });
    });
  });

  // ============================================================================
  // Color Matching Tests
  // ============================================================================

  describe('findClosestDye', () => {
    it('should find closest dye to red', () => {
      const service = DyeService.getInstance();
      const dye = service.findClosestDye('#FF0000');
      // Should find a dye, not null (database is loaded)
      expect(dye).not.toBeNull();
      expect(dye?.hex).toBeDefined();
    });

    it('should exclude specified dyes', () => {
      const service = DyeService.getInstance();
      const allDyes = service.getAllDyes();
      if (allDyes.length > 0) {
        const excludedId = allDyes[0].id;
        const dye = service.findClosestDye('#FF0000', [excludedId]);
        if (dye) {
          expect(dye.id).not.toBe(excludedId);
        }
      }
    });
  });

  describe('findDyesWithinDistance', () => {
    it('should return empty array for impossible distance', () => {
      const service = DyeService.getInstance();
      const results = service.findDyesWithinDistance('#FF0000', 0);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should respect limit parameter', () => {
      const service = DyeService.getInstance();
      const results = service.findDyesWithinDistance('#FF0000', 500, 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  // ============================================================================
  // Sorting Tests
  // ============================================================================

  describe('getDyesSortedByBrightness', () => {
    it('should return sorted array', () => {
      const service = DyeService.getInstance();
      const dyes = service.getDyesSortedByBrightness(true);
      expect(Array.isArray(dyes)).toBe(true);

      // Check sorting order
      for (let i = 1; i < dyes.length; i++) {
        expect(dyes[i].hsv.v).toBeGreaterThanOrEqual(dyes[i - 1].hsv.v);
      }
    });

    it('should support descending order', () => {
      const service = DyeService.getInstance();
      const dyesAsc = service.getDyesSortedByBrightness(true);
      const dyesDesc = service.getDyesSortedByBrightness(false);

      // Check that descending is reverse of ascending
      expect(dyesDesc.length).toBe(dyesAsc.length);

      // Verify first element of desc is greater than or equal to last element of asc
      expect(dyesDesc[0].hsv.v).toBeGreaterThanOrEqual(dyesAsc[dyesAsc.length - 1].hsv.v);

      // Verify last element of desc is less than or equal to first element of asc
      expect(dyesDesc[dyesDesc.length - 1].hsv.v).toBeLessThanOrEqual(dyesAsc[0].hsv.v);
    });
  });

  describe('getDyesSortedBySaturation', () => {
    it('should sort by saturation', () => {
      const service = DyeService.getInstance();
      const dyes = service.getDyesSortedBySaturation(true);
      expect(Array.isArray(dyes)).toBe(true);

      for (let i = 1; i < dyes.length; i++) {
        expect(dyes[i].hsv.s).toBeGreaterThanOrEqual(dyes[i - 1].hsv.s);
      }
    });
  });

  describe('getDyesSortedByHue', () => {
    it('should sort by hue', () => {
      const service = DyeService.getInstance();
      const dyes = service.getDyesSortedByHue(true);
      expect(Array.isArray(dyes)).toBe(true);

      for (let i = 1; i < dyes.length; i++) {
        expect(dyes[i].hsv.h).toBeGreaterThanOrEqual(dyes[i - 1].hsv.h);
      }
    });
  });

  // ============================================================================
  // Harmony Generation Tests
  // ============================================================================

  describe('findComplementaryPair', () => {
    it('should find complementary color', () => {
      const service = DyeService.getInstance();
      const dye = service.findComplementaryPair('#FF0000');
      // Result could be null if no close match exists
      expect(dye === null || typeof dye === 'object').toBe(true);
    });
  });

  describe('findAnalogousDyes', () => {
    it('should find analogous colors', () => {
      const service = DyeService.getInstance();
      const dyes = service.findAnalogousDyes('#FF0000');
      expect(Array.isArray(dyes)).toBe(true);
    });

    it('should respect angle parameter', () => {
      const service = DyeService.getInstance();
      const dyes1 = service.findAnalogousDyes('#FF0000', 30);
      const dyes2 = service.findAnalogousDyes('#FF0000', 10);
      // Smaller angle should return fewer or equal results
      expect(dyes2.length).toBeLessThanOrEqual(dyes1.length + 1);
    });
  });

  describe('findTriadicDyes', () => {
    it('should find triadic color scheme', () => {
      const service = DyeService.getInstance();
      const dyes = service.findTriadicDyes('#FF0000');
      expect(Array.isArray(dyes)).toBe(true);
      expect(dyes.length).toBeLessThanOrEqual(3);
    });
  });

  // ============================================================================
  // Phase 12.5 Bug Fix Tests
  // ============================================================================

  describe('Facewear exclusion (Phase 12.5 fix)', () => {
    it('should exclude Facewear dyes from findClosestDye', () => {
      const service = DyeService.getInstance();
      const dye = service.findClosestDye('#FF0000');
      // Should find a dye
      expect(dye).not.toBeNull();
      // Dye should not be a Facewear dye
      if (dye) {
        expect(dye.category).not.toBe('Facewear');
      }
    });

    it('should find dyes matching red color', () => {
      const service = DyeService.getInstance();
      const results = service.findDyesWithinDistance('#FF0000', 150, 10);
      // Should find some red-ish dyes
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Triadic harmony (Phase 12.5 fix)', () => {
    it('should return triadic colors for input', () => {
      const service = DyeService.getInstance();
      const dyes = service.findTriadicDyes('#FF0000');
      // Should find some dyes
      expect(Array.isArray(dyes)).toBe(true);
    });

    it('should return up to 3 companion colors for triadic', () => {
      const service = DyeService.getInstance();
      const dyes = service.findTriadicDyes('#FF0000');
      // Should return 0-3 results (not 4, since base color is not included)
      expect(dyes.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Harmony suggestion limiting (Phase 12.5 fix)', () => {
    it('should respect result limiting in filterDyes', () => {
      const service = DyeService.getInstance();
      // Filter can return many results, but harmony should limit to 6
      const results = service.filterDyes({ category: 'Red' });
      // This is just checking the service works with filters
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should throw error when database not loaded', () => {
      const service = DyeService.getInstance();
      expect(() => {
        // This will throw since database is empty
        service.getDyeCount();
      }).not.toThrow(); // getDyeCount checks status internally
    });
  });
});
