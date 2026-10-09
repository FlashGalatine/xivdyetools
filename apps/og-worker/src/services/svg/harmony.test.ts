/**
 * Harmony OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateHarmonyOG } from './harmony';
import { ALL_DYES, dyeService } from './dye-helpers';
import {
  HARMONY_OFFSETS,
  LEGACY_MATCHING_METHOD_MAP,
  MATCHING_METHODS,
  MATCHING_METHOD_TAGS,
  normalizeMatchingMethod,
} from '@xivdyetools/core';
import { isAlgorithm } from '../../og-params';
import type { HarmonyType } from '../../types';

const anyDye = dyeService.getAllDyes()[0];
const stainId = anyDye.stainID ?? anyDye.id;

/** The bucket mark's clipPath id is a per-render counter (band.ts) — mask it. */
const normalizeMarkUid = (svg: string): string => svg.replace(/ogm\d+/g, 'ogmX');

describe('generateHarmonyOG (15E band)', () => {
  it('renders the Discord band frame with base + matches', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'tetradic' });

    expect(svg).toContain('<svg');
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="350"');
    expect(svg).toContain('XIV DYE TOOLS');
    expect(svg).toContain('HARMONY');
    expect(svg).toContain('BASE');
    // The deck names the base and the harmony it anchors
    expect(svg).toMatch(/font-size="14.5"[^>]*>[^<]*Tetradic</);
    // Ideal offsets ride the match roles
    expect(svg).toContain('+60°');
    // The footer prints the path only
    expect(svg).toContain('xivdyetools.app/harmony');
    expect(svg).not.toContain('?dye=');
  });

  describe('a non-default wheel', () => {
    /** The hexes the card printed, in band order — which dyes were CHOSEN. */
    const picked = (svg: string): string[] =>
      [...svg.matchAll(/>(#[0-9A-F]{6})</g)].map((m) => m[1]);

    it('changes the dyes, not just the caption', () => {
      const rgb = generateHarmonyOG({ dyeId: 43, harmonyType: 'complementary' });
      const ryb = generateHarmonyOG({ dyeId: 43, harmonyType: 'complementary', wheel: 'ryb' });
      const rgbDyes = picked(rgb);
      const rybDyes = picked(ryb);
      expect(rgbDyes.length).toBeGreaterThan(1);
      // The SET, not the string: a caption-only difference would leave these equal.
      expect(new Set(rybDyes)).not.toEqual(new Set(rgbDyes));
    });

    /**
     * The deck carries the localised wheel name, and the X frame DROPS the
     * deck — so on Twitter the two cards were pixel-identical apart from the
     * dyes, with nothing saying which wheel produced them. The footer-right
     * slot already names the algorithm; the wheel joins it there as a
     * non-localised tag, the same class of token as `ΔE2000`.
     */
    it('tags the footer even in the X frame, where the deck is gone', () => {
      const ryb = generateHarmonyOG({
        dyeId: 43,
        harmonyType: 'complementary',
        wheel: 'ryb',
        frame: 'x',
      });
      const rgb = generateHarmonyOG({ dyeId: 43, harmonyType: 'complementary', frame: 'x' });
      expect(ryb).toContain('RYB');
      expect(rgb).not.toContain('RYB');
      // The algorithm tag is still there beside it.
      expect(ryb).toContain('ΔE2000');
    });

    it('leaves the footer alone on the default wheel', () => {
      const rgb = generateHarmonyOG({ dyeId: 43, harmonyType: 'complementary', wheel: 'rgb' });
      expect(rgb).not.toContain('RGB');
    });
  });

  it('the Δ is match → computed ideal (never four-reds on a correct tetrad)', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'tetradic' });
    // Every match tag is a Δ value
    const deltas = [...svg.matchAll(/Δ(\d+\.\d)/g)].map((m) => parseFloat(m[1]));
    expect(deltas.length).toBeGreaterThan(0);
  });

  it('renders the X frame at 400×210, deck dropped, bands intact', () => {
    const discord = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic' });
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('xivdyetools.app/harmony');
    // The deck drops...
    expect(discord).toContain('font-size="14.5"');
    expect(svg).not.toContain('font-size="14.5"');
    // ...and the bands keep their roles and names
    expect(svg).toContain('BASE');
    expect(svg).toContain('font-size="17"');
  });

  it('monochromatic falls back to nearest dyes', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'monochromatic' });
    expect(svg).toContain('<svg');
    expect(svg).toContain('≈');
  });

  it('an unknown dye renders the neutral state, never throws', () => {
    const svg = generateHarmonyOG({ dyeId: 999999, harmonyType: 'tetradic' });
    expect(svg).toContain('NOT FOUND');
    expect(svg).toContain('#999999');
  });

  it('localizes dye names', () => {
    const en = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', locale: 'en' });
    const ja = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', locale: 'ja' });
    expect(en).toContain('<svg');
    expect(ja).toContain('<svg');
  });

  it('names the requested algorithm in the footer-right slot', () => {
    const svg = generateHarmonyOG({
      dyeId: stainId,
      harmonyType: 'triadic',
      algorithm: 'ciede2000',
      frame: 'x',
    });
    expect(svg).toContain('ΔE2000');
  });

  it('localizes the tool tag and the harmony name', () => {
    const de = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', locale: 'de' });
    expect(de).toContain('HARMONIE');
    const ja = generateHarmonyOG({ dyeId: stainId, harmonyType: 'triadic', locale: 'ja' });
    expect(ja).toContain('ハーモニー');
  });
});

// ---------------------------------------------------------------------------
// BUG-022 (deep dive 2026-09-02): og-worker carried a private IDEAL_OFFSETS
// that diverged from the page's HARMONY_OFFSETS in three of ten rows. A card
// is the unfurl of a page URL, so `compound` drew three dyes and the page the
// reader then opened drew three *different* ones — zero overlap.
//
// The old suite exercised only tetradic / triadic / monochromatic: the three
// rows that happened to agree, or that were deliberately the fallback.
// ---------------------------------------------------------------------------
describe('BUG-022: the card draws the same hues the page does', () => {
  const ALL: HarmonyType[] = [
    'complementary',
    'analogous',
    'triadic',
    'split-complementary',
    'tetradic',
    'inverted-tetradic',
    'square',
    'monochromatic',
    'compound',
    'shades',
  ];

  it('every harmony type the route accepts has a row in the shared table', () => {
    for (const type of ALL) {
      expect(HARMONY_OFFSETS[type], type).toBeDefined();
    }
  });

  it('the role tags on a card are exactly the shared table’s offsets', () => {
    // `monochromatic` alone takes the nearest-dye path (its single [0] offset
    // is a no-op rotation), so it renders `≈` rather than a degree tag.
    for (const type of ALL.filter((t) => t !== 'monochromatic')) {
      const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: type });
      const roles = [...svg.matchAll(/>([+-]?\d+)°</g)].map((m) => Number(m[1]));
      // A band card draws at most 4 matches beside the base.
      const expected = HARMONY_OFFSETS[type].slice(0, 4);
      expect(roles, type).toEqual(expected);
    }
  });

  it('shades renders its own hues instead of falling through to nearest-dye', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'shades' });
    expect(svg).toContain('+15°');
    expect(svg).toContain('+345°');
    // `≈` is the nearest-dye role — the branch this used to land in silently
    expect(svg).not.toContain('>≈<');
  });

  it('analogous draws the page’s two bands, not three with a complement', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'analogous' });
    const roles = [...svg.matchAll(/>([+-]?\d+)°</g)].map((m) => Number(m[1]));
    expect(roles).toEqual([30, 330]);
    expect(roles).not.toContain(180);
  });

  it('compound draws the page’s scheme, not the bot’s', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'compound' });
    const roles = [...svg.matchAll(/>([+-]?\d+)°</g)].map((m) => Number(m[1]));
    expect(roles).toEqual([30, 180, 330]);
  });

  it('monochromatic still takes the nearest-dye path and fills four bands', () => {
    const svg = generateHarmonyOG({ dyeId: stainId, harmonyType: 'monochromatic' });
    const approx = [...svg.matchAll(/>≈</g)];
    expect(approx.length).toBe(4);
  });

  /**
   * 2026-09-03 review: `?algo=` fed only the PRINTED delta while ranking stayed
   * hardcoded to ciede2000 — so an `?algo=oklab` link drew the ΔE2000 dyes
   * under ΔEOK figures, a different set from the page it opens, which ranks by
   * the requested method. The card is the unfurl of that page; if the two ever
   * disagree the preview is lying about where the link goes.
   */
  describe('the requested algorithm chooses the dyes, not just the numbers', () => {
    /**
     * The hexes the card printed, in band order — which dyes were CHOSEN.
     *
     * Deliberately not every text run: the per-row Δ figures are computed with
     * the requested algorithm even when ranking is not, so comparing all runs
     * passes whether or not this is fixed. A first draft of this test did
     * exactly that and survived the mutation. The hex identifies the dye.
     */
    function pickedHexes(algorithm: string): string[] {
      const svg = generateHarmonyOG({
        dyeId: stainId,
        harmonyType: 'tetradic',
        algorithm: algorithm as never,
      });
      return [...svg.matchAll(/>(#[0-9A-F]{6})</g)].map((m) => m[1]);
    }

    it('a different algorithm can return a different set of dyes', () => {
      // Over 125 dyes ΔE2000 and RGB distance disagree on ordering; with
      // ranking pinned these two are identical for every base.
      const byDeltaE = pickedHexes('ciede2000');
      const byRgb = pickedHexes('rgb');
      expect(byDeltaE.length).toBeGreaterThan(1);
      expect(byDeltaE).not.toEqual(byRgb);
    });

    /**
     * BUG-061 / BUG-062 (deep dive 2026-10-04): this used to list only the six
     * 5.0 spellings and assert only `<svg` — so the three legacy spellings the
     * route still accepts (`isAlgorithm`) were never rendered, and a card that
     * drew the wrong dyes passed as long as it drew SOMETHING. Every spelling
     * the route admits must now choose exactly the dyes its normalized method
     * chooses, and name that method in the footer.
     */
    const EVERY_ACCEPTED_SPELLING = [...MATCHING_METHODS, ...Object.keys(LEGACY_MATCHING_METHOD_MAP)];

    it('every listed spelling is one the route accepts, legacy included', () => {
      for (const algorithm of EVERY_ACCEPTED_SPELLING) {
        expect(isAlgorithm(algorithm), algorithm).toBe(true);
      }
      // The three pre-5.0 spellings are what the old list left out.
      expect(EVERY_ACCEPTED_SPELLING).toEqual(expect.arrayContaining(['hyab', 'oklch-weighted', 'euclidean']));
    });

    it('every accepted spelling chooses its normalized method’s dyes and names that method', () => {
      const matchCount = HARMONY_OFFSETS.tetradic.slice(0, 4).length;
      for (const algorithm of EVERY_ACCEPTED_SPELLING) {
        const normalized = normalizeMatchingMethod(algorithm);
        const svg = generateHarmonyOG({
          dyeId: stainId,
          harmonyType: 'tetradic',
          algorithm: algorithm as never,
        });
        expect(svg, algorithm).not.toContain('NOT FOUND');
        // The base plus one band per offset — no slot went missing.
        expect(pickedHexes(algorithm), algorithm).toHaveLength(1 + matchCount);
        expect(pickedHexes(algorithm), algorithm).toEqual(pickedHexes(normalized));
        expect(svg, algorithm).toContain(MATCHING_METHOD_TAGS[normalized]);
      }
    });

    /**
     * BUG-062: core's `getDistanceForMethod` has no case for a legacy spelling,
     * so it returned `undefined`, every candidate scored NaN, the sort left them
     * in table order, and `/og/harmony/1/tetradic.png?algo=hyab` drew the first
     * dyes of `ALL_DYES` — grays — in place of a tetrad.
     */
    it('a legacy spelling is not ranked in dye-table order', () => {
      const base = dyeService.getAllDyes().find((d) => (d.stainID ?? d.id) === stainId)!;
      const tableOrder = ALL_DYES.filter((d) => d.itemID !== base.itemID)
        .slice(0, HARMONY_OFFSETS.tetradic.slice(0, 4).length)
        .map((d) => d.hex.toUpperCase());
      for (const legacy of Object.keys(LEGACY_MATCHING_METHOD_MAP)) {
        expect(pickedHexes(legacy).slice(1), legacy).not.toEqual(tableOrder);
      }
    });

    it('a legacy spelling renders the same card as the method it normalizes to', () => {
      for (const [legacy, normalized] of Object.entries(LEGACY_MATCHING_METHOD_MAP)) {
        const viaLegacy = generateHarmonyOG({ dyeId: stainId, harmonyType: 'tetradic', algorithm: legacy as never });
        const viaNormalized = generateHarmonyOG({ dyeId: stainId, harmonyType: 'tetradic', algorithm: normalized });
        expect(normalizeMarkUid(viaLegacy), legacy).toBe(normalizeMarkUid(viaNormalized));
      }
    });
  });
});
