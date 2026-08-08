/**
 * Tests for the 12H·2 gradient card generator + the colour helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  generateGradientCard,
  interpolateColor,
  generateGradientColors,
  type GradientCardOptions,
} from './gradient.js';

// ============================================================================
// Fixtures — the doc's Rose Pink → Wine Red six-step ramp
// ============================================================================

const strip = [
  { idealHex: '#E69F96', dyeHex: '#E69F96' },
  { idealHex: '#C67A71', dyeHex: '#C98A81' },
  { idealHex: '#A65951', dyeHex: '#C98A81' },
  { idealHex: '#853E37', dyeHex: '#913B27' },
  { idealHex: '#652721', dyeHex: '#781A1A' },
  { idealHex: '#451511', dyeHex: '#451511' },
];

const rows = [
  { stepText: '1', idealHex: '#E69F96', dyeHex: '#E69F96', name: 'Rose Pink', deltaE: 0.0 },
  { stepText: '2–3', idealHex: '#A65951', dyeHex: '#C98A81', name: 'Coral Pink', deltaE: 10.1 },
  { stepText: '4', idealHex: '#853E37', dyeHex: '#913B27', name: 'Blood Red', deltaE: 5.8 },
  { stepText: '5', idealHex: '#652721', dyeHex: '#781A1A', name: 'Dalamud Red', deltaE: 5.3 },
  { stepText: '6', idealHex: '#451511', dyeHex: '#451511', name: 'Wine Red', deltaE: 0.0 },
];

const defaultOptions: GradientCardOptions = {
  headerText: 'HSV · 6',
  strip,
  rows,
  legend: 'strip = every step · rows = the distinct dyes',
  lang: 'en',
};

// ============================================================================
// generateGradientCard
// ============================================================================

describe('generateGradientCard', () => {
  it('returns a valid SVG within the budget', () => {
    const svg = generateGradientCard(defaultOptions);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="400"');
    const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
  });

  it('renders the pill, the space/steps readout and the legend', () => {
    const svg = generateGradientCard(defaultOptions);

    expect(svg).toContain('/GRADIENT');
    expect(svg).toContain('HSV · 6');
    expect(svg).toContain('strip = every step');
    expect(svg).toContain('xivdyetools.app');
  });

  it('carries every step in the strip even when rows are fewer', () => {
    const svg = generateGradientCard(defaultOptions);
    // Six ideal caps, five rows — no contradiction between them
    for (const c of strip) expect(svg).toContain(c.idealHex);
    expect(svg).toContain('Coral Pink');
  });

  it('prints merged step ranges in the lead column', () => {
    const svg = generateGradientCard(defaultOptions);
    expect(svg).toContain('2–3');
  });

  it('caps rows at five', () => {
    const svg = generateGradientCard({
      ...defaultOptions,
      rows: [...rows, { stepText: '7', idealHex: '#111111', dyeHex: '#111111', name: 'Sixth Row', deltaE: 3 }],
    });
    expect(svg).not.toContain('Sixth Row');
  });

  it('renders the stage-0 verdict on a shorter card (12H·4)', () => {
    const twoRows = rows.slice(0, 2);
    const withVerdict = generateGradientCard({
      ...defaultOptions,
      rows: twoRows,
      verdict: '12 steps resolve to 2 dyes. Nothing in the game sits between them.',
    });
    const without = generateGradientCard({ ...defaultOptions });

    // The verdict wraps across text lines — assert a fragment within one line
    expect(withVerdict).toContain('resolve to 2 dyes.');
    const hv = Number(/height="(\d+)"/.exec(withVerdict)?.[1]);
    const h5 = Number(/height="(\d+)"/.exec(without)?.[1]);
    // Shorter than the five-row card — a height a card is allowed to take
    expect(hv).toBeLessThan(h5);
  });

  it('renders the light theme surface', () => {
    const svg = generateGradientCard({ ...defaultOptions, theme: 'light' });
    expect(svg).toContain('#FFFFFF');
  });
});

// ============================================================================
// Colour helpers
// ============================================================================

describe('interpolateColor', () => {
  it('returns the endpoints at 0 and 1', () => {
    expect(interpolateColor('#000000', '#ffffff', 0)).toBe('#000000');
    expect(interpolateColor('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('returns the midpoint at 0.5', () => {
    expect(interpolateColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('generateGradientColors', () => {
  it('generates the requested number of steps including endpoints', () => {
    const colors = generateGradientColors('#000000', '#ffffff', 5);
    expect(colors).toHaveLength(5);
    expect(colors[0]).toBe('#000000');
    expect(colors[4]).toBe('#ffffff');
  });

  it('handles stepCount 1 and 0 without NaN (BUG-063)', () => {
    expect(generateGradientColors('#123456', '#654321', 1)).toEqual(['#123456']);
    expect(generateGradientColors('#123456', '#654321', 0)).toEqual([]);
  });
});
