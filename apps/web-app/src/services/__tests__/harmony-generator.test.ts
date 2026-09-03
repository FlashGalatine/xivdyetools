/**
 * XIV Dye Tools - Harmony Generator Unit Tests
 *
 * Tests the harmony color calculation and dye matching functions.
 *
 * @module services/__tests__/harmony-generator.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getHarmonyTypes, HARMONY_TYPE_IDS } from '../harmony-generator';
import { HARMONY_OFFSETS } from '@xivdyetools/core';

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
    hsvToHex: vi.fn(() => '#MOCK00'),
    getColorDistance: vi.fn(() => 50),
    getDistanceForMethod: vi.fn((_h1: string, _h2: string, m: string) => {
      const table: Record<string, number> = {
        ciede2000: 25,
        oklab: 15,
        cie76: 50,
        redmean: 20,
        rgb: 100,
        distinguish: 23,
      };
      return table[m] ?? 25;
    }),
  },
  dyeService: {
    getAllDyes: vi.fn(() => []),
  },
  LanguageService: {
    getHarmonyType: vi.fn((key: string) => `Harmony: ${key}`),
    t: vi.fn((key: string) => `Translation: ${key}`),
  },
}));

vi.mock('@xivdyetools/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/core')>();
  return {
    ...actual,
    ColorConverter: {
      getDeltaE: vi.fn((_hex1: string, _hex2: string, algorithm: string) => {
        if (algorithm === 'cie76') return 50;
        if (algorithm === 'cie2000' || algorithm === 'ciede2000') return 25;
        return 30;
      }),
      getDeltaE_Oklab: vi.fn(() => 15),
      getDeltaE_redmean: vi.fn(() => 20),
      getDeltaE_OklchWeighted: vi.fn(() => 18),
    },
  };
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
      expect(ids).toContain('inverted-tetradic');
      expect(ids).toContain('square');
      expect(ids).toContain('monochromatic');
      expect(ids).toContain('compound');
      expect(ids).toContain('shades');
    });

    it('should have icons for each type', () => {
      HARMONY_TYPE_IDS.forEach(({ icon }) => {
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

    it('should have inverted-tetradic at 120, 180, and 300 degrees (mirror of tetradic)', () => {
      expect(HARMONY_OFFSETS['inverted-tetradic']).toEqual([120, 180, 300]);
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

  // The selection algorithm's tests went with the algorithm: it now lives in
  // `@xivdyetools/core` as `generateHarmonySlots`, covered by
  // `HarmonySelector.test.ts` and pinned by `HarmonySelector.golden.test.ts`,
  // whose digest was captured from THIS module's output while both still
  // existed. What remains here is the picker's vocabulary.
});
