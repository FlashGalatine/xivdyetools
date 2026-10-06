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
  getLocalizedClan,
  getLocalizedColorWheelName,
  getLocalizedCurrency,
  getLocalizedDyeName,
  getLocalizedHarmonyType,
  getLocalizedRace,
  getLocalizedVisionType,
} from './localization.js';
import { tribeDisplay } from './commands/chara-identity.js';

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

  it('getLocalizedClan spells the key out as words, never the raw camelCase key', () => {
    expect(getLocalizedClan('seekerOfTheSun')).toBe('Seeker Of The Sun');
    expect(getLocalizedClan('theLost', 'de')).toBe('The Lost');
    expect(getLocalizedClan('raen', 'ja')).toBe('Raen');
  });

  // The core-vocabulary getters (TERM-001) answer with core's own key: the
  // harmony title, the wheel tag, the vision lens and the /glamour race word
  // still print something a reader can place, never an empty string or a throw.
  it('getLocalizedHarmonyType returns the core harmony key', () => {
    expect(getLocalizedHarmonyType('splitComplementary')).toBe('splitComplementary');
    expect(getLocalizedHarmonyType('triadic', 'ja')).toBe('triadic');
  });

  it('getLocalizedColorWheelName returns the wheel id', () => {
    expect(getLocalizedColorWheelName('ryb')).toBe('ryb');
    expect(getLocalizedColorWheelName('oklch-hue', 'de')).toBe('oklch-hue');
  });

  it('getLocalizedVisionType returns the vision key', () => {
    expect(getLocalizedVisionType('protanopia')).toBe('protanopia');
    expect(getLocalizedVisionType('normal', 'ko')).toBe('normal');
  });

  it('getLocalizedRace returns the race key', () => {
    expect(getLocalizedRace('viera')).toBe('viera');
    expect(getLocalizedRace('auRa', 'zh')).toBe('auRa');
  });

  it("tribeDisplay keeps the pre-HC-001 line — SEEKER OF THE SUN, not SEEKEROFTHESUN", () => {
    expect(tribeDisplay('SeekerOfTheSun', 'de')).toBe('SEEKER OF THE SUN');
    expect(tribeDisplay('Midlander', 'zh')).toBe('MIDLANDER');
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
