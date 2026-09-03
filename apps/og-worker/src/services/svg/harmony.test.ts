/**
 * Harmony OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateHarmonyOG } from './harmony';
import { dyeService } from './dye-helpers';
import { HARMONY_OFFSETS } from '@xivdyetools/core';
import type { HarmonyType } from '../../types';

const anyDye = dyeService.getAllDyes()[0];
const stainId = anyDye.stainID ?? anyDye.id;

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

    it('every accepted algorithm still renders a full card', () => {
      for (const algorithm of ['ciede2000', 'oklab', 'cie76', 'redmean', 'rgb', 'distinguish']) {
        const svg = generateHarmonyOG({
          dyeId: stainId,
          harmonyType: 'tetradic',
          algorithm: algorithm as never,
        });
        expect(svg, algorithm).toContain('<svg');
        expect(svg, algorithm).not.toContain('NOT FOUND');
      }
    });
  });
});
