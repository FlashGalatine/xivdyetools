/**
 * XIV Dye Tools - dye-name helper tests
 *
 * @module shared/__tests__/dye-name.test
 */

import { describe, it, expect, vi } from 'vitest';

const mockGetCurrentLocale = vi.fn(() => 'en');
const mockGetDyeName = vi.fn((itemID: number): string | null => {
  if (itemID === 1) return 'Feuerrot'; // localized name exists
  return null; // no translation for this itemID
});

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string) => key,
    getCurrentLocale: () => mockGetCurrentLocale(),
    getDyeName: (itemID: number) => mockGetDyeName(itemID),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

import { compareDyeNames, dyeNameMatches, localizedDyeName } from '../dye-name';

describe('dye-name', () => {
  describe('localizedDyeName', () => {
    it('returns the localized name when one exists', () => {
      expect(localizedDyeName({ itemID: 1, name: 'Fire Red' })).toBe('Feuerrot');
    });

    it('falls back to dye.name when getDyeName returns null', () => {
      expect(localizedDyeName({ itemID: 2, name: 'Snow White' })).toBe('Snow White');
    });
  });

  describe('dyeNameMatches', () => {
    it('matches the localized name, case-insensitively', () => {
      expect(dyeNameMatches({ itemID: 1, name: 'Fire Red' }, 'feuer')).toBe(true);
    });

    it('matches the English dye.name even when a (different) localized name exists', () => {
      expect(dyeNameMatches({ itemID: 1, name: 'Fire Red' }, 'fire')).toBe(true);
    });

    it('returns false when the query matches neither name', () => {
      expect(dyeNameMatches({ itemID: 1, name: 'Fire Red' }, 'blue')).toBe(false);
    });
  });

  describe('compareDyeNames', () => {
    it('orders by localized name using the current locale', () => {
      mockGetCurrentLocale.mockReturnValue('en');
      const a = { itemID: 2, name: 'Alpha' };
      const b = { itemID: 3, name: 'Beta' };
      expect(compareDyeNames(a, b)).toBeLessThan(0);
      expect(compareDyeNames(b, a)).toBeGreaterThan(0);
      expect(compareDyeNames(a, a)).toBe(0);
    });

    it('passes the current locale through to localeCompare', () => {
      const localeCompareSpy = vi.spyOn(String.prototype, 'localeCompare');
      mockGetCurrentLocale.mockReturnValue('de');
      compareDyeNames({ itemID: 2, name: 'Alpha' }, { itemID: 3, name: 'Beta' });
      expect(localeCompareSpy).toHaveBeenCalledWith('Beta', 'de');
      localeCompareSpy.mockRestore();
    });
  });
});
