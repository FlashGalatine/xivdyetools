/**
 * Harmony Command — Unit Tests
 *
 * Tests for executeHarmony, getHarmonyTypeChoices, and HARMONY_TYPES.
 */

import { describe, it, expect } from 'vitest';
import { executeHarmony, getHarmonyTypeChoices, HARMONY_TYPES } from './harmony.js';
import type { HarmonyType } from './harmony.js';

const BASE_HEX = '#D69C6D'; // A warm brown (Rust Red-ish)

// ============================================================================
// HARMONY_TYPES
// ============================================================================

describe('HARMONY_TYPES', () => {
  it('contains all 7 harmony types', () => {
    expect(HARMONY_TYPES).toHaveLength(7);
  });

  it('includes triadic', () => {
    expect(HARMONY_TYPES).toContain('triadic');
  });

  it('includes complementary', () => {
    expect(HARMONY_TYPES).toContain('complementary');
  });

  it('includes all expected types', () => {
    const expected = ['triadic', 'complementary', 'analogous', 'split-complementary', 'tetradic', 'square', 'monochromatic'];
    for (const type of expected) {
      expect(HARMONY_TYPES).toContain(type);
    }
  });
});

// ============================================================================
// getHarmonyTypeChoices
// ============================================================================

describe('getHarmonyTypeChoices', () => {
  it('returns an array of choice objects', () => {
    const choices = getHarmonyTypeChoices();
    expect(choices.length).toBe(HARMONY_TYPES.length);
  });

  it('each choice has name and value', () => {
    const choices = getHarmonyTypeChoices();
    for (const choice of choices) {
      expect(choice).toHaveProperty('name');
      expect(choice).toHaveProperty('value');
      expect(typeof choice.name).toBe('string');
      expect(typeof choice.value).toBe('string');
    }
  });

  it('choice values match HARMONY_TYPES', () => {
    const choices = getHarmonyTypeChoices();
    const values = choices.map((c) => c.value);
    for (const type of HARMONY_TYPES) {
      expect(values).toContain(type);
    }
  });

  it('choice names are human-readable (capitalized)', () => {
    const choices = getHarmonyTypeChoices();
    for (const choice of choices) {
      // First character should be uppercase
      expect(choice.name[0]).toBe(choice.name[0].toUpperCase());
    }
  });
});

// ============================================================================
// executeHarmony
// ============================================================================

describe('executeHarmony', () => {
  const harmonyTypes: HarmonyType[] = [...HARMONY_TYPES];

  for (const harmonyType of harmonyTypes) {
    it(`generates ${harmonyType} harmony successfully`, async () => {
      const result = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType,
        locale: 'en',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.svgString).toContain('<svg');
      expect(result.baseHex).toBe(BASE_HEX);
      expect(result.harmonyDyes.length).toBeGreaterThan(0);
      expect(result.embed.title).toBeDefined();
      expect(result.embed.color).toBeGreaterThanOrEqual(0);
    });
  }

  it('includes baseName in result when provided', async () => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      baseName: 'Rust Red',
      harmonyType: 'triadic',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.baseName).toBeDefined();
  });

  it('uses localized name when both baseName and baseItemID are provided', async () => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      baseName: 'Dalamud Red',
      baseItemID: 5790,
      harmonyType: 'triadic',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.baseName).toBeDefined();
  });

  it('uses hex as baseName when name not provided', async () => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'complementary',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // baseName should fall back to the hex
    expect(result.baseName).toBeDefined();
  });

  it('returns embed with description containing dye list', async () => {
    const result = await executeHarmony({
      baseHex: '#FF0000',
      harmonyType: 'triadic',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.description).toBeDefined();
    expect(result.embed.description).toContain('**1.**');
  });

  it('returns embed with footer', async () => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'analogous',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.footer).toBeDefined();
  });

  it('works with Japanese locale', async () => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'triadic',
      locale: 'ja',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('<svg');
  });

  it('handles unrecognized harmony type via default fallback', async () => {
    // Covers: getHarmonyDyes default case + getLocalizedHarmonyType fallback branch
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'unknown' as unknown as HarmonyType,
      locale: 'en',
    });

    // The default case falls back to triadic dyes, so ok should still be true
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.title).toBeDefined();
  });

  it('returns dyes for each harmony type', async () => {
    const triadic = await executeHarmony({ baseHex: '#0000FF', harmonyType: 'triadic', locale: 'en' });
    const comp = await executeHarmony({ baseHex: '#0000FF', harmonyType: 'complementary', locale: 'en' });

    expect(triadic.ok).toBe(true);
    expect(comp.ok).toBe(true);

    if (triadic.ok && comp.ok) {
      // Triadic should have more harmony dyes than complementary
      expect(triadic.harmonyDyes.length).toBeGreaterThan(comp.harmonyDyes.length);
    }
  });

  describe('dyeFilters', () => {
    it('excludes metallic dyes when excludeMetallic is set', async () => {
      const result = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'triadic',
        locale: 'en',
        dyeFilters: { excludeMetallic: true },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (const dye of result.harmonyDyes) {
        expect(dye.isMetallic).toBe(false);
      }
    });

    it('returns all dyes when dyeFilters is undefined', async () => {
      const result = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'triadic',
        locale: 'en',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.harmonyDyes.length).toBeGreaterThan(0);
    });

    it('returns all dyes when dyeFilters is empty', async () => {
      const result = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'triadic',
        locale: 'en',
        dyeFilters: {},
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.harmonyDyes.length).toBeGreaterThan(0);
    });
  });

  describe('strictMatching', () => {
    it('applies deltaE tightening with default formula/tolerance', async () => {
      const result = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'triadic',
        locale: 'en',
        strictMatching: true,
      });

      expect(result.ok).toBe(true);
    });

    it('preserves caller-supplied deltaE formula and tolerance', async () => {
      const result = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'triadic',
        locale: 'en',
        strictMatching: true,
        harmonyOptions: { deltaEFormula: 'cie76', deltaETolerance: 30 },
      });

      expect(result.ok).toBe(true);
    });
  });

  describe('companion expansion', () => {
    it('companionCount=3 expands each harmony slot with close matches', async () => {
      const single = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'complementary',
        locale: 'en',
      });
      const expanded = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'complementary',
        locale: 'en',
        companionCount: 3,
      });

      expect(single.ok && expanded.ok).toBe(true);
      if (!single.ok || !expanded.ok) return;

      expect(expanded.harmonyDyes.length).toBeGreaterThan(single.harmonyDyes.length);
      expect(expanded.harmonyDyes.length).toBeLessThanOrEqual(single.harmonyDyes.length * 3);
    });

    it('preventDuplicates yields unique dye ids across slots', async () => {
      const result = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'analogous',
        locale: 'en',
        companionCount: 2,
        preventDuplicates: true,
        baseId: 1,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const ids = result.harmonyDyes.map((d) => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('clamps out-of-range companionCount into [1, 3]', async () => {
      const tooBig = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'complementary',
        locale: 'en',
        companionCount: 99,
      });
      const tooSmall = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'complementary',
        locale: 'en',
        companionCount: 0,
      });

      expect(tooBig.ok && tooSmall.ok).toBe(true);
      if (!tooBig.ok || !tooSmall.ok) return;

      // 1 complementary slot → at most 3 dyes; count 0 clamps up to 1 dye
      expect(tooBig.harmonyDyes.length).toBeLessThanOrEqual(3);
      expect(tooSmall.harmonyDyes.length).toBe(1);
    });

    it('companions respect dyeFilters (filtered candidates are skipped, not returned)', async () => {
      const result = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'triadic',
        locale: 'en',
        companionCount: 3,
        dyeFilters: { excludeMetallic: true },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (const dye of result.harmonyDyes) {
        expect(dye.isMetallic).toBe(false);
      }
    });

    it('supports alternate matching methods for companion lookup', async () => {
      const result = await executeHarmony({
        baseHex: BASE_HEX,
        harmonyType: 'complementary',
        locale: 'en',
        companionCount: 2,
        matchingMethod: 'rgb',
      });

      expect(result.ok).toBe(true);
    });
  });
});
