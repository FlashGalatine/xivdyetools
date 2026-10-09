/**
 * Tests for the /contrast pair-count router (13A · 13B · 13C·1).
 *
 * The pair count picks the frame — nothing picks it for the user — so the
 * router is asserted at each boundary. Polarity here is green = far apart =
 * safe, deliberately opposite the Dye Comparison tool, and the bands are
 * named by their ratio: a letter grade reaching the card is a regression.
 */

import { describe, it, expect } from 'vitest';
import {
  generateContrastCard,
  contrastRatio,
  formatContrastRatio,
  type ContrastCardOptions,
  type ContrastPair,
} from './contrast-card.js';
import { CARD_DARK, CARD_LIGHT } from './frame.js';

const LABELS = {
  worstPair: 'WORST PAIR',
  pairCol: 'PAIR',
  ratioCol: 'RATIO',
  ratioShort: 'RATIO',
  rest: 'REST',
  bands: ['under 3:1', '3:1', '4.5:1', '7:1'] as const,
  floorKey: 'non-text floor is 3:1 — WCAG 1.4.11',
  plotKey: 'ratio on a 1:1→21:1 log axis',
  title: 'Contrast — 3 dyes',
};

// Deliberately not the theme's own surface/name tokens — a swatch hex that
// collides with a theme token makes "renders the light surface" untestable.
const pair = (over: Partial<ContrastPair> = {}): ContrastPair => ({
  hexA: '#241E1B',
  hexB: '#F2E6D8',
  nameA: 'Soot Black',
  nameB: 'Snow White',
  abbrA: 'SOO',
  abbrB: 'SNO',
  ratio: 14.2,
  ...over,
});

const options = (pairs: ContrastPair[]): ContrastCardOptions => ({
  pairs,
  labels: LABELS,
  lang: 'en',
});

const heightOf = (svg: string): number => Number(/height="(\d+)"/.exec(svg)?.[1]);

/** The fill of the first `<text>` node whose whole content is `content` (undefined if none). */
const fillOfText = (svg: string, content: string): string | undefined => {
  const escaped = content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<text [^>]*fill="([^"]+)"[^>]*>${escaped}</text>`).exec(svg)?.[1];
};

describe('contrastRatio', () => {
  it('re-exports core rather than re-deriving the ladder', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#17171A', '#ECECEE')).toBeCloseTo(contrastRatio('#ECECEE', '#17171A'), 10);
  });
});

/**
 * BUG-142 — the one printer every surface uses (the card's four sites, the
 * /contrast embed, the /compare RATIO readout). It floors, never rounds, and
 * carries NO epsilon: the tier is judged on the raw ratio with `>=`, so the
 * printed figure must sit at or above a cut exactly when the raw ratio does.
 */
describe('formatContrastRatio', () => {
  /** The largest double strictly below `x` (x > 0): decrement its bit pattern. */
  const nextDown = (x: number): number => {
    const f = new Float64Array([x]);
    new BigUint64Array(f.buffer)[0] -= 1n;
    return f[0];
  };

  /** The printed figure read back as a number (either decimal separator). */
  const printed = (ratio: number, dp: number): number => Number(formatContrastRatio(ratio, dp).replace(',', '.'));

  // Why checking ONE double per cut proves the equivalence for every double:
  //
  //  - Both prints come from H = floor(fl(r × 100)), the ratio in whole
  //    hundredths; the 1 dp print is H truncated to tenths, floor(H / 10).
  //  - cut × 100 is an integer (300, 450, 700) and a multiple of 10, so
  //    floor(H / 10) ≥ cut × 10 ⇔ H ≥ cut × 100: at 1 dp as at 2 dp, the
  //    print reaches the cut exactly when H does.
  //  - cut × 100 is exactly representable, so H ≥ cut × 100 ⇔ fl(r × 100) ≥ cut × 100.
  //  - IEEE multiplication is monotone: r ≥ cut ⇒ fl(r × 100) ≥ fl(cut × 100) = cut × 100.
  //    So every r at or above the cut prints at or above it.
  //  - Every double below the cut is ≤ nextDown(cut), so by the same
  //    monotonicity its product is ≤ fl(nextDown(cut) × 100). If THAT is
  //    below cut × 100, every double below the cut prints below it.
  //
  // The removed `+ 1e-9` broke the last step: a ratio in [cut − 1e-11, cut)
  // printed the cut figure in the lower band's tone.
  describe.each([
    [3, 1],
    [3, 2],
    [4.5, 1],
    [4.5, 2],
    [7, 1],
    [7, 2],
  ])('cut %s at %s dp', (cut, dp) => {
    it('prints the cut itself at the cut — never demoted', () => {
      expect(printed(cut, dp)).toBe(cut);
    });

    it('prints the largest double below the cut below the cut', () => {
      const below = nextDown(cut);
      expect(below).toBeLessThan(cut);
      expect(printed(below, dp)).toBeLessThan(cut);
    });

    it('prints cut − 1e-12 below the cut (the epsilon printed the cut)', () => {
      expect(printed(cut - 1e-12, dp)).toBeLessThan(cut);
    });

    it('agrees with the raw `>=` on a sweep of doubles around the cut', () => {
      const offsets = [-1e-6, -1e-9, -1e-11, -1e-13, -1e-15, 0, 1e-15, 1e-13, 1e-11, 1e-9, 1e-6];
      let below = cut;
      const walk: number[] = [];
      for (let k = 0; k < 64; k++) walk.push((below = nextDown(below)));
      for (const r of [...offsets.map((o) => cut + o), ...walk]) {
        expect(printed(r, dp) >= cut).toBe(r >= cut);
      }
    });
  });

  it("prints the reviewer's real pair (/contrast #1C5F98 #190102) below 3", () => {
    const r = contrastRatio('#1C5F98', '#190102');
    // 2.9999999999993983 with core's formula — a hair under the cut
    expect(r).toBeLessThan(3);
    expect(r).toBeGreaterThan(3 - 1e-11);
    expect(formatContrastRatio(r)).toBe('2.99');
    expect(formatContrastRatio(r, 2)).toBe('2.99');
    expect(formatContrastRatio(r, 1)).toBe('2.9');
  });

  it('floors, never rounds — a third decimal ≥ 5 stays down', () => {
    expect(formatContrastRatio(2.995036513386356)).toBe('2.99');
    expect(formatContrastRatio(5.678)).toBe('5.67');
    expect(formatContrastRatio(6.96, 1)).toBe('6.9');
  });

  it('prints whole ratios at full precision', () => {
    expect(formatContrastRatio(1)).toBe('1.00');
    expect(formatContrastRatio(21)).toBe('21.00');
    expect(formatContrastRatio(21, 1)).toBe('21.0');
  });

  it('floors the double it is given: the literal 4.35 is 4.34999… and prints 4.34', () => {
    // A decimal literal is not exactly that decimal as a double — 4.35 is
    // stored as 4.3499999999999996447…, which IS below 4.35. Flooring it to
    // 4.34 is the honest figure; an epsilon that "fixed" this printed real
    // sub-cut ratios at the cut. Core's ratios are never grid literals.
    expect((4.35).toPrecision(20)).toBe('4.3499999999999996447');
    expect(formatContrastRatio(4.35)).toBe('4.34');
    expect(formatContrastRatio(4.3517)).toBe('4.35');
  });

  it('prints the 1 dp figure as the 2 dp figure truncated, so the two never disagree', () => {
    // Floored independently, the two precisions parted ways just under a
    // tenth: fl(r × 10) rounds UP to 36 while fl(r × 100) stays below 360, so
    // one ratio printed 3.6 at 1 dp and 3.59 at 2 dp.
    const r = 3.5999999999999996;
    expect(r).toBeLessThan(3.6);
    expect(r).toBe(nextDown(3.6));
    expect(formatContrastRatio(r, 2)).toBe('3.59');
    expect(formatContrastRatio(r, 1)).toBe('3.5');
  });

  it('agrees at 1 and 2 dp at and just under every tenth from 1.1 to 21.0', () => {
    for (let tenths = 11; tenths <= 210; tenths++) {
      for (const r of [tenths / 10, nextDown(tenths / 10)]) {
        for (const lang of ['en', 'de']) {
          const two = formatContrastRatio(r, 2, lang);
          expect(formatContrastRatio(r, 1, lang), `${r} (${lang})`).toBe(two.slice(0, -1));
        }
      }
    }
  });

  it("uses the language's decimal separator, like every card figure (F-08)", () => {
    expect(formatContrastRatio(2.995036513386356, 2, 'de')).toBe('2,99');
    expect(formatContrastRatio(2.995036513386356, 2, 'fr')).toBe('2,99');
    expect(formatContrastRatio(2.995036513386356, 2, 'ja')).toBe('2.99');
    expect(formatContrastRatio(2.995036513386356, 1, 'de')).toBe('2,9');
    // An unknown language falls back to English, the default
    expect(formatContrastRatio(2.995036513386356, 2, 'xx')).toBe('2.99');
  });
});

describe('generateContrastCard', () => {
  describe('frame contract', () => {
    it.each([
      ['13A', 1],
      ['13B', 3],
      ['13C·1', 6],
    ] as const)('%s renders a 400-wide SVG within the 350 ceiling', (_frame, count) => {
      const svg = generateContrastCard(options(Array.from({ length: count }, () => pair())));

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('width="400"');
      expect(heightOf(svg)).toBeLessThanOrEqual(350);
    });

    it.each([
      ['13A', 1],
      ['13B', 3],
      ['13C·1', 6],
    ] as const)('%s prints the chip and the mark footer', (_frame, count) => {
      const svg = generateContrastCard(options(Array.from({ length: count }, () => pair())));

      expect(svg).toContain('/CONTRAST');
      expect(svg).toContain('xivdyetools.app');
    });

    it.each([
      ['13A', 1],
      ['13B', 3],
      ['13C·1', 6],
    ] as const)('%s never prints a letter grade', (_frame, count) => {
      const svg = generateContrastCard(options(Array.from({ length: count }, () => pair())));

      expect(svg).not.toMatch(/>AAA?</);
    });

    it('accepts an overridden command label and a suppressed glyph', () => {
      const svg = generateContrastCard({ ...options([pair()]), commandLabel: '/A11Y CONTRAST', commandGlyph: null });
      expect(svg).toContain('/A11Y CONTRAST');
    });

    it('renders the light surface when asked', () => {
      const svg = generateContrastCard({ ...options([pair()]), theme: 'light' });

      expect(svg).toContain(CARD_LIGHT.surface);
      expect(svg).not.toContain(CARD_DARK.surface);
    });
  });

  describe('13A — one pair owns the card', () => {
    it('renders both names, the 2-dp ratio and the band name', () => {
      const svg = generateContrastCard(options([pair()]));

      expect(svg).toContain('Soot Black');
      expect(svg).toContain('Snow White');
      expect(svg).toContain('>14.20:1</text>');
      expect(svg).toContain('>RATIO</text>');
      expect(svg).toContain('7:1');
    });

    it('omits the WORST PAIR caption when there is only one pair', () => {
      expect(generateContrastCard(options([pair()]))).not.toContain('WORST PAIR');
    });

    it('leaves the REST strip absent by condition, not blank', () => {
      const alone = generateContrastCard(options([pair()]));
      expect(alone).not.toContain('>REST</text>');
    });

    it('never reaches its WORST PAIR / REST branches through the router', () => {
      // 13A's multi-pair decorations are only reachable if the router hands
      // it more than one pair — and it cannot: 2+ pairs route to 13B. This
      // pins that fact so the branches are not mistaken for live output.
      const only13A = generateContrastCard(options([pair()]));
      expect(only13A).not.toContain('WORST PAIR');
      expect(only13A).not.toContain('>REST</text>');

      // …and the frame 2 pairs actually reach is the ledger, which has neither
      const twoPairs = generateContrastCard(options([pair(), pair({ ratio: 3.3 })]));
      expect(twoPairs).not.toContain('WORST PAIR');
      expect(twoPairs).not.toContain('>REST</text>');
    });

    it('reads the ratio ramp in reverse — a high ratio is safe', () => {
      const safe = generateContrastCard(options([pair({ ratio: 14.2 })]));
      const failing = generateContrastCard(options([pair({ ratio: 1.4 })]));

      expect(safe).toContain(CARD_DARK.tiers[0]);
      expect(failing).toContain(CARD_DARK.tiers[3]);
    });

    it.each([
      [1.5, 3],
      [3.2, 2],
      [5.0, 1],
      [9.0, 0],
    ])('ratio %s lands on tier index %s of the ramp', (ratio, tierIndex) => {
      const svg = generateContrastCard(options([pair({ ratio })]));
      expect(svg).toContain(CARD_DARK.tiers[tierIndex]);
    });

    it('keeps a minimum band bar at a 1:1 ratio', () => {
      const svg = generateContrastCard(options([pair({ ratio: 1 })]));

      expect(svg).toContain('>1.00:1</text>');
      expect(svg).not.toContain('NaN');
      expect(svg).toContain('width="4.0"');
    });

    it('prints the WCAG floor key', () => {
      expect(generateContrastCard(options([pair()]))).toContain('non-text floor is 3:1');
    });

    it('throws on an empty pair list rather than drawing an empty verdict', () => {
      // 0 pairs routes to 13A, where the worst pair is undefined by
      // construction. The caller always has at least one pair (2 dyes).
      expect(() => generateContrastCard(options([]))).toThrow();
    });
  });

  describe('13B — the three-pair ledger', () => {
    const three = [
      pair({ ratio: 2.1, nameA: 'Dalamud Red', nameB: 'Wine Red', abbrA: 'DAL', abbrB: 'WIN' }),
      pair({ ratio: 6.4, nameA: 'Dalamud Red', nameB: 'Snow White', abbrA: 'DAL', abbrB: 'SNO' }),
      pair({ ratio: 9.9, nameA: 'Wine Red', nameB: 'Snow White', abbrA: 'WIN', abbrB: 'SNO' }),
    ];

    it('renders the localized title and the column heads', () => {
      const svg = generateContrastCard(options(three));

      expect(svg).toContain('Contrast — 3 dyes');
      expect(svg).toContain('>PAIR</text>');
      expect(svg).toContain('>RATIO</text>');
    });

    it('names every pair — no tail, no cap in play', () => {
      const svg = generateContrastCard(options(three));

      expect(svg).toContain('Dalamud Red');
      expect(svg).toContain('Wine Red');
      expect(svg).toContain('Snow White');
      expect(svg).toContain('>2.10:1</text>');
      expect(svg).toContain('>9.90:1</text>');
    });

    it('grows one 46 px row at a time', () => {
      const two = heightOf(generateContrastCard(options(three.slice(0, 2))));
      const all = heightOf(generateContrastCard(options(three)));

      expect(all - two).toBe(46);
    });
  });

  describe('13C·1 — the six-pair plot', () => {
    const six = Array.from({ length: 6 }, (_, i) =>
      pair({ ratio: 1 + i * 3.5, abbrA: `A${i}`, abbrB: `B${i}` })
    );

    it('renders the axis endpoints and the 3 / 4.5 / 7 criterion lines', () => {
      const svg = generateContrastCard(options(six));

      expect(svg).toContain('>1:1</text>');
      expect(svg).toContain('>21:1</text>');
      expect(svg).toContain('>3</text>');
      expect(svg).toContain('>4.5</text>');
      expect(svg).toContain('>7</text>');
      expect(svg).toContain('stroke-dasharray="3 3"');
    });

    it('prints pair codes and a one-decimal value column', () => {
      const svg = generateContrastCard(options(six));

      expect(svg).toContain('A0·B0');
      expect(svg).toContain('A5·B5');
      expect(svg).toContain('>18.5</text>');
      // one decimal — nothing in this tool acts on the second digit
      expect(svg).not.toContain('>18.50</text>');
    });

    it('draws a marker per pair on the log axis', () => {
      const svg = generateContrastCard(options(six));
      // r="4.5" is the plot marker; the app-mark footer also emits circles
      expect((svg.match(/<circle cx="[\d.]+" cy="[\d.]+" r="4\.5"/g) ?? []).length).toBe(6);
    });

    it('prints the plot legend and the value-column head', () => {
      const svg = generateContrastCard(options(six));

      expect(svg).toContain('ratio on a 1:1→21:1 log axis');
      expect(svg).toContain('Contrast — 3 dyes');
    });

    it('stays inside the ceiling at six pairs', () => {
      expect(heightOf(generateContrastCard(options(six)))).toBeLessThanOrEqual(350);
    });
  });

  // BUG-142: the tier is judged on the raw ratio (WCAG never rounds a
  // threshold), but the figure used to be printed ROUNDED — so a failing
  // 2.96 read "3.0" in the failing red, and a 6.96 read "7.0" one band short
  // of 7:1. The print is now floored to its precision through
  // formatContrastRatio, with no epsilon: every cut (3 / 4.5 / 7) sits on
  // both the 1 dp and the 2 dp grid, so the printed figure and the tone can
  // no longer disagree (proved per cut in the formatContrastRatio block).
  describe('the printed ratio never rounds across a band cut (BUG-142)', () => {
    const plot = (...ratios: number[]) =>
      options(ratios.map((ratio, i) => pair({ ratio, abbrA: `A${i}`, abbrB: `B${i}` })));

    it('13C·1 prints a failing 2.96 as 2.9 in the failing tone, never 3.0', () => {
      const svg = generateContrastCard(plot(2.96, 5, 8, 10, 12, 14));

      expect(svg).not.toContain('>3.0</text>');
      expect(fillOfText(svg, '2.9')).toBe(CARD_DARK.tiers[3]);
    });

    it('13C·1 prints a 6.96 as 6.9 in the 4.5:1 tone, never 7.0', () => {
      const svg = generateContrastCard(plot(2, 3.5, 6.96, 10, 12, 14));

      expect(svg).not.toContain('>7.0</text>');
      expect(fillOfText(svg, '6.9')).toBe(CARD_DARK.tiers[1]);
    });

    it('13B prints a failing 2.996 as 2.99:1, never 3.00:1', () => {
      const svg = generateContrastCard(
        options([pair({ ratio: 2.996 }), pair({ ratio: 5 }), pair({ ratio: 9 })]),
      );

      expect(svg).not.toContain('>3.00:1</text>');
      expect(fillOfText(svg, '2.99:1')).toBe(CARD_DARK.tiers[3]);
    });

    it('13B floors off-grid ratios to the hundredth below, in their own tone', () => {
      // Off-grid on purpose. A decimal literal like 4.35 is not exactly 4.35
      // as a double (it is 4.3499999999999996447…, genuinely below 4.35), so
      // its honest floor is 4.34 — the 1e-9 that used to hide that also
      // printed real sub-cut ratios at the cut. 1.1583 is the rounding case
      // (it would round to 1.16).
      const svg = generateContrastCard(
        options([pair({ ratio: 1.1583 }), pair({ ratio: 4.3517 }), pair({ ratio: 9 })]),
      );

      expect(fillOfText(svg, '1.15:1')).toBe(CARD_DARK.tiers[3]);
      expect(fillOfText(svg, '4.35:1')).toBe(CARD_DARK.tiers[2]);
      expect(svg).not.toContain('>1.16:1</text>');
    });

    it("13A prints the reviewer's real sub-3 pair as 2.99:1 in the failing tone, never 3.00:1", () => {
      // /contrast #1C5F98 #190102 — core gives 2.9999999999993983. The old
      // `+ 1e-9` printed it as "3.00:1" in the failing tone, under "under 3:1".
      const ratio = contrastRatio('#1C5F98', '#190102');
      const svg = generateContrastCard(options([pair({ hexA: '#1C5F98', hexB: '#190102', ratio })]));

      expect(svg).not.toContain('>3.00:1</text>');
      expect(fillOfText(svg, '2.99:1')).toBe(CARD_DARK.tiers[3]);
      expect(fillOfText(svg, 'under 3:1')).toBe(CARD_DARK.tiers[3]);
    });

    it("13C·1 prints the reviewer's real sub-3 pair as 2.9 in the failing tone, never 3.0", () => {
      const ratio = contrastRatio('#1C5F98', '#190102');
      const svg = generateContrastCard(plot(ratio, 5, 8, 10, 12, 14));

      expect(svg).not.toContain('>3.0</text>');
      expect(fillOfText(svg, '2.9')).toBe(CARD_DARK.tiers[3]);
    });

    it('13A prints a failing 2.996 as 2.99:1 under the failing band', () => {
      const svg = generateContrastCard(options([pair({ ratio: 2.996 })]));

      expect(svg).not.toContain('>3.00:1</text>');
      expect(fillOfText(svg, '2.99:1')).toBe(CARD_DARK.tiers[3]);
      expect(fillOfText(svg, 'under 3:1')).toBe(CARD_DARK.tiers[3]);
    });

    it('13A prints a 6.999 as 6.99:1 under the 4.5:1 band, never 7.00:1', () => {
      const svg = generateContrastCard(options([pair({ ratio: 6.999 })]));

      expect(svg).not.toContain('>7.00:1</text>');
      expect(fillOfText(svg, '6.99:1')).toBe(CARD_DARK.tiers[1]);
      expect(fillOfText(svg, '4.5:1')).toBe(CARD_DARK.tiers[1]);
    });

    it('never demotes a ratio sitting exactly on a cut', () => {
      const svg = generateContrastCard(options([pair({ ratio: 3 })]));

      expect(fillOfText(svg, '3.00:1')).toBe(CARD_DARK.tiers[2]);
      expect(fillOfText(svg, '3:1')).toBe(CARD_DARK.tiers[2]);
    });
  });

  describe('router boundaries', () => {
    const many = (n: number) => options(Array.from({ length: n }, (_, i) => pair({ ratio: 1 + i * 2 })));

    it('routes on the pair count: ≤1 → 13A, 2–3 → 13B, 4+ → the plot', () => {
      // 13A alone prints the 30 px ratio; 13B alone prints the ledger title;
      // 13C·1 alone prints the axis endpoints.
      expect(generateContrastCard(many(1))).toContain('font-size="30"');
      expect(generateContrastCard(many(2))).toContain('Contrast — 3 dyes');
      expect(generateContrastCard(many(3))).toContain('Contrast — 3 dyes');
      expect(generateContrastCard(many(4))).toContain('>21:1</text>');
      expect(generateContrastCard(many(6))).toContain('>21:1</text>');
    });

    it('is total over the real dye counts — 2, 3 and 4 dyes give 1, 3 and 6 pairs', () => {
      for (const pairCount of [1, 3, 6]) {
        const svg = generateContrastCard(many(pairCount));
        expect(svg).toContain('width="400"');
        expect(heightOf(svg)).toBeLessThanOrEqual(350);
      }
    });
  });
});
