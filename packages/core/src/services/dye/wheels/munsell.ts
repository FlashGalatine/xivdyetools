/**
 * The Munsell hue wheel: 40 principal hues at 3.6° per ASTM step, anchored
 * to sRGB by the renotation data at Value 6 / Chroma 8 (see NOTICE).
 * Red's complement is 5BG, a blue-green — the third answer after RGB (cyan)
 * and RYB (green), and the one Japan's JIS Z 8721 teaches.
 *
 * @module services/dye/wheels/munsell
 */

import munsellData from '../../../data/munsell-hues.json' with { type: 'json' };
import { hueWarpWheel } from './hue-warp.js';
import type { WarpTable } from './types.js';

export interface MunsellAnchor {
  notation: string;
  astm: number;
  wheelAngle: number;
  hsvHue: number;
}

export const MUNSELL_ANCHORS: ReadonlyArray<MunsellAnchor> = munsellData.anchors;

export const MUNSELL_TABLE: WarpTable = munsellData.table as unknown as WarpTable;

export const MUNSELL_WHEEL = hueWarpWheel('munsell', MUNSELL_TABLE);
