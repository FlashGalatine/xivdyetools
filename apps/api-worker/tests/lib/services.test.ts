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

  it('calculates hyab distance', () => {
    const d = calculateDistance(red, green, 'hyab');
    expect(d).toBeGreaterThan(0);
  });

  it('calculates oklch-weighted distance with weights', () => {
    const d = calculateDistance(red, green, 'oklch-weighted', { kL: 2, kC: 1, kH: 0.5 });
    expect(d).toBeGreaterThan(0);
  });

  it('falls back to oklab for unknown method', () => {
    const unknown = calculateDistance(red, green, 'unknown' as never);
    const oklab = calculateDistance(red, green, 'oklab');
    expect(unknown).toBe(oklab);
  });

  it('returns 0 for identical colors', () => {
    const d = calculateDistance(red, red, 'oklab');
    expect(d).toBe(0);
  });
});
