/**
 * Tests for the D1/SQLite LIKE-pattern helpers.
 *
 * These sit on the autocomplete path, where a moderator's typing goes
 * straight into a `LIKE` clause. Unescaped `%` or `_` does not throw — it
 * silently widens the match, so a search for "a_b" quietly returns rows the
 * moderator never asked for. The escaping is therefore asserted on the exact
 * output string, not merely on "it did something".
 */

import { describe, it, expect } from 'vitest';
import {
  escapeLikePattern,
  validateAndEscapeQuery,
  validateQueryInput,
} from './sql-helpers.js';

describe('escapeLikePattern', () => {
  it.each([
    ['a percent', '50% off', '50\\% off'],
    ['an underscore', 'test_pattern', 'test\\_pattern'],
    ['a backslash', 'back\\slash', 'back\\\\slash'],
    ['all three at once', '%_\\', '\\%\\_\\\\'],
  ])('escapes %s', (_label, input, expected) => {
    expect(escapeLikePattern(input)).toBe(expected);
  });

  it('leaves a plain query untouched', () => {
    expect(escapeLikePattern('Snow White')).toBe('Snow White');
    expect(escapeLikePattern('')).toBe('');
  });

  it('truncates before escaping, so the cap counts input characters', () => {
    const escaped = escapeLikePattern('%'.repeat(10), 4);

    // 4 input chars → 4 escapes → 8 output chars
    expect(escaped).toBe('\\%\\%\\%\\%');
  });

  it('defaults the cap to 100 characters', () => {
    expect(escapeLikePattern('a'.repeat(150))).toHaveLength(100);
  });

  it('leaves input at or under the cap alone', () => {
    expect(escapeLikePattern('a'.repeat(100))).toHaveLength(100);
    expect(escapeLikePattern('short', 100)).toBe('short');
  });
});

describe('validateQueryInput', () => {
  it('accepts a plain query with default options', () => {
    expect(validateQueryInput('Snow White')).toEqual({ valid: true, sanitized: 'Snow White' });
  });

  it('accepts an empty query when no minimum is set', () => {
    // minLength defaults to 0 — autocomplete fires on an empty box
    expect(validateQueryInput('')).toEqual({ valid: true, sanitized: '' });
  });

  it('rejects a query below the minimum length', () => {
    const result = validateQueryInput('a', { minLength: 3 });

    expect(result.valid).toBe(false);
    expect(result.sanitized).toBe('');
    expect(result.error).toContain('at least 3 characters');
  });

  it('accepts a query exactly at the minimum length', () => {
    expect(validateQueryInput('abc', { minLength: 3 }).valid).toBe(true);
  });

  it('truncates rather than rejecting an over-long query', () => {
    const result = validateQueryInput('a'.repeat(150), { maxLength: 10 });

    // Still valid, just shorter — a moderator's long paste should search,
    // not error
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('a'.repeat(10));
  });

  it('applies the default 100-character cap', () => {
    expect(validateQueryInput('a'.repeat(150)).sanitized).toHaveLength(100);
  });

  it('rejects a query failing the allowed pattern', () => {
    const result = validateQueryInput('drop; table', { allowedPattern: /^[a-zA-Z0-9\s]+$/ });

    expect(result.valid).toBe(false);
    expect(result.sanitized).toBe('');
    expect(result.error).toBe('Query contains invalid characters');
  });

  it('accepts a query matching the allowed pattern', () => {
    const result = validateQueryInput('Snow White 2', { allowedPattern: /^[a-zA-Z0-9\s]+$/ });

    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('Snow White 2');
  });

  it('tests the pattern against the truncated value, not the original', () => {
    // The tail that would have failed the pattern is cut off first
    const result = validateQueryInput('abc!!!', {
      maxLength: 3,
      allowedPattern: /^[a-z]+$/,
    });

    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('abc');
  });
});

describe('validateAndEscapeQuery', () => {
  it('validates then escapes in one step', () => {
    const result = validateAndEscapeQuery('50% off');

    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('50\\% off');
  });

  it('returns the failure untouched without escaping it', () => {
    const result = validateAndEscapeQuery('a', { minLength: 5 });

    expect(result.valid).toBe(false);
    expect(result.sanitized).toBe('');
    expect(result.error).toContain('at least 5 characters');
  });

  it('passes the same cap to both stages', () => {
    const result = validateAndEscapeQuery('%'.repeat(10), { maxLength: 3 });

    // Truncated to 3 by validation, then escaped without re-truncating
    expect(result.sanitized).toBe('\\%\\%\\%');
  });

  it('propagates a pattern rejection', () => {
    const result = validateAndEscapeQuery('nope!', { allowedPattern: /^[a-z]+$/ });

    expect(result.valid).toBe(false);
    expect(result.error).toBe('Query contains invalid characters');
  });
});
