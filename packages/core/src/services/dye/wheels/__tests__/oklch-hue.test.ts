import { describe, it, expect } from 'vitest';
import { OKLCH_HUE_TABLE, OKLCH_HUE_WHEEL } from '../oklch-hue.js';
import { assertMonotoneTable } from '../hue-warp.js';
import { ColorConverter } from '../../../color/ColorConverter.js';

describe('oklch-hue wheel', () => {
  it('is a monotone table of 73 pairs (72 samples, the HSV-0° sample becomes [0,0], plus [360,360])', () => {
    expect(OKLCH_HUE_TABLE).toHaveLength(73);
    expect(() => assertMonotoneTable(OKLCH_HUE_TABLE, 'oklch-hue')).not.toThrow();
  });

  // Landmarks measured in research 05 (wheelstakes2): HSV → wheel.
  // The OKLab hue of the pure sRGB hue circle, zeroed at red.
  it.each([
    [60, 80.5],
    [120, 113.3],
    [180, 165.5],
    [240, 234.8],
    [300, 299.1],
  ])('places HSV %i° near wheel %s°', (hsvHue, wheelHue) => {
    expect(OKLCH_HUE_WHEEL.hueOf(ColorConverter.hsvToHex(hsvHue, 100, 100))).toBeCloseTo(
      wheelHue,
      0
    );
  });

  it("red's complement lands near sRGB 186°", () => {
    expect(OKLCH_HUE_WHEEL.target('#FF0000', 180).targetHue).toBeCloseTo(186.1, 0);
  });

  it('survives the OKLab dent around HSV 231–240° (round trip stays under 1e-6)', () => {
    for (let h = 225; h <= 245; h += 0.05) {
      const hex = ColorConverter.hsvToHex(h, 100, 100);
      const exactH = ColorConverter.hexToHsv(hex).h;
      const back = OKLCH_HUE_WHEEL.target(hex, OKLCH_HUE_WHEEL.hueOf(hex)).targetHue;
      expect(Math.abs(back - exactH)).toBeLessThan(1e-6);
    }
  });

  it('keeps a grey grey', () => {
    expect(OKLCH_HUE_WHEEL.target('#7F7F7F', 180).targetHex).toBe('#7F7F7F');
  });
});
