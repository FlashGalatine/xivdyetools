import { describe, it, expect } from 'vitest';
import {
  resolveIdType,
  parseHex,
  parseIntParam,
  parseFloatParam,
  parseEnumParam,
  parseBooleanParam,
  parseCommaSeparatedIds,
  parseLocale,
  parseMatchingMethod,
} from '../../src/lib/validation.js';
import { ApiError } from '../../src/lib/api-error.js';

describe('resolveIdType', () => {
  it('resolves negative IDs as facewear', () => {
    expect(resolveIdType(-1)).toEqual({ type: 'facewear', id: -1 });
    expect(resolveIdType(-11)).toEqual({ type: 'facewear', id: -11 });
  });

  it('resolves 1-125 as stainID', () => {
    expect(resolveIdType(1)).toEqual({ type: 'stain', stainId: 1 });
    expect(resolveIdType(125)).toEqual({ type: 'stain', stainId: 125 });
    expect(resolveIdType(63)).toEqual({ type: 'stain', stainId: 63 });
  });

  it('resolves 5729+ as itemID', () => {
    expect(resolveIdType(5729)).toEqual({ type: 'item', itemId: 5729 });
    expect(resolveIdType(5813)).toEqual({ type: 'item', itemId: 5813 });
    expect(resolveIdType(48227)).toEqual({ type: 'item', itemId: 48227 });
  });

  it('resolves 0 as invalid', () => {
    expect(resolveIdType(0)).toEqual({ type: 'invalid', id: 0 });
  });

  it('resolves 126-5728 as invalid (gap between stainID and itemID)', () => {
    expect(resolveIdType(126)).toEqual({ type: 'invalid', id: 126 });
    expect(resolveIdType(5728)).toEqual({ type: 'invalid', id: 5728 });
    expect(resolveIdType(1000)).toEqual({ type: 'invalid', id: 1000 });
  });
});

describe('parseHex', () => {
  it('accepts valid 6-digit hex with hash', () => {
    expect(parseHex('#FF5733')).toBe('#FF5733');
  });

  it('accepts valid 6-digit hex without hash (auto-prepends)', () => {
    expect(parseHex('FF5733')).toBe('#FF5733');
  });

  it('normalizes to uppercase', () => {
    expect(parseHex('ff5733')).toBe('#FF5733');
    expect(parseHex('#aabbcc')).toBe('#AABBCC');
  });

  it('throws MISSING_PARAMETER for undefined', () => {
    expect(() => parseHex(undefined)).toThrow(ApiError);
    try {
      parseHex(undefined);
    } catch (e) {
      expect((e as ApiError).code).toBe('MISSING_PARAMETER');
    }
  });

  it('throws INVALID_HEX for invalid formats', () => {
    const invalid = ['#F53', 'red', '#GGGGGG', '12345', '#1234567', ''];
    for (const val of invalid) {
      expect(() => parseHex(val || undefined)).toThrow(ApiError);
    }
  });
});

describe('parseIntParam', () => {
  it('parses valid integers', () => {
    expect(parseIntParam('42', 'test')).toBe(42);
    expect(parseIntParam('-5', 'test')).toBe(-5);
  });

  it('returns default for undefined', () => {
    expect(parseIntParam(undefined, 'test', { defaultValue: 10 })).toBe(10);
  });

  it('throws for missing required param', () => {
    expect(() => parseIntParam(undefined, 'test')).toThrow(ApiError);
  });

  it('enforces min/max', () => {
    expect(() => parseIntParam('0', 'test', { min: 1 })).toThrow(ApiError);
    expect(() => parseIntParam('300', 'test', { max: 200 })).toThrow(ApiError);
  });

  it('throws for non-numeric strings', () => {
    expect(() => parseIntParam('abc', 'test')).toThrow(ApiError);
  });
});

describe('parseFloatParam', () => {
  it('parses valid floats', () => {
    expect(parseFloatParam('1.5', 'test')).toBe(1.5);
    expect(parseFloatParam('0.01', 'test')).toBe(0.01);
  });

  it('returns default for undefined', () => {
    expect(parseFloatParam(undefined, 'test', { defaultValue: 1.0 })).toBe(1.0);
  });

  it('throws for non-numeric strings', () => {
    expect(() => parseFloatParam('abc', 'test')).toThrow(ApiError);
  });
});

describe('parseEnumParam', () => {
  const values = ['a', 'b', 'c'] as const;

  it('accepts valid values', () => {
    expect(parseEnumParam('a', 'test', values)).toBe('a');
    expect(parseEnumParam('c', 'test', values)).toBe('c');
  });

  it('returns default for undefined', () => {
    expect(parseEnumParam(undefined, 'test', values, 'b')).toBe('b');
  });

  it('throws for invalid values', () => {
    expect(() => parseEnumParam('d', 'test', values)).toThrow(ApiError);
  });
});

describe('parseBooleanParam', () => {
  it('parses true/false/1/0', () => {
    expect(parseBooleanParam('true')).toBe(true);
    expect(parseBooleanParam('false')).toBe(false);
    expect(parseBooleanParam('1')).toBe(true);
    expect(parseBooleanParam('0')).toBe(false);
  });

  it('returns undefined for undefined or empty', () => {
    expect(parseBooleanParam(undefined)).toBeUndefined();
    expect(parseBooleanParam('')).toBeUndefined();
  });
});

describe('parseCommaSeparatedIds', () => {
  it('parses valid comma-separated integers', () => {
    expect(parseCommaSeparatedIds('1,2,3', 'ids', 50)).toEqual([1, 2, 3]);
  });

  it('handles negative numbers', () => {
    expect(parseCommaSeparatedIds('-1,5729,1', 'ids', 50)).toEqual([-1, 5729, 1]);
  });

  it('throws when exceeding max items', () => {
    expect(() => parseCommaSeparatedIds('1,2,3', 'ids', 2)).toThrow(ApiError);
  });

  it('throws for non-integer values', () => {
    expect(() => parseCommaSeparatedIds('1,abc,3', 'ids', 50)).toThrow(ApiError);
  });

  it('throws for undefined', () => {
    expect(() => parseCommaSeparatedIds(undefined, 'ids', 50)).toThrow(ApiError);
  });
});

describe('parseLocale', () => {
  it('defaults to en', () => {
    expect(parseLocale(undefined)).toBe('en');
    expect(parseLocale('')).toBe('en');
  });

  it('accepts valid locales', () => {
    expect(parseLocale('ja')).toBe('ja');
    expect(parseLocale('zh')).toBe('zh');
  });

  it('throws for invalid locales', () => {
    expect(() => parseLocale('xx')).toThrow(ApiError);
  });
});

describe('parseMatchingMethod', () => {
  it('defaults to oklab', () => {
    expect(parseMatchingMethod(undefined)).toBe('oklab');
  });

  it('accepts valid methods', () => {
    expect(parseMatchingMethod('rgb')).toBe('rgb');
    expect(parseMatchingMethod('ciede2000')).toBe('ciede2000');
    expect(parseMatchingMethod('oklch-weighted')).toBe('oklch-weighted');
  });

  it('throws for invalid methods', () => {
    expect(() => parseMatchingMethod('invalid')).toThrow(ApiError);
  });
});
