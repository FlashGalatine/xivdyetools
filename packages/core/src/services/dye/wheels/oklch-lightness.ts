/**
 * The constant-lightness OKLCH wheel: rotate hue at the base's OKLab L and C,
 * then gamut-map. Unlike the warp wheels this abandons the base's HSV S/V, so
 * a light base yields light partners and palettes lean toward mid-tones —
 * a deliberate product decision (spec §2.2), not a side effect.
 *
 * @module services/dye/wheels/oklch-lightness
 */

import type { HexColor } from '@xivdyetools/types';
import { ColorConverter } from '../../color/ColorConverter.js';
import type { ColorWheel } from './types.js';

/** Ring stops are painted at this L, at the maximum in-gamut chroma per hue. */
export const RING_LIGHTNESS = 0.65;

/**
 * Below this OKLCH chroma a colour is treated as grey: no hue, no rotation.
 *
 * 0.006, not the 0.005 the brief names — the in-game "Pure White" dye
 * (#F9F8F4) and the test's own achromatic fixture #F4F5F9 both measure
 * C ≈ 0.0054 (cross-checked against culori's oklch converter), just over
 * 0.005. 0.006 clears that with margin while staying well under the next
 * dye up by chroma, Charcoal Grey at C ≈ 0.0083, so it does not swallow any
 * colour meant to keep rotating.
 */
export const ACHROMATIC_CHROMA = 0.006;

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

let ringCache: { count: number; stops: readonly HexColor[] } | null = null;

export const OKLCH_LIGHTNESS_WHEEL: ColorWheel = {
  id: 'oklch-lightness',

  hueOf(hex: string): number {
    return mod360(ColorConverter.hexToOklch(hex).h);
  },

  target(baseHex: string, wheelHue: number): { targetHex: HexColor; targetHue: number } {
    const base = ColorConverter.hexToOklch(baseHex);
    if (base.C < ACHROMATIC_CHROMA) {
      // A grey has no hue to rotate; every partner of a grey is that grey.
      const { r, g, b } = ColorConverter.hexToRgb(baseHex);
      const hex = ColorConverter.rgbToHex(r, g, b);
      return { targetHex: hex, targetHue: ColorConverter.hexToHsv(hex).h };
    }
    const targetHex = ColorConverter.gamutMapOklch(base.L, base.C, mod360(wheelHue));
    return { targetHex, targetHue: ColorConverter.hexToHsv(targetHex).h };
  },

  ringStops(count: number): readonly HexColor[] {
    if (ringCache && ringCache.count === count) return ringCache.stops;
    const stops: HexColor[] = [];
    for (let i = 0; i < count; i++) {
      const h = (i * 360) / count;
      const c = ColorConverter.maxChromaOklch(RING_LIGHTNESS, h);
      stops.push(ColorConverter.gamutMapOklch(RING_LIGHTNESS, c, h));
    }
    ringCache = { count, stops };
    return stops;
  },
};
