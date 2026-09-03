/**
 * Comparison OG tests — the 15E band adapter (a qualified acceptance).
 */
import { describe, it, expect } from 'vitest';
import { generateComparisonOG, COMPARISON_MAX_DYES } from './comparison';
import { dyeService } from './dye-helpers';

const dyes = dyeService.getAllDyes();
const sid = (i: number): number => dyes[i].stainID ?? dyes[i].id;

/** band.ts's mark clip-path id carries a module-level call counter
 * (`ogm7b`, `ogm8b`, …) that is cosmetic — it exists so multiple cards
 * embedded on one page never collide on an SVG id — not content, so a
 * byte-identical-output comparison across two `generate*OG` calls in the
 * same test needs it normalised out first. */
const normalizeMarkUid = (svg: string): string => svg.replace(/ogm\d+/g, 'ogmX');

describe('generateComparisonOG (15E band)', () => {
  it('the closest pair leads, adjacent and widened', () => {
    const svg = generateComparisonOG({ dyeIds: [sid(0), sid(5), sid(50), sid(90)] });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('CLOSEST PAIR');
    expect(svg).toContain('COMPARE');
  });

  it('only the closest pair survives, as the deck — six numbers are not four of anything', () => {
    const svg = generateComparisonOG({ dyeIds: [sid(0), sid(5), sid(50), sid(90)] });
    expect(svg).toMatch(/↔.*· Δ\d+\.\d/);
    // The full six-pair run is gone; there is no sub-line to carry it
    expect(svg).not.toMatch(/Δ \d+\.\d · \d+\.\d/);
  });

  it('handles two dyes', () => {
    const svg = generateComparisonOG({ dyeIds: [sid(0), sid(5)] });
    expect(svg).toContain('CLOSEST PAIR');
  });

  it('the X frame moves the closest-pair Δ to the footer and keeps the band names', () => {
    const svg = generateComparisonOG({ dyeIds: [sid(0), sid(5), sid(50)], frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toMatch(/CLOSEST Δ\d+\.\d/);
    expect(svg).toContain('xivdyetools.app/comparison');
    // In-band content is unchanged by the degrade
    expect(svg).toContain('CLOSEST PAIR');
  });

  it('localizes the tool tag', () => {
    expect(generateComparisonOG({ dyeIds: [sid(0), sid(5)], locale: 'de' })).toContain('VERGLEICH');
    expect(generateComparisonOG({ dyeIds: [sid(0), sid(5)], locale: 'ja' })).toContain('比較');
  });

  it('fewer than two resolvable dyes renders the neutral state', () => {
    const svg = generateComparisonOG({ dyeIds: [999999] });
    expect(svg).toContain('NOT FOUND');
  });

  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R17): pins COMPARISON_MAX_DYES
  // to what the render actually does, not just to itself — og-data-generator.ts
  // trusts this constant to know how many ids the emitted image URL needs to
  // carry. If a future edit changed the `.slice(0, N)` above to a literal
  // number instead of the exported constant, this is what would catch the
  // drift (the shared-constant import cannot, by itself, catch a hand-edit
  // that stops using it).
  it('ids past COMPARISON_MAX_DYES render byte-identically to leaving them off', () => {
    const ids = [sid(0), sid(5), sid(50), sid(90)];
    expect(ids.length).toBe(COMPARISON_MAX_DYES);
    const exact = normalizeMarkUid(generateComparisonOG({ dyeIds: ids }));
    const withExtra = normalizeMarkUid(generateComparisonOG({ dyeIds: [...ids, sid(10), sid(20)] }));
    expect(withExtra).toBe(exact);
  });
});

// ---------------------------------------------------------------------------
// og-8 (deep dive 2026-09-02): the dye list was never deduplicated, and "the
// other dyes" was computed by object identity. `/og/comparison/1,1` is
// canonical, so the S7-R12 grammar accepts it; `getDyeByItemId(1)` returned
// the SAME object twice, `dyes.length === 2` cleared the `< 2` guard, and the
// card compared Snow White with itself — two identical CLOSEST PAIR bands
// over the deck `Snow White ↔ Snow White · Δ0.0`.
//
// The existing tests only ever feed distinct ids.
// ---------------------------------------------------------------------------
describe('og-8: a repeated id never produces a dye compared with itself', () => {
  it('one id repeated is one dye — not two, so the neutral state', () => {
    const svg = generateComparisonOG({ dyeIds: [sid(0), sid(0)] });
    expect(svg).toContain('NOT FOUND');
    expect(svg).not.toContain('CLOSEST PAIR');
    // The tell of the bug: a dye is Δ0.0 from itself.
    expect(svg).not.toContain('Δ0.0');
  });

  it('a duplicate renders byte-identically to leaving it off', () => {
    const distinct = [sid(0), sid(5), sid(50)];
    const clean = normalizeMarkUid(generateComparisonOG({ dyeIds: distinct }));
    const dupLeading = normalizeMarkUid(
      generateComparisonOG({ dyeIds: [sid(0), sid(0), sid(5), sid(50)] })
    );
    const dupInterior = normalizeMarkUid(
      generateComparisonOG({ dyeIds: [sid(0), sid(5), sid(0), sid(50)] })
    );
    expect(dupLeading).toBe(clean);
    expect(dupInterior).toBe(clean);
  });

  it('duplicates do not eat the four band slots', () => {
    // Pre-fix, this sliced to [0,0,5,50] and drew the first dye twice while
    // dropping sid(90) entirely.
    const withDup = normalizeMarkUid(
      generateComparisonOG({ dyeIds: [sid(0), sid(0), sid(5), sid(50), sid(90)] })
    );
    const four = normalizeMarkUid(
      generateComparisonOG({ dyeIds: [sid(0), sid(5), sid(50), sid(90)] })
    );
    expect(withDup).toBe(four);
  });
});
