/**
 * Mixer OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateMixerOG } from './mixer';
import { dyeService } from './dye-helpers';

const dyes = dyeService.getAllDyes();
const sid = (i: number): number => dyes[i].stainID ?? dyes[i].id;

describe('generateMixerOG (15E band)', () => {
  it('widths are the ratio; the mix rides the strip above the buyable band', () => {
    const svg = generateMixerOG({ dyeAId: sid(0), dyeBId: sid(20), ratio: 60 });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('A · 60%');
    expect(svg).toContain('B · 40%');
    expect(svg).toContain('BUYABLE');
    // The structural variant: the 46px mix strip
    expect(svg).toContain('height="46"');
    expect(svg).toContain('60/40');
  });

  it('handles the three-dye mix', () => {
    const svg = generateMixerOG({ dyeAId: sid(0), dyeBId: sid(20), dyeCId: sid(40), ratio: 50 });
    expect(svg).toContain('BUYABLE');
    expect(svg).toContain('>C<');
  });

  it('the X frame names the buyable dye', () => {
    const svg = generateMixerOG({ dyeAId: sid(0), dyeBId: sid(20), ratio: 30, frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('xivdyetools.app/mixer');
  });

  it('an unknown dye renders the neutral state, never throws', () => {
    const svg = generateMixerOG({ dyeAId: 999999, dyeBId: sid(1), ratio: 50 });
    expect(svg).toContain('NOT FOUND');
  });
});
