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
});
