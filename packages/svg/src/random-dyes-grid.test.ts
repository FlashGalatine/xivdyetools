/**
 * Tests for the 11B Random Dyes table generator.
 *
 * generateRandomDyesGrid is a pure function (options → SVG string). Tests
 * assert structural validity, table content, the R1 five-row cap, and the
 * grow-with-count height rule.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRandomDyesGrid,
  type RandomDyeRow,
  type RandomDyesGridOptions,
} from './random-dyes-grid.js';

// ============================================================================
// Test fixtures
// ============================================================================

function makeRow(stain: number, name: string, hex: string, category = 'Reds'): RandomDyeRow {
  return { hex, localizedName: name, localizedCategory: category, stainID: stain };
}

const fiveRows: RandomDyeRow[] = [
  makeRow(82, 'Lotus Pink', '#FECEF5', 'Purples'),
  makeRow(52, 'Hunter Green', '#284B2C', 'Greens'),
  makeRow(35, 'Ul Brown', '#B7A370', 'Yellows'),
  makeRow(63, 'Peacock Blue', '#3B6886', 'Blues'),
  makeRow(12, 'Wine Red', '#451511', 'Reds'),
];

const defaultOptions: RandomDyesGridOptions = {
  dyes: fiveRows,
  title: 'Random Dyes',
  labels: { name: 'DYE', cat: 'CATEGORY', stain: 'STAIN' },
};

// ============================================================================
// generateRandomDyesGrid
// ============================================================================

describe('generateRandomDyesGrid', () => {
  it('returns a valid SVG table at 400 wide', () => {
    const svg = generateRandomDyesGrid(defaultOptions);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="400"');
    expect(svg).toContain('</svg>');
  });

  it('renders the title, the pill and the header row', () => {
    const svg = generateRandomDyesGrid(defaultOptions);

    expect(svg).toContain('Random Dyes');
    expect(svg).toContain('/DYE RANDOM');
    expect(svg).toContain('>DYE</text>');
    expect(svg).toContain('CATEGORY');
    expect(svg).toContain('STAIN');
  });

  it('prints every row with name, hex, category and stain', () => {
    const svg = generateRandomDyesGrid(defaultOptions);

    for (const row of fiveRows) {
      expect(svg).toContain(row.localizedName);
      expect(svg).toContain(row.hex.toUpperCase());
      expect(svg).toContain(`>${row.stainID}</text>`);
    }
  });

  it('five rows plus a header is exactly what 350 buys', () => {
    const svg = generateRandomDyesGrid(defaultOptions);
    const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
    expect(height).toBeGreaterThan(330);
  });

  it('grows with the count — a shorter result is a shorter card', () => {
    const two = generateRandomDyesGrid({ ...defaultOptions, dyes: fiveRows.slice(0, 2) });
    const five = generateRandomDyesGrid(defaultOptions);
    const h2 = Number(/height="(\d+)"/.exec(two)?.[1]);
    const h5 = Number(/height="(\d+)"/.exec(five)?.[1]);
    expect(h2).toBeLessThan(h5);
  });

  it('caps at five rows (R1)', () => {
    const svg = generateRandomDyesGrid({
      ...defaultOptions,
      dyes: [...fiveRows, makeRow(99, 'Sixth Dye', '#123456')],
    });
    expect(svg).not.toContain('Sixth Dye');
  });

  it('escapes XML in localized names', () => {
    const svg = generateRandomDyesGrid({
      ...defaultOptions,
      dyes: [makeRow(1, 'A <&> Dye', '#101010')],
    });
    expect(svg).toContain('A &lt;&amp;&gt; Dye');
  });

  it('renders the light theme surface', () => {
    const svg = generateRandomDyesGrid({ ...defaultOptions, theme: 'light' });
    expect(svg).toContain('#FFFFFF');
  });

  it('carries the mark and never an instruction', () => {
    const svg = generateRandomDyesGrid(defaultOptions);
    expect(svg).toContain('xivdyetools.app');
    expect(svg).not.toContain('Run again');
  });
});
