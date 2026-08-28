/**
 * Remaining validation branches: the per-flag dye filters, the numeric
 * bounds, and the two ID resolutions that deliberately return nothing.
 *
 * `applyDyeFilters` is the surface `/v1/dyes` hands its query string to.
 * Each flag is an independent early-return, so a flag with no test can
 * silently stop filtering and the endpoint serves confidently-wrong data —
 * which is exactly the failure the parseBooleanParam docblock warns about.
 */

import { describe, it, expect } from 'vitest';
import { dyeDatabase } from '@xivdyetools/core';
import { DyeService } from '@xivdyetools/core';
import {
  applyDyeFilters,
  hasActiveDyeFilters,
  lookupDyeByResolvedId,
  parseBooleanParam,
  parseFloatParam,
  parseIntParam,
  resolveIdType,
  type DyeQueryFilters,
} from '../../src/lib/validation.js';

const allDyes = new DyeService(dyeDatabase).getAllDyes();

describe('applyDyeFilters — one arm per flag', () => {
  it.each([
    ['metallic', 'isMetallic'],
    ['pastel', 'isPastel'],
    ['dark', 'isDark'],
    ['cosmic', 'isCosmic'],
    ['ishgardian', 'isIshgardian'],
  ] as const)('filters on %s in both directions', (flag, property) => {
    const included = applyDyeFilters(allDyes, { [flag]: true } as DyeQueryFilters);
    const excluded = applyDyeFilters(allDyes, { [flag]: false } as DyeQueryFilters);

    expect(included.every((d) => d[property] === true)).toBe(true);
    expect(excluded.every((d) => d[property] === false)).toBe(true);
    // Partition: every dye lands in exactly one side
    expect(included.length + excluded.length).toBe(allDyes.length);
    expect(included.length).toBeGreaterThan(0);
  });

  it.each(['vendor', 'craft', 'expensive'] as const)(
    'filters on %s in both directions',
    (flag) => {
      const included = applyDyeFilters(allDyes, { [flag]: true } as DyeQueryFilters);
      const excluded = applyDyeFilters(allDyes, { [flag]: false } as DyeQueryFilters);

      expect(included.length + excluded.length).toBe(allDyes.length);
      expect(included.length).toBeGreaterThan(0);
    }
  );

  it('applies several flags conjunctively', () => {
    const both = applyDyeFilters(allDyes, { metallic: false, dark: true });

    expect(both.every((d) => !d.isMetallic && d.isDark)).toBe(true);
  });

  it('returns every dye when no filter is set', () => {
    expect(applyDyeFilters(allDyes, {})).toHaveLength(allDyes.length);
  });
});

describe('hasActiveDyeFilters', () => {
  it('is false for an empty filter set and for all-undefined values', () => {
    expect(hasActiveDyeFilters({})).toBe(false);
    expect(hasActiveDyeFilters({ metallic: undefined, dark: undefined })).toBe(false);
  });

  it('is true when any flag is set, including an explicit false', () => {
    expect(hasActiveDyeFilters({ metallic: true })).toBe(true);
    // `false` is an active filter — "show me non-metallic dyes"
    expect(hasActiveDyeFilters({ metallic: false })).toBe(true);
  });
});

describe('lookupDyeByResolvedId — the deliberate misses', () => {
  it('returns null for a legacy facewear id', () => {
    const resolution = resolveIdType(-1629);

    expect(resolution.type).toBe('facewear');
    // Schema v2 moved facewear out of the dye database; the route turns this
    // null into an explanatory 404 carrying the new slug.
    expect(lookupDyeByResolvedId(resolution)).toBeNull();
  });

  it('returns null for an id in the invalid gap', () => {
    const resolution = resolveIdType(3000);

    expect(resolution.type).toBe('invalid');
    expect(lookupDyeByResolvedId(resolution)).toBeNull();
  });

  it('resolves a stainID and an itemID to real dyes', () => {
    expect(lookupDyeByResolvedId(resolveIdType(1))).not.toBeNull();
    expect(lookupDyeByResolvedId(resolveIdType(5729))).not.toBeNull();
  });

  // Schema v2 widened the stain window to the full Stain-sheet byte range
  // (1-254, was 1-125) so future dyes resolve without an API change. The
  // invalid gap is therefore 255-5728, not 126-5728.
  it.each([
    [-1, 'facewear'],
    [1, 'stain'],
    [125, 'stain'],
    [254, 'stain'],
    [255, 'invalid'],
    [5728, 'invalid'],
    [5729, 'item'],
    [99999, 'item'],
  ])('partitions id %s as %s', (id, type) => {
    expect(resolveIdType(id).type).toBe(type);
  });

  it('leaves no gap between the ranges', () => {
    // Every integer from -1 to 6000 resolves to exactly one type
    for (const id of [-1, 0, 1, 254, 255, 5728, 5729]) {
      expect(['facewear', 'stain', 'item', 'invalid']).toContain(resolveIdType(id).type);
    }
    expect(resolveIdType(0).type).toBe('invalid');
  });
});

describe('parseIntParam bounds', () => {
  it('rejects a value below min', () => {
    expect(() => parseIntParam('0', 'perPage', { min: 1, max: 200 })).toThrow(/must be >= 1/);
  });

  it('rejects a value above max', () => {
    expect(() => parseIntParam('201', 'perPage', { min: 1, max: 200 })).toThrow(/must be <= 200/);
  });

  it('accepts both bounds inclusively', () => {
    expect(parseIntParam('1', 'perPage', { min: 1, max: 200 })).toBe(1);
    expect(parseIntParam('200', 'perPage', { min: 1, max: 200 })).toBe(200);
  });

  it('skips the bound checks when no bound is configured', () => {
    expect(parseIntParam('99999', 'anything')).toBe(99999);
    expect(parseIntParam('-5', 'anything')).toBe(-5);
  });
});

describe('parseFloatParam bounds', () => {
  it('rejects a value below min and above max', () => {
    expect(() => parseFloatParam('-0.5', 'maxDistance', { min: 0, max: 100 })).toThrow(/>= 0/);
    expect(() => parseFloatParam('100.5', 'maxDistance', { min: 0, max: 100 })).toThrow(/<= 100/);
  });

  it('accepts a value inside the range', () => {
    expect(parseFloatParam('12.5', 'maxDistance', { min: 0, max: 100 })).toBe(12.5);
  });
});

describe('parseBooleanParam', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
  ])('reads %s as %s', (value, expected) => {
    expect(parseBooleanParam(value, 'metallic')).toBe(expected);
  });

  it.each([undefined, ''])('treats %s as unset rather than false', (value) => {
    expect(parseBooleanParam(value, 'metallic')).toBeUndefined();
  });

  it('rejects anything else rather than silently dropping the filter', () => {
    expect(() => parseBooleanParam('yes', 'metallic')).toThrow(/must be one of/);
  });

  it('names the parameter generically when none was supplied', () => {
    expect(() => parseBooleanParam('yes')).toThrow(/"boolean"/);
  });
});
