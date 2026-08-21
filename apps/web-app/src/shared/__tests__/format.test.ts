/**
 * XIV Dye Tools - format helper tests
 *
 * @module shared/__tests__/format.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCurrentLocale = vi.fn(() => 'en');

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, params: Record<string, string | number>) => {
      if (key === 'common.gilAmount') return `${params.n} ${params.unit}`;
      return key;
    },
    getCurrentLocale: () => mockGetCurrentLocale(),
    getCurrency: (currency: string) => (currency === 'Gil' ? 'Gil' : currency),
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

import { formatDate, formatGil, formatList, formatNumber } from '../format';

describe('format', () => {
  beforeEach(() => {
    mockGetCurrentLocale.mockReturnValue('en');
  });

  describe('formatNumber', () => {
    it('formats with de grouping (thousands separator ".")', () => {
      expect(formatNumber(1234, 'de')).toBe('1.234');
    });

    it('formats with en grouping (thousands separator ",")', () => {
      expect(formatNumber(1234, 'en')).toBe('1,234');
    });

    it('defaults to the current locale when none is passed', () => {
      mockGetCurrentLocale.mockReturnValue('de');
      expect(formatNumber(1234)).toBe('1.234');
    });
  });

  describe('formatDate', () => {
    it('formats a Date using the given locale', () => {
      const d = new Date(Date.UTC(2026, 0, 15));
      expect(formatDate(d, 'en')).toBe(d.toLocaleDateString('en'));
    });

    it('accepts a string or number and defaults to the current locale', () => {
      mockGetCurrentLocale.mockReturnValue('en');
      const iso = '2026-01-15T00:00:00Z';
      expect(formatDate(iso)).toBe(new Date(iso).toLocaleDateString('en'));
    });
  });

  describe('formatList', () => {
    it('joins with the locale conjunction rather than a hardcoded ", "', () => {
      expect(formatList(['A', 'B', 'C'], 'en')).toBe('A, B, and C');
      expect(formatList(['A', 'B', 'C'], 'de')).toBe('A, B und C');
    });

    it('uses the CJK separator for ja', () => {
      // ja joins with the ideographic comma, never ", "
      expect(formatList(['A', 'B'], 'ja')).not.toContain(', ');
    });

    it('returns a lone item unchanged and an empty list as an empty string', () => {
      expect(formatList(['A'], 'en')).toBe('A');
      expect(formatList([], 'en')).toBe('');
    });

    it('defaults to the current locale when none is passed', () => {
      mockGetCurrentLocale.mockReturnValue('de');
      expect(formatList(['A', 'B'])).toBe('A und B');
    });
  });

  describe('formatGil', () => {
    it('formats via the common.gilAmount key with the formatted number and currency label', () => {
      expect(formatGil(1234)).toBe('1,234 Gil');
    });

    it('uses the locale-appropriate number grouping', () => {
      mockGetCurrentLocale.mockReturnValue('de');
      expect(formatGil(1234)).toBe('1.234 Gil');
    });
  });
});
