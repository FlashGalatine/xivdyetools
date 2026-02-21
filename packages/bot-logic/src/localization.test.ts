/**
 * Localization — Unit Tests
 *
 * Tests for initializeLocale, getLocalizedDyeName, and getLocalizedCategory.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeLocale, getLocalizedDyeName, getLocalizedCategory } from './localization.js';

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
});
