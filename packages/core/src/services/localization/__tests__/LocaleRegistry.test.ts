import { describe, it, expect, beforeEach } from 'vitest';
import { LocaleRegistry } from '../LocaleRegistry.js';
import type { LocaleData, LocaleCode } from '../../../types/index.js';

describe('LocaleRegistry', () => {
  let registry: LocaleRegistry;

  // Mock locale data for testing
  const mockEnglishData: LocaleData = {
    locale: 'en' as LocaleCode,
    meta: {
      version: '1.0.0',
      generated: '2025-01-01T00:00:00.000Z',
      dyeCount: 125,
    },
    labels: {
      dye: 'Dye',
      dark: 'Dark',
      metallic: 'Metallic',
      pastel: 'Pastel',
      cosmic: 'Cosmic',
      cosmicExploration: 'Cosmic Exploration',
      cosmicFortunes: 'Cosmic Fortunes',
    },
    dyeNames: {
      '5729': 'Snow White',
      '5740': 'Wine Red',
    },
    categories: {
      Reds: 'Reds',
      Blues: 'Blues',
      Neutral: 'Neutral',
    },
    acquisitions: {
      'Dye Vendor': 'Dye Vendor',
      Crafting: 'Crafting',
    },
    metallicDyeIds: [13116, 13117],
    harmonyTypes: {
      complementary: 'Complementary',
      analogous: 'Analogous',
      triadic: 'Triadic',
      splitComplementary: 'Split-Complementary',
      tetradic: 'Tetradic',
      square: 'Square',
      monochromatic: 'Monochromatic',
      compound: 'Compound',
      shades: 'Shades',
    },
    visionTypes: {
      normal: 'Normal Vision',
      deuteranopia: 'Deuteranopia',
      protanopia: 'Protanopia',
      tritanopia: 'Tritanopia',
      achromatopsia: 'Achromatopsia',
    },
  };

  const mockJapaneseData: LocaleData = {
    ...mockEnglishData,
    locale: 'ja' as LocaleCode,
    labels: {
      dye: 'カララント',
      dark: '濃',
      metallic: 'メタリック',
      pastel: 'パステル',
      cosmic: 'コスミック',
      cosmicExploration: 'コズミック・エクスプロレーション',
      cosmicFortunes: 'コズミック・フォーチュン',
    },
    dyeNames: {
      '5729': 'スノウホワイト',
      '5740': 'ワインレッド',
    },
  };

  beforeEach(() => {
    registry = new LocaleRegistry();
  });

  describe('registerLocale', () => {
    it('should register a locale successfully', () => {
      registry.registerLocale(mockEnglishData);

      expect(registry.hasLocale('en')).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should register multiple locales', () => {
      registry.registerLocale(mockEnglishData);
      registry.registerLocale(mockJapaneseData);

      expect(registry.hasLocale('en')).toBe(true);
      expect(registry.hasLocale('ja')).toBe(true);
      expect(registry.size).toBe(2);
    });

    it('should overwrite existing locale when registered again', () => {
      registry.registerLocale(mockEnglishData);

      const updatedEnglishData: LocaleData = {
        ...mockEnglishData,
        meta: { ...mockEnglishData.meta, version: '2.0.0' },
      };

      registry.registerLocale(updatedEnglishData);

      const retrieved = registry.getLocale('en');
      expect(retrieved?.meta.version).toBe('2.0.0');
      expect(registry.size).toBe(1); // Should still be 1
    });
  });

  describe('hasLocale', () => {
    it('should return false for unregistered locale', () => {
      expect(registry.hasLocale('en')).toBe(false);
    });

    it('should return true for registered locale', () => {
      registry.registerLocale(mockEnglishData);
      expect(registry.hasLocale('en')).toBe(true);
    });

    it('should return false after clearing registry', () => {
      registry.registerLocale(mockEnglishData);
      registry.clear();
      expect(registry.hasLocale('en')).toBe(false);
    });
  });

  describe('getLocale', () => {
    it('should return null for unregistered locale', () => {
      const result = registry.getLocale('en');
      expect(result).toBeNull();
    });

    it('should return registered locale data', () => {
      registry.registerLocale(mockEnglishData);

      const result = registry.getLocale('en');
      expect(result).toEqual(mockEnglishData);
    });

    it('should return correct locale data for multiple registered locales', () => {
      registry.registerLocale(mockEnglishData);
      registry.registerLocale(mockJapaneseData);

      const enResult = registry.getLocale('en');
      const jaResult = registry.getLocale('ja');

      expect(enResult?.locale).toBe('en');
      expect(jaResult?.locale).toBe('ja');
      expect(enResult?.labels.dye).toBe('Dye');
      expect(jaResult?.labels.dye).toBe('カララント');
    });

    it('should return complete locale data with all properties', () => {
      registry.registerLocale(mockEnglishData);

      const result = registry.getLocale('en');

      expect(result).toHaveProperty('locale');
      expect(result).toHaveProperty('meta');
      expect(result).toHaveProperty('labels');
      expect(result).toHaveProperty('dyeNames');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('acquisitions');
      expect(result).toHaveProperty('metallicDyeIds');
      expect(result).toHaveProperty('harmonyTypes');
      expect(result).toHaveProperty('visionTypes');
    });
  });

  describe('clear', () => {
    it('should clear all registered locales', () => {
      registry.registerLocale(mockEnglishData);
      registry.registerLocale(mockJapaneseData);

      expect(registry.size).toBe(2);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.hasLocale('en')).toBe(false);
      expect(registry.hasLocale('ja')).toBe(false);
    });

    it('should allow re-registering after clear', () => {
      registry.registerLocale(mockEnglishData);
      registry.clear();
      registry.registerLocale(mockEnglishData);

      expect(registry.hasLocale('en')).toBe(true);
      expect(registry.size).toBe(1);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size).toBe(0);
    });

    it('should return correct count after registering locales', () => {
      expect(registry.size).toBe(0);

      registry.registerLocale(mockEnglishData);
      expect(registry.size).toBe(1);

      registry.registerLocale(mockJapaneseData);
      expect(registry.size).toBe(2);
    });

    it('should return 0 after clear', () => {
      registry.registerLocale(mockEnglishData);
      registry.registerLocale(mockJapaneseData);

      registry.clear();

      expect(registry.size).toBe(0);
    });
  });

  describe('cache behavior', () => {
    it('should cache locale data in memory', () => {
      registry.registerLocale(mockEnglishData);

      const firstRetrieval = registry.getLocale('en');
      const secondRetrieval = registry.getLocale('en');

      // Should return the same cached data
      expect(firstRetrieval).toBe(secondRetrieval);
    });

    it('should maintain separate cache entries for different locales', () => {
      registry.registerLocale(mockEnglishData);
      registry.registerLocale(mockJapaneseData);

      const enData = registry.getLocale('en');
      const jaData = registry.getLocale('ja');

      expect(enData).not.toBe(jaData);
      expect(enData?.locale).toBe('en');
      expect(jaData?.locale).toBe('ja');
    });
  });
});
