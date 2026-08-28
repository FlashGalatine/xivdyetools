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
    // The deck names the lens from the shipped locale key, not the short code
    expect(svg).toContain('font-size="14.5"');
    expect(svg).toContain('VISION');
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

  it('the X frame moves the lens to the footer and scales the strip ×0.66', () => {
    const svg = generateAccessibilityOG({
      dyeIds: [sid(0), sid(10)],
      visionType: 'tritanopia',
      frame: 'x',
    });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('TRIT');
    expect(svg).toContain('xivdyetools.app/accessibility');
    // 52 → 34
    expect(svg).toContain('height="34"');
    expect(svg).not.toContain('height="52"');
    // In-band content unchanged by the degrade
    expect(svg).toContain('AS DESIGNED');
  });

  it('localizes the tool tag', () => {
    expect(generateAccessibilityOG({ dyeIds: [sid(0)], locale: 'de' })).toContain('SEHKRAFT');
    expect(generateAccessibilityOG({ dyeIds: [sid(0)], locale: 'zh' })).toContain('色觉');
  });

  it('no resolvable dyes renders the neutral state', () => {
    const svg = generateAccessibilityOG({ dyeIds: [999999] });
    expect(svg).toContain('NOT FOUND');
  });
});
