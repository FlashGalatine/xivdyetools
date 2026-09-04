/**
 * Parity guard: `ColorService.mixColors*` vs `blending/blendColors`.
 *
 * Core ships two mixing surfaces. `@xivdyetools/core/blending` is the
 * dependency-light one (REFACTOR-005) that the Discord bot consumes;
 * `ColorService.mixColors*` is the one the web app consumes. Before the
 * 2026-09-03 fact-check they were two independent implementations, and for
 * `ryb` they were two different ALGORITHMS that disagreed by up to ΔE₀₀ 38.
 *
 * The governing principle is that core is the single source of truth for
 * colour computation and every front end is a view onto it. Two functions
 * with the same name that return different colours cannot both be that
 * source. This file is what stops them drifting apart again: every
 * `mixColors*` must be a thin delegation to `blendColors`, and this asserts
 * byte-equality of the hex, not approximate agreement.
 *
 * @module services/__tests__/ColorService.blending-parity
 */

import { describe, it, expect } from 'vitest';
import { ColorService } from '../ColorService.js';
import { blendColors } from '../../blending/index.js';
import type { BlendingMode } from '../../blending/types.js';

/** Every named mode, paired with the ColorService method that must equal it. */
const MODE_METHODS: ReadonlyArray<
  [BlendingMode, (a: string, b: string, r: number) => string]
> = [
  ['rgb', (a, b, r) => ColorService.mixColorsRgb(a, b, r)],
  ['lab', (a, b, r) => ColorService.mixColorsLab(a, b, r)],
  ['oklab', (a, b, r) => ColorService.mixColorsOklab(a, b, r)],
  ['ryb', (a, b, r) => ColorService.mixColorsRyb(a, b, r)],
  ['hsl', (a, b, r) => ColorService.mixColorsHsl(a, b, r)],
  ['spectral', (a, b, r) => ColorService.mixColorsSpectral(a, b, r)],
];

/** Pairs chosen to cover the failure shapes the fact-check found. */
const PAIRS: ReadonlyArray<[string, string, string]> = [
  ['primary opposites', '#FF0000', '#0000FF'],
  ['blue + yellow (the K-M / RYB case)', '#0000FF', '#FFFF00'],
  ['greyscale extremes', '#000000', '#FFFFFF'],
  ['green + red', '#00FF00', '#FF0000'],
  ['teal + orange', '#008080', '#FF8C00'],
  ['dye-typical: Dalamud Red + Metallic Gold', '#C24D4D', '#C8A84A'],
  ['dye-typical: Pastel Pink + Pastel Blue', '#E8A3A3', '#A3B8E8'],
  ['near-black + near-white', '#1A1A1A', '#E5E5E5'],
];

const RATIOS = [0, 0.25, 0.5, 0.75, 1];

describe('ColorService.mixColors* delegates to blendColors', () => {
  for (const [mode, method] of MODE_METHODS) {
    for (const [label, hex1, hex2] of PAIRS) {
      for (const ratio of RATIOS) {
        it(`${mode} @ ${ratio} — ${label}`, () => {
          expect(method(hex1, hex2, ratio).toLowerCase()).toBe(
            blendColors(hex1, hex2, mode, ratio).hex.toLowerCase(),
          );
        });
      }
    }
  }
});

describe('each surface keeps its own hex case', () => {
  /**
   * The two surfaces have always disagreed on CASE — `blendColors` emits
   * lowercase, `ColorService` uppercase (the `rgbToHex` delta recorded in
   * `blending/conversions.equivalence.test.ts`). Delegating naïvely flipped
   * `mixColors*` to lowercase, which five existing assertions caught; a caller
   * comparing a mix against an uppercase `dye.hex` would not have been so
   * lucky. The parity assertions above therefore compare case-insensitively
   * ON PURPOSE, and this is what stops that becoming a licence to drift.
   */
  it.each(MODE_METHODS.map(([mode]) => mode))(
    '%s: ColorService returns uppercase',
    (mode) => {
      const method = MODE_METHODS.find(([m]) => m === mode)![1];
      const hex = method('#c24d4d', '#c8a84a', 0.5);

      expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    },
  );

  it.each(MODE_METHODS.map(([mode]) => mode))('%s: blendColors returns lowercase', (mode) => {
    expect(blendColors('#C24D4D', '#C8A84A', mode, 0.5).hex).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('mixColorsRyb obeys the identity law', () => {
  /**
   * The Gossett-Chen trilinear cube maps into the convex hull of its eight
   * corners; pure green, blue, cyan, magenta and true black have no RYB
   * pre-image, so its Newton-method inverse cannot converge for them. Mixing
   * a dye with ITSELF therefore did not return that dye — it failed on 53% of
   * dye pairs, max ΔE₀₀ 27.9. A 0-100% slider whose 0% end is not the input
   * is a defect a user sees in one drag.
   */
  it.each([
    ['pure green', '#00FF00'],
    ['pure blue', '#0000FF'],
    ['cyan', '#00FFFF'],
    ['magenta', '#FF00FF'],
    ['true black', '#000000'],
    ['pure white', '#FFFFFF'],
    ['teal', '#008080'],
    ['dye-typical rose', '#C24D4D'],
  ])('%s mixed with itself returns itself at every ratio', (_label, hex) => {
    for (const ratio of RATIOS) {
      expect(ColorService.mixColorsRyb(hex, hex, ratio).toLowerCase()).toBe(hex.toLowerCase());
    }
  });
});

describe('mixColorsHsl keeps its hue-method argument through the delegation', () => {
  /**
   * `blendColors`'s HSL took the shortest arc unconditionally. `mixColorsHsl`
   * has always accepted a hue method, so delegating without threading it
   * through would silently drop a documented parameter — the exact class of
   * "front end selects, core substitutes something else" this sprint exists
   * to remove.
   */
  it('longer arc differs from shorter arc', () => {
    const shorter = ColorService.mixColorsHsl('#FF0000', '#00FF00', 0.5, 'shorter');
    const longer = ColorService.mixColorsHsl('#FF0000', '#00FF00', 0.5, 'longer');

    expect(longer).not.toBe(shorter);
  });

  it('each hue method reaches blendColors intact', () => {
    for (const method of ['shorter', 'longer', 'increasing', 'decreasing'] as const) {
      expect(ColorService.mixColorsHsl('#FF0000', '#00FF00', 0.5, method).toLowerCase()).toBe(
        blendColors('#FF0000', '#00FF00', 'hsl', 0.5, { hueMethod: method }).hex.toLowerCase(),
      );
    }
  });

  it('omitting the hue method is the same as asking for the shorter arc', () => {
    expect(ColorService.mixColorsHsl('#FF0000', '#00FF00', 0.5)).toBe(
      ColorService.mixColorsHsl('#FF0000', '#00FF00', 0.5, 'shorter'),
    );
  });
});

describe('the RYB colour space exposed by ColorService is the invertible one', () => {
  /**
   * `ColorService.rgbToRyb` used to return coordinates in the Gossett-Chen
   * cube (white at the origin) found by a damped Newton solve. It now returns
   * coordinates in the chromatic-subtraction space (black at the origin) that
   * `blendColors(..., 'ryb')` actually mixes in. The axes do NOT mean the same
   * thing as before; what they gain is an exact inverse.
   */
  it.each([
    ['pure red', 255, 0, 0],
    ['pure green', 0, 255, 0],
    ['pure blue', 0, 0, 255],
    ['cyan', 0, 255, 255],
    ['white', 255, 255, 255],
    ['black', 0, 0, 0],
    ['mid grey', 128, 128, 128],
    ['dye-typical rose', 194, 77, 77],
  ])('%s survives an RGB → RYB → RGB round trip', (_label, r, g, b) => {
    const ryb = ColorService.rgbToRyb(r, g, b);
    const back = ColorService.rybToRgb(ryb.r, ryb.y, ryb.b);

    expect(Math.abs(back.r - r)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.g - g)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.b - b)).toBeLessThanOrEqual(1);
  });

  it('green and blue are distinguishable (BUG-006 stayed fixed)', () => {
    expect(ColorService.rgbToRyb(0, 255, 0)).not.toEqual(ColorService.rgbToRyb(0, 0, 255));
  });

  it('hexToRyb / rybToHex round-trip agrees with the numeric pair', () => {
    const ryb = ColorService.hexToRyb('#C24D4D');
    expect(ColorService.rybToHex(ryb.r, ryb.y, ryb.b).toLowerCase()).toBe('#c24d4d');
  });
});
