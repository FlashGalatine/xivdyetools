/**
 * Tests for the /contrast pair-count router (13A · 13B · 13C·1).
 *
 * The pair count picks the frame — nothing picks it for the user — so the
 * router is asserted at each boundary. Polarity here is green = far apart =
 * safe, deliberately opposite the Dye Comparison tool, and the bands are
 * named by their ratio: a letter grade reaching the card is a regression.
 */

import { describe, it, expect } from 'vitest';
import { generateContrastCard, contrastRatio, type ContrastCardOptions, type ContrastPair } from './contrast-card.js';
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

describe('contrastRatio', () => {
  it('re-exports core rather than re-deriving the ladder', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#17171A', '#ECECEE')).toBeCloseTo(contrastRatio('#ECECEE', '#17171A'), 10);
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
