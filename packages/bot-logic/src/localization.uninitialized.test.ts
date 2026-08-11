/**
 * The uninitialized-locale arm of every localization getter.
 *
 * The getters read a per-locale instance out of a module-level cache and
 * return their fallback when it is absent. That arm is the one a real Worker
 * isolate hits on its very first request — the cache is per-isolate and starts
 * empty — so "no instance yet" must degrade to the untranslated fallback
 * rather than throw. This file deliberately never calls `initializeLocale`;
 * Vitest gives each test file its own module registry, so the cache stays
 * empty for the whole file.
 */

import { describe, it, expect } from 'vitest';
import {
  getLocalizedAcquisition,
  getLocalizedCategory,
  getLocalizedCurrency,
  getLocalizedDyeName,
} from './localization.js';

describe('localization getters before any locale is initialized', () => {
  it('getLocalizedDyeName returns the fallback name', () => {
    expect(getLocalizedDyeName(5729, 'Snow White')).toBe('Snow White');
    expect(getLocalizedDyeName(5729, 'Snow White', 'ja')).toBe('Snow White');
  });

  it('getLocalizedCategory returns the raw category key', () => {
    expect(getLocalizedCategory('Whites')).toBe('Whites');
    expect(getLocalizedCategory('Whites', 'de')).toBe('Whites');
  });

  it('getLocalizedAcquisition returns the raw acquisition key', () => {
    expect(getLocalizedAcquisition('Dye Vendor')).toBe('Dye Vendor');
    expect(getLocalizedAcquisition('Dye Vendor', 'fr')).toBe('Dye Vendor');
  });

  it('getLocalizedCurrency returns the raw currency key', () => {
    expect(getLocalizedCurrency('Gil')).toBe('Gil');
    expect(getLocalizedCurrency('Gil', 'ko')).toBe('Gil');
  });

  it('never throws for any supported locale', () => {
    for (const locale of ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const) {
      expect(() => getLocalizedDyeName(5729, 'Snow White', locale)).not.toThrow();
      expect(() => getLocalizedCategory('Whites', locale)).not.toThrow();
      expect(() => getLocalizedAcquisition('Dye Vendor', locale)).not.toThrow();
      expect(() => getLocalizedCurrency('Gil', locale)).not.toThrow();
    }
  });

  it('defaults to English when no locale is passed', () => {
    // The `locale: LocaleCode = 'en'` default parameter — same fallback path,
    // but it must not blow up on a missing argument.
    expect(getLocalizedCategory('Reds')).toBe('Reds');
  });
});
