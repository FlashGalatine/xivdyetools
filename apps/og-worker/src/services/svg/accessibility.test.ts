/**
 * Accessibility OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateAccessibilityOG, ACCESSIBILITY_MAX_DYES } from './accessibility';
import { dyeService } from './dye-helpers';

const dyes = dyeService.getAllDyes();
const sid = (i: number): number => dyes[i].stainID ?? dyes[i].id;

/** band.ts's mark clip-path id carries a module-level call counter
 * (`ogm11b`, `ogm12b`, …) that is cosmetic — it exists so multiple cards
 * embedded on one page never collide on an SVG id — not content, so a
 * byte-identical-output comparison across two `generate*OG` calls in the
 * same test needs it normalised out first. */
const normalizeMarkUid = (svg: string): string => svg.replace(/ogm\d+/g, 'ogmX');

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

  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R17): pins ACCESSIBILITY_MAX_DYES
  // to what the render actually does — see the equivalent comparison.test.ts
  // case for why this needs its own render-level check.
  it('ids past ACCESSIBILITY_MAX_DYES render byte-identically to leaving them off', () => {
    const ids = [sid(0), sid(10), sid(30), sid(60)];
    expect(ids.length).toBe(ACCESSIBILITY_MAX_DYES);
    const exact = normalizeMarkUid(generateAccessibilityOG({ dyeIds: ids, visionType: 'deuteranopia' }));
    const withExtra = normalizeMarkUid(generateAccessibilityOG({
      dyeIds: [...ids, sid(20), sid(40)],
      visionType: 'deuteranopia',
    }));
    expect(withExtra).toBe(exact);
  });
});
