/**
 * Unit tests for match-quality tiers (REFACTOR-004).
 *
 * The whole point of this module is the standardized INCLUSIVE boundary
 * semantics, so the boundary values (0, 10, 25, 50) are tested explicitly.
 */

import { describe, it, expect } from 'vitest';
import { MATCH_QUALITY_TIERS, classifyMatchDistance } from './match-quality.js';

describe('MATCH_QUALITY_TIERS', () => {
  it('is ordered by ascending maxDistance', () => {
    const bounds = MATCH_QUALITY_TIERS.map((t) => t.maxDistance);
    expect(bounds).toEqual([...bounds].sort((a, b) => a - b));
  });

  it('ends with an unbounded approximate tier', () => {
    const last = MATCH_QUALITY_TIERS[MATCH_QUALITY_TIERS.length - 1];
    expect(last.key).toBe('approximate');
    expect(last.maxDistance).toBe(Infinity);
  });
});

describe('classifyMatchDistance', () => {
  it('distance 0 → perfect', () => {
    expect(classifyMatchDistance(0)).toBe('perfect');
  });

  it('boundaries are inclusive: 10 → excellent, 25 → good, 50 → fair', () => {
    expect(classifyMatchDistance(10)).toBe('excellent');
    expect(classifyMatchDistance(25)).toBe('good');
    expect(classifyMatchDistance(50)).toBe('fair');
  });

  it('values just above a boundary fall into the next tier', () => {
    expect(classifyMatchDistance(0.001)).toBe('excellent');
    expect(classifyMatchDistance(10.001)).toBe('good');
    expect(classifyMatchDistance(25.001)).toBe('fair');
    expect(classifyMatchDistance(50.001)).toBe('approximate');
  });

  it('classifies the maximum possible RGB distance (~441) as approximate', () => {
    expect(classifyMatchDistance(441.673)).toBe('approximate');
  });
});
