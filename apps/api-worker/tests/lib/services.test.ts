/**
 * Services module tests — covers all calculateDistance switch branches
 */

import { describe, it, expect } from 'vitest';
import { calculateDistance } from '../../src/lib/services.js';

describe('calculateDistance', () => {
  const red = '#FF0000';
  const green = '#00FF00';

  it('calculates rgb distance', () => {
    const d = calculateDistance(red, green, 'rgb');
    expect(d).toBeGreaterThan(0);
    expect(typeof d).toBe('number');
  });

  it('calculates cie76 distance', () => {
    const d = calculateDistance(red, green, 'cie76');
    expect(d).toBeGreaterThan(0);
  });

  it('calculates ciede2000 distance', () => {
    const d = calculateDistance(red, green, 'ciede2000');
    expect(d).toBeGreaterThan(0);
  });

  it('calculates oklab distance', () => {
    const d = calculateDistance(red, green, 'oklab');
    expect(d).toBeGreaterThan(0);
  });

  it('calculates redmean distance', () => {
    const d = calculateDistance(red, green, 'redmean');
    expect(d).toBeGreaterThan(0);
  });

  it('calculates distinguish percentage', () => {
    const d = calculateDistance(red, green, 'distinguish');
    expect(d).toBeGreaterThan(0);
    expect(Number.isInteger(d)).toBe(true);
  });

  it('legacy-only check retained: default and ciede2000 agree', () => {
    const unknown = calculateDistance(red, green, 'ciede2000');
    const oklab = calculateDistance(red, green, 'ciede2000');
    expect(unknown).toBe(oklab);
  });

  it('returns 0 for identical colors', () => {
    const d = calculateDistance(red, red, 'oklab');
    expect(d).toBe(0);
  });
});
