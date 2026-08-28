/**
 * Tests for the 14J·2 Colour sheet generator (/extractor color).
 */

import { describe, it, expect } from 'vitest';
import { generateNearestSheet, type NearestSheetOptions } from './nearest-sheet.js';

const LABELS = {
  target: 'TARGET',
  rank: 'RANK',
  nearest: 'NEAREST DYE',
  matchKey: 'nearest by ΔE2000',
};

const defaultOptions: NearestSheetOptions = {
  targetHex: '#4A6B8C',
  targetText: '#4A6B8C',
  rows: [
    { rank: 1, hex: '#3B6886', name: 'Peacock Blue', deltaE: 3.1 },
    { rank: 2, hex: '#437272', name: 'Turquoise Green', deltaE: 7.9 },
    { rank: 3, hex: '#273067', name: 'Royal Blue', deltaE: 11.4 },
    { rank: 4, hex: '#000B9D', name: 'Dragoon Blue', deltaE: 18.6 },
    { rank: 5, hex: '#284B2C', name: 'Hunter Green', deltaE: 24.2 },
  ],
  labels: LABELS,
  lang: 'en',
};

describe('generateNearestSheet', () => {
  it('returns a valid SVG at 400 wide within the ceiling', () => {
    const svg = generateNearestSheet(defaultOptions);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="400"');
    const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
  });

  it('names the subcommand in the chip', () => {
    const svg = generateNearestSheet(defaultOptions);
    expect(svg).toContain('/EXTRACTOR COLOR');
  });

  it('renders the target block and repeats the target down the pair column', () => {
    const svg = generateNearestSheet(defaultOptions);

    expect(svg).toContain('TARGET');
    expect(svg).toContain('#4A6B8C');
    // The target rail appears once per row plus the header swatch
    const count = (svg.match(/#4A6B8C/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(6);
  });

  it('prints ranks, names and tier-toned measures', () => {
    const svg = generateNearestSheet(defaultOptions);

    expect(svg).toContain('>1</text>');
    expect(svg).toContain('Peacock Blue');
    expect(svg).toContain('Hunter Green');
    // 24.2 is past the 20 cut → the far tier colour
    expect(svg).toContain('#f4645a');
    expect(svg).toContain('nearest by ΔE2000');
  });

  it('is method-aware: header tag, per-method tiers and decimals', () => {
    // ΔEOK: raw values, three decimals, its own band cuts (0.017 / 0.04 / 0.107)
    const svg = generateNearestSheet({
      ...defaultOptions,
      method: 'oklab',
      rows: [
        { rank: 1, hex: '#3B6886', name: 'Peacock Blue', deltaE: 0.012 },
        { rank: 2, hex: '#284B2C', name: 'Hunter Green', deltaE: 0.2 },
      ],
      labels: { ...LABELS, matchKey: 'nearest by ΔEOK' },
    });
    expect(svg).toContain('>ΔEOK</text>');
    expect(svg).toContain('>0.012</text>');
    expect(svg).toContain('>0.200</text>');
    // 0.2 is past ΔEOK's 0.107 cut → the far tier colour
    expect(svg).toContain('#f4645a');
    expect(svg).not.toContain('>ΔE</text>');

    // DISTINGUISH %: integer + %
    const pct = generateNearestSheet({
      ...defaultOptions,
      method: 'distinguish',
      rows: [{ rank: 1, hex: '#3B6886', name: 'Peacock Blue', deltaE: 4.6 }],
    });
    expect(pct).toContain('>DISTINGUISH %</text>');
    expect(pct).toContain('>5%</text>');
  });

  it('shows the resolved dye name when the input was a dye', () => {
    const svg = generateNearestSheet({ ...defaultOptions, targetText: 'Dalamudroter' });
    expect(svg).toContain('Dalamudroter');
  });

  it('caps at five rows', () => {
    const svg = generateNearestSheet({
      ...defaultOptions,
      rows: [
        ...defaultOptions.rows,
        { rank: 6, hex: '#111111', name: 'Sixth Dye', deltaE: 30 },
      ],
    });
    expect(svg).not.toContain('Sixth Dye');
  });

  it('renders the light theme surface', () => {
    const svg = generateNearestSheet({ ...defaultOptions, theme: 'light' });
    expect(svg).toContain('#FFFFFF');
  });
});
