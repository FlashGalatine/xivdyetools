/**
 * LocalizationService Comprehensive Tests
 * Phase 4.1: Target comprehensive coverage of the localization facade
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LocalizationService,
  extractLocaleCode,
  resolveLocaleFromPreference,
  SUPPORTED_LOCALES,
  LocalizationServiceConfig,
} from '../LocalizationService.js';
import type { LocaleCode, LocalePreference } from '../../types/index.js';
import { LocaleLoader } from '../localization/LocaleLoader.js';
import { LocaleRegistry } from '../localization/LocaleRegistry.js';
import { TranslationProvider } from '../localization/TranslationProvider.js';

// ============================================================================
// Pure Function Tests
// ============================================================================

describe('extractLocaleCode', () => {
  describe('valid locale strings', () => {
    it('should extract "en" from "en"', () => {
      expect(extractLocaleCode('en')).toBe('en');
    });

    it('should extract "en" from "en-US"', () => {
      expect(extractLocaleCode('en-US')).toBe('en');
    });

    it('should extract "en" from "en-GB"', () => {
      expect(extractLocaleCode('en-GB')).toBe('en');
    });

    it('should extract "ja" from "ja"', () => {
      expect(extractLocaleCode('ja')).toBe('ja');
    });

    it('should extract "ja" from "ja-JP"', () => {
      expect(extractLocaleCode('ja-JP')).toBe('ja');
    });

    it('should extract "de" from "de"', () => {
      expect(extractLocaleCode('de')).toBe('de');
    });

    it('should extract "de" from "de-DE"', () => {
      expect(extractLocaleCode('de-DE')).toBe('de');
    });

    it('should extract "fr" from "fr"', () => {
      expect(extractLocaleCode('fr')).toBe('fr');
    });

    it('should extract "fr" from "fr-FR"', () => {
      expect(extractLocaleCode('fr-FR')).toBe('fr');
    });
  });

  describe('case insensitivity', () => {
    it('should handle uppercase "EN"', () => {
      expect(extractLocaleCode('EN')).toBe('en');
    });

    it('should handle mixed case "En-Us"', () => {
      expect(extractLocaleCode('En-Us')).toBe('en');
    });

    it('should handle uppercase "JA-JP"', () => {
      expect(extractLocaleCode('JA-JP')).toBe('ja');
    });
  });

  describe('supported locales - Korean and Chinese', () => {
    it('should extract "ko" from "ko"', () => {
      expect(extractLocaleCode('ko')).toBe('ko');
    });

    it('should extract "ko" from "ko-KR"', () => {
      expect(extractLocaleCode('ko-KR')).toBe('ko');
    });

    it('should extract "zh" from "zh"', () => {
      expect(extractLocaleCode('zh')).toBe('zh');
    });

    it('should extract "zh" from "zh-CN"', () => {
      expect(extractLocaleCode('zh-CN')).toBe('zh');
    });
  });

  describe('unsupported locales', () => {
    it('should return null for unsupported locale "es"', () => {
      expect(extractLocaleCode('es')).toBeNull();
    });

    it('should return null for unsupported locale "pt-BR"', () => {
      expect(extractLocaleCode('pt-BR')).toBeNull();
    });

    it('should return null for unsupported locale "it"', () => {
      expect(extractLocaleCode('it')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(extractLocaleCode('')).toBeNull();
    });

    it('should handle single character', () => {
      expect(extractLocaleCode('e')).toBeNull();
    });

    it('should handle locale with multiple dashes', () => {
      expect(extractLocaleCode('en-US-variant')).toBe('en');
    });
  });
});

describe('resolveLocaleFromPreference', () => {
  describe('explicit priority', () => {
    it('should return explicit locale when provided', () => {
      const preference: LocalePreference = {
        explicit: 'de',
        guild: 'ja',
        system: 'en',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('de');
    });

    it('should return explicit locale over all others', () => {
      const preference: LocalePreference = {
        explicit: 'fr',
        guild: 'de',
        system: 'ja',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('fr');
    });

    it('should skip invalid explicit locale', () => {
      const preference: LocalePreference = {
        explicit: 'es' as LocaleCode, // Invalid - Spanish not supported
        guild: 'ja',
        system: 'en',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('ja');
    });

    it('should accept Chinese as valid explicit locale', () => {
      const preference: LocalePreference = {
        explicit: 'zh',
        guild: 'ja',
        system: 'en',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('zh');
    });

    it('should accept Korean as valid explicit locale', () => {
      const preference: LocalePreference = {
        explicit: 'ko',
        guild: 'ja',
        system: 'en',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('ko');
    });
  });

  describe('guild priority', () => {
    it('should use guild locale when explicit is null', () => {
      const preference: LocalePreference = {
        explicit: null,
        guild: 'ja',
        system: 'en',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('ja');
    });

    it('should extract locale from guild string (ja-JP)', () => {
      const preference: LocalePreference = {
        explicit: null,
        guild: 'ja-JP',
        system: 'en',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('ja');
    });

    it('should skip invalid guild locale', () => {
      const preference: LocalePreference = {
        explicit: null,
        guild: 'es-ES', // Spanish not supported
        system: 'de',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('de');
    });

    it('should accept Chinese guild locale', () => {
      const preference: LocalePreference = {
        explicit: null,
        guild: 'zh-CN',
        system: 'de',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('zh');
    });
  });

  describe('system priority', () => {
    it('should use system locale when explicit and guild are null/invalid', () => {
      const preference: LocalePreference = {
        explicit: null,
        guild: null,
        system: 'de-DE',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('de');
    });

    it('should extract locale from system string', () => {
      const preference: LocalePreference = {
        explicit: null,
        guild: null,
        system: 'fr-FR',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('fr');
    });

    it('should skip invalid system locale', () => {
      const preference: LocalePreference = {
        explicit: null,
        guild: null,
        system: 'it-IT', // Italian not supported
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('en');
    });

    it('should accept Korean system locale', () => {
      const preference: LocalePreference = {
        explicit: null,
        guild: null,
        system: 'ko-KR',
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('ko');
    });
  });

  describe('fallback priority', () => {
    it('should use fallback when all others are null', () => {
      const preference: LocalePreference = {
        explicit: null,
        guild: null,
        system: null,
        fallback: 'en',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('en');
    });

    it('should use fallback when all others are invalid', () => {
      const preference: LocalePreference = {
        explicit: 'es' as LocaleCode, // Spanish not supported
        guild: 'it', // Italian not supported
        system: 'pt', // Portuguese not supported
        fallback: 'ja',
      };
      expect(resolveLocaleFromPreference(preference)).toBe('ja');
    });
  });
});

describe('SUPPORTED_LOCALES', () => {
  it('should contain en, ja, de, fr, ko, zh', () => {
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('ja');
    expect(SUPPORTED_LOCALES).toContain('de');
    expect(SUPPORTED_LOCALES).toContain('fr');
    expect(SUPPORTED_LOCALES).toContain('ko');
    expect(SUPPORTED_LOCALES).toContain('zh');
  });

  it('should have exactly 6 locales', () => {
    expect(SUPPORTED_LOCALES.length).toBe(6);
  });

  it('should be readonly array', () => {
    // TypeScript enforces readonly at compile time via `as const`
    // Runtime we verify it's an array with expected content
    expect(Array.isArray(SUPPORTED_LOCALES)).toBe(true);
    expect(SUPPORTED_LOCALES).toEqual(['en', 'ja', 'de', 'fr', 'ko', 'zh']);
  });
});

// ============================================================================
// Mock Implementations
// ============================================================================

class MockLocaleLoader extends LocaleLoader {
  private mockData: Map<string, unknown> = new Map();

  setMockData(locale: string, data: unknown) {
    this.mockData.set(locale, data);
  }

  loadLocale(locale: LocaleCode) {
    const data = this.mockData.get(locale) as Record<string, unknown>;
    if (!data) {
      throw new Error(`Mock data not set for locale: ${locale}`);
    }
    return {
      locale,
      meta: {
        version: '1.0.0',
        generated: new Date().toISOString(),
        dyeCount: Object.keys(data.dyeNames ?? {}).length,
      },
      labels: data.labels ?? {},
      dyeNames: data.dyeNames ?? {},
      categories: data.categories ?? {},
      acquisitions: data.acquisitions ?? {},
      metallicDyeIds: (data.metallicDyeIds as number[]) ?? [],
      harmonyTypes: data.harmonyTypes ?? {},
      visionTypes: data.visionTypes ?? {},
    } as import('../../types/index.js').LocaleData;
  }
}

// ============================================================================
// LocalizationService Instance Tests
// ============================================================================

describe('LocalizationService', () => {
  let mockLoader: MockLocaleLoader;
  let registry: LocaleRegistry;
  let service: LocalizationService;

  const mockEnglishData = {
    labels: {
      dye: 'Dye:',
      category: 'Category:',
      acquisition: 'Acquisition:',
    },
    dyeNames: {
      '5729': 'Snow White',
      '5730': 'Ash Grey',
    },
    categories: {
      Whites: 'Whites',
      Grays: 'Grays',
    },
    acquisitions: {
      'Dye Vendor': 'Dye Vendor',
      Crafting: 'Crafting',
    },
    metallicDyeIds: [],
    harmonyTypes: {
      complementary: 'Complementary',
      analogous: 'Analogous',
    },
    visionTypes: {
      normal: 'Normal Vision',
      deuteranopia: 'Deuteranopia',
    },
  };

  const mockJapaneseData = {
    labels: {
      dye: 'カラント：',
      category: 'カテゴリー：',
    },
    dyeNames: {
      '5729': 'スノウホワイト',
      '5730': 'アッシュグレイ',
    },
    categories: {
      Whites: '白系',
      Grays: '灰系',
    },
    acquisitions: {
      'Dye Vendor': '染料売り',
    },
    metallicDyeIds: [],
    harmonyTypes: {
      complementary: '補色',
    },
    visionTypes: {
      normal: '通常視覚',
    },
  };

  beforeEach(() => {
    mockLoader = new MockLocaleLoader();
    mockLoader.setMockData('en', mockEnglishData);
    mockLoader.setMockData('ja', mockJapaneseData);

    registry = new LocaleRegistry();
    const translator = new TranslationProvider(registry);

    service = new LocalizationService({
      loader: mockLoader,
      registry: registry,
      translator: translator,
    });
  });

  afterEach(() => {
    service.clear();
    LocalizationService.clear();
  });

  describe('constructor', () => {
    it('should create with default implementations', () => {
      const defaultService = new LocalizationService();
      expect(defaultService).toBeDefined();
    });

    it('should create with custom loader', () => {
      const customService = new LocalizationService({ loader: mockLoader });
      expect(customService).toBeDefined();
    });

    it('should create with custom registry', () => {
      const customService = new LocalizationService({ registry: new LocaleRegistry() });
      expect(customService).toBeDefined();
    });

    it('should create with all custom implementations', () => {
      const customRegistry = new LocaleRegistry();
      const customService = new LocalizationService({
        loader: mockLoader,
        registry: customRegistry,
        translator: new TranslationProvider(customRegistry),
      });
      expect(customService).toBeDefined();
    });
  });

  describe('setLocale', () => {
    it('should set locale and mark as initialized', async () => {
      expect(service.isLocaleLoaded()).toBe(false);
      await service.setLocale('en');
      expect(service.isLocaleLoaded()).toBe(true);
      expect(service.getCurrentLocale()).toBe('en');
    });

    it('should load locale data from loader', async () => {
      await service.setLocale('en');
      const label = service.getLabel('dye');
      expect(label).toBe('Dye:');
    });

    it('should switch locales', async () => {
      await service.setLocale('en');
      expect(service.getCurrentLocale()).toBe('en');

      await service.setLocale('ja');
      expect(service.getCurrentLocale()).toBe('ja');
    });

    it('should use cached locale on second call', async () => {
      await service.setLocale('en');
      await service.setLocale('en'); // Should not reload
      expect(service.getCurrentLocale()).toBe('en');
    });
  });

  describe('setLocaleFromPreference', () => {
    it('should resolve and set locale from preference', async () => {
      await service.setLocaleFromPreference({
        explicit: 'ja',
        guild: 'en',
        system: 'de',
        fallback: 'en',
      });
      expect(service.getCurrentLocale()).toBe('ja');
    });

    it('should fall back through preference chain', async () => {
      await service.setLocaleFromPreference({
        explicit: null,
        guild: null,
        system: null,
        fallback: 'en',
      });
      expect(service.getCurrentLocale()).toBe('en');
    });
  });

  describe('getCurrentLocale', () => {
    it('should return default locale before initialization', () => {
      expect(service.getCurrentLocale()).toBe('en');
    });

    it('should return current locale after setting', async () => {
      await service.setLocale('ja');
      expect(service.getCurrentLocale()).toBe('ja');
    });
  });

  describe('isLocaleLoaded', () => {
    it('should return false before loading', () => {
      expect(service.isLocaleLoaded()).toBe(false);
    });

    it('should return true after loading', async () => {
      await service.setLocale('en');
      expect(service.isLocaleLoaded()).toBe(true);
    });

    it('should return false after clear', async () => {
      await service.setLocale('en');
      service.clear();
      expect(service.isLocaleLoaded()).toBe(false);
    });
  });

  describe('getLabel', () => {
    it('should return localized label', async () => {
      await service.setLocale('en');
      expect(service.getLabel('dye')).toBe('Dye:');
    });

    it('should return Japanese label', async () => {
      await service.setLocale('ja');
      expect(service.getLabel('dye')).toBe('カラント：');
    });
  });

  describe('getDyeName', () => {
    it('should return localized dye name', async () => {
      await service.setLocale('en');
      expect(service.getDyeName(5729)).toBe('Snow White');
    });

    it('should return Japanese dye name', async () => {
      await service.setLocale('ja');
      expect(service.getDyeName(5729)).toBe('スノウホワイト');
    });

    it('should return null for non-existent dye', async () => {
      await service.setLocale('en');
      expect(service.getDyeName(9999)).toBeNull();
    });
  });

  describe('getCategory', () => {
    it('should return localized category', async () => {
      await service.setLocale('en');
      expect(service.getCategory('Whites')).toBe('Whites');
    });

    it('should return Japanese category', async () => {
      await service.setLocale('ja');
      expect(service.getCategory('Whites')).toBe('白系');
    });
  });

  describe('getAcquisition', () => {
    it('should return localized acquisition', async () => {
      await service.setLocale('en');
      expect(service.getAcquisition('Dye Vendor')).toBe('Dye Vendor');
    });

    it('should return Japanese acquisition', async () => {
      await service.setLocale('ja');
      expect(service.getAcquisition('Dye Vendor')).toBe('染料売り');
    });
  });

  describe('getMetallicDyeIds', () => {
    it('should return array of metallic dye IDs', async () => {
      await service.setLocale('en');
      const ids = service.getMetallicDyeIds();
      expect(Array.isArray(ids)).toBe(true);
    });
  });

  describe('getHarmonyType', () => {
    it('should return localized harmony type', async () => {
      await service.setLocale('en');
      expect(service.getHarmonyType('complementary')).toBe('Complementary');
    });

    it('should return Japanese harmony type', async () => {
      await service.setLocale('ja');
      expect(service.getHarmonyType('complementary')).toBe('補色');
    });
  });

  describe('getVisionType', () => {
    it('should return localized vision type', async () => {
      await service.setLocale('en');
      expect(service.getVisionType('normal')).toBe('Normal Vision');
    });

    it('should return Japanese vision type', async () => {
      await service.setLocale('ja');
      expect(service.getVisionType('normal')).toBe('通常視覚');
    });
  });

  describe('getAvailableLocales', () => {
    it('should return array of supported locales', () => {
      const locales = service.getAvailableLocales();
      expect(locales).toContain('en');
      expect(locales).toContain('ja');
      expect(locales).toContain('de');
      expect(locales).toContain('fr');
      expect(locales).toContain('ko');
      expect(locales).toContain('zh');
    });

    it('should return a copy', () => {
      const locales1 = service.getAvailableLocales();
      const locales2 = service.getAvailableLocales();
      expect(locales1).not.toBe(locales2);
    });
  });

  describe('preloadLocales', () => {
    it('should preload multiple locales', async () => {
      await service.preloadLocales(['en', 'ja']);
      // Both should be loaded, switching should be instant
      await service.setLocale('en');
      expect(service.getCurrentLocale()).toBe('en');
      await service.setLocale('ja');
      expect(service.getCurrentLocale()).toBe('ja');
    });
  });

  describe('clear', () => {
    it('should reset service state', async () => {
      await service.setLocale('ja');
      expect(service.getCurrentLocale()).toBe('ja');
      expect(service.isLocaleLoaded()).toBe(true);

      service.clear();
      expect(service.getCurrentLocale()).toBe('en');
      expect(service.isLocaleLoaded()).toBe(false);
    });
  });

  // ==========================================================================
  // Static API Tests
  // ==========================================================================

  describe('Static API', () => {
    beforeEach(() => {
      LocalizationService.clear();
    });

    it('should call static setLocale', async () => {
      await LocalizationService.setLocale('en');
      expect(LocalizationService.getCurrentLocale()).toBe('en');
    });

    it('should call static setLocaleFromPreference', async () => {
      await LocalizationService.setLocaleFromPreference({
        explicit: 'en',
        guild: null,
        system: null,
        fallback: 'en',
      });
      expect(LocalizationService.getCurrentLocale()).toBe('en');
    });

    it('should have static getCurrentLocale', () => {
      const locale = LocalizationService.getCurrentLocale();
      expect(typeof locale).toBe('string');
    });

    it('should have static isLocaleLoaded', () => {
      expect(typeof LocalizationService.isLocaleLoaded()).toBe('boolean');
    });

    it('should call static getLabel', () => {
      const result = LocalizationService.getLabel('dye');
      expect(typeof result).toBe('string');
    });

    it('should call static getDyeName', () => {
      const result = LocalizationService.getDyeName(5729);
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should call static getCategory', () => {
      const result = LocalizationService.getCategory('Reds');
      expect(typeof result).toBe('string');
    });

    it('should call static getAcquisition', () => {
      const result = LocalizationService.getAcquisition('Dye Vendor');
      expect(typeof result).toBe('string');
    });

    it('should call static getMetallicDyeIds', () => {
      const ids = LocalizationService.getMetallicDyeIds();
      expect(Array.isArray(ids)).toBe(true);
    });

    it('should call static getHarmonyType', () => {
      const result = LocalizationService.getHarmonyType('complementary');
      expect(typeof result).toBe('string');
    });

    it('should call static getVisionType', () => {
      const result = LocalizationService.getVisionType('normal');
      expect(typeof result).toBe('string');
    });

    it('should have static getAvailableLocales', () => {
      const locales = LocalizationService.getAvailableLocales();
      expect(Array.isArray(locales)).toBe(true);
    });

    it('should call static preloadLocales', async () => {
      await LocalizationService.preloadLocales(['en']);
      expect(LocalizationService.isLocaleLoaded()).toBe(true);
    });

    it('should have static clear', () => {
      expect(typeof LocalizationService.clear).toBe('function');
    });
  });
});
