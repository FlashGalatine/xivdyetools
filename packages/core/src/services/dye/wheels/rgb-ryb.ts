/**
 * The RGB (identity) and RYB (artist's) wheels.
 *
 * RYB is the 25-pair NodeBox/Paletton/Adobe hue warp. **Column 1 is the RYB
 * angle, column 2 the sRGB hue** — the most-read write-up states it the other
 * way round in prose while implementing it correctly, and reversing it turns
 * red's complement from green into blue while a naïve "≠ 180°" test still
 * passes (research 01 §1a). `registry.test.ts` asserts the values.
 *
 * @module services/dye/wheels/rgb-ryb
 */

import { hueWarpWheel } from './hue-warp.js';
import type { WarpTable } from './types.js';

/** The identity: today's Harmony Explorer, bit for bit. */
export const RGB_WHEEL = hueWarpWheel('rgb', [
  [0, 0],
  [360, 360],
]);

/** `[rybAngle, srgbHue]`. Red's complement (RYB 180°) is sRGB 138°. */
export const RYB_TABLE: WarpTable = [
  [0, 0],
  [15, 8],
  [30, 17],
  [45, 26],
  [60, 34],
  [75, 41],
  [90, 48],
  [105, 54],
  [120, 60],
  [135, 81],
  [150, 103],
  [165, 123],
  [180, 138],
  [195, 155],
  [210, 171],
  [225, 187],
  [240, 204],
  [255, 219],
  [270, 234],
  [285, 251],
  [300, 267],
  [315, 282],
  [330, 298],
  [345, 329],
  [360, 360],
];

export const RYB_WHEEL = hueWarpWheel('ryb', RYB_TABLE);
