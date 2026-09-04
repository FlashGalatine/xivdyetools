/**
 * Equivalence guard: `blending/conversions.ts` vs `ColorConverter`.
 *
 * DEAD-037 ("Inside core") and the `DEPRECATIONS.md` follow-up "unify duplicated
 * conversions with ColorService inside core" asked whether the blending module's
 * private conversion helpers can be deleted in favour of core's `ColorConverter`.
 *
 * They cannot. This file is the evidence, and it is a permanent guard, not a
 * one-off study: it pins which helpers are bit-identical (so a future change to
 * either side is caught) and which ones carry a **known numeric delta** that must
 * never be "fixed". Unifying a delta helper would silently move every gradient,
 * mixer output and bot card that `blendColors()` renders — the deltas below are
 * reachable from real dye pairs, not from synthetic edge cases.
 *
 * Corpus: all 125 dye hexes from `dyes.json`, plus the primaries/greys/near-black
 * vectors the sibling `conversions.test.ts` / `blending.test.ts` suites use.
 *
 * Summary (2026-08-18, dead-code audit Wave 4b; RYB row updated 2026-09-03):
 *
 * | helper              | core equivalent               | verdict                                    |
 * |---------------------|-------------------------------|--------------------------------------------|
 * | `hexToRgb`          | `ColorConverter.hexToRgb`     | identical values (contract differs, see below) |
 * | `oklabToRgb`        | `ColorConverter.oklabToRgb`   | identical (0 mismatches in 86,319 samples) |
 * | `rgbToHex`          | `ColorConverter.rgbToHex`     | DELTA — lowercase vs uppercase output      |
 * | `rgbToLab`          | `ColorConverter.rgbToLab`     | DELTA — core rounds to 4 dp                |
 * | `labToRgb`          | `ColorConverter.labToRgb`     | DELTA — different dark-region inverse math |
 * | `rgbToOklab`        | `ColorConverter.rgbToOklab`   | DELTA — core rounds to 6 dp                |
 * | `rgbToHsl`          | `ColorConverter.rgbToHsl`     | DELTA — 0–1 vs 0–100 scale, core rounds 2 dp |
 * | `hslToRgb`          | `ColorConverter.hslToRgb`     | DELTA — 0–100 rescale loses float identity |
 * | `rgbToRyb`/`rybToRgb` | `ColorService.*`            | UNIFIED 5.0.0 — one space, scale differs only |
 * | reflectance / K-S   | (none)                        | removed 4.4.0 — see `conversions.ts`       |
 *
 * ⚠️ The RYB row is the one that CHANGED verdict. It read "DELTA — a different
 * algorithm entirely" while core carried a second RYB implementation (the
 * Gossett-Chen paint cube in `RybColorMixer`). That cube was deleted in 5.0.0
 * because it fails the identity law — mixing a dye with itself did not return
 * it — so there is now exactly one RYB space and the only difference left is
 * that `ColorService` presents it 0-255 where `conversions.ts` uses 0-1. The
 * remaining DELTA rows are still live and still must not be "fixed".
 */

import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  rgbToLab,
  labToRgb,
  rgbToOklab,
  oklabToRgb,
  rgbToHsl,
  hslToRgb,
  rgbToRyb,
  rybToRgb,
} from './conversions.js';
import { blendColors } from './blending.js';
import { ColorConverter } from '../services/color/ColorConverter.js';
import { ColorService } from '../services/ColorService.js';
import dyes from '../data/dyes.json' with { type: 'json' };

/** All 125 dye hexes — the real input domain of `blendColors()`. */
const DYE_HEXES: string[] = (dyes as Array<{ hex: string }>).map((d) => d.hex);

/** The fixed vectors the sibling blending suites exercise, plus near-black. */
const TEST_VECTORS = [
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#808080',
  '#FFFF00',
  '#00FFFF',
  '#FF00FF',
  '#010101',
  '#020202',
  '#030303',
  '#050403',
];

const CORPUS = [...DYE_HEXES, ...TEST_VECTORS];

/** Blend ratios swept across every pair (matches `blendColors()`'s clamped 0–1 domain). */
const RATIOS = [0, 0.1, 0.25, 0.333, 0.5, 0.667, 0.75, 0.9, 1];

describe('conversions.ts ↔ ColorConverter equivalence (DEAD-037)', () => {
  it('the corpus is the full dye table plus the suites’ vectors', () => {
    expect(DYE_HEXES).toHaveLength(125);
    expect(CORPUS).toHaveLength(138);
  });

  // ==========================================================================
  // Identical — these two ARE interchangeable; the assertions catch drift.
  // ==========================================================================

  describe('identical to core', () => {
    it('hexToRgb matches ColorConverter.hexToRgb channel-for-channel', () => {
      for (const hex of CORPUS) {
        const mine = hexToRgb(hex);
        const core = ColorConverter.hexToRgb(hex);
        expect(mine.r).toBe(core.r);
        expect(mine.g).toBe(core.g);
        expect(mine.b).toBe(core.b);
      }
    });

    it('oklabToRgb matches ColorConverter.oklabToRgb across every interpolated OKLAB in the corpus', () => {
      let samples = 0;
      for (let i = 0; i < CORPUS.length; i++) {
        for (let j = i; j < CORPUS.length; j++) {
          const a = rgbToOklab(hexToRgb(CORPUS[i]!));
          const b = rgbToOklab(hexToRgb(CORPUS[j]!));
          for (const t of RATIOS) {
            const L = a.L * (1 - t) + b.L * t;
            const aa = a.a * (1 - t) + b.a * t;
            const bb = a.b * (1 - t) + b.b * t;
            const mine = oklabToRgb({ L, a: aa, b: bb });
            const core = ColorConverter.oklabToRgb(L, aa, bb);
            expect(mine.r).toBe(core.r);
            expect(mine.g).toBe(core.g);
            expect(mine.b).toBe(core.b);
            samples++;
          }
        }
      }
      // Guard against the sweep silently collapsing to nothing.
      expect(samples).toBeGreaterThan(80_000);
    });
  });

  // ==========================================================================
  // Known deltas — DO NOT unify. Each records the exact divergent values.
  // ==========================================================================

  describe('known deltas — do not unify', () => {
    it('rgbToHex: blending emits lowercase, core emits uppercase', () => {
      const rgb = hexToRgb('#e4dfd0');
      expect(rgbToHex(rgb)).toBe('#e4dfd0');
      expect(ColorConverter.rgbToHex(rgb.r, rgb.g, rgb.b)).toBe('#E4DFD0');
      // Values agree; only the casing differs, and `blendColors().hex` is lowercase.
      expect(rgbToHex(rgb).toUpperCase()).toBe(
        (ColorConverter.rgbToHex(rgb.r, rgb.g, rgb.b) as string).toUpperCase(),
      );
    });

    it('rgbToLab: core rounds L/a/b to 4 dp, blending keeps full precision', () => {
      const rgb = hexToRgb('#e4dfd0');
      const mine = rgbToLab(rgb);
      const core = ColorConverter.rgbToLab(rgb.r, rgb.g, rgb.b);
      expect(mine.l).toBe(88.83921264346783);
      expect(core.L).toBe(88.8392);
      expect(mine.a).toBe(-0.8625513551161479);
      expect(core.a).toBe(-0.8626);
      expect(mine.b).toBe(7.949198967806437);
      expect(core.b).toBe(7.9492);
    });

    it('rgbToOklab: core rounds L/a/b to 6 dp, blending keeps full precision', () => {
      const rgb = hexToRgb('#e4dfd0');
      const mine = rgbToOklab(rgb);
      const core = ColorConverter.rgbToOklab(rgb.r, rgb.g, rgb.b);
      expect(mine.L).toBe(0.9034996475394197);
      expect(core.L).toBe(0.9035);
      expect(mine.a).toBe(-0.0005799732264173962);
      expect(core.a).toBe(-0.00058);
      expect(mine.b).toBe(0.02081821971624631);
      expect(core.b).toBe(0.020818);
    });

    it('rgbToHsl: blending returns s/l on 0–1, core returns 0–100 rounded to 2 dp', () => {
      const rgb = hexToRgb('#e4dfd0');
      const mine = rgbToHsl(rgb);
      const core = ColorConverter.rgbToHsl(rgb.r, rgb.g, rgb.b);
      expect(mine.h).toBe(44.99999999999998);
      expect(core.h).toBe(45);
      expect(mine.s).toBe(0.2702702702702704);
      expect(core.s).toBe(27.03);
      expect(mine.l).toBe(0.8549019607843138);
      expect(core.l).toBe(85.49);
    });

    it('labToRgb: the dark-region inverse differs (7.787 linear segment vs κ=903.3)', () => {
      // Reachable from a real dye pair: Midnight Blue → near-black at t≈2/3.
      const a = rgbToLab(hexToRgb('#000b9d'));
      const b = rgbToLab(hexToRgb('#010101'));
      const t = 0.667;
      const lab = {
        l: a.l * (1 - t) + b.l * t,
        a: a.a * (1 - t) + b.a * t,
        b: a.b * (1 - t) + b.b * t,
      };
      const mine = labToRgb(lab);
      const core = ColorConverter.labToRgb(lab.l, lab.a, lab.b);
      expect(mine).toEqual({ r: 23, g: 13, b: 53 });
      expect(core).toEqual({ r: 23, g: 12, b: 53 });
      // Also reproducible from a bare LAB triple in the dark segment.
      expect(labToRgb({ l: 7.35, a: 0, b: -5 })).toEqual({ r: 18, g: 23, b: 29 });
      expect(ColorConverter.labToRgb(7.35, 0, -5)).toEqual({ r: 18, g: 22, b: 29 });
    });

    it('hslToRgb: the 0–100 rescale core requires loses float identity', () => {
      // Reachable from a real dye pair: Ash Grey → a neutral grey at t=0.5.
      const a = rgbToHsl(hexToRgb('#aca8a2'));
      const b = rgbToHsl(hexToRgb('#a7a7a7'));
      const t = 0.5;
      const h = a.h + (b.h - a.h) * t;
      const s = a.s * (1 - t) + b.s * t;
      const l = a.l * (1 - t) + b.l * t;
      const mine = hslToRgb({ h, s, l });
      const core = ColorConverter.hslToRgb(h, s * 100, l * 100);
      expect(mine).toEqual({ r: 170, g: 166, b: 165 });
      expect(core).toEqual({ r: 169, g: 166, b: 164 });
    });

    it('rgbToRyb / rybToRgb: ColorService is the same space at 255× the scale', () => {
      // Was a DELTA row: ColorService used to run the Gossett-Chen cube and
      // returned `{ r: 14, … }` for this dye against blending's 0.8418. The
      // cube is gone (5.0.0), so the only remaining difference is the scale.
      const rgb = hexToRgb('#e4dfd0');
      const mine = rgbToRyb(rgb);
      const viaService = ColorService.rgbToRyb(rgb.r, rgb.g, rgb.b);

      expect(mine.r).toBeCloseTo(0.8418, 4);
      expect(viaService.r).toBeCloseTo(mine.r * 255, 10);
      expect(viaService.y).toBeCloseTo(mine.y * 255, 10);
      expect(viaService.b).toBeCloseTo(mine.b * 255, 10);

      expect(rybToRgb(mine)).toEqual({ r: 228, g: 223, b: 208 });
      expect(ColorService.rybToRgb(viaService.r, viaService.y, viaService.b)).toEqual({
        r: 228,
        g: 223,
        b: 208,
      });
    });
  });

  // ==========================================================================
  // Pipeline: what a full switch-over would actually change.
  // ==========================================================================

  describe('blendColors() output would move if the delta helpers were unified', () => {
    it('LAB blending moves on near-black pairs', () => {
      // Current, shipped behaviour — this is the value that must not change.
      expect(blendColors('#020202', '#000000', 'lab', 0.25).hex).toBe('#010201');
      // What delegating labToRgb to core would produce instead.
      const a = rgbToLab(hexToRgb('#020202'));
      const b = rgbToLab(hexToRgb('#000000'));
      const t = 0.25;
      const viaCore = ColorConverter.labToRgb(
        a.l * (1 - t) + b.l * t,
        a.a * (1 - t) + b.a * t,
        a.b * (1 - t) + b.b * t,
      );
      expect(rgbToHex(viaCore)).toBe('#010101');
    });

    it('HSL blending moves on dark saturated pairs', () => {
      expect(blendColors('#644216', '#000000', 'hsl', 0.75).hex).toBe('#120e0d');
      const a = rgbToHsl(hexToRgb('#644216'));
      const b = rgbToHsl(hexToRgb('#000000'));
      const t = 0.75;
      let hueDiff = b.h - a.h;
      if (hueDiff > 180) hueDiff -= 360;
      if (hueDiff < -180) hueDiff += 360;
      let h = a.h + hueDiff * t;
      if (h < 0) h += 360;
      if (h >= 360) h -= 360;
      const viaCore = ColorConverter.hslToRgb(
        h,
        (a.s * (1 - t) + b.s * t) * 100,
        (a.l * (1 - t) + b.l * t) * 100,
      );
      expect(rgbToHex(viaCore)).toBe('#120d0d');
    });

    it('RYB blending no longer has a second implementation to move to', () => {
      // The Gossett-Chen round trip landed on #E3DFD0 for a dye that is
      // #E4DFD0 — one count of the identity failure that retired it. Both
      // surfaces now return the input exactly at ratio 0.
      expect(blendColors('#e4dfd0', '#656565', 'ryb', 0).hex).toBe('#e4dfd0');
      expect(ColorService.mixColorsRyb('#e4dfd0', '#656565', 0).toLowerCase()).toBe('#e4dfd0');

      const ryb = ColorService.rgbToRyb(228, 223, 208);
      const back = ColorService.rybToRgb(ryb.r, ryb.y, ryb.b);
      expect(rgbToHex(back).toUpperCase()).toBe('#E4DFD0');
    });
  });
});
