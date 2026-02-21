/**
 * Input Resolution — Unit Tests
 *
 * Tests for hex validation, normalization, resolveColorInput, and resolveDyeInput.
 */

import { describe, it, expect } from 'vitest';
import { isValidHex, normalizeHex, resolveColorInput, resolveDyeInput, dyeService } from './input-resolution.js';

// ============================================================================
// isValidHex
// ============================================================================

describe('isValidHex', () => {
  describe('6-digit hex', () => {
    it('accepts uppercase with hash', () => {
      expect(isValidHex('#FF0000')).toBe(true);
    });

    it('accepts lowercase with hash', () => {
      expect(isValidHex('#ff0000')).toBe(true);
    });

    it('accepts mixed case with hash', () => {
      expect(isValidHex('#Ff00aB')).toBe(true);
    });

    it('accepts without hash', () => {
      expect(isValidHex('FF0000')).toBe(true);
    });

    it('accepts lowercase without hash', () => {
      expect(isValidHex('ff0000')).toBe(true);
    });
  });

  describe('3-digit shorthand', () => {
    it('accepts 3-digit with hash by default', () => {
      expect(isValidHex('#F00')).toBe(true);
    });

    it('accepts 3-digit without hash', () => {
      expect(isValidHex('F00')).toBe(true);
    });

    it('accepts lowercase 3-digit', () => {
      expect(isValidHex('#fff')).toBe(true);
    });

    it('rejects 3-digit when allowShorthand is false', () => {
      expect(isValidHex('#F00', { allowShorthand: false })).toBe(false);
    });

    it('rejects 3-digit without hash when allowShorthand is false', () => {
      expect(isValidHex('F00', { allowShorthand: false })).toBe(false);
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty string', () => {
      expect(isValidHex('')).toBe(false);
    });

    it('rejects non-hex characters', () => {
      expect(isValidHex('#GGGGGG')).toBe(false);
    });

    it('rejects too-short values', () => {
      expect(isValidHex('#FF')).toBe(false);
    });

    it('rejects too-long values', () => {
      expect(isValidHex('#FF00001')).toBe(false);
    });

    it('rejects 4-digit values', () => {
      expect(isValidHex('#FFFF')).toBe(false);
    });

    it('rejects 5-digit values', () => {
      expect(isValidHex('#FFFFF')).toBe(false);
    });

    it('rejects plain text', () => {
      expect(isValidHex('red')).toBe(false);
    });
  });
});

// ============================================================================
// normalizeHex
// ============================================================================

describe('normalizeHex', () => {
  it('adds hash prefix to bare 6-digit hex', () => {
    expect(normalizeHex('FF0000')).toBe('#FF0000');
  });

  it('uppercases lowercase hex', () => {
    expect(normalizeHex('#ff0000')).toBe('#FF0000');
  });

  it('keeps already-normalized hex unchanged', () => {
    expect(normalizeHex('#FF0000')).toBe('#FF0000');
  });

  it('expands 3-digit shorthand with hash', () => {
    expect(normalizeHex('#F00')).toBe('#FF0000');
  });

  it('expands 3-digit shorthand without hash', () => {
    expect(normalizeHex('F00')).toBe('#FF0000');
  });

  it('expands and uppercases 3-digit shorthand', () => {
    expect(normalizeHex('fff')).toBe('#FFFFFF');
  });

  it('handles mixed case 3-digit', () => {
    expect(normalizeHex('#fAb')).toBe('#FFAABB');
  });

  it('normalizes black', () => {
    expect(normalizeHex('000')).toBe('#000000');
  });
});

// ============================================================================
// resolveColorInput
// ============================================================================

describe('resolveColorInput', () => {
  describe('hex input', () => {
    it('resolves a 6-digit hex code', () => {
      const result = resolveColorInput('#FF0000');
      expect(result).not.toBeNull();
      expect(result!.hex).toBe('#FF0000');
    });

    it('resolves hex without hash prefix', () => {
      const result = resolveColorInput('FF0000');
      expect(result).not.toBeNull();
      expect(result!.hex).toBe('#FF0000');
    });

    it('resolves 3-digit shorthand hex', () => {
      const result = resolveColorInput('#F00');
      expect(result).not.toBeNull();
      expect(result!.hex).toBe('#FF0000');
    });

    it('returns no dye info for plain hex by default', () => {
      const result = resolveColorInput('#123456');
      expect(result).not.toBeNull();
      expect(result!.hex).toBe('#123456');
      expect(result!.dye).toBeUndefined();
      expect(result!.name).toBeUndefined();
    });

    it('finds closest dye when findClosestForHex is true', () => {
      const result = resolveColorInput('#FF0000', { findClosestForHex: true });
      expect(result).not.toBeNull();
      expect(result!.hex).toBe('#FF0000');
      expect(result!.dye).toBeDefined();
      expect(result!.name).toBeDefined();
    });
  });

  describe('dye name input', () => {
    it('resolves a known dye by exact name', () => {
      const result = resolveColorInput('Snow White');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Snow White');
      expect(result!.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(result!.dye).toBeDefined();
    });

    it('resolves dye name case-insensitively', () => {
      const result = resolveColorInput('snow white');
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Snow White');
    });

    it('resolves a partial dye name', () => {
      const result = resolveColorInput('Soot');
      expect(result).not.toBeNull();
      expect(result!.name).toMatch(/Soot/);
    });

    it('resolves dye with all expected fields', () => {
      const result = resolveColorInput('Soot Black');
      expect(result).not.toBeNull();
      expect(result!.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(result!.name).toBeDefined();
      expect(result!.id).toBeDefined();
      expect(result!.dye).toBeDefined();
    });

    it('excludes Facewear dyes by default', () => {
      // Search for a term that only matches Facewear dyes if they exist
      const allDyes = dyeService.getAllDyes();
      const facewearDye = allDyes.find((d) => d.category === 'Facewear');
      if (facewearDye) {
        const result = resolveColorInput(facewearDye.name);
        // Should either return null or a non-Facewear dye
        if (result?.dye) {
          expect(result.dye.category).not.toBe('Facewear');
        }
      }
    });
  });

  describe('CSS color name input', () => {
    it('resolves a CSS-only color name (no matching dye name)', () => {
      // "crimson" is a CSS color that doesn't match any FFXIV dye name
      const result = resolveColorInput('crimson');
      expect(result).not.toBeNull();
      expect(result!.hex).toBe('#DC143C');
    });

    it('resolves CSS color case-insensitively', () => {
      const result = resolveColorInput('MediumSlateBlue');
      expect(result).not.toBeNull();
      expect(result!.hex).toBe('#7B68EE');
    });

    it('prioritizes dye name over CSS color name', () => {
      // "coral" matches dye "Coral Pink" before CSS fallback
      const result = resolveColorInput('coral');
      expect(result).not.toBeNull();
      expect(result!.dye).toBeDefined();
    });

    it('finds closest dye for CSS color when findClosestForHex is true', () => {
      const result = resolveColorInput('crimson', { findClosestForHex: true });
      expect(result).not.toBeNull();
      expect(result!.hex).toBe('#DC143C');
      expect(result!.dye).toBeDefined();
    });
  });

  describe('invalid input', () => {
    it('returns null for unrecognized input', () => {
      expect(resolveColorInput('xyznotacolor123')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(resolveColorInput('')).toBeNull();
    });
  });
});

// ============================================================================
// resolveDyeInput
// ============================================================================

describe('resolveDyeInput', () => {
  it('resolves a dye by name', () => {
    const dye = resolveDyeInput('Snow White');
    expect(dye).not.toBeNull();
    expect(dye!.name).toBe('Snow White');
    expect(dye!.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('resolves a dye by partial name', () => {
    const dye = resolveDyeInput('Soot');
    expect(dye).not.toBeNull();
    expect(dye!.name).toMatch(/Soot/);
  });

  it('resolves closest dye from hex input', () => {
    const dye = resolveDyeInput('#FF0000');
    expect(dye).not.toBeNull();
    expect(dye!.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(dye!.name).toBeDefined();
  });

  it('excludes Facewear dyes from name results', () => {
    const allDyes = dyeService.getAllDyes();
    const facewearDye = allDyes.find((d) => d.category === 'Facewear');
    if (facewearDye) {
      const result = resolveDyeInput(facewearDye.name);
      if (result) {
        expect(result.category).not.toBe('Facewear');
      }
    }
  });

  it('returns null for unrecognized input', () => {
    expect(resolveDyeInput('xyznotacolor123')).toBeNull();
  });

  it('returns a full Dye object with expected properties', () => {
    const dye = resolveDyeInput('Snow White');
    expect(dye).not.toBeNull();
    expect(dye).toHaveProperty('id');
    expect(dye).toHaveProperty('name');
    expect(dye).toHaveProperty('hex');
    expect(dye).toHaveProperty('category');
    expect(dye).toHaveProperty('itemID');
  });
});
