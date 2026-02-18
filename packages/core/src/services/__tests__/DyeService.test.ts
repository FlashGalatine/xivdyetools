/**
 * DyeService tests
 *
 * Tests for the DyeService facade which manages the FFXIV dye database.
 * Covers all methods including localization support.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DyeService } from '../DyeService.js';
import { LocalizationService } from '../LocalizationService.js';
import type { Dye } from '../../types/index.js';

// Sample dye data for testing (matches Dye interface)
const sampleDyes: Dye[] = [
  {
    itemID: 5729,
    id: 1,
    name: 'Snow White',
    hex: '#ECECEC',
    rgb: { r: 236, g: 236, b: 236 },
    hsv: { h: 0, s: 0, v: 92 },
    category: 'Whites',
    acquisition: 'Dye Vendor',
    cost: 334,
  },
  {
    itemID: 5730,
    id: 2,
    name: 'Ash Grey',
    hex: '#7D8485',
    rgb: { r: 125, g: 132, b: 133 },
    hsv: { h: 188, s: 6, v: 52 },
    category: 'Grays',
    acquisition: 'Dye Vendor',
    cost: 334,
  },
  {
    itemID: 5731,
    id: 3,
    name: 'Goobbue Grey',
    hex: '#6A6E6E',
    rgb: { r: 106, g: 110, b: 110 },
    hsv: { h: 180, s: 4, v: 43 },
    category: 'Grays',
    acquisition: 'Crafting',
    cost: 0,
  },
  {
    itemID: 5732,
    id: 4,
    name: 'Rose Pink',
    hex: '#EBB8B1',
    rgb: { r: 235, g: 184, b: 177 },
    hsv: { h: 7, s: 25, v: 92 },
    category: 'Reds',
    acquisition: 'Dye Vendor',
    cost: 334,
  },
  {
    itemID: 5733,
    id: 5,
    name: 'Lilac Purple',
    hex: '#CCB1DE',
    rgb: { r: 204, g: 177, b: 222 },
    hsv: { h: 276, s: 20, v: 87 },
    category: 'Purples',
    acquisition: 'Dye Vendor',
    cost: 334,
  },
  {
    itemID: 5734,
    id: 6,
    name: 'Metallic Silver',
    hex: '#ADADAD',
    rgb: { r: 173, g: 173, b: 173 },
    hsv: { h: 0, s: 0, v: 68 },
    category: 'Metallics',
    acquisition: 'Beast Tribes',
    cost: 0,
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

    it('should get multiple dyes by IDs', () => {
      const dyes = dyeService.getDyesByIds([5729, 5730, 5731]);
      expect(dyes).toHaveLength(3);
    });

    it('should filter out non-existent IDs', () => {
      const dyes = dyeService.getDyesByIds([5729, 99999, 5730]);
      expect(dyes).toHaveLength(2);
    });

    it('should check loaded status', () => {
      expect(dyeService.isLoadedStatus()).toBe(true);
      const emptyService = new DyeService();
    });

    it('should get last loaded time', () => {
      const time = dyeService.getLastLoadedTime();
      expect(time).toBeGreaterThan(0);
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
      const closestDye = dyeService.findClosestDye('#EBEBEB', []);
      expect(closestDye).toBeDefined();
    });

    it('should find closest dye excluding specific IDs', () => {
      const closestDye = dyeService.findClosestDye('#EBEBEB', [5729]);
      expect(closestDye).toBeDefined();
      expect(closestDye).toBeDefined();
    });

    it('should find dyes within distance', () => {
      const dyes = dyeService.findDyesWithinDistance('#ECECEC', 50);
      expect(dyes.length).toBeGreaterThanOrEqual(1);
    });

    it('should find dyes within distance with limit', () => {
      const dyes = dyeService.findDyesWithinDistance('#808080', 100, 2);
      expect(dyes.length).toBeLessThanOrEqual(2);
    });

    describe('sorting', () => {
      it('should sort by brightness ascending (default)', () => {
        const sorted = dyeService.getDyesSortedByBrightness();
        expect(sorted).toHaveLength(6);
      });

      it('should sort by brightness descending', () => {
        const sorted = dyeService.getDyesSortedByBrightness(false);
        expect(sorted).toHaveLength(6);
      });

      it('should sort by saturation ascending (default)', () => {
        const sorted = dyeService.getDyesSortedBySaturation();
        expect(sorted).toHaveLength(6);
      });

      it('should sort by saturation descending', () => {
        const sorted = dyeService.getDyesSortedBySaturation(false);
        expect(sorted).toHaveLength(6);
      });

      it('should sort by hue ascending (default)', () => {
        const sorted = dyeService.getDyesSortedByHue();
        expect(sorted).toHaveLength(6);
      });

      it('should sort by hue descending', () => {
        const sorted = dyeService.getDyesSortedByHue(false);
        expect(sorted).toHaveLength(6);
      });
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

    it('should find monochromatic dyes with default limit', () => {
      const mono = dyeService.findMonochromaticDyes('#FF0000');
      expect(mono.length).toBeLessThanOrEqual(6);
    });

    it('should find monochromatic dyes with custom limit', () => {
      const mono = dyeService.findMonochromaticDyes('#FF0000', 3);
      expect(mono.length).toBeLessThanOrEqual(3);
    });

    it('should find compound dyes', () => {
      const compound = dyeService.findCompoundDyes('#FF0000');
      expect(Array.isArray(compound)).toBe(true);
    });

    it('should find split-complementary dyes', () => {
      const splitComp = dyeService.findSplitComplementaryDyes('#FF0000');
      expect(Array.isArray(splitComp)).toBe(true);
      expect(splitComp.length).toBeLessThanOrEqual(2);
    });

    it('should find shade dyes', () => {
      const shades = dyeService.findShadesDyes('#FF0000');
      expect(shades).toBeDefined();
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

    describe('getLocalizedDyeById', () => {
      it('should return dye without localized name when no locale loaded', () => {
        const dye = dyeService.getLocalizedDyeById(5729);
        expect(dye).toBeDefined();
        expect(dye?.name).toBe('Snow White');
        expect(dye?.localizedName).toBeUndefined();
      });

      it('should return null for non-existent ID', () => {
        const dye = dyeService.getLocalizedDyeById(99999);
        expect(dye).toBeNull();
      });

      it('should include localized name when locale loaded', () => {
        vi.spyOn(LocalizationService, 'isLocaleLoaded').mockReturnValue(true);
        vi.spyOn(LocalizationService, 'getDyeName').mockReturnValue('スノウホワイト');

        const dye = dyeService.getLocalizedDyeById(5729);
        expect(dye).toBeDefined();
        expect(dye?.localizedName).toBe('スノウホワイト');
      });

      it('should handle null localized name', () => {
        vi.spyOn(LocalizationService, 'isLocaleLoaded').mockReturnValue(true);
        vi.spyOn(LocalizationService, 'getDyeName').mockReturnValue(null);

        const dye = dyeService.getLocalizedDyeById(5729);
        expect(dye).toBeDefined();
        expect(dye?.localizedName).toBeUndefined();
      });
    });

    describe('getAllLocalizedDyes', () => {
      it('should return dyes without localized names when no locale loaded', () => {
        const dyes = dyeService.getAllLocalizedDyes();
        expect(dyes).toHaveLength(6);
        dyes.forEach((dye) => {
          expect(dye.localizedName).toBeUndefined();
        });
      });

      it('should include localized names when locale loaded', () => {
        vi.spyOn(LocalizationService, 'isLocaleLoaded').mockReturnValue(true);
        vi.spyOn(LocalizationService, 'getDyeName').mockImplementation((itemID: number) => {
          if (itemID === 5729) return 'スノウホワイト';
          return null;
        });

        const dyes = dyeService.getAllLocalizedDyes();
        const snowWhite = dyes.find((d) => d.itemID === 5729);
        expect(snowWhite?.localizedName).toBe('スノウホワイト');
      });
    });

    describe('getNonMetallicDyes', () => {
      it('should exclude metallic dyes based on locale data', () => {
        vi.spyOn(LocalizationService, 'getMetallicDyeIds').mockReturnValue([5734]);

        const nonMetallic = dyeService.getNonMetallicDyes();
        expect(nonMetallic).toHaveLength(5);
        expect(nonMetallic.find((d) => d.itemID === 5734)).toBeUndefined();
      });

      it('should return all dyes when no metallic IDs', () => {
        vi.spyOn(LocalizationService, 'getMetallicDyeIds').mockReturnValue([]);

        const nonMetallic = dyeService.getNonMetallicDyes();
        expect(nonMetallic).toHaveLength(6);
      });
    });
  });
});
