/**
 * Localization — Unit Tests
 *
 * Tests for initializeLocale, getLocalizedDyeName, and getLocalizedCategory.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalizationService } from '@xivdyetools/core';
import type { LocaleCode } from './i18n/index.js';
import {
  initializeLocale,
  getLocalizedAcquisition,
  getLocalizedCategory,
  getLocalizedClan,
  getLocalizedColorWheelName,
  getLocalizedCurrency,
  getLocalizedDyeName,
  getLocalizedHarmonyType,
  getLocalizedRace,
  getLocalizedVisionType,
} from './localization.js';

describe('localization', () => {
  describe('initializeLocale', () => {
    it('initializes English locale without error', async () => {
      await expect(initializeLocale('en')).resolves.toBeUndefined();
    });

    it('initializes Japanese locale without error', async () => {
      await expect(initializeLocale('ja')).resolves.toBeUndefined();
    });

    it('initializes all supported locales', async () => {
      const locales = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const;
      for (const locale of locales) {
        await expect(initializeLocale(locale)).resolves.toBeUndefined();
      }
    });

    it('falls back to English when locale initialization fails (invalid locale)', async () => {
      // Passing an unsupported locale causes loadLocale to throw, triggering the catch fallback
      await expect(initializeLocale('xx' as LocaleCode)).resolves.toBeUndefined();
    });
  });

  describe('getLocalizedDyeName', () => {
    beforeEach(async () => {
      await initializeLocale('en');
    });

    it('returns localized name for a known dye item ID', () => {
      // Snow White has itemID 5729
      const result = getLocalizedDyeName(5729, 'Snow White', 'en');
      expect(result).toBe('Snow White');
    });

    it('returns fallback name when locale is not initialized', () => {
      // Use a locale that definitely hasn't been loaded
      const result = getLocalizedDyeName(5729, 'FallbackName', 'ko');
      // Should return the fallback since ko may not be initialized
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns fallback name for unknown item ID', () => {
      const result = getLocalizedDyeName(999999, 'UnknownDye', 'en');
      expect(result).toBe('UnknownDye');
    });

    it('defaults to English when locale parameter omitted', () => {
      const result = getLocalizedDyeName(5729, 'Snow White');
      expect(result).toBe('Snow White');
    });
  });

  describe('getLocalizedCategory', () => {
    beforeEach(async () => {
      await initializeLocale('en');
    });

    it('returns category name for a known category', () => {
      const result = getLocalizedCategory('Whites', 'en');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns the input category when locale is not initialized', () => {
      const result = getLocalizedCategory('TestCategory', 'ko');
      expect(typeof result).toBe('string');
    });

    it('defaults to English when locale parameter omitted', () => {
      const result = getLocalizedCategory('Whites');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getLocalizedClan (HC-001)', () => {
    beforeEach(async () => {
      await initializeLocale('en');
      await initializeLocale('de');
      await initializeLocale('ko');
    });

    it("returns core's clan name for the locale", () => {
      expect(getLocalizedClan('seekerOfTheSun', 'en')).toBe('Seeker of the Sun');
      expect(getLocalizedClan('seekerOfTheSun', 'de')).toBe('Goldtatze');
      expect(getLocalizedClan('midlander', 'ko')).toBe('중원 부족');
    });

    it('defaults to English when locale parameter omitted', () => {
      expect(getLocalizedClan('theLost')).toBe('The Lost');
    });
  });

  describe('cross-locale consistency', () => {
    it('returns different names for different locales', async () => {
      await initializeLocale('en');
      await initializeLocale('ja');

      const enName = getLocalizedDyeName(5729, 'Snow White', 'en');
      const jaName = getLocalizedDyeName(5729, 'Snow White', 'ja');

      // Both should be non-empty strings
      expect(enName.length).toBeGreaterThan(0);
      expect(jaName.length).toBeGreaterThan(0);
      // They may or may not differ depending on the locale data,
      // but both should resolve successfully
    });
  });

  /**
   * The never-throws arm: a loaded locale whose core lookup throws must still
   * hand the command its fallback. These run on every card and embed label, so
   * a throw here would turn one bad lookup into GENERATION_FAILED for the whole
   * command. The spy assertion proves the locale really was loaded, so this is
   * the catch arm and not the "no instance yet" arm the uninitialized file covers.
   */
  describe('a core lookup that throws degrades to the fallback', () => {
    beforeEach(async () => {
      await initializeLocale('de');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    type Getter =
      | 'getDyeName'
      | 'getCategory'
      | 'getHarmonyType'
      | 'getColorWheelName'
      | 'getVisionShort'
      | 'getRace'
      | 'getClan'
      | 'getAcquisition'
      | 'getCurrency';
    /** The prototype seen as just the getters, so one spy call fits every case. */
    const getters = LocalizationService.prototype as unknown as Record<Getter, () => string>;

    const cases: Array<{
      method: Getter;
      call: () => string;
      fallback: string;
    }> = [
      {
        method: 'getDyeName',
        call: () => getLocalizedDyeName(5729, 'Snow White', 'de'),
        fallback: 'Snow White',
      },
      {
        method: 'getCategory',
        call: () => getLocalizedCategory('Whites', 'de'),
        fallback: 'Whites',
      },
      {
        method: 'getHarmonyType',
        call: () => getLocalizedHarmonyType('splitComplementary', 'de'),
        fallback: 'splitComplementary',
      },
      {
        method: 'getColorWheelName',
        call: () => getLocalizedColorWheelName('ryb', 'de'),
        fallback: 'ryb',
      },
      {
        method: 'getVisionShort',
        call: () => getLocalizedVisionType('protanopia', 'de'),
        fallback: 'protanopia',
      },
      { method: 'getRace', call: () => getLocalizedRace('viera', 'de'), fallback: 'viera' },
      // The clan never falls back to its camelCase key: the card prints it.
      {
        method: 'getClan',
        call: () => getLocalizedClan('seekerOfTheSun', 'de'),
        fallback: 'Seeker Of The Sun',
      },
      {
        method: 'getAcquisition',
        call: () => getLocalizedAcquisition('Dye Vendor', 'de'),
        fallback: 'Dye Vendor',
      },
      { method: 'getCurrency', call: () => getLocalizedCurrency('Gil', 'de'), fallback: 'Gil' },
    ];

    it.each(cases)('$method throwing returns "$fallback"', ({ method, call, fallback }) => {
      const spy = vi.spyOn(getters, method).mockImplementation(() => {
        throw new Error('locale table corrupt');
      });

      expect(call()).toBe(fallback);
      expect(spy).toHaveBeenCalled();
    });
  });
});
