/**
 * XIV Dye Tools - custom-dye helper tests
 *
 * @module shared/__tests__/custom-dye.test
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => (key === 'common.custom' ? 'Custom' : key),
    tInterpolate: (key: string, params: Record<string, string | number>) => {
      if (key === 'common.customColorName') return `Custom (${params.hex})`;
      return key;
    },
    getCurrentLocale: () => 'en',
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

import { CUSTOM_DYE_SENTINEL, customDyeLabel, isCustomDye, makeCustomDye } from '../custom-dye';

describe('custom-dye', () => {
  it('CUSTOM_DYE_SENTINEL is the fixed sentinel string', () => {
    expect(CUSTOM_DYE_SENTINEL).toBe('__custom__');
  });

  describe('makeCustomDye', () => {
    it('builds a Dye-shaped object from a hex colour', () => {
      const dye = makeCustomDye('#ff5500');

      expect(dye.hex).toBe('#FF5500');
      expect(dye.name).toBe('Custom (#FF5500)');
      expect(dye.category).toBe(CUSTOM_DYE_SENTINEL);
      expect(dye.acquisition).toBe(CUSTOM_DYE_SENTINEL);
      expect(dye.stainID).toBeNull();
      expect(dye.currency).toBeNull();
      expect(dye.cost).toBe(0);
      expect(dye.consolidationType).toBeNull();
      expect(dye.isMetallic).toBe(false);
      expect(dye.isPastel).toBe(false);
      expect(dye.isDark).toBe(false);
      expect(dye.isCosmic).toBe(false);
      expect(dye.isIshgardian).toBe(false);
      expect(dye.rgb).toEqual({ r: 255, g: 85, b: 0 });
    });

    it('uses a negative synthetic id, and id === itemID', () => {
      const dye = makeCustomDye('#000000');
      expect(dye.id).toBeLessThan(0);
      expect(dye.itemID).toBe(dye.id);
    });

    it('mints distinct ids for two dyes created back-to-back', () => {
      const a = makeCustomDye('#111111');
      const b = makeCustomDye('#222222');
      expect(a.id).not.toBe(b.id);
    });

    it('routes the name through LanguageService.tInterpolate with the uppercased hex', () => {
      const dye = makeCustomDye('#abcdef');
      expect(dye.name).toBe('Custom (#ABCDEF)');
    });
  });

  describe('isCustomDye', () => {
    it('is true for a dye whose category is the sentinel', () => {
      expect(isCustomDye({ category: CUSTOM_DYE_SENTINEL })).toBe(true);
    });

    it('is false for a real dye category', () => {
      expect(isCustomDye({ category: 'Blue' })).toBe(false);
    });

    it('is true for a dye actually produced by makeCustomDye', () => {
      expect(isCustomDye(makeCustomDye('#123456'))).toBe(true);
    });
  });

  describe('customDyeLabel', () => {
    it('returns the localized "common.custom" label', () => {
      expect(customDyeLabel()).toBe('Custom');
    });
  });
});
