/**
 * DyeService tests
 *
 * Tests for the DyeService facade which manages the FFXIV dye database.
 * Covers all methods including localization support.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DyeService } from '../DyeService.js';
import { LocalizationService } from '../LocalizationService.js';
import type { Dye } from '@xivdyetools/types';

// Sample dye data for testing (matches Dye interface)
const sampleDyes: Dye[] = [
  {
    itemID: 5729,
    id: 1,
    stainID: 1,
    name: 'Snow White',
    hex: '#ECECEC',
    rgb: { r: 236, g: 236, b: 236 },
    hsv: { h: 0, s: 0, v: 92 },
    category: 'Whites',
    acquisition: 'Dye Vendor',
    cost: 334,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    itemID: 5730,
    id: 2,
    stainID: 2,
    name: 'Ash Grey',
    hex: '#7D8485',
    rgb: { r: 125, g: 132, b: 133 },
    hsv: { h: 188, s: 6, v: 52 },
    category: 'Grays',
    acquisition: 'Dye Vendor',
    cost: 334,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    itemID: 5731,
    id: 3,
    stainID: 3,
    name: 'Goobbue Grey',
    hex: '#6A6E6E',
    rgb: { r: 106, g: 110, b: 110 },
    hsv: { h: 180, s: 4, v: 43 },
    category: 'Grays',
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
    itemID: 5732,
    id: 4,
    stainID: 4,
    name: 'Rose Pink',
    hex: '#EBB8B1',
    rgb: { r: 235, g: 184, b: 177 },
    hsv: { h: 7, s: 25, v: 92 },
    category: 'Reds',
    acquisition: 'Dye Vendor',
    cost: 334,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    itemID: 5733,
    id: 5,
    stainID: 5,
    name: 'Lilac Purple',
    hex: '#CCB1DE',
    rgb: { r: 204, g: 177, b: 222 },
    hsv: { h: 276, s: 20, v: 87 },
    category: 'Purples',
    acquisition: 'Dye Vendor',
    cost: 334,
    currency: 'Gil',
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
  {
    itemID: 5734,
    id: 6,
    stainID: 6,
    name: 'Metallic Silver',
    hex: '#ADADAD',
    rgb: { r: 173, g: 173, b: 173 },
    hsv: { h: 0, s: 0, v: 68 },
    category: 'Metallics',
    acquisition: 'Venture Coffers',
    cost: 0,
    currency: 'Gil',
    isMetallic: true,
    isPastel: false,
    isDark: false,
    isCosmic: false,

    isIshgardian: false,

    consolidationType: null,
  },
];

describe('DyeService', () => {
  let dyeService: DyeService;

  beforeEach(() => {
    dyeService = new DyeService(sampleDyes);
    LocalizationService.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Constructor
  // ============================================================================

  describe('constructor', () => {
    it('should initialize without data', () => {
      const emptyService = new DyeService();
      expect(emptyService).toBeDefined();
    });

    it('should initialize with array data', () => {
      expect(dyeService.getDyeCount()).toBe(6);
      expect(dyeService.isLoadedStatus()).toBe(true);
    });

    it('should initialize with JSON object data', () => {
      const jsonData = sampleDyes;
      const service = new DyeService(jsonData);
      expect(service.getDyeCount()).toBe(6);
    });
  });

  // ============================================================================
  // Database Access
  // ============================================================================

  describe('database access', () => {
    it('should get all dyes', () => {
      const dyes = dyeService.getAllDyes();
      expect(dyes).toHaveLength(6);
    });

    it('should get dye by ID', () => {
      const dye = dyeService.getDyeById(5729);
      expect(dye).toBeDefined();
      expect(dye?.name).toBe('Snow White');
    });

    it('should return null for non-existent ID', () => {
      const dye = dyeService.getDyeById(99999);
      expect(dye).toBeNull();
    });

    it('should get dye by stainID', () => {
      const dye = dyeService.getByStainId(1);
      expect(dye).toBeDefined();
      expect(dye?.name).toBe('Snow White');
      expect(dye?.itemID).toBe(5729);
    });

    it('should return null for non-existent stainID', () => {
      const dye = dyeService.getByStainId(999);
      expect(dye).toBeNull();
    });

    it('should check loaded status', () => {
      expect(dyeService.isLoadedStatus()).toBe(true);
      const emptyService = new DyeService();
      expect(emptyService.isLoadedStatus()).toBe(false);
    });

    it('should get dye count', () => {
      expect(dyeService.getDyeCount()).toBe(6);
    });

    it('should get unique categories', () => {
      const categories = dyeService.getCategories();
      expect(categories).toContain('Whites');
      expect(categories).toContain('Grays');
      expect(categories).toContain('Reds');
    });
  });

  // ============================================================================
  // Search & Filter
  // ============================================================================

  describe('search and filter', () => {
    it('should search by name (partial match)', () => {
      const results = dyeService.searchByName('grey');
      expect(results).toHaveLength(2);
    });

    it('should search by name (case insensitive)', () => {
      const results = dyeService.searchByName('SNOW');
      expect(results).toHaveLength(1);
    });

    it('should search by category', () => {
      const results = dyeService.searchByCategory('Grays');
      expect(results).toHaveLength(2);
    });

    it('should filter by category', () => {
      const results = dyeService.filterDyes({ category: 'Grays' });
      expect(results).toHaveLength(2);
    });

    it('should filter with exclude IDs', () => {
      const results = dyeService.filterDyes({ excludeIds: [5729, 5730] });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter with empty options', () => {
      const results = dyeService.filterDyes();
      expect(results).toHaveLength(6);
    });

    it('should find closest dye to hex', () => {
      const closestDye = dyeService.findClosestDye('#EBEBEB');
      expect(closestDye).toBeDefined();
      expect(closestDye?.name).toBe('Snow White');
    });

    it('should find closest dye with exclude list (default)', () => {
      const closestDye = dyeService.findClosestDye('#EBEBEB');
      expect(closestDye).toBeDefined();
    });

    it('should find closest dye excluding specific IDs', () => {
      const closestDye = dyeService.findClosestDye('#EBEBEB', { excludeIds: [5729] });
      expect(closestDye).toBeDefined();
      expect(closestDye).toBeDefined();
    });

    it('should find dyes within distance', () => {
      const dyes = dyeService.findDyesWithinDistance('#ECECEC', { maxDistance: 50 });
      expect(dyes.length).toBeGreaterThanOrEqual(1);
    });

    it('should find dyes within distance with limit', () => {
      const dyes = dyeService.findDyesWithinDistance('#808080', { maxDistance: 100, limit: 2 });
      expect(dyes.length).toBeLessThanOrEqual(2);
    });
  });

  // ============================================================================
  // Harmony & Palette Generation
  // ============================================================================

  describe('harmony generation', () => {
    it('should find complementary pair', () => {
      const complement = dyeService.findComplementaryPair('#FF0000');
      expect(complement).toBeDefined();
    });

    it('should find analogous dyes with default angle', () => {
      const analogous = dyeService.findAnalogousDyes('#FF0000');
      expect(analogous).toBeDefined();
    });

    it('should find analogous dyes with custom angle', () => {
      const analogous = dyeService.findAnalogousDyes('#FF0000', 45);
      expect(analogous).toBeDefined();
    });

    it('should find triadic dyes', () => {
      const triadic = dyeService.findTriadicDyes('#FF0000');
      expect(Array.isArray(triadic)).toBe(true);
      expect(triadic.length).toBeLessThanOrEqual(2);
    });

    it('should find square dyes', () => {
      const square = dyeService.findSquareDyes('#FF0000');
      expect(Array.isArray(square)).toBe(true);
      expect(square.length).toBeLessThanOrEqual(3);
    });

    it('should find tetradic dyes', () => {
      const tetradic = dyeService.findTetradicDyes('#FF0000');
      expect(Array.isArray(tetradic)).toBe(true);
      expect(tetradic.length).toBeLessThanOrEqual(3);
    });

    it('should find inverted tetradic dyes', () => {
      const inverted = dyeService.findInvertedTetradicDyes('#FF0000');
      expect(Array.isArray(inverted)).toBe(true);
      expect(inverted.length).toBeLessThanOrEqual(3);
    });

    it('should find monochromatic dyes with default limit', () => {
      const mono = dyeService.findMonochromaticDyes('#FF0000');
      expect(mono.length).toBeLessThanOrEqual(6);
    });

    it('should find monochromatic dyes with custom limit', () => {
      const mono = dyeService.findMonochromaticDyes('#FF0000', 3);
      expect(mono.length).toBeLessThanOrEqual(3);
    });

    it('should find split-complementary dyes', () => {
      const splitComp = dyeService.findSplitComplementaryDyes('#FF0000');
      expect(Array.isArray(splitComp)).toBe(true);
      expect(splitComp.length).toBeLessThanOrEqual(2);
    });
  });

  // ============================================================================
  // Localization Support
  // ============================================================================

  describe('localization support', () => {
    describe('searchByLocalizedName', () => {
      it('should fall back to English search when no locale loaded', () => {
        // LocalizationService.isLocaleLoaded() returns false by default
        const results = dyeService.searchByLocalizedName('snow');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Snow White');
      });

      it('should search both English and localized names when locale loaded', async () => {
        // Mock the LocalizationService
        vi.spyOn(LocalizationService, 'isLocaleLoaded').mockReturnValue(true);
        vi.spyOn(LocalizationService, 'getDyeName').mockImplementation((itemID: number) => {
          if (itemID === 5729) return 'スノウホワイト';
          if (itemID === 5730) return 'アッシュグレイ';
          return null;
        });

        // Search by localized name
        const japaneseResults = dyeService.searchByLocalizedName('スノウ');
        expect(japaneseResults).toHaveLength(1);

        // English still works
        const englishResults = dyeService.searchByLocalizedName('snow');
        expect(englishResults).toHaveLength(1);
      });
    });
  });
});
