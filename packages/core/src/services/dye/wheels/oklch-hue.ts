/**
 * The OKLCH-hue wheel: the sRGB hue circle re-spaced so equal angles are equal
 * OKLab hue steps. Targets still carry the base's HSV saturation and value, so
 * it behaves like RYB (a different spacing), not like a different colour space.
 *
 * The raw OKLab hue of the pure-hue circle reverses by 0.16° across HSV
 * 231.4°–240° — invisible on the ring, a 13° inverse error if left alone
 * (research 05 §7). `normalizeWarpTable` monotonises it and the tests pin the
 * result.
 *
 * @module services/dye/wheels/oklch-hue
 */

import { ColorConverter } from '../../color/ColorConverter.js';
import { hueWarpWheel, normalizeWarpTable } from './hue-warp.js';
import type { WarpTable } from './types.js';

/** `[oklabHue, hsvHue]` for the fully saturated sRGB hue circle, normalised. */
export function deriveOklchHueTable(stepDegrees = 5): WarpTable {
  const raw: Array<readonly [number, number]> = [];
  for (let h = 0; h < 360; h += stepDegrees) {
    const hex = ColorConverter.hsvToHex(h, 100, 100);
    raw.push([ColorConverter.hexToOklch(hex).h, h]);
  }
  return normalizeWarpTable(raw, 'oklch-hue', { maxCorrectionDeg: 1 });
}

export const OKLCH_HUE_TABLE: WarpTable = deriveOklchHueTable();

export const OKLCH_HUE_WHEEL = hueWarpWheel('oklch-hue', OKLCH_HUE_TABLE);
