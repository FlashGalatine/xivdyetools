/**
 * Unit tests for types.ts runtime exports: BLENDING_MODES metadata and the
 * isValidBlendingMode type guard.
 */

import { describe, it, expect } from 'vitest';
import { BLENDING_MODES, isValidBlendingMode } from './types.js';

describe('BLENDING_MODES', () => {
  it('lists all six modes with unique values', () => {
    const values = BLENDING_MODES.map((m) => m.value);
    expect(values).toEqual(['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral']);
    expect(new Set(values).size).toBe(6);
  });

  it('every mode has a non-empty name and description', () => {
    for (const mode of BLENDING_MODES) {
      expect(mode.name.length).toBeGreaterThan(0);
      expect(mode.description.length).toBeGreaterThan(0);
    }
  });
});

describe('isValidBlendingMode', () => {
  it('returns true for every declared mode', () => {
    for (const mode of BLENDING_MODES) {
      expect(isValidBlendingMode(mode.value)).toBe(true);
    }
  });

  it('returns false for unknown strings', () => {
    expect(isValidBlendingMode('cmyk')).toBe(false);
    expect(isValidBlendingMode('')).toBe(false);
    expect(isValidBlendingMode('RGB')).toBe(false); // case-sensitive
  });
});
