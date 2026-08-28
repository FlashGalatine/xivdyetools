/**
 * Tests for the 5.0 matching-method vocabulary.
 *
 * `normalizeMatchingMethod` is the migration seam every stored choice passes
 * through — KV preferences, localStorage, the URL `algo` param, API bodies.
 * A gap here silently changes what "closest dye" means for a returning user,
 * so the retired-value map and the fallback are pinned explicitly.
 */

import { describe, it, expect } from 'vitest';
import {
  MATCHING_METHODS,
  DEFAULT_MATCHING_METHOD,
  MATCHING_METHOD_TAGS,
  LEGACY_MATCHING_METHOD_MAP,
  isMatchingMethod,
  normalizeMatchingMethod,
  type MatchingMethod,
} from '../index.js';

describe('MATCHING_METHODS', () => {
  it('is the six-entry suite display order', () => {
    expect(MATCHING_METHODS).toEqual([
      'ciede2000',
      'oklab',
      'cie76',
      'redmean',
      'rgb',
      'distinguish',
    ]);
  });

  it('defaults to ΔE2000 — one answer to "what does CLOSE mean"', () => {
    expect(DEFAULT_MATCHING_METHOD).toBe('ciede2000');
    expect(MATCHING_METHODS).toContain(DEFAULT_MATCHING_METHOD);
  });

  it('tags every method plus the display-only ratio entry', () => {
    for (const method of MATCHING_METHODS) {
      expect(MATCHING_METHOD_TAGS[method]).toBeTruthy();
    }
    // RATIO is a display entry, not a MatchingMethod — it never ranks matches
    expect(MATCHING_METHOD_TAGS.ratio).toBe('RATIO');
    expect(MATCHING_METHODS).not.toContain('ratio' as MatchingMethod);
  });

  it('keeps tags unique so a printed tag identifies its method', () => {
    const tags = Object.values(MATCHING_METHOD_TAGS);
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe('isMatchingMethod', () => {
  it.each(MATCHING_METHODS)('accepts %s', (method) => {
    expect(isMatchingMethod(method)).toBe(true);
  });

  it.each(Object.keys(LEGACY_MATCHING_METHOD_MAP))('rejects the retired value %s', (retired) => {
    expect(isMatchingMethod(retired)).toBe(false);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 2000],
    ['an object', { method: 'ciede2000' }],
    ['an array', ['ciede2000']],
    ['an empty string', ''],
    ['a near-miss', 'ciede2001'],
    ['a cased variant', 'CIEDE2000'],
  ])('rejects %s', (_label, value) => {
    expect(isMatchingMethod(value)).toBe(false);
  });
});

describe('normalizeMatchingMethod', () => {
  it.each(MATCHING_METHODS)('passes the current value %s through unchanged', (method) => {
    expect(normalizeMatchingMethod(method)).toBe(method);
  });

  it('folds both retired v4 methods into the suite default', () => {
    // No perceptual successor keeps their exact behaviour, and a silently
    // different non-default would be worse than the default.
    expect(normalizeMatchingMethod('hyab')).toBe('ciede2000');
    expect(normalizeMatchingMethod('oklch-weighted')).toBe('ciede2000');
  });

  it('maps the informal pre-5.0 deep-link value to RGB DIST', () => {
    expect(normalizeMatchingMethod('euclidean')).toBe('rgb');
  });

  it('maps every entry in the legacy table to a current method', () => {
    for (const [legacy, target] of Object.entries(LEGACY_MATCHING_METHOD_MAP)) {
      expect(normalizeMatchingMethod(legacy)).toBe(target);
      expect(MATCHING_METHODS).toContain(target);
    }
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 42],
    ['an object', {}],
    ['garbage', 'not-a-method'],
    ['an empty string', ''],
  ])('falls back to the default for %s', (_label, value) => {
    expect(normalizeMatchingMethod(value)).toBe(DEFAULT_MATCHING_METHOD);
  });

  it('is idempotent — normalizing twice never drifts', () => {
    for (const value of [...MATCHING_METHODS, ...Object.keys(LEGACY_MATCHING_METHOD_MAP), 'junk']) {
      const once = normalizeMatchingMethod(value);
      expect(normalizeMatchingMethod(once)).toBe(once);
    }
  });
});
