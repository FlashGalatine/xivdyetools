/**
 * Gradient OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateGradientOG } from './gradient';
import { dyeService } from './dye-helpers';

const dyes = dyeService.getAllDyes();
const sid = (i: number): number => dyes[i].stainID ?? dyes[i].id;

describe('generateGradientOG (15E band)', () => {
  it('renders endpoints as the dyes themselves and middles as matched dyes', () => {
    const svg = generateGradientOG({ startDyeId: sid(0), endDyeId: sid(10), steps: 5 });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="350"');
    expect(svg).toContain('START');
    expect(svg).toContain('END');
    // Middle bands are tagged with the Δ to their interpolated step
    expect(svg).toMatch(/Δ\d+\.\d/);
    expect(svg).toContain('GRADIENT');
  });

  it('clamps the step count to the band cap', () => {
    const svg = generateGradientOG({ startDyeId: sid(0), endDyeId: sid(10), steps: 12 });
    expect(svg).toContain('<svg');
    expect(svg).toContain('height="350"');
  });

  it('the X frame carries the endpoints line', () => {
    const svg = generateGradientOG({ startDyeId: sid(0), endDyeId: sid(10), steps: 4, frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('xivdyetools.app/gradient');
  });

  it('an unknown dye renders the neutral state, never throws', () => {
    const svg = generateGradientOG({ startDyeId: 999999, endDyeId: sid(1), steps: 4 });
    expect(svg).toContain('NOT FOUND');
  });
});
