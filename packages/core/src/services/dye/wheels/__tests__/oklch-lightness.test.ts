import { describe, it, expect } from 'vitest';
import { OKLCH_LIGHTNESS_WHEEL, RING_LIGHTNESS } from '../oklch-lightness.js';
import { ColorConverter } from '../../../color/ColorConverter.js';

describe('oklch-lightness wheel', () => {
  it('reads the OKLCH hue of the base', () => {
    expect(OKLCH_LIGHTNESS_WHEEL.hueOf('#FF0000')).toBeCloseTo(29.2, 0);
  });

  it('keeps L and C of the base and gamut-maps the rotated colour', () => {
    const base = ColorConverter.hexToOklch('#0000FF');
    const { targetHex, targetHue } = OKLCH_LIGHTNESS_WHEEL.target('#0000FF', (base.h + 180) % 360);
    const got = ColorConverter.hexToOklch(targetHex);
    expect(got.L).toBeCloseTo(base.L, 1);
    // dark olive, per research 02 Table B — and the HSV hue we report is the mapped colour's
    expect(targetHue).toBeCloseTo(ColorConverter.hexToHsv(targetHex).h, 9);
    expect(targetHue).toBeGreaterThan(30);
    expect(targetHue).toBeLessThan(60);
  });

  it('answers the same L for every partner of a saturated base (the point of this wheel)', () => {
    const base = ColorConverter.hexToOklch('#FFD700');
    for (const off of [60, 120, 180, 240, 300]) {
      const hex = OKLCH_LIGHTNESS_WHEEL.target('#FFD700', (base.h + off) % 360).targetHex;
      expect(ColorConverter.hexToOklch(hex).L).toBeCloseTo(base.L, 1);
    }
  });

  it('returns an achromatic base unchanged for every angle', () => {
    for (const hex of ['#808080', '#FFFFFF', '#000000', '#F4F5F9']) {
      for (const angle of [0, 90, 180, 270]) {
        expect(OKLCH_LIGHTNESS_WHEEL.target(hex, angle).targetHex).toBe(hex);
      }
    }
  });

  it('paints an in-gamut ring at the ring lightness, with hue advancing around the circle', () => {
    const stops = OKLCH_LIGHTNESS_WHEEL.ringStops(36);
    expect(stops).toHaveLength(36);
    let prev = -1;
    for (const [i, hex] of stops.entries()) {
      const { L, h } = ColorConverter.hexToOklch(hex);
      expect(L).toBeCloseTo(RING_LIGHTNESS, 1);
      const expected = (i * 10) % 360;
      const diff = Math.min(Math.abs(h - expected), 360 - Math.abs(h - expected));
      expect(diff).toBeLessThan(4); // 8-bit rounding of a max-chroma colour
      if (i > 0) {
        const step = (h - prev + 360) % 360; // circular advance from the previous stop
        expect(step).toBeGreaterThan(6);
        expect(step).toBeLessThan(14);
      }
      prev = h;
    }
  });
});
