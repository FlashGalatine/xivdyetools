/**
 * XIV Dye Tools - region-name helper tests
 *
 * The server pickers used to print `data-centers.json`'s raw region string in
 * every locale; `regionLabel()` maps it onto a locale key, and must still
 * render something for a region the table has never seen.
 *
 * @module shared/__tests__/region-name.test
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => `t:${key}`,
    tInterpolate: (key: string) => key,
    getCurrentLocale: () => 'en',
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

import { regionLabel } from '../region-name';

describe('regionLabel', () => {
  it.each([
    ['Japan', 'marketBoard.region.japan'],
    ['North-America', 'marketBoard.region.northAmerica'],
    ['Europe', 'marketBoard.region.europe'],
    ['Oceania', 'marketBoard.region.oceania'],
    ['中国', 'marketBoard.region.china'],
    ['한국', 'marketBoard.region.korea'],
  ])('translates the %s region', (region, key) => {
    expect(regionLabel(region)).toBe(`t:${key}`);
  });

  it('falls back to the raw string for a region the table does not know', () => {
    // A new data centre must never blank the picker's group label.
    expect(regionLabel('NA')).toBe('NA');
    expect(regionLabel('')).toBe('');
  });
});
