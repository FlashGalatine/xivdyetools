import { describe, it, expect } from 'vitest';
import {
  COLOR_WHEEL_IDS,
  DEFAULT_COLOR_WHEEL,
  getColorWheel,
  isColorWheelId,
} from '../ColorWheel.js';
import { RGB_WHEEL, RYB_TABLE, RYB_WHEEL } from '../rgb-ryb.js';
import { ColorConverter } from '../../../color/ColorConverter.js';

describe('registry', () => {
  it('lists the five wheels in display order with rgb first and default', () => {
    expect(COLOR_WHEEL_IDS).toEqual(['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness']);
    expect(DEFAULT_COLOR_WHEEL).toBe('rgb');
  });

  it.each(['rgb', 'ryb', 'munsell', 'oklch-hue', 'oklch-lightness'])('accepts %s', (id) => {
    expect(isColorWheelId(id)).toBe(true);
  });

  it.each(['', 'RGB', 'cmyk', 'hsl', 'toString', 'constructor', 42, null, undefined])(
    'rejects %j',
    (value) => {
      expect(isColorWheelId(value)).toBe(false);
    }
  );

  it('never answers a prototype property for an unknown id', () => {
    expect(() => getColorWheel('toString' as never)).toThrow(RangeError);
    expect(() => getColorWheel('constructor' as never)).toThrow(RangeError);
  });

  it('returns a wheel whose id is the id asked for', () => {
    expect(getColorWheel('rgb').id).toBe('rgb');
    expect(getColorWheel('ryb').id).toBe('ryb');
  });
});

describe('rgb wheel (identity)', () => {
  it('reads the HSV hue unchanged and returns the HSV target unchanged', () => {
    for (const hex of ['#FF0000', '#123456', '#6D5440', '#00FFFF', '#808080']) {
      const hsv = ColorConverter.hexToHsv(hex);
      expect(RGB_WHEEL.hueOf(hex)).toBe(hsv.h);
      for (const offset of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 345]) {
        const wheelHue = (hsv.h + offset) % 360;
        const { targetHex, targetHue } = RGB_WHEEL.target(hex, wheelHue);
        expect(targetHue).toBe(wheelHue);
        expect(targetHex).toBe(ColorConverter.hsvToHex(wheelHue, hsv.s, hsv.v));
      }
    }
  });

  it('paints the plain sRGB ring', () => {
    expect(RGB_WHEEL.ringStops(6)).toEqual([
      '#FF0000',
      '#FFFF00',
      '#00FF00',
      '#00FFFF',
      '#0000FF',
      '#FF00FF',
    ]);
  });
});

describe('ryb wheel', () => {
  it('has the 25-pair table with RYB angle in column 1 and sRGB hue in column 2', () => {
    expect(RYB_TABLE).toHaveLength(25);
    expect(RYB_TABLE[8]).toEqual([120, 60]); // yellow
    expect(RYB_TABLE[12]).toEqual([180, 138]); // red's complement, a green
    expect(RYB_TABLE[16]).toEqual([240, 204]); // Itten's cyan-leaning blue
  });

  it("red's complement is green (sRGB 138°), not cyan", () => {
    expect(RYB_WHEEL.target('#FF0000', 180).targetHue).toBeCloseTo(138, 9);
  });

  it('yellow sits at RYB 120° and maps back to sRGB 60°', () => {
    expect(RYB_WHEEL.hueOf('#FFFF00')).toBeCloseTo(120, 9);
    expect(RYB_WHEEL.target('#FF0000', 120).targetHue).toBeCloseTo(60, 9);
  });

  it('round-trips and is an involution under complement', () => {
    for (let h = 0; h < 360; h += 0.1) {
      const hex = ColorConverter.hsvToHex(h, 100, 100);
      const w = RYB_WHEEL.hueOf(hex);
      const back = RYB_WHEEL.target(hex, w).targetHue;
      expect(Math.abs(back - ColorConverter.hexToHsv(hex).h) % 360).toBeLessThan(1e-6);
      const comp = RYB_WHEEL.target(hex, (w + 180) % 360).targetHex;
      const compW = RYB_WHEEL.hueOf(comp);
      const compComp = RYB_WHEEL.target(comp, (compW + 180) % 360).targetHue;
      // hsvToHex rounds to 8 bits, so allow the rounding, not the maths
      expect(Math.min(Math.abs(compComp - h), 360 - Math.abs(compComp - h))).toBeLessThan(1.5);
    }
  });

  it('keeps a grey grey', () => {
    for (const offset of [30, 120, 180, 270]) {
      expect(RYB_WHEEL.target('#808080', offset).targetHex).toBe('#808080');
    }
  });
});
