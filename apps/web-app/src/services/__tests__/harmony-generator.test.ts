/**
 * XIV Dye Tools - Harmony Generator Unit Tests
 *
 * Tests the harmony color calculation and dye matching functions.
 *
 * @module services/__tests__/harmony-generator.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getHarmonyTypes,
  calculateColorDistance,
  calculateHueDeviance,
  findClosestDyesToHue,
  replaceExcludedDyes,
  findHarmonyDyes,
  HARMONY_TYPE_IDS,
  HARMONY_OFFSETS,
  type HarmonyConfig,
  type ScoredDyeMatch,
} from '../harmony-generator';
import type { Dye } from '@shared/types';
import type { MatchingMethod } from '@shared/tool-config-types';

// Mock the services
vi.mock('@services/index', () => ({
  ColorService: {
    hexToHsv: vi.fn((hex: string) => {
      // Simple mock: parse color and return approximate HSV
      if (hex === '#FF0000') return { h: 0, s: 100, v: 100 };
      if (hex === '#00FF00') return { h: 120, s: 100, v: 100 };
      if (hex === '#0000FF') return { h: 240, s: 100, v: 100 };
      if (hex === '#FFFF00') return { h: 60, s: 100, v: 100 };
      return { h: 0, s: 0, v: 50 };
    }),
    hsvToHex: vi.fn((h: number, s: number, v: number) => '#MOCK00'),
    getColorDistance: vi.fn(() => 50),
  },
  dyeService: {
    getAllDyes: vi.fn(() => []),
  },
  LanguageService: {
    getHarmonyType: vi.fn((key: string) => `Harmony: ${key}`),
    t: vi.fn((key: string) => `Translation: ${key}`),
  },
}));

vi.mock('@xivdyetools/core', () => ({
  ColorConverter: {
    getDeltaE: vi.fn((hex1: string, hex2: string, algorithm: string) => {
      if (algorithm === 'cie76') return 50;
      if (algorithm === 'cie2000') return 25;
      return 30;
    }),
    getDeltaE_Oklab: vi.fn(() => 15),
    getDeltaE_HyAB: vi.fn(() => 20),
    getDeltaE_OklchWeighted: vi.fn(() => 18),
  },
}));

// Mock dye factory
const createMockDye = (overrides: Partial<Dye> = {}): Dye => ({
  id: 1,
  name: 'Test Dye',
  itemID: 12345,
  stainID: 1,
  hex: '#FF0000',
  rgb: { r: 255, g: 0, b: 0 },
  hsv: { h: 0, s: 100, v: 100 },
  category: 'General-purpose',
  acquisition: 'NPC',
  cost: 0,
  isMetallic: false,
  isPastel: false,
  isDark: false,
  isCosmic: false,
  ...overrides,
});

describe('harmony-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // HARMONY_TYPE_IDS Tests
  // ============================================================================

  describe('HARMONY_TYPE_IDS', () => {
    it('should contain all expected harmony types', () => {
      const ids = HARMONY_TYPE_IDS.map((t) => t.id);

      expect(ids).toContain('complementary');
      expect(ids).toContain('analogous');
      expect(ids).toContain('triadic');
      expect(ids).toContain('split-complementary');
      expect(ids).toContain('tetradic');
      expect(ids).toContain('square');
      expect(ids).toContain('monochromatic');
      expect(ids).toContain('compound');
      expect(ids).toContain('shades');
    });

    it('should have icons for each type', () => {
      HARMONY_TYPE_IDS.forEach(({ id, icon }) => {
        expect(icon).toBeTruthy();
        expect(typeof icon).toBe('string');
      });
    });
  });

  // ============================================================================
  // HARMONY_OFFSETS Tests
  // ============================================================================

  describe('HARMONY_OFFSETS', () => {
    it('should have complementary at 180 degrees', () => {
      expect(HARMONY_OFFSETS.complementary).toEqual([180]);
    });

    it('should have analogous at 30 and 330 degrees', () => {
      expect(HARMONY_OFFSETS.analogous).toEqual([30, 330]);
    });

    it('should have triadic at 120 and 240 degrees', () => {
      expect(HARMONY_OFFSETS.triadic).toEqual([120, 240]);
    });

    it('should have split-complementary at 150 and 210 degrees', () => {
      expect(HARMONY_OFFSETS['split-complementary']).toEqual([150, 210]);
    });

    it('should have tetradic at 60, 180, and 240 degrees', () => {
      expect(HARMONY_OFFSETS.tetradic).toEqual([60, 180, 240]);
    });

    it('should have square at 90, 180, and 270 degrees', () => {
      expect(HARMONY_OFFSETS.square).toEqual([90, 180, 270]);
    });

    it('should have monochromatic at 0 degrees', () => {
      expect(HARMONY_OFFSETS.monochromatic).toEqual([0]);
    });

    it('should have compound at 30, 180, and 330 degrees', () => {
      expect(HARMONY_OFFSETS.compound).toEqual([30, 180, 330]);
    });

    it('should have shades at 15 and 345 degrees', () => {
      expect(HARMONY_OFFSETS.shades).toEqual([15, 345]);
    });
  });

  // ============================================================================
  // getHarmonyTypes Tests
  // ============================================================================

  describe('getHarmonyTypes', () => {
    it('should return harmony types with localized names', () => {
      const types = getHarmonyTypes();

      expect(types.length).toBe(HARMONY_TYPE_IDS.length);
      types.forEach((type) => {
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('description');
        expect(type).toHaveProperty('icon');
      });
    });

    it('should convert hyphenated IDs to camelCase for localization', async () => {
      const { LanguageService } = await import('@services/index');

      getHarmonyTypes();

      // 'split-complementary' should become 'splitComplementary'
      expect(LanguageService.getHarmonyType).toHaveBeenCalledWith('splitComplementary');
    });
  });

  // ============================================================================
  // calculateColorDistance Tests
  // ============================================================================

  describe('calculateColorDistance', () => {
    const hex1 = '#FF0000';
    const hex2 = '#0000FF';

    it('should use RGB distance', async () => {
      const { ColorService } = await import('@services/index');

      const result = calculateColorDistance(hex1, hex2, 'rgb');

      expect(ColorService.getColorDistance).toHaveBeenCalledWith(hex1, hex2);
    });

    it('should use CIE76 DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'cie76');

      expect(ColorConverter.getDeltaE).toHaveBeenCalledWith(hex1, hex2, 'cie76');
      expect(result).toBe(50);
    });

    it('should use CIEDE2000 DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'ciede2000');

      expect(ColorConverter.getDeltaE).toHaveBeenCalledWith(hex1, hex2, 'cie2000');
      expect(result).toBe(25);
    });

    it('should use OKLAB DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'oklab');

      expect(ColorConverter.getDeltaE_Oklab).toHaveBeenCalledWith(hex1, hex2);
      expect(result).toBe(15);
    });

    it('should use HyAB DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'hyab');

      expect(ColorConverter.getDeltaE_HyAB).toHaveBeenCalledWith(hex1, hex2);
      expect(result).toBe(20);
    });

    it('should use OKLCH weighted DeltaE', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'oklch-weighted');

      expect(ColorConverter.getDeltaE_OklchWeighted).toHaveBeenCalledWith(hex1, hex2);
      expect(result).toBe(18);
    });

    it('should default to OKLAB for unknown method', async () => {
      const { ColorConverter } = await import('@xivdyetools/core');

      const result = calculateColorDistance(hex1, hex2, 'unknown' as MatchingMethod);

      expect(ColorConverter.getDeltaE_Oklab).toHaveBeenCalledWith(hex1, hex2);
    });
  });

  // ============================================================================
  // calculateHueDeviance Tests
  // ============================================================================

  describe('calculateHueDeviance', () => {
    it('should return 0 for same hue', async () => {
      const dye = createMockDye({ hex: '#FF0000' }); // Hue 0

      const result = calculateHueDeviance(dye, 0);

      expect(result).toBe(0);
    });

    it('should calculate angular distance correctly', async () => {
      const { ColorService } = await import('@services/index');
      vi.mocked(ColorService.hexToHsv).mockReturnValue({ h: 30, s: 100, v: 100 });

      const dye = createMockDye({ hex: '#FFA500' }); // Orange-ish

      const result = calculateHueDeviance(dye, 0);

      expect(result).toBe(30);
    });

    it('should use shortest angular distance (wrap around)', async () => {
      const { ColorService } = await import('@services/index');
      vi.mocked(ColorService.hexToHsv).mockReturnValue({ h: 350, s: 100, v: 100 });

      const dye = createMockDye({ hex: '#FF0000' });

      const result = calculateHueDeviance(dye, 10);

      // Distance from 350 to 10: min(340, 20) = 20
      expect(result).toBe(20);
    });

    it('should handle complementary colors (180 degrees)', async () => {
      const { ColorService } = await import('@services/index');
      vi.mocked(ColorService.hexToHsv).mockReturnValue({ h: 180, s: 100, v: 100 });

      const dye = createMockDye({ hex: '#00FFFF' }); // Cyan

      const result = calculateHueDeviance(dye, 0);

      expect(result).toBe(180);
    });
  });

  // ============================================================================
  // findClosestDyesToHue Tests
  // ============================================================================

  describe('findClosestDyesToHue', () => {
    it('should return empty array for empty dyes list', () => {
      const result = findClosestDyesToHue([], 180, 5, {
        usePerceptualMatching: false,
        matchingMethod: 'oklab',
      });

      expect(result).toEqual([]);
    });

    it('should skip Facewear category dyes', async () => {
      const { ColorService } = await import('@services/index');
      vi.mocked(ColorService.hexToHsv).mockReturnValue({ h: 0, s: 100, v: 100 });

      const dyes = [
        createMockDye({ id: 1, itemID: 1, category: 'Facewear', hex: '#FF0000' }),
        createMockDye({ id: 2, itemID: 2, category: 'General-purpose', hex: '#FF0000' }),
      ];

      const result = findClosestDyesToHue(dyes, 0, 5, {
        usePerceptualMatching: false,
        matchingMethod: 'oklab',
      });

      expect(result.length).toBe(1);
      expect(result[0].dye.category).toBe('General-purpose');
    });

    it('should sort by deviance ascending', async () => {
      const { ColorService } = await import('@services/index');
      // Mock different hues for different dyes
      vi.mocked(ColorService.hexToHsv)
        .mockReturnValueOnce({ h: 30, s: 100, v: 100 }) // 30 degrees from 0
        .mockReturnValueOnce({ h: 10, s: 100, v: 100 }); // 10 degrees from 0

      const dyes = [
        createMockDye({ id: 1, itemID: 1, hex: '#FFA500' }), // Orange
        createMockDye({ id: 2, itemID: 2, hex: '#FF4500' }), // Red-orange
      ];

      const result = findClosestDyesToHue(dyes, 0, 5, {
        usePerceptualMatching: false,
        matchingMethod: 'oklab',
      });

      // Should be sorted with smaller deviance first
      expect(result[0].deviance).toBeLessThanOrEqual(result[1].deviance);
    });

    it('should limit results to count parameter', async () => {
      const { ColorService } = await import('@services/index');
      vi.mocked(ColorService.hexToHsv).mockReturnValue({ h: 0, s: 100, v: 100 });

      const dyes = Array.from({ length: 10 }, (_, i) =>
        createMockDye({ id: i, itemID: i, hex: '#FF0000' })
      );

      const result = findClosestDyesToHue(dyes, 0, 3, {
        usePerceptualMatching: false,
        matchingMethod: 'oklab',
      });

      expect(result.length).toBe(3);
    });

    it('should use perceptual matching when enabled', async () => {
      const { ColorService } = await import('@services/index');
      vi.mocked(ColorService.hexToHsv).mockReturnValue({ h: 0, s: 50, v: 50 });

      const baseDye = createMockDye({ hsv: { h: 0, s: 60, v: 70 } });
      const dyes = [createMockDye()];

      findClosestDyesToHue(
        dyes,
        180,
        5,
        { usePerceptualMatching: true, matchingMethod: 'oklab' },
        baseDye
      );

      // Should call hsvToHex to create target color
      expect(ColorService.hsvToHex).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // replaceExcludedDyes Tests
  // ============================================================================

  describe('replaceExcludedDyes', () => {
    it('should return dyes unchanged when no filters', () => {
      const dyes: ScoredDyeMatch[] = [{ dye: createMockDye(), deviance: 10 }];

      const result = replaceExcludedDyes(dyes, 180, null, null);

      expect(result).toEqual(dyes);
    });

    it('should return dyes unchanged when filterConfig is null', () => {
      const dyeFilters = { isDyeExcluded: vi.fn().mockReturnValue(false) };
      const dyes: ScoredDyeMatch[] = [{ dye: createMockDye(), deviance: 10 }];

      const result = replaceExcludedDyes(dyes, 180, dyeFilters as any, null);

      expect(result).toEqual(dyes);
    });

    it('should keep non-excluded dyes', () => {
      const dyeFilters = { isDyeExcluded: vi.fn().mockReturnValue(false) };
      const filterConfig = { someFilter: true };
      const dyes: ScoredDyeMatch[] = [
        { dye: createMockDye({ itemID: 1 }), deviance: 10 },
        { dye: createMockDye({ itemID: 2 }), deviance: 20 },
      ];

      const result = replaceExcludedDyes(dyes, 180, dyeFilters as any, filterConfig as any);

      expect(result.length).toBe(2);
      expect(dyeFilters.isDyeExcluded).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // findHarmonyDyes Tests
  // ============================================================================

  describe('findHarmonyDyes', () => {
    it('should return empty array for unknown harmony type', async () => {
      const { dyeService } = await import('@services/index');
      vi.mocked(dyeService.getAllDyes).mockReturnValue([]);

      const baseDye = createMockDye();
      const config: HarmonyConfig = {
        usePerceptualMatching: false,
        matchingMethod: 'oklab',
        companionDyesCount: 3,
      };

      const result = findHarmonyDyes(baseDye, 'unknown-type', config);

      expect(result).toEqual([]);
    });

    it('should use harmony offsets for the harmony type', async () => {
      const { dyeService, ColorService } = await import('@services/index');
      vi.mocked(ColorService.hexToHsv).mockReturnValue({ h: 0, s: 100, v: 100 });
      vi.mocked(dyeService.getAllDyes).mockReturnValue([
        createMockDye({ id: 1, itemID: 1, hex: '#00FFFF' }),
      ]);

      const baseDye = createMockDye({ hex: '#FF0000' });
      const config: HarmonyConfig = {
        usePerceptualMatching: false,
        matchingMethod: 'oklab',
        companionDyesCount: 3,
      };

      const result = findHarmonyDyes(baseDye, 'complementary', config);

      // Complementary has one offset (180), so should process once
      expect(dyeService.getAllDyes).toHaveBeenCalled();
    });

    it('should filter excluded dyes when filters are provided', async () => {
      const { dyeService, ColorService } = await import('@services/index');
      vi.mocked(ColorService.hexToHsv).mockReturnValue({ h: 0, s: 100, v: 100 });
      vi.mocked(dyeService.getAllDyes).mockReturnValue([
        createMockDye({ id: 1, itemID: 1 }),
        createMockDye({ id: 2, itemID: 2 }),
      ]);

      const baseDye = createMockDye();
      const config: HarmonyConfig = {
        usePerceptualMatching: false,
        matchingMethod: 'oklab',
        companionDyesCount: 3,
      };
      const dyeFilters = {
        isDyeExcluded: vi.fn((dye: Dye) => dye.itemID === 1),
      };
      const filterConfig = { someFilter: true };

      const result = findHarmonyDyes(
        baseDye,
        'complementary',
        config,
        dyeFilters as any,
        filterConfig as any
      );

      // Dye with itemID 1 should be filtered out
      const ids = result.map((r) => r.dye.itemID);
      expect(ids).not.toContain(1);
    });
  });
});
