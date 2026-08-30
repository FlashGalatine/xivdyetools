/**
 * Tests for the /swatch character sheet card (1a slots · 1b hardest).
 *
 * The card draws; the caller orders and caps. These tests pin the drawing
 * contract — the live-slot strip, the measuredRow lead shape, the OFF GRID
 * amber state — and deliberately do not assert an ordering the module
 * does not own.
 */

import { describe, it, expect } from 'vitest';
import { generateSwatchCard, type SwatchCardOptions, type SwatchCardRow } from './swatch-card.js';
import { CARD_DARK, CARD_LIGHT } from './frame.js';

/**
 * The ink `measuredRow` actually gives an OFF GRID sub-line.
 *
 * NOTE: `frame.ts` resolves `subTone: 'warn'` to `theme.tiers[2]`, so the
 * OFF-GRID state currently shares a token with the third *tier*. The module
 * docs describe the state amber as the separate `#F4BF4F`. This pins what
 * ships; reconciling the two is a design decision, not a test fix.
 */
const WARN_INK = CARD_DARK.tiers[2];

const LABELS = {
  lSlot: 'SLOT',
  lNearest: 'NEAREST DYE',
  footKey: 'nearest by ΔE2000 · 4 of 6 slots',
};

const row = (over: Partial<SwatchCardRow> = {}): SwatchCardRow => ({
  slotLabel: 'SKIN',
  addr: 'R6·C3',
  sourceHex: '#E0BFA8',
  dyeHex: '#D9BCA4',
  name: 'Bone White',
  deltaE: 3.4,
  ...over,
});

const defaultOptions: SwatchCardOptions = {
  stripHexes: ['#E0BFA8', '#3B2A20', '#6A8FA8', '#B54A5C'],
  charSub: 'Miqo\'te ♀ · Ktisis',
  title: 'Character swatch',
  rows: [
    row(),
    row({ slotLabel: 'HAIR', addr: 'R4·C7', sourceHex: '#3B2A20', dyeHex: '#3A2B23', name: 'Soot Black', deltaE: 1.8 }),
    row({ slotLabel: 'EYES', addr: 'R2·C1', sourceHex: '#6A8FA8', dyeHex: '#5E8CA6', name: 'Sky Blue', deltaE: 4.9 }),
    row({
      slotLabel: 'LIPS',
      addr: 'OFF GRID',
      addrWarn: true,
      sourceHex: '#B54A5C',
      dyeHex: '#A84B58',
      name: 'Rose Pink',
      deltaE: 22.6,
    }),
  ],
  labels: LABELS,
  lang: 'en',
};

const heightOf = (svg: string): number => Number(/height="(\d+)"/.exec(svg)?.[1]);

describe('generateSwatchCard', () => {
  it('renders a 400-wide SVG with the mark footer', () => {
    const svg = generateSwatchCard(defaultOptions);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="400"');
    expect(svg).toContain('xivdyetools.app');
    expect(heightOf(svg)).toBeGreaterThan(0);
  });

  it('names the command in the chip for both orders', () => {
    expect(generateSwatchCard(defaultOptions)).toContain('/SWATCH');
    // 1b is the same frame with a different caller ordering — same chip
    expect(generateSwatchCard({ ...defaultOptions, rows: [...defaultOptions.rows].reverse() })).toContain('/SWATCH');
  });

  it('accepts an overridden command label and a suppressed glyph', () => {
    const svg = generateSwatchCard({ ...defaultOptions, commandLabel: '/CHARACTER', commandGlyph: null });

    expect(svg).toContain('/CHARACTER');
    expect(svg).not.toContain('/SWATCH');
  });

  it('renders the identifier lines and the column heads', () => {
    const svg = generateSwatchCard(defaultOptions);

    expect(svg).toContain(defaultOptions.title);
    expect(svg).toContain('Miqo&apos;te ♀ · Ktisis');
    expect(svg).toContain('>SLOT</text>');
    expect(svg).toContain('NEAREST DYE');
    expect(svg).toContain('>ΔE</text>');
  });

  it('draws one clipped stripe per live slot colour', () => {
    const svg = generateSwatchCard(defaultOptions);

    expect(svg).toContain('clipPath id="swstrip"');
    for (const hex of defaultOptions.stripHexes) {
      expect(svg).toContain(hex);
    }
  });

  it('falls back to a single black stripe when no slots parsed', () => {
    const svg = generateSwatchCard({ ...defaultOptions, stripHexes: [] });

    expect(svg).toContain('#000000');
    expect(svg).not.toContain('NaN');
  });

  it('renders every row: slot label, address, dye name and measure', () => {
    const svg = generateSwatchCard(defaultOptions);

    for (const r of defaultOptions.rows) {
      expect(svg).toContain(r.slotLabel);
      expect(svg).toContain(r.name);
    }
    expect(svg).toContain('R6·C3');
    expect(svg).toContain('>3.4</text>');
  });

  it('flags an OFF GRID address in the warn ink, quiet label ink otherwise', () => {
    const warned = generateSwatchCard({ ...defaultOptions, rows: [defaultOptions.rows[3]] });
    const plain = generateSwatchCard({
      ...defaultOptions,
      rows: [{ ...defaultOptions.rows[3], addrWarn: false, addr: 'R1·C1' }],
    });

    expect(warned).toContain('OFF GRID');
    expect(warned).toContain(`>OFF GRID</text>`);
    expect(warned).toContain(`fill="${WARN_INK}" font-size="11"`);
    expect(plain).not.toContain('OFF GRID');
    expect(plain).toContain(`fill="${CARD_DARK.label}" font-size="11"`);
  });

  it('grows the frame with the live-slot count', () => {
    const oneRow = heightOf(generateSwatchCard({ ...defaultOptions, rows: [row()] }));
    const fourRows = heightOf(generateSwatchCard(defaultOptions));

    expect(fourRows).toBeGreaterThan(oneRow);
    // 46 px per measuredRow
    expect(fourRows - oneRow).toBe(46 * 3);
  });

  it('renders a rowless card without inventing a row', () => {
    const svg = generateSwatchCard({ ...defaultOptions, rows: [] });

    expect(svg).toContain('width="400"');
    expect(svg).not.toContain('Bone White');
    expect(svg).toContain('nearest by ΔE2000');
  });

  it('prints the generated count key from the caller', () => {
    const svg = generateSwatchCard(defaultOptions);
    expect(svg).toContain('nearest by ΔE2000 · 4 of 6 slots');
  });

  it('renders the light surface when asked', () => {
    const svg = generateSwatchCard({ ...defaultOptions, theme: 'light' });

    expect(svg).toContain(CARD_LIGHT.surface);
    expect(svg).not.toContain(CARD_DARK.surface);
  });

  it('escapes the title rather than emitting raw markup', () => {
    const svg = generateSwatchCard({ ...defaultOptions, title: '<script>x</script>' });

    expect(svg).toContain('&lt;script&gt;');
    expect(svg).not.toContain('<script>');
  });

  it('takes no character-name option — the title is the neutral card label only', () => {
    // Type-level guard (chara-name privacy, 3.0.0): `charName` was removed
    // and the card must never grow a name-shaped option again. If one is
    // re-added, the excess-property error below disappears and the
    // `@ts-expect-error` itself fails type-check.
    const options: SwatchCardOptions = {
      ...defaultOptions,
      // @ts-expect-error — no `charName` on SwatchCardOptions; pass a neutral `title`
      charName: 'Nunh Test',
    };
    const svg = generateSwatchCard(options);

    expect(svg).toContain(defaultOptions.title);
  });
});
