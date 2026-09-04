/**
 * Mixer OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateMixerOG } from './mixer';
import { dyeService } from './dye-helpers';
import { blendColors } from '@xivdyetools/core/blending';

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

  describe('the card mixes in the mode the sharer chose', () => {
    /**
     * The web mixer offers six mixing modes and its share URL carries the
     * chosen one as `?mode=`. This card hardcoded `mixColorsLab`, so every
     * shared mix rendered in CIELAB whatever the user had picked — including
     * the web tool's DEFAULT, which is `ryb`. The front end selects and core
     * computes; substituting a different algorithm at the render step breaks
     * that in the one place the user cannot see it happening.
     *
     * ⚠️ These assert on the emitted MIX COLOUR, never on the SVG string.
     * `generateMixerOG` is deliberately non-deterministic: the shared OG mark
     * mints a fresh `clipPath` id per render (`ogm0b`, `ogm1b`, …), so two
     * identical calls return different strings and `expect(x).not.toBe(y)`
     * over whole cards passes no matter what the generator does.
     */
    const dyeA = dyes[0];
    const dyeB = dyes[20];
    const pair = { dyeAId: sid(0), dyeBId: sid(20), ratio: 50 };

    /** The mix strip's fill — the one pixel the mode actually decides. */
    const mixFill = (svg: string): string[] =>
      [...svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase());

    it.each(['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral'] as const)(
      '%s: the card paints the mix that mode computes',
      (mode) => {
        const expected = blendColors(dyeA.hex, dyeB.hex, mode, 0.5).hex.toLowerCase();
        expect(mixFill(generateMixerOG({ ...pair, mode }))).toContain(expected);
      },
    );

    it("defaults to the web mixer's own default (ryb), not lab", () => {
      const ryb = blendColors(dyeA.hex, dyeB.hex, 'ryb', 0.5).hex.toLowerCase();
      const lab = blendColors(dyeA.hex, dyeB.hex, 'lab', 0.5).hex.toLowerCase();
      expect(ryb).not.toBe(lab); // guards the test itself

      const fills = mixFill(generateMixerOG(pair));
      expect(fills).toContain(ryb);
      expect(fills).not.toContain(lab);
    });

    it('an unknown mode falls back without throwing', () => {
      const svg = generateMixerOG({ ...pair, mode: 'nonsense' as never });
      expect(svg).toContain('BUYABLE');
    });

    it('the third dye is folded in using the same mode, not lab', () => {
      const dyeC = dyes[40];
      const twoWay = blendColors(dyeA.hex, dyeB.hex, 'spectral', 0.5).hex;
      const expected = blendColors(twoWay, dyeC.hex, 'spectral', 1 / 3).hex.toLowerCase();

      const fills = mixFill(
        generateMixerOG({ ...pair, dyeCId: sid(40), mode: 'spectral' }),
      );
      expect(fills).toContain(expected);
    });
  });
});
