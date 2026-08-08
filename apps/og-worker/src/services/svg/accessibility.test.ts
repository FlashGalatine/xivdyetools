/**
 * Accessibility OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateAccessibilityOG } from './accessibility';
import { dyeService } from './dye-helpers';

const dyes = dyeService.getAllDyes();
const sid = (i: number): number => dyes[i].stainID ?? dyes[i].id;

describe('generateAccessibilityOG (15E band)', () => {
  it('bands are the dyes as perceived, the strip above is as designed', () => {
    const svg = generateAccessibilityOG({
      dyeIds: [sid(0), sid(10), sid(30)],
      visionType: 'deuteranopia',
    });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('AS DESIGNED');
    // The structural variant: the 52px as-designed strip
    expect(svg).toContain('height="52"');
    // Δ is the shift the lens introduces
    expect(svg).toMatch(/Δ\d+\.\d/);
    expect(svg).toContain('DEUT');
  });

  it.each(['normal', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'] as const)(
    'handles %s',
    (vision) => {
      const svg = generateAccessibilityOG({ dyeIds: [sid(0), sid(10)], visionType: vision });
      expect(svg).toContain('<svg');
    }
  );

  it('normal vision shifts are zero', () => {
    const svg = generateAccessibilityOG({ dyeIds: [sid(0)], visionType: 'normal' });
    expect(svg).toContain('Δ0.0');
  });

  it('the X frame names the lens', () => {
    const svg = generateAccessibilityOG({
      dyeIds: [sid(0), sid(10)],
      visionType: 'tritanopia',
      frame: 'x',
    });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('TRIT');
    expect(svg).toContain('xivdyetools.app/accessibility');
  });

  it('no resolvable dyes renders the neutral state', () => {
    const svg = generateAccessibilityOG({ dyeIds: [999999] });
    expect(svg).toContain('NOT FOUND');
  });
});
