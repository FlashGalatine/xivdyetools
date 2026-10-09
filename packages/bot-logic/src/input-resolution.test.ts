/**
 * Input Resolution — Unit Tests
 *
 * Tests for hex validation, normalization, resolveColorInput, and resolveDyeInput.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidHex,
  normalizeHex,
  resolveColorInput,
  resolveDyeInput,
  searchDyesByName,
  findDyeByName,
  dyeService,
} from './input-resolution.js';
import { initializeLocale } from './localization.js';

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

    it('includes Facewear dyes when excludeFacewear is false', () => {
      const allDyes = dyeService.getAllDyes();
      const facewearDye = allDyes.find((d) => d.category === 'Facewear');
      if (facewearDye) {
        const result = resolveColorInput(facewearDye.name, { excludeFacewear: false });
        // With excludeFacewear: false, the Facewear dye should be included in candidates
        expect(result).not.toBeNull();
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

// ============================================================================
// Localized name matching (2026-08-20 i18n audit, F-02)
// ============================================================================

describe('localized dye-name matching', () => {
  it('searchDyesByName finds a dye by its Japanese name once the locale is loaded', async () => {
    await initializeLocale('ja');
    const hits = searchDyesByName('スノウ', 'ja');
    expect(hits.map((d) => d.name)).toContain('Snow White');
  });

  it('searchDyesByName still finds English names under a non-English locale, English first', async () => {
    await initializeLocale('de');
    const hits = searchDyesByName('snow', 'de');
    expect(hits[0]?.name).toBe('Snow White');
  });

  it('searchDyesByName is English-only when no locale is given', () => {
    expect(searchDyesByName('スノウ')).toEqual([]);
  });

  // An empty folded query is a substring of every localized name, so without
  // its guard the localized pass would hand back all 125 dyes for a blank
  // autocomplete under any non-English locale.
  it('a blank query matches nothing under a non-English locale, not every dye', async () => {
    await initializeLocale('de');
    expect(searchDyesByName('', 'de')).toEqual([]);
    expect(searchDyesByName('   ', 'de')).toEqual([]);
    expect(findDyeByName('', 'de')).toBeNull();
    expect(findDyeByName('  ', 'de')).toBeNull();
  });

  it('findDyeByName matches the exact localized name and the exact English name', async () => {
    await initializeLocale('ja');
    expect(findDyeByName('スノウホワイト', 'ja')?.name).toBe('Snow White');
    expect(findDyeByName('snow white', 'ja')?.name).toBe('Snow White');
    expect(findDyeByName('スノウ', 'ja')).toBeNull(); // partial is not exact
  });

  it('resolveDyeInput and resolveColorInput accept localized names', async () => {
    await initializeLocale('ja');
    expect(resolveDyeInput('スノウホワイト', 'ja')?.name).toBe('Snow White');
    expect(resolveColorInput('スノウホワイト', { locale: 'ja' })?.name).toBe('Snow White');
    expect(resolveDyeInput('スノウホワイト')).toBeNull();
  });

  // I18N-005 (2026-09-19 audit): searchDyesByName folds accents/ß/width on
  // both sides via core's foldForSearch, so an ASCII-only query still finds
  // a dye whose localized name carries a diacritic the user's keyboard
  // cannot type.
  describe('accent/ß/width folding (I18N-005)', () => {
    it('finds the German dye "Schneeweißer" via an ASCII-only query', async () => {
      await initializeLocale('de');
      const hits = searchDyesByName('schneeweiss', 'de');
      expect(hits.map((d) => d.name)).toContain('Snow White');
    });

    it('finds the German dye "Rußschwarzer" via an ASCII-only query', async () => {
      await initializeLocale('de');
      const hits = searchDyesByName('russschwarz', 'de');
      expect(hits.map((d) => d.name)).toContain('Soot Black');
    });

    it('finds the French dye "jaune crème" via an unaccented query', async () => {
      await initializeLocale('fr');
      const hits = searchDyesByName('creme', 'fr');
      expect(hits.map((d) => d.name)).toContain('Cream Yellow');
    });
  });
});

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

// ============================================================================
// stainID input (2026-08-29)
// ============================================================================
// The Discord autocomplete hands every dye option a stainID (1–254) as its
// value; a human may still type a name or a hex. A bare 1–3 digit number in
// range is a stainID — a hex shorthand must carry '#' or a hex letter.

describe('stainID input', () => {
  it('searchDyesByName resolves a bare stainID to exactly that dye', () => {
    const results = searchDyesByName('95');
    expect(results.map((d) => d.name)).toEqual(['Carmine Red']);
  });

  it('findDyeByName resolves a bare stainID', () => {
    expect(findDyeByName('95')?.name).toBe('Carmine Red');
  });

  it('resolveColorInput prefers the stainID over a 3-digit hex shorthand', () => {
    expect(resolveColorInput('101')?.name).toBe('Pure White');
    // …but a hash still means hex, exactly as before
    expect(resolveColorInput('#101')).toEqual({ hex: '#110011' });
  });

  it('resolveDyeInput resolves a bare stainID', () => {
    expect(resolveDyeInput('102')?.name).toBe('Jet Black');
  });

  it('numbers outside 1–254 are not stainIDs', () => {
    expect(resolveDyeInput('255')).toBeNull();
    expect(resolveDyeInput('0')).toBeNull();
    expect(findDyeByName('999')).toBeNull();
  });
});

describe('legacy item id input', () => {
  // A 4.x habit (and what the pre-5.0 autocomplete sent): item ids start at
  // 5729, so the range never overlaps the stainID byte.
  it('searchDyesByName resolves a legacy item id to exactly that dye', () => {
    expect(searchDyesByName('13114').map((d) => d.name)).toEqual(['Pure White']);
  });

  it('resolveColorInput and resolveDyeInput resolve a legacy item id', () => {
    expect(resolveColorInput('5763')?.name).toBe('Ul Brown');
    expect(resolveDyeInput('13115')?.name).toBe('Jet Black');
  });

  it('a number in the gap between the ranges resolves nothing', () => {
    expect(searchDyesByName('3000')).toEqual([]);
    expect(findDyeByName('3000')).toBeNull();
  });
});

// ============================================================================
// Six bare digits are a hex colour, never an id (BUG-034, 2026-10-04 audit)
// ============================================================================
// The id branch ran ahead of hex for every bare number, so '000000', '123456'
// and '333333' — valid hex colours the docblock promises to accept without '#'
// — came back null and /gradient, /mixer, /harmony, /contrast and
// /accessibility replied "invalid colour". Worse, '013114' parsed as 13114,
// Pure White's legacy item id, and silently drew Pure White instead of #013114.

describe('six-digit all-numeric input (BUG-034)', () => {
  it.each(['000000', '123456', '333333'])('resolveColorInput reads %s as a hex colour', (input) => {
    expect(resolveColorInput(input)).toEqual({ hex: `#${input}` });
  });

  it('a leading-zero hex that spells a real legacy item id is still the colour', () => {
    // 13114 is Pure White's legacy item id; '013114' is the colour #013114.
    expect(resolveColorInput('013114')).toEqual({ hex: '#013114' });
  });

  it('findClosestForHex attaches the closest dye to an all-digit hex', () => {
    const result = resolveColorInput('000000', { findClosestForHex: true });
    expect(result?.hex).toBe('#000000');
    expect(result?.dye).toBeDefined();
    const padded = resolveColorInput('013114', { findClosestForHex: true });
    expect(padded?.hex).toBe('#013114');
    expect(padded?.name).not.toBe('Pure White');
  });

  it('resolveDyeInput finds the closest dye to the colour, not the id', () => {
    const dye = resolveDyeInput('013114');
    expect(dye).not.toBeNull();
    expect(dye?.name).not.toBe('Pure White');
    expect(dye).toEqual(dyeService.findClosestDye('#013114'));
  });

  it('searchDyesByName and findDyeByName never read six digits as an id', () => {
    expect(searchDyesByName('013114')).toEqual([]);
    expect(findDyeByName('013114')).toBeNull();
  });

  it('one to five digits are still ids', () => {
    expect(resolveColorInput('13114')?.name).toBe('Pure White');
    expect(resolveColorInput('101')?.name).toBe('Pure White');
    expect(resolveColorInput('5763')?.name).toBe('Ul Brown');
    expect(resolveColorInput('#101')).toEqual({ hex: '#110011' });
    // A 3-digit non-id is still an id miss, not a shorthand colour.
    expect(resolveColorInput('255')).toBeNull();
    expect(resolveColorInput('000')).toBeNull();
  });

  // The first pass's six-digit rule matched the bare string while the id
  // rules tolerated surrounding whitespace, so a padded six-digit input was
  // neither a colour nor an id and resolved to nothing anywhere. Each resolver
  // now trims once at the top, so padding never changes how digits are read.
  describe('surrounding whitespace', () => {
    it.each([
      [' 013114', '#013114'],
      ['013114 ', '#013114'],
      [' 123456', '#123456'],
      ['013114\n', '#013114'],
      ['\t000000', '#000000'],
    ])('resolveColorInput reads %j as the colour %s', (input, hex) => {
      expect(resolveColorInput(input)).toEqual({ hex });
    });

    it('findClosestForHex attaches the closest dye to a padded all-digit hex', () => {
      const result = resolveColorInput(' 013114 ', { findClosestForHex: true });
      expect(result?.hex).toBe('#013114');
      expect(result?.dye).toEqual(dyeService.findClosestDye('#013114'));
    });

    it('resolveDyeInput finds the closest dye to a padded all-digit hex', () => {
      expect(resolveDyeInput(' 013114')).toEqual(dyeService.findClosestDye('#013114'));
      expect(resolveDyeInput('013114 ')).toEqual(dyeService.findClosestDye('#013114'));
    });

    // Trimming once covers every hex, not only the all-digit ones: a padded
    // hex with letters used to fall through to the name search and come back
    // null as well.
    it('a padded hex with letters is a colour too', () => {
      expect(resolveColorInput(' #FF0000 ')).toEqual({ hex: '#FF0000' });
      expect(resolveColorInput('ff0000 ')).toEqual({ hex: '#FF0000' });
      expect(resolveDyeInput(' #FF0000')).toEqual(dyeService.findClosestDye('#FF0000'));
    });

    // Pins, green before the trim as well: the id and name paths already
    // tolerated padding, and six digits must stay out of them either way.
    it('padded six digits are still never an id', () => {
      expect(searchDyesByName(' 013114')).toEqual([]);
      expect(findDyeByName('013114 ')).toBeNull();
    });

    it('padded one to five digits are still ids', () => {
      expect(resolveColorInput(' 101 ')?.name).toBe('Pure White');
      expect(resolveDyeInput(' 13114')?.name).toBe('Pure White');
      expect(searchDyesByName('95 ').map((d) => d.name)).toEqual(['Carmine Red']);
      expect(findDyeByName('\t102')?.name).toBe('Jet Black');
    });
  });

  // The precedence rests on this: every id a dye can be looked up by fits in
  // five digits, so no real id is ever shadowed by the six-digit hex rule.
  it('every stainID, id and itemID in the database is at most five digits', () => {
    for (const dye of dyeService.getAllDyes()) {
      expect(dye.stainID ?? 0).toBeLessThan(100_000);
      expect(dye.id).toBeLessThan(100_000);
      expect(dye.itemID).toBeLessThan(100_000);
    }
  });
});
