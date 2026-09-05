import { describe, it, expect } from 'vitest';
import {
  assertMonotoneTable,
  fromWheelHue,
  hueWarpWheel,
  normalizeWarpTable,
  toWheelHue,
} from '../hue-warp.js';
import type { WarpTable } from '../types.js';

const IDENTITY: WarpTable = [
  [0, 0],
  [360, 360],
];
/** A two-segment warp: the first 90° of HSV hue occupy 180° of wheel. */
const STRETCH: WarpTable = [
  [0, 0],
  [180, 90],
  [360, 360],
];

describe('interpolation', () => {
  it('identity maps every angle to itself', () => {
    for (let h = 0; h < 360; h += 0.5) {
      expect(toWheelHue(IDENTITY, h)).toBe(h);
      expect(fromWheelHue(IDENTITY, h)).toBe(h);
    }
  });

  it('interpolates linearly inside a segment, both directions', () => {
    expect(toWheelHue(STRETCH, 45)).toBeCloseTo(90, 9);
    expect(fromWheelHue(STRETCH, 90)).toBeCloseTo(45, 9);
    expect(toWheelHue(STRETCH, 225)).toBeCloseTo(270, 9);
    expect(fromWheelHue(STRETCH, 270)).toBeCloseTo(225, 9);
  });

  it('wraps: 360 and −30 are treated as 0 and 330', () => {
    expect(toWheelHue(STRETCH, 360)).toBe(0);
    expect(fromWheelHue(STRETCH, -30)).toBeCloseTo(fromWheelHue(STRETCH, 330), 9);
  });

  it('round-trips to 1e-9 over the whole circle', () => {
    for (let h = 0; h < 360; h += 0.1) {
      expect(Math.abs(fromWheelHue(STRETCH, toWheelHue(STRETCH, h)) - h)).toBeLessThan(1e-9);
    }
  });
});

describe('assertMonotoneTable', () => {
  it('accepts a strictly increasing table spanning 0→360', () => {
    expect(() => assertMonotoneTable(STRETCH, 'stretch')).not.toThrow();
  });

  it('rejects a table that does not start at [0,0] or end at [360,360]', () => {
    expect(() =>
      assertMonotoneTable(
        [
          [0, 5],
          [360, 360],
        ],
        'bad',
      ),
    ).toThrow(/\[0,0\]/);
    expect(() =>
      assertMonotoneTable(
        [
          [0, 0],
          [350, 360],
        ],
        'bad',
      ),
    ).toThrow(/\[360,360\]/);
  });

  it('rejects a backward step in either column', () => {
    expect(() =>
      assertMonotoneTable(
        [
          [0, 0],
          [100, 120],
          [90, 200],
          [360, 360],
        ],
        'w',
      ),
    ).toThrow(/row 2/);
    expect(() =>
      assertMonotoneTable(
        [
          [0, 0],
          [100, 120],
          [200, 110],
          [360, 360],
        ],
        'h',
      ),
    ).toThrow(/row 2/);
  });
});

describe('normalizeWarpTable', () => {
  it('sorts by HSV hue, unwraps the wheel column, and zeroes at HSV 0', () => {
    // Measured pairs [wheelAngle, hsvHue] handed in unsorted and un-zeroed:
    // wheel = hsv + 30 everywhere, so after zeroing it must be the identity.
    const raw: Array<[number, number]> = [
      [210, 180],
      [30, 0],
      [300, 270],
      [120, 90],
      [15, 345],
    ];
    const table = normalizeWarpTable(raw, 'shifted');
    expect(table[0]).toEqual([0, 0]);
    expect(table[table.length - 1]).toEqual([360, 360]);
    for (const [w, h] of table) expect(w).toBeCloseTo(h, 9);
  });

  it('monotonises a small dent with a running maximum and reports nothing', () => {
    const raw: Array<[number, number]> = [
      [0, 0],
      [100, 90],
      [99.9, 100], // 0.1° reversal, like OKLab hue around HSV 231–240
      [200, 180],
      [300, 270],
    ];
    const table = normalizeWarpTable(raw, 'dented');
    expect(() => assertMonotoneTable(table, 'dented')).not.toThrow();
  });

  it('throws when a dent exceeds the stated tolerance', () => {
    const raw: Array<[number, number]> = [
      [0, 0],
      [100, 90],
      [95, 100], // 5° reversal
      [200, 180],
      [300, 270],
    ];
    expect(() => normalizeWarpTable(raw, 'broken', { maxCorrectionDeg: 1 })).toThrow(/broken/);
  });
});

describe('hueWarpWheel', () => {
  const wheel = hueWarpWheel('ryb', STRETCH);

  it('reads the base hue through the table', () => {
    // #FF8000 is HSV hue 30.1176…, rounded by ColorConverter to 30.12; under
    // STRETCH that is doubled.
    expect(wheel.hueOf('#FF8000')).toBeCloseTo(60.24, 2);
  });

  it('builds the target with the base saturation and value on the mapped hue', () => {
    // Base: pure red at half value. Wheel 180 → HSV 90 (chartreuse), V stays 50%.
    const { targetHex, targetHue } = wheel.target('#800000', 180);
    expect(targetHue).toBeCloseTo(90, 9);
    expect(targetHex).toBe('#408000');
  });

  it('paints ring stops from the mapped hue at full saturation and value', () => {
    const stops = wheel.ringStops(4); // wheel 0, 90, 180, 270 → HSV 0, 45, 90, 225
    expect(stops).toEqual(['#FF0000', '#FFBF00', '#80FF00', '#0040FF']);
  });

  it('refuses a non-monotone table at construction', () => {
    expect(() =>
      hueWarpWheel('ryb', [
        [0, 0],
        [200, 100],
        [100, 200],
        [360, 360],
      ]),
    ).toThrow();
  });
});
