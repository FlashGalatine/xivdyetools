/**
 * Tests for the /contrast command (13A/13B/13C·1 router).
 */

import { describe, it, expect } from 'vitest';
import { executeContrast } from './contrast.js';

const white = { hex: '#F0EBE0', name: 'Snow White', itemID: 5729 };
const black = { hex: '#2B2923', name: 'Soot Black', itemID: 5730 };
const red = { hex: '#781A1A', name: 'Dalamud Red', itemID: 5738 };
const blue = { hex: '#273067', name: 'Royal Blue', itemID: 5773 };

describe('executeContrast', () => {
  it('routes two dyes to 13A — the worst pair gets the whole card', async () => {
    const result = await executeContrast({ dyes: [white, black], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.pairs).toHaveLength(1);
    expect(result.svgString).toContain('/CONTRAST');
    expect(result.svgString).toContain(':1');
    // One pair: the REST strip is absent by condition, not blank
    expect(result.svgString).not.toContain('REST');
  });

  it('routes three dyes to 13B — every pair named', async () => {
    const result = await executeContrast({ dyes: [white, black, red], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.pairs).toHaveLength(3);
    expect(result.svgString).toContain('Snow White');
    expect(result.svgString).toContain('PAIR');
  });

  it('routes four dyes to 13C·1 — the plot with the value column', async () => {
    const result = await executeContrast({ dyes: [white, black, red, blue], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.pairs).toHaveLength(6);
    // Axis endpoints + the shipped short column header
    expect(result.svgString).toContain('1:1');
    expect(result.svgString).toContain('21:1');
    expect(result.svgString).toContain('RATIO');
  });

  it('sorts pairs worst-first and leads the embed with the worst', async () => {
    const result = await executeContrast({ dyes: [white, black, red], locale: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (let i = 1; i < result.pairs.length; i++) {
      expect(result.pairs[i].ratio).toBeGreaterThanOrEqual(result.pairs[i - 1].ratio);
    }
    expect(result.embed.description).toContain(':1');
  });

  it('polarity: a high-contrast pair reads green, a near pair reads red', async () => {
    const high = await executeContrast({ dyes: [white, black], locale: 'en' });
    const low = await executeContrast({ dyes: [red, { ...red, name: 'Rust Red', hex: '#622207', itemID: 5741 }], locale: 'en' });
    expect(high.ok && low.ok).toBe(true);
    if (!high.ok || !low.ok) return;
    // green = far apart = safe (dark ramp tier colours)
    expect(high.svgString).toContain('#5bbd68');
    expect(low.svgString).toContain('#f4645a');
  });

  it('localizes the German column header (VERH.)', async () => {
    const result = await executeContrast({ dyes: [white, black, red, blue], locale: 'de' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('VERH.');
  });
});
