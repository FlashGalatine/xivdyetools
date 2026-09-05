/**
 * Derivation of the OKLCH-hue warp table.
 *
 * This lives under `scripts/` on purpose: the table it produces is checked in
 * as `src/data/oklch-hue-table.json`, so nothing derives it at import time.
 * It used to run inside `oklch-hue.ts` — 72 `hsvToHex` + `hexToOklch` round
 * trips on every module load, in every bundle that touched a colour wheel,
 * including the web app's lazily loaded modal chunk.
 *
 * `scripts/lib/oklch-hue-table.test.ts` asserts that re-running this agrees
 * with the committed JSON, which is what stops the two drifting apart.
 *
 * @module scripts/lib/oklch-hue-table
 */

import { ColorConverter } from '../../src/services/color/ColorConverter.js';
import { normalizeWarpTable } from '../../src/services/dye/wheels/hue-warp.js';
import type { WarpTable } from '../../src/services/dye/wheels/types.js';

/**
 * `[oklabHue, hsvHue]` for the fully saturated sRGB hue circle, normalised.
 *
 * Both columns are measured from the SAME 8-bit colour. Pairing the OKLab hue
 * of `hsvToHex(h, 100, 100)` with the nominal loop `h` mismatched them by up
 * to ~0.35°: `hsvToHex` rounds to 8 bits, so the colour actually measured sits
 * at `hexToHsv(hex).h`, not at `h`. The inverse mapping is what the wheel
 * hands to the ranking, so a stale second column is a real (if small) error in
 * every target hue.
 */
export function deriveOklchHueTable(stepDegrees = 5): WarpTable {
  const raw: Array<readonly [number, number]> = [];
  for (let h = 0; h < 360; h += stepDegrees) {
    const hex = ColorConverter.hsvToHex(h, 100, 100);
    raw.push([ColorConverter.hexToOklch(hex).h, ColorConverter.hexToHsv(hex).h]);
  }
  return normalizeWarpTable(raw, 'oklch-hue', { maxCorrectionDeg: 1 });
}
