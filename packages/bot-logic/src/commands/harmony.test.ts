/**
 * Harmony Command — Unit Tests
 *
 * Tests for executeHarmony, getHarmonyTypeChoices, and HARMONY_TYPES.
 */

import { HARMONY_OFFSETS } from '@xivdyetools/core';
import { describe, it, expect } from 'vitest';
import { executeHarmony, getHarmonyTypeChoices, HARMONY_TYPES } from './harmony.js';
import type { HarmonyType } from './harmony.js';
import { dyeService } from '../input-resolution.js';

const BASE_HEX = '#D69C6D'; // A warm brown (Rust Red-ish)

// ============================================================================
// HARMONY_TYPES
// ============================================================================

describe('HARMONY_TYPES', () => {
  // Ten since 2026-09-03. Selection reads HARMONY_OFFSETS rather than calling a
  // bespoke DyeService.find*Dyes() per type, so `compound` and `shades` — which
  // the web app has always offered and no finder method exists for — work here
  // too.
  it('contains all 10 harmony types', () => {
    expect(HARMONY_TYPES).toHaveLength(10);
  });

  it('offers exactly the types the shared offsets table defines', () => {
    expect([...HARMONY_TYPES].sort()).toEqual(Object.keys(HARMONY_OFFSETS).sort());
  });

  it('includes triadic', () => {
    expect(HARMONY_TYPES).toContain('triadic');
  });

  it('includes complementary', () => {
    expect(HARMONY_TYPES).toContain('complementary');
  });

  it('includes all expected types', () => {
    const expected = ['triadic', 'complementary', 'analogous', 'split-complementary', 'tetradic', 'inverted-tetradic', 'square', 'monochromatic', 'compound', 'shades'];
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

    // One line: the card names every slot; the embed carries the share URL
    expect(result.embed.description).toBeDefined();
    expect(result.embed.description).toContain('xivdyetools.app/harmony');
  });

  it('renders the 11A slot rows into the SVG', async () => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'analogous',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Frame vocabulary: 400 wide, the mark, the base label
    expect(result.svgString).toContain('width="400"');
    expect(result.svgString).toContain('xivdyetools.app');
    expect(result.svgString).toContain('BASE');
    // Turn 13: the ceiling is a wall, not a guideline
    const height = Number(/height="(\d+)"/.exec(result.svgString)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
  });

  it('leads each slot with the angle the maths asked for', async () => {
    // Square asks for 90° / 180° / 270°; -30 (analogous) reads as 330°, an
    // angle on the wheel rather than a signed rotation
    const square = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'square',
      locale: 'en',
    });
    expect(square.ok).toBe(true);
    if (!square.ok) return;
    expect(square.svgString).toContain('180°');

    const analogous = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'analogous',
      locale: 'en',
    });
    expect(analogous.ok).toBe(true);
    if (!analogous.ok) return;
    expect(analogous.svgString).toContain('330°');
    expect(analogous.svgString).not.toContain('-30°');
  });

  it('prints the matching method whenever a tier is off-default', async () => {
    // A tier is a property of the METHOD, not of the pair — two players with
    // different stored preferences get different dyes, and without the tag
    // one of the two PNGs looks wrong.
    const off = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'triadic',
      locale: 'en',
      matchingMethod: 'redmean',
    });
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    expect(off.svgString).toContain('REDMEAN');

    const dflt = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'triadic',
      locale: 'en',
      matchingMethod: 'ciede2000',
    });
    expect(dflt.ok).toBe(true);
    if (!dflt.ok) return;
    // The default needs no tag — the bare ΔE header is the ΔE2000 case
    expect(dflt.svgString).not.toContain('REDMEAN');
  });

  it('names the weakest slot in the verdict, with a glyph rather than a label', async () => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'square',
      locale: 'de',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // "weakest slot" as a label overran the row in German — the ↓ is the label
    expect(result.svgString).toContain('↓');
    const height = Number(/height="(\d+)"/.exec(result.svgString)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
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

  // Behaviour change, 2026-09-03: an unrecognised type used to fall through to
  // TRIADIC and render a card labelled with the unknown name — the user asked
  // for one thing and got another, silently. Discord constrains the choices, so
  // this can only arrive from a malformed interaction; answering "no matches"
  // is the honest result. `generateHarmonySlots` returns no slots for a type
  // that is not a row in the table.
  it('refuses an unrecognized harmony type instead of drawing a triadic', async () => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: 'unknown' as unknown as HarmonyType,
      locale: 'en',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NO_MATCHES');
  });

  // An inherited key must not resolve to a Function and take the render with it.
  it.each(['toString', 'constructor'])('refuses the inherited key %j', async (type) => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: type as unknown as HarmonyType,
      locale: 'en',
    });

    expect(result.ok).toBe(false);
  });

  it.each(['compound', 'shades'])('builds a %s harmony', async (type) => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: type as HarmonyType,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.harmonyDyes.length).toBeGreaterThan(0);
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

// ============================================================================
// The type label reaches the card from the locale data (pkg-svg-bot-logic-08)
// ============================================================================

describe('the harmony type label', () => {
  /**
   * `getLocalizedHarmonyType` used to carry an English `formats` table below
   * its locale lookup, described as a fallback. It could never run: the key map
   * covers all eight types, so the lookup always returned first, and even on a
   * missing key `Translator.t()` yields the raw key rather than undefined. It
   * was removed — but the removal is only safe while every type really does
   * resolve through the locale data, which is what this asserts.
   *
   * The card uppercases the label, and Japanese has no case, so the localized
   * string appears verbatim in the SVG.
   */
  it.each(HARMONY_TYPES)('renders %s from the ja locale, not an English fallback', async (type) => {
    const result = await executeHarmony({
      baseHex: BASE_HEX,
      harmonyType: type as HarmonyType,
      locale: 'ja',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // No English name for the type survives into the card…
    const english: Record<string, string> = {
      complementary: 'COMPLEMENTARY',
      analogous: 'ANALOGOUS',
      triadic: 'TRIADIC',
      'split-complementary': 'SPLIT-COMPLEMENTARY',
      tetradic: 'TETRADIC',
      'inverted-tetradic': 'INVERTED TETRADIC',
      square: 'SQUARE',
      monochromatic: 'MONOCHROMATIC',
    };
    expect(result.svgString).not.toContain(english[type]);

    // …and the raw key never leaks either, which is what a missing locale
    // entry would produce now that the English table is gone.
    expect(result.svgString).not.toContain('HARMONY.');
  });
});

// ============================================================================
// Colour wheel (Task 11) — wheel carries into the algorithm, the card token,
// and the share URL
// ============================================================================

describe('colour wheel', () => {
  // `baseDye` lookup in executeHarmony runs off `baseId` alone (independent of
  // `baseHex`), so a real dye supplies the stainID the share-URL assertion
  // needs while `#B02020` — saturated enough that RGB vs RYB hue rotation
  // picks a different nearest dye — drives the actual harmony computation.
  const realDye = dyeService.getAllDyes()[0];
  if (!realDye) throw new Error('fixture dye database is empty');

  const run = (wheel?: 'rgb' | 'ryb' | 'munsell' | 'oklch-hue' | 'oklch-lightness') =>
    executeHarmony({
      baseHex: '#B02020',
      baseName: 'Dalamud Red',
      baseId: realDye.id,
      baseItemID: realDye.itemID,
      harmonyType: 'complementary',
      locale: 'en',
      wheel,
    });

  it('defaults to RGB: no wheel in the share URL and no token on the card', async () => {
    const r = await run();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.embed.description).not.toContain('wheel=');
    expect(r.svgString).not.toContain('RYB');
  });

  it('passes wheel=ryb through: different dyes, token on the card, wheel in the share URL', async () => {
    const rgb = await run('rgb');
    const ryb = await run('ryb');
    expect(rgb.ok && ryb.ok).toBe(true);
    if (!rgb.ok || !ryb.ok) return;
    expect(ryb.harmonyDyes[0]?.itemID).not.toBe(rgb.harmonyDyes[0]?.itemID);
    expect(ryb.svgString).toContain('RYB');
    expect(ryb.embed.description).toContain('&wheel=ryb');
    expect(rgb.embed.description).not.toContain('wheel=');
  });

  it('localises the token', async () => {
    const r = await executeHarmony({
      baseHex: '#B02020',
      baseId: realDye.id,
      baseItemID: realDye.itemID,
      harmonyType: 'triadic',
      locale: 'ja',
      wheel: 'munsell',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.svgString).toContain('マンセル');
  });
});
