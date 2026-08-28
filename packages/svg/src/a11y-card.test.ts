/**
 * Tests for the /accessibility card (13D lens · 13E all · 13H solo).
 *
 * The three frames are a router on `mode`, not a scaling layout, so each one
 * is asserted on its own geometry. Separation polarity is the thing most
 * likely to regress: larger ΔE is *safer* here, the opposite of a match tier.
 */

import { describe, it, expect } from 'vitest';
import { generateA11yCard, type A11yCardOptions, type A11yLensRow } from './a11y-card.js';
import { CARD_DARK, CARD_LIGHT } from './frame.js';

const LABELS = {
  designed: 'AS DESIGNED',
  perceived: 'AS PERCEIVED',
  separation: 'SEPARATION',
  normalShort: 'NORMAL',
  lens: 'LENS',
  shift: 'SHIFT',
  sepBandKey: 'separation by ΔE2000 — larger is safer',
  soloKey: 'shift by ΔE2000 — relative to the largest',
  worstNote: 'weakest: Deuteranopia',
};

const row = (over: Partial<A11yLensRow> = {}): A11yLensRow => ({
  label: 'Deuteranopia',
  short: 'DEUT',
  deltaE: 12.4,
  hexA: '#B54A3C',
  hexB: '#3C6BB5',
  ...over,
});

const lensOptions: A11yCardOptions = {
  mode: 'lens',
  titleText: 'Dalamud Red ↔ Royal Blue',
  subject: row(),
  normalDeltaE: 41.8,
  rows: [
    row({ label: 'Protanopia', short: 'PROT', deltaE: 9.2 }),
    row({ label: 'Tritanopia', short: 'TRIT', deltaE: 33.5 }),
    row({ label: 'Achromatopsia', short: 'ACHR', deltaE: 4.1 }),
  ],
  labels: LABELS,
  lang: 'en',
};

const allOptions: A11yCardOptions = {
  mode: 'all',
  titleText: 'Dalamud Red ↔ Royal Blue',
  rows: [
    row({ label: 'Normal', short: 'NORM', deltaE: 41.8, isNormal: true }),
    row({ label: 'Protanopia', short: 'PROT', deltaE: 9.2 }),
    row({ label: 'Deuteranopia', short: 'DEUT', deltaE: 12.4 }),
    row({ label: 'Tritanopia', short: 'TRIT', deltaE: 33.5 }),
    row({ label: 'Achromatopsia', short: 'ACHR', deltaE: 4.1 }),
  ],
  labels: LABELS,
  lang: 'en',
};

const soloOptions: A11yCardOptions = {
  mode: 'solo',
  titleText: 'Dalamud Red',
  rows: [
    row({ label: 'Normal', short: 'NORM', deltaE: 0, isNormal: true, hexA: '#B54A3C', hexB: undefined }),
    row({ label: 'Protanopia', short: 'PROT', deltaE: 18.2, hexA: '#7a6b3c', hexB: undefined }),
    row({ label: 'Deuteranopia', short: 'DEUT', deltaE: 14.9, hexA: '#8b7340', hexB: undefined }),
    row({ label: 'Tritanopia', short: 'TRIT', deltaE: 6.3, hexA: '#b04b52', hexB: undefined }),
  ],
  labels: LABELS,
  lang: 'en',
};

const heightOf = (svg: string): number => Number(/height="(\d+)"/.exec(svg)?.[1]);

describe('generateA11yCard', () => {
  describe('frame contract (all modes)', () => {
    it.each([
      ['lens', lensOptions],
      ['all', allOptions],
      ['solo', soloOptions],
    ] as const)('%s renders a 400-wide SVG within the 350 ceiling', (_mode, options) => {
      const svg = generateA11yCard(options);

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('width="400"');
      expect(heightOf(svg)).toBeLessThanOrEqual(350);
      expect(heightOf(svg)).toBeGreaterThan(0);
    });

    it.each([
      ['lens', lensOptions],
      ['all', allOptions],
      ['solo', soloOptions],
    ] as const)('%s prints the mark footer and the default chip', (_mode, options) => {
      const svg = generateA11yCard(options);

      expect(svg).toContain('/ACCESSIBILITY');
      expect(svg).toContain('xivdyetools.app');
    });

    it('prints the command the user actually typed', () => {
      const svg = generateA11yCard({ ...lensOptions, commandLabel: '/A11Y' });

      expect(svg).toContain('/A11Y');
      expect(svg).not.toContain('/ACCESSIBILITY');
    });

    it('honours an explicitly suppressed glyph', () => {
      const withGlyph = generateA11yCard(lensOptions);
      const without = generateA11yCard({ ...lensOptions, commandGlyph: null });

      expect(without.length).toBeLessThan(withGlyph.length);
      expect(without).toContain('/ACCESSIBILITY');
    });

    it('renders the light surface when asked', () => {
      const svg = generateA11yCard({ ...lensOptions, theme: 'light' });

      expect(svg).toContain(CARD_LIGHT.surface);
      expect(svg).not.toContain(CARD_DARK.surface);
    });

    it('escapes card text rather than emitting raw markup', () => {
      const svg = generateA11yCard({ ...soloOptions, titleText: 'Red <& "Blue">' });

      expect(svg).toContain('&lt;');
      expect(svg).toContain('&amp;');
      expect(svg).not.toContain('Red <&');
    });
  });

  describe('13D — the named lens', () => {
    it('puts the lens name in the header and the pair in the title', () => {
      const svg = generateA11yCard(lensOptions);

      expect(svg).toContain('Deuteranopia');
      expect(svg).toContain('Dalamud Red ↔ Royal Blue');
      expect(svg).toContain('AS DESIGNED');
      expect(svg).toContain('AS PERCEIVED');
    });

    it('renders the subject separation and the normal reference', () => {
      const svg = generateA11yCard(lensOptions);

      expect(svg).toContain('>12.4</text>');
      expect(svg).toContain('>41.8</text>');
      expect(svg).toContain('SEPARATION · DEUT');
      expect(svg).toContain('NORMAL');
    });

    it('omits the normal reference when no unsimulated value was supplied', () => {
      const { normalDeltaE: _drop, ...rest } = lensOptions;
      const svg = generateA11yCard(rest as A11yCardOptions);

      expect(svg).not.toContain('>41.8</text>');
      expect(svg).not.toContain('NORMAL');
    });

    it('draws the summary strip for the remaining lenses', () => {
      const svg = generateA11yCard(lensOptions);

      expect(svg).toContain('>PROT</text>');
      expect(svg).toContain('>TRIT</text>');
      expect(svg).toContain('>ACHR</text>');
    });

    it('renders a single swatch when the subject has no second colour', () => {
      const svg = generateA11yCard({
        ...lensOptions,
        subject: row({ hexB: undefined }),
      });

      expect((svg.match(/#B54A3C/g) ?? []).length).toBeGreaterThanOrEqual(1);
      expect(svg).not.toContain('#3C6BB5');
    });

    it('survives an empty summary strip without dividing by zero', () => {
      const svg = generateA11yCard({ ...lensOptions, rows: [] });

      expect(svg).toContain('width="400"');
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('Infinity');
    });

    it('falls back to the all-lens frame when mode is lens but no subject was given', () => {
      const { subject: _drop, ...rest } = lensOptions;
      const svg = generateA11yCard(rest as A11yCardOptions);

      // 13E's column headers, not 13D's AS DESIGNED / AS PERCEIVED pair
      expect(svg).toContain('>LENS</text>');
      expect(svg).not.toContain('AS DESIGNED');
    });
  });

  describe('13E — every lens', () => {
    it('renders the LENS / SEPARATION column heads and one row per lens', () => {
      const svg = generateA11yCard(allOptions);

      expect(svg).toContain('>LENS</text>');
      expect(svg).toContain('>SEPARATION</text>');
      for (const label of ['Normal', 'Protanopia', 'Deuteranopia', 'Tritanopia', 'Achromatopsia']) {
        expect(svg).toContain(label);
      }
    });

    it('prints the weakest-lens note and the band key under the table', () => {
      const svg = generateA11yCard(allOptions);

      expect(svg).toContain('weakest: Deuteranopia');
      expect(svg).toContain('separation by ΔE2000');
    });

    it('reads the separation ramp in reverse — larger ΔE is safer', () => {
      const safe = generateA11yCard({
        ...allOptions,
        rows: [row({ label: 'Tritanopia', short: 'TRIT', deltaE: 44 })],
      });
      const merged = generateA11yCard({
        ...allOptions,
        rows: [row({ label: 'Tritanopia', short: 'TRIT', deltaE: 2 })],
      });

      // separation cuts are 8 / 15 / 30 ascending → 44 is the top tier
      expect(safe).toContain(CARD_DARK.tiers[0]);
      expect(safe).not.toContain(CARD_DARK.tiers[3]);
      // …and 2 is merged
      expect(merged).toContain(CARD_DARK.tiers[3]);
      expect(merged).not.toContain(CARD_DARK.tiers[0]);
    });

    it('grows with the row count and still clears the ceiling at five lenses', () => {
      const two = heightOf(generateA11yCard({ ...allOptions, rows: allOptions.rows.slice(0, 2) }));
      const all = heightOf(generateA11yCard(allOptions));

      expect(all).toBeGreaterThan(two);
      expect(all).toBeLessThanOrEqual(350);
    });
  });

  describe('13H — the single dye', () => {
    it('renders the SHIFT column instead of a verdict', () => {
      const svg = generateA11yCard(soloOptions);

      expect(svg).toContain('>SHIFT</text>');
      expect(svg).toContain('>LENS</text>');
      expect(svg).not.toContain('SEPARATION');
      expect(svg).toContain('shift by ΔE2000');
    });

    it('prints the simulated hex uppercased so it is pasteable', () => {
      const svg = generateA11yCard(soloOptions);

      expect(svg).toContain('>#7A6B3C</text>');
      expect(svg).toContain('>#B04B52</text>');
    });

    it('uses neutral ink for the bars — a shift is not a risk', () => {
      const svg = generateA11yCard(soloOptions);

      expect(svg).toContain(`height="5" rx="2.5" fill="${CARD_DARK.subValue}"`);
      expect(svg).not.toContain(CARD_DARK.tiers[3]);
    });

    it('keeps a minimum bar width when every shift is zero', () => {
      const svg = generateA11yCard({
        ...soloOptions,
        rows: [row({ deltaE: 0, hexA: '#B54A3C', hexB: undefined })],
      });

      expect(svg).not.toContain('NaN');
      expect(svg).toContain('width="2.0"');
    });
  });
});
