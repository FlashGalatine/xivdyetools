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
    // The deck names the answer — the buyable dye
    expect(svg).toContain('font-size="14.5"');
  });

  it('handles the three-dye mix', () => {
    const svg = generateMixerOG({ dyeAId: sid(0), dyeBId: sid(20), dyeCId: sid(40), ratio: 50 });
    expect(svg).toContain('BUYABLE');
    expect(svg).toContain('>C<');
  });

  it('the X frame scales the mix strip ×0.66 and keeps the band names', () => {
    const svg = generateMixerOG({ dyeAId: sid(0), dyeBId: sid(20), ratio: 30, frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('xivdyetools.app/mixer');
    // 46 → 30, the degrade rule applied to the one structural variant
    expect(svg).toContain('height="30"');
    expect(svg).not.toContain('height="46"');
    // The buyable dye is the third band's own name; nothing had to move
    expect(svg).toContain('BUYABLE');
    // A 30% band is only 60px wide, so its role ellipsises to the pixel
    // budget — but it is drawn, which is the point: the X degrade changed
    // nothing in-band. (Proportion is the reading; a thin band is its cost.)
    expect(svg).toMatch(/>A ·/);
  });

  it('localizes the tool tag', () => {
    const de = generateMixerOG({ dyeAId: sid(0), dyeBId: sid(20), ratio: 60, locale: 'de' });
    expect(de).toContain('MISCHER');
  });

  it('an unknown dye renders the neutral state, never throws', () => {
    const svg = generateMixerOG({ dyeAId: 999999, dyeBId: sid(1), ratio: 50 });
    expect(svg).toContain('NOT FOUND');
  });
});
