import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocaleLoader } from '../LocaleLoader.js';
import type { LocaleCode } from '../../../types/index.js';
import { AppError, ErrorCode } from '../../../types/index.js';

describe('LocaleLoader', () => {
  let loader: LocaleLoader;

  beforeEach(() => {
    loader = new LocaleLoader();
  });

  describe('loadLocale', () => {
    it('should load English locale successfully', async () => {
      const localeData = await loader.loadLocale('en');

      expect(localeData).toBeDefined();
      expect(localeData.locale).toBe('en');
      expect(localeData.meta).toBeDefined();
      expect(localeData.labels).toBeDefined();
      expect(localeData.dyeNames).toBeDefined();
      expect(localeData.categories).toBeDefined();
      expect(localeData.acquisitions).toBeDefined();
      expect(localeData.metallicDyeIds).toBeInstanceOf(Array);
      expect(localeData.harmonyTypes).toBeDefined();
      expect(localeData.visionTypes).toBeDefined();
    });

    it('should load Japanese locale successfully', async () => {
      const localeData = await loader.loadLocale('ja');

      expect(localeData).toBeDefined();
      expect(localeData.locale).toBe('ja');
      expect(localeData.meta).toBeDefined();
      expect(localeData.labels).toBeDefined();
    });

    it('should load German locale successfully', async () => {
      const localeData = await loader.loadLocale('de');

      expect(localeData).toBeDefined();
      expect(localeData.locale).toBe('de');
      expect(localeData.meta).toBeDefined();
    });

    it('should load French locale successfully', async () => {
      const localeData = await loader.loadLocale('fr');

      expect(localeData).toBeDefined();
      expect(localeData.locale).toBe('fr');
      expect(localeData.meta).toBeDefined();
    });

    it('should throw AppError for non-existent locale', () => {
      expect(() => loader.loadLocale('invalid' as LocaleCode)).toThrow(AppError);
    });

    it('should throw AppError with correct error code for invalid locale', () => {
      try {
        loader.loadLocale('xx' as LocaleCode);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        if (error instanceof AppError) {
          expect(error.code).toBe(ErrorCode.LOCALE_LOAD_FAILED);
        }
      }
    });

    it('should have valid metadata in English locale', async () => {
      const localeData = await loader.loadLocale('en');

      expect(localeData.meta.version).toBeDefined();
      expect(localeData.meta.generated).toBeDefined();
      expect(localeData.meta.dyeCount).toBeGreaterThan(0);
    });

    it('should have valid labels in English locale', async () => {
      const localeData = await loader.loadLocale('en');

      expect(localeData.labels.dye).toBe('Dye');
      expect(localeData.labels.dark).toBe('Dark');
      expect(localeData.labels.metallic).toBe('Metallic');
    });

    it('should have dye names in loaded locale', async () => {
      const localeData = await loader.loadLocale('en');

      expect(localeData.dyeNames['5729']).toBe('Snow White');
      expect(localeData.dyeNames['5740']).toBe('Wine Red');
    });

    it('should have categories in loaded locale', async () => {
      const localeData = await loader.loadLocale('en');

      expect(localeData.categories['Reds']).toBe('Reds');
      expect(localeData.categories['Blues']).toBe('Blues');
      expect(localeData.categories['Neutral']).toBe('Neutral');
    });

    it('should have acquisitions in loaded locale', async () => {
      const localeData = await loader.loadLocale('en');

      expect(localeData.acquisitions['Dye Vendor']).toBe('Dye Vendor');
      expect(localeData.acquisitions['Crafting']).toBe('Crafting');
    });

    it('should have metallic dye IDs array', async () => {
      const localeData = await loader.loadLocale('en');

      expect(localeData.metallicDyeIds).toBeInstanceOf(Array);
      expect(localeData.metallicDyeIds.length).toBeGreaterThan(0);
      expect(localeData.metallicDyeIds).toContain(13116); // Metallic Silver
      expect(localeData.metallicDyeIds).toContain(13117); // Metallic Gold
    });

    it('should have harmony types in loaded locale', async () => {
      const localeData = await loader.loadLocale('en');

      expect(localeData.harmonyTypes.complementary).toBe('Complementary');
      expect(localeData.harmonyTypes.triadic).toBe('Triadic');
      expect(localeData.harmonyTypes.analogous).toBe('Analogous');
    });

    it('should have vision types in loaded locale', async () => {
      const localeData = await loader.loadLocale('en');

      expect(localeData.visionTypes.normal).toBe('Normal Vision');
      expect(localeData.visionTypes.deuteranopia).toContain('Deuteranopia');
      expect(localeData.visionTypes.protanopia).toContain('Protanopia');
      expect(localeData.visionTypes.tritanopia).toContain('Tritanopia');
    });
  });

  describe('data validation', () => {
    it('should validate locale data structure', async () => {
      const localeData = await loader.loadLocale('en');

      // All required fields must be present
      expect(localeData).toHaveProperty('locale');
      expect(localeData).toHaveProperty('meta');
      expect(localeData).toHaveProperty('labels');
      expect(localeData).toHaveProperty('dyeNames');
      expect(localeData).toHaveProperty('categories');
      expect(localeData).toHaveProperty('acquisitions');
      expect(localeData).toHaveProperty('metallicDyeIds');
      expect(localeData).toHaveProperty('harmonyTypes');
      expect(localeData).toHaveProperty('visionTypes');
    });

    it('should have consistent data types across all locales', async () => {
      const enData = await loader.loadLocale('en');
      const jaData = await loader.loadLocale('ja');
      const deData = await loader.loadLocale('de');
      const frData = await loader.loadLocale('fr');

      // Check that all locales have the same structure
      for (const data of [enData, jaData, deData, frData]) {
        expect(typeof data.locale).toBe('string');
        expect(typeof data.meta).toBe('object');
        expect(typeof data.labels).toBe('object');
        expect(typeof data.dyeNames).toBe('object');
        expect(Array.isArray(data.metallicDyeIds)).toBe(true);
      }
    });
  });

  describe('isValidLocaleData validation (internal)', () => {
    // These tests verify the internal validation logic is working correctly
    // by testing edge cases that would fail validation

    it('should load Korean locale successfully', async () => {
      const localeData = await loader.loadLocale('ko');
      expect(localeData).toBeDefined();
      expect(localeData.locale).toBe('ko');
    });

    it('should load Chinese locale successfully', async () => {
      const localeData = await loader.loadLocale('zh');
      expect(localeData).toBeDefined();
      expect(localeData.locale).toBe('zh');
    });

    it('should validate all fields exist in loaded data', async () => {
      // Load a locale and verify all required fields pass validation
      const localeData = await loader.loadLocale('en');

      // These assertions verify the validation passed
      expect(typeof localeData.locale).toBe('string');
      expect(typeof localeData.meta).toBe('object');
      expect(typeof localeData.labels).toBe('object');
      expect(typeof localeData.dyeNames).toBe('object');
      expect(typeof localeData.categories).toBe('object');
      expect(typeof localeData.acquisitions).toBe('object');
      expect(Array.isArray(localeData.metallicDyeIds)).toBe(true);
      expect(typeof localeData.harmonyTypes).toBe('object');
      expect(typeof localeData.visionTypes).toBe('object');
    });
  });

  describe('isValidLocaleData direct tests', () => {
    // Directly test the private isValidLocaleData method for full branch coverage

    it('should return false for null data (line 80-81)', () => {
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData'](null);
      expect(isValid).toBe(false);
    });

    it('should return false for undefined data', () => {
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData'](undefined);
      expect(isValid).toBe(false);
    });

    it('should return false for string data', () => {
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData']('not an object');
      expect(isValid).toBe(false);
    });

    it('should return false for number data', () => {
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData'](12345);
      expect(isValid).toBe(false);
    });

    it('should return false for array data', () => {
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData']([1, 2, 3]);
      expect(isValid).toBe(false);
    });

    it('should return false for empty object', () => {
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData']({});
      expect(isValid).toBe(false);
    });

    it('should return false for data missing locale field', () => {
      const invalidData = {
        meta: {},
        labels: {},
        dyeNames: {},
        categories: {},
        acquisitions: {},
        metallicDyeIds: [],
        harmonyTypes: {},
        visionTypes: {},
      };
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData'](invalidData);
      expect(isValid).toBe(false);
    });

    it('should return false for data with non-string locale', () => {
      const invalidData = {
        locale: 123, // Should be string
        meta: {},
        labels: {},
        dyeNames: {},
        categories: {},
        acquisitions: {},
        metallicDyeIds: [],
        harmonyTypes: {},
        visionTypes: {},
      };
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData'](invalidData);
      expect(isValid).toBe(false);
    });

    it('should return false for data with non-array metallicDyeIds', () => {
      const invalidData = {
        locale: 'en',
        meta: {},
        labels: {},
        dyeNames: {},
        categories: {},
        acquisitions: {},
        metallicDyeIds: 'not an array',
        harmonyTypes: {},
        visionTypes: {},
      };
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData'](invalidData);
      expect(isValid).toBe(false);
    });

    it('should return true for valid complete data', () => {
      const validData = {
        locale: 'en',
        meta: {},
        labels: {},
        dyeNames: {},
        categories: {},
        acquisitions: {},
        metallicDyeIds: [],
        harmonyTypes: {},
        visionTypes: {},
      };
      // @ts-expect-error - Accessing private method for testing
      const isValid = loader['isValidLocaleData'](validData);
      expect(isValid).toBe(true);
    });
  });

  describe('invalid data structure triggering line 59', () => {
    // To trigger line 59, we need isValidLocaleData to return false
    // while the locale exists in the map

    it('should throw when isValidLocaleData returns false for existing locale (line 59)', () => {
      const testLoader = new LocaleLoader();

      // Mock the private isValidLocaleData to return false
      // @ts-expect-error - Accessing private method for mocking
      vi.spyOn(testLoader, 'isValidLocaleData').mockReturnValue(false);

      // Now loadLocale should find the data but fail validation, triggering line 59
      expect(() => testLoader.loadLocale('en')).toThrow(AppError);
      expect(() => testLoader.loadLocale('en')).toThrow(/Invalid locale data structure/);

      vi.restoreAllMocks();
    });

    it('should throw AppError with correct code when validation fails', () => {
      const testLoader = new LocaleLoader();

      // @ts-expect-error - Accessing private method for mocking
      vi.spyOn(testLoader, 'isValidLocaleData').mockReturnValue(false);

      try {
        testLoader.loadLocale('ja');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        if (error instanceof AppError) {
          expect(error.code).toBe(ErrorCode.LOCALE_LOAD_FAILED);
          expect(error.message).toContain('ja');
          expect(error.message).toContain('Invalid locale data structure');
        }
      }

      vi.restoreAllMocks();
    });
  });
});
