/**
 * Swatch OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateSwatchOG } from './swatch';
import { MATCHING_METHODS, MATCHING_METHOD_TAGS } from '@xivdyetools/core';

describe('generateSwatchOG (15E band)', () => {
  it('the target is a target, never a result — no invented name or stain', async () => {
    const svg = await generateSwatchOG({ color: '7A6B4F' });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('TARGET');
    expect(svg).toContain('#7A6B4F');
    expect(svg).toContain('NO STAIN ID');
    expect(svg).toContain('SWATCH');
  });

  it('holds four matches, not five (the 11px name floor)', async () => {
    const svg = await generateSwatchOG({ color: '7A6B4F', limit: 20 });
    expect(svg).toContain('>4<');
    expect(svg).not.toContain('>5<');
  });

  it('the X frame carries the target line', async () => {
    const svg = await generateSwatchOG({ color: '7A6B4F', frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('xivdyetools.app/swatch');
  });

  it('an invalid hex renders the neutral state, never throws', async () => {
    const svg = await generateSwatchOG({ color: 'zzz' });
    expect(svg).toContain('NOT FOUND');
  });
});

// ---------------------------------------------------------------------------
// BUG-023 / BUG-024 (deep dive 2026-09-02): a card must name the method it
// actually measured with.
//
// BUG-023 — swatch ranked by a hardcoded ciede2000 but printed
// `deltaForAlgorithm(…, algorithm)` under an `algorithm` footer. ΔEOK and
// ΔE2000 do not agree on order over 125 dyes, so rank 2 could display a
// SMALLER Δ than rank 1, and the set could differ from the page's.
// The old suite never passed an `algorithm` at all, and asserted only the
// band count.
//
// BUG-024 — `ALGO_TAG` had no row for `hyab` or `oklch-weighted`, the two
// legacy spellings pre-5.0 shared links still carry and `VALID_ALGORITHMS`
// still accepts. The lookup missed, the fallback upper-cased the raw param,
// and the footer read `HYAB` over ΔE2000 numbers.
// ---------------------------------------------------------------------------
describe('BUG-023: the printed deltas are the ones the card ranked by', () => {
  const parseDeltas = (svg: string): number[] =>
    [...svg.matchAll(/Δ(\d+(?:\.\d+)?)</g)].map((m) => parseFloat(m[1]));

  it('deltas run in ascending order under every method', () => {
    for (const algorithm of MATCHING_METHODS) {
      const svg = generateSwatchOG({ color: '7A6B4F', limit: 4, algorithm });
      const deltas = parseDeltas(svg);
      expect(deltas.length, algorithm).toBe(4);
      for (let i = 1; i < deltas.length; i++) {
        expect(deltas[i], `${algorithm}: rank ${i + 1} vs ${i}`).toBeGreaterThanOrEqual(
          deltas[i - 1]
        );
      }
    }
  });

  it('the ranked set is the requested method’s, not ciede2000’s', () => {
    // #7A6B4F is the review's own example, and the metrics disagree hard here:
    // ΔE2000 ranks four browns (Opo-opo, Shale, Qiqirn, Mole); REDMEAN puts
    // Lilac Purple first and drops three of those four. Under the bug this
    // card drew the ΔE2000 browns with REDMEAN numbers on them.
    const byDefault = generateSwatchOG({ color: '7A6B4F', limit: 4, algorithm: 'ciede2000' });
    const byRedmean = generateSwatchOG({ color: '7A6B4F', limit: 4, algorithm: 'redmean' });

    expect(byRedmean).toContain('Lilac');
    expect(byDefault).not.toContain('Lilac');
    expect(byDefault).toContain('Opo-opo');
    expect(byRedmean).not.toContain('Opo-opo');
  });
});

describe('BUG-024: the footer names the method that actually ran', () => {
  it('a legacy spelling prints its NORMALISED tag, not the raw param', () => {
    // normalizeMatchingMethod folds both retired v4 methods into the default,
    // so the numbers are ΔE2000 — the footer has to say so.
    for (const legacy of ['hyab', 'oklch-weighted']) {
      const svg = generateSwatchOG({
        color: 'AABBCC',
        limit: 3,
        algorithm: legacy as never,
      });
      expect(svg, legacy).toContain('ΔE2000');
      expect(svg, legacy).not.toContain('HYAB');
      expect(svg, legacy).not.toContain('OKLCH-WEIGHTED');
    }

    // `euclidean` normalises to rgb, and always did have a row — it stays right
    const rgb = generateSwatchOG({ color: 'AABBCC', limit: 3, algorithm: 'euclidean' as never });
    expect(rgb).toContain('RGB DIST');
  });

  it('every accepted spelling resolves to a tag from core’s table', () => {
    // The route's own vocabulary — the 6 live methods plus the 3 legacy ones.
    const ACCEPTED = [...MATCHING_METHODS, 'euclidean', 'hyab', 'oklch-weighted'];
    const KNOWN_TAGS = new Set(Object.values(MATCHING_METHOD_TAGS));
    for (const algorithm of ACCEPTED) {
      const svg = generateSwatchOG({ color: 'AABBCC', limit: 3, algorithm: algorithm as never });
      // The footer-right slot is the last text run on the card.
      const runs = [...svg.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim());
      const tag = runs.filter((r) => KNOWN_TAGS.has(r)).pop();
      expect(tag, `${algorithm}: no known tag in the footer`).toBeDefined();
    }
  });
});
