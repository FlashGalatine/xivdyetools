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
    expect(svg).toContain('COMPARISON');
  });

  it('the six pair numbers survive only as a mono run in the sub-line', () => {
    const svg = generateComparisonOG({ dyeIds: [sid(0), sid(5), sid(50), sid(90)] });
    // The pair-Δ run (ellipsised to the sub-line's pixel budget)
    const sub = /Δ (\d+\.\d)( · \d+\.\d)+/.exec(svg);
    expect(sub).not.toBeNull();
  });

  it('handles two dyes', () => {
    const svg = generateComparisonOG({ dyeIds: [sid(0), sid(5)] });
    expect(svg).toContain('CLOSEST PAIR');
  });

  it('the X frame names the closest pair with its Δ', () => {
    const svg = generateComparisonOG({ dyeIds: [sid(0), sid(5), sid(50)], frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toMatch(/↔/);
    expect(svg).toContain('xivdyetools.app/comparison');
  });

  it('fewer than two resolvable dyes renders the neutral state', () => {
    const svg = generateComparisonOG({ dyeIds: [999999] });
    expect(svg).toContain('NOT FOUND');
  });
});
