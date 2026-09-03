/**
 * Validation guards for client-controlled query parameters.
 *
 * @module lib/validation.test
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_MATCHING_METHOD, MATCHING_METHODS } from '@xivdyetools/core';
import { parseMatchingMethod } from './validation.js';
import { ApiError } from './api-error.js';

describe('parseMatchingMethod', () => {
  it('defaults when the parameter is absent or empty', () => {
    expect(parseMatchingMethod(undefined)).toBe(DEFAULT_MATCHING_METHOD);
    expect(parseMatchingMethod('')).toBe(DEFAULT_MATCHING_METHOD);
  });

  it.each([...MATCHING_METHODS])('passes through the supported method %s', (method) => {
    expect(parseMatchingMethod(method)).toBe(method);
  });

  it.each([
    ['hyab', 'ciede2000'],
    ['oklch-weighted', 'ciede2000'],
    ['euclidean', 'rgb'],
  ])('normalises the retired value %s to %s', (retired, expected) => {
    expect(parseMatchingMethod(retired)).toBe(expected);
  });

  it('rejects an unknown method with a 400', () => {
    expect(() => parseMatchingMethod('nonsense')).toThrow(ApiError);
  });

  /**
   * BUG-011: the legacy-map branch ran FIRST and tested membership with
   * `value in MAP`, which resolves through Object.prototype. `?method=constructor`
   * therefore matched, returned the `Object` function as a MatchingMethod, and
   * skipped the allowlist entirely — the route answered 200 with a null distance
   * instead of the 400 every other bad value gets. The allowlist now runs first
   * and the legacy lookup is guarded.
   */
  it.each(['constructor', 'toString', '__proto__', 'valueOf', 'hasOwnProperty'])(
    'rejects the inherited key %s exactly like any other unknown value',
    (key) => {
      expect(() => parseMatchingMethod(key)).toThrow(ApiError);
    }
  );
});
