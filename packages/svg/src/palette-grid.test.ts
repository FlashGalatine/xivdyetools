/**
 * Tests for the 14K Ramp generator (/extractor image).
 *
 * generatePaletteGrid is a pure function (options → SVG string). Tests
 * assert structural validity, the all-colours band with its minimum-slice
 * floor, the top-five row cap, and the measured-row content.
 */

import { describe, it, expect } from 'vitest';
import {
  generatePaletteGrid,
  bandSlices,
  type PaletteGridOptions,
  type PaletteRowEntry,
} from './palette-grid.js';

// ============================================================================
// Fixtures
// ============================================================================

function row(share: number, name: string, extractedHex: string, matchedHex: string, deltaE = 6): PaletteRowEntry {
  return { share, extractedHex, matchedHex, matchedName: name, deltaE };
}

const LABELS = { share: 'SHARE', matched: 'MATCHED DYE', rampKey: 'band width = share of image' };

const fiveRows = [
  row(42, 'Wine Red', '#451812', '#451511', 4.2),
  row(23, 'Hunter Green', '#2A4B2E', '#284B2C', 2.1),
  row(18, 'Peacock Blue', '#3D6A88', '#3B6886', 3.3),
  row(10, 'Ul Brown', '#B5A26E', '#B7A370', 1.8),
  row(7, 'Soot Black', '#20201F', '#1C1C1C', 5.5),
];

const defaultOptions: PaletteGridOptions = {
  title: 'Palette from image',
  band: fiveRows.map((r) => ({ hex: r.extractedHex, share: r.share })),
  rows: fiveRows,
  labels: LABELS,
  lang: 'en',
};

// ============================================================================
// bandSlices
// ============================================================================

describe('bandSlices', () => {
  it('divides the width proportionally to share', () => {
    const slices = bandSlices(
      [
        { hex: '#111111', share: 50 },
        { hex: '#222222', share: 50 },
      ],
      368
    );
    expect(slices[0]).toBeCloseTo(184);
    expect(slices[1]).toBeCloseTo(184);
  });

  it('floors tiny slices so the tenth colour never disappears', () => {
    const slices = bandSlices(
      [
        { hex: '#111111', share: 98 },
        { hex: '#222222', share: 2 },
      ],
      368
    );
    expect(slices[1]).toBeGreaterThanOrEqual(7);
    // The remainder comes off the largest band; total is preserved
    expect(slices[0] + slices[1]).toBeCloseTo(368);
  });

  it('keeps the total width with many floored slices', () => {
    const entries = [
      { hex: '#000001', share: 91 },
      ...Array.from({ length: 9 }, (_, i) => ({ hex: `#00000${i + 2}`, share: 1 })),
    ];
    const slices = bandSlices(entries, 368);
    expect(slices.reduce((a, b) => a + b, 0)).toBeCloseTo(368);
    for (const s of slices.slice(1)) expect(s).toBeGreaterThanOrEqual(7);
  });
});

// ============================================================================
// generatePaletteGrid
// ============================================================================

describe('generatePaletteGrid', () => {
  it('returns a valid SVG at 400 wide reaching 350 at five rows', () => {
    const svg = generatePaletteGrid(defaultOptions);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="400"');
    const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
  });

  it('names the subcommand in the chip — a glyph cannot', () => {
    const svg = generatePaletteGrid(defaultOptions);
    expect(svg).toContain('/EXTRACTOR IMAGE');
  });

  it('carries every band colour even when rows cap at five', () => {
    const tenBand = Array.from({ length: 10 }, (_, i) => ({
      hex: `#10203${i}`,
      share: i === 0 ? 46 : 6,
    }));
    const svg = generatePaletteGrid({
      ...defaultOptions,
      band: tenBand,
      rows: fiveRows,
    });

    for (const b of tenBand) expect(svg).toContain(b.hex);
    // Rows stay a top five
    expect(svg).toContain('Wine Red');
    expect(svg).toContain('Soot Black');
  });

  it('caps rows at five even if more are passed', () => {
    const svg = generatePaletteGrid({
      ...defaultOptions,
      rows: [...fiveRows, row(3, 'Sixth Dye', '#123456', '#123457')],
    });
    expect(svg).not.toContain('Sixth Dye');
  });

  it('prints share leads, the labels row and the legend', () => {
    const svg = generatePaletteGrid(defaultOptions);

    expect(svg).toContain('>42%</text>');
    expect(svg).toContain('SHARE');
    expect(svg).toContain('MATCHED DYE');
    expect(svg).toContain('band width = share of image');
    expect(svg).toContain('xivdyetools.app');
  });

  it('localizes ΔE decimals through the lang', () => {
    const svg = generatePaletteGrid({ ...defaultOptions, lang: 'de' });
    // 4.2 → 4,2
    expect(svg).toContain('4,2');
  });

  it('renders the light theme surface', () => {
    const svg = generatePaletteGrid({ ...defaultOptions, theme: 'light' });
    expect(svg).toContain('#FFFFFF');
  });
});
