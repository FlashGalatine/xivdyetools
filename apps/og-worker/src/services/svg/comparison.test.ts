/**
 * Comparison OG tests — the 15E band adapter (a qualified acceptance).
 */
import { describe, it, expect } from 'vitest';
import { generateComparisonOG } from './comparison';
import { dyeService } from './dye-helpers';

const dyes = dyeService.getAllDyes();
const sid = (i: number): number => dyes[i].stainID ?? dyes[i].id;

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
});
