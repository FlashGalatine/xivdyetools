/**
 * Hue-warp wheels: a monotone piecewise-linear bijection between sRGB/HSV hue
 * and a wheel angle. RGB (identity), RYB, Munsell and OKLCH-hue are all this.
 *
 * The target keeps the BASE's HSV saturation and value on the mapped hue —
 * the contract the 2026-09-03 harmony convergence rests on — so on the
 * identity table this reproduces today's output bit for bit.
 *
 * @module services/dye/wheels/hue-warp
 */

import type { HexColor } from '@xivdyetools/types';
import { ColorConverter } from '../../color/ColorConverter.js';
import type { ColorWheel, ColorWheelId, WarpTable } from './types.js';

const mod360 = (x: number): number => (x >= 0 && x < 360 ? x : ((x % 360) + 360) % 360);

/**
 * Every table must be strictly increasing in both columns and run exactly
 * from `[0,0]` to `[360,360]`; otherwise the inverse is ambiguous and a
 * linear-search inverse returns a hue wrong by far more than the dent
 * (research 05 §7: a 0.16° reversal produced a 13° error, silently).
 */
export function assertMonotoneTable(table: WarpTable, id: string): void {
  if (table.length < 2) {
    throw new Error(`ColorWheel ${id}: table needs at least two pairs`);
  }
  const first = table[0];
  const last = table[table.length - 1];
  if (first[0] !== 0 || first[1] !== 0) {
    throw new Error(`ColorWheel ${id}: table must start at [0,0]`);
  }
  if (last[0] !== 360 || last[1] !== 360) {
    throw new Error(`ColorWheel ${id}: table must end at [360,360]`);
  }
  for (let i = 1; i < table.length; i++) {
    if (!(table[i][0] > table[i - 1][0]) || !(table[i][1] > table[i - 1][1])) {
      throw new Error(`ColorWheel ${id}: table is not strictly increasing at row ${i}`);
    }
  }
}

/** Piecewise-linear map of `x` from column `from` to column `to`. */
function interpolate(table: WarpTable, x: number, from: 0 | 1, to: 0 | 1): number {
  const v = mod360(x);
  let lo = 0;
  let hi = table.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (table[mid][from] <= v) lo = mid;
    else hi = mid;
  }
  const a = table[lo];
  const b = table[hi];
  const t = (v - a[from]) / (b[from] - a[from]);
  return mod360(a[to] + t * (b[to] - a[to]));
}

/** sRGB/HSV hue → wheel angle. */
export function toWheelHue(table: WarpTable, hsvHue: number): number {
  return table.length === 2 ? mod360(hsvHue) : interpolate(table, hsvHue, 1, 0);
}

/** Wheel angle → sRGB/HSV hue. */
export function fromWheelHue(table: WarpTable, wheelHue: number): number {
  return table.length === 2 ? mod360(wheelHue) : interpolate(table, wheelHue, 0, 1);
}

export interface NormalizeOptions {
  /** Largest running-max correction tolerated, in degrees. Default 1. */
  maxCorrectionDeg?: number;
}

/**
 * Turn measured `[wheelAngle, hsvHue]` pairs — in any order, with the wheel
 * column wrapping wherever the measurement put its zero — into a valid
 * {@link WarpTable}: sorted by HSV hue, wheel column unwrapped, small dents
 * monotonised with a running maximum, re-zeroed so HSV 0° ↦ wheel 0°, and
 * closed with `[0,0]` and `[360,360]`.
 *
 * Every warp wheel is zeroed at sRGB red, so wheels differ in SPACING only;
 * that is what lets the ring, the nodes and the base spoke share one origin.
 */
export function normalizeWarpTable(
  raw: ReadonlyArray<readonly [number, number]>,
  id: string,
  options: NormalizeOptions = {},
): WarpTable {
  const maxCorrection = options.maxCorrectionDeg ?? 1;
  if (raw.length < 3) {
    throw new Error(`ColorWheel ${id}: need at least three measured pairs`);
  }
  const sorted = raw
    .map(([w, h]) => [mod360(w), mod360(h)] as [number, number])
    .sort((a, b) => a[1] - b[1]);

  // Unwrap the wheel column: a backward step larger than half a turn is the
  // measurement's own zero crossing, not a dent.
  const unwrapped: Array<[number, number]> = [];
  let offset = 0;
  for (let i = 0; i < sorted.length; i++) {
    let w = sorted[i][0] + offset;
    if (i > 0 && w < unwrapped[i - 1][0] - 180) {
      offset += 360;
      w += 360;
    }
    unwrapped.push([w, sorted[i][1]]);
  }

  // Monotonise small dents; refuse large ones.
  for (let i = 1; i < unwrapped.length; i++) {
    const prev = unwrapped[i - 1][0];
    if (unwrapped[i][0] <= prev) {
      const correction = prev - unwrapped[i][0];
      if (correction > maxCorrection) {
        throw new Error(
          `ColorWheel ${id}: wheel column reverses by ${correction.toFixed(3)}° at HSV ` +
            `${unwrapped[i][1].toFixed(2)}°, more than the ${maxCorrection}° tolerance`,
        );
      }
      unwrapped[i][0] = prev + 1e-6;
    }
  }

  // Wheel angle at HSV 0°, by interpolating across the wrap-around segment.
  const [wFirst, hFirst] = unwrapped[0];
  const [wLast, hLast] = unwrapped[unwrapped.length - 1];
  const t = (360 - hLast) / (hFirst + 360 - hLast);
  const w0 = wLast + t * (wFirst + 360 - wLast);

  const table: Array<readonly [number, number]> = [[0, 0]];
  for (const [w, h] of unwrapped) {
    const shifted = w - w0 + 360; // wFirst ≥ w0 − 360 by construction
    if (h > 0 && shifted > 0 && shifted < 360) table.push([shifted, h]);
  }
  table.push([360, 360]);

  assertMonotoneTable(table, id);
  return table;
}

/** Build a wheel from a table. Throws at construction on a bad table. */
export function hueWarpWheel(id: ColorWheelId, table: WarpTable): ColorWheel {
  assertMonotoneTable(table, id);
  return {
    id,
    // Every warp wheel's target is the base's own S/V on a re-spaced hue, so
    // angular hue distance to `targetHue` is a meaningful ranking here.
    carriesBaseHsv: true,
    hueOf(hex: string): number {
      return toWheelHue(table, ColorConverter.hexToHsv(hex).h);
    },
    target(baseHex: string, wheelHue: number): { targetHex: HexColor; targetHue: number } {
      const base = ColorConverter.hexToHsv(baseHex);
      const targetHue = fromWheelHue(table, wheelHue);
      return { targetHex: ColorConverter.hsvToHex(targetHue, base.s, base.v), targetHue };
    },
    ringStops(count: number): readonly HexColor[] {
      const stops: HexColor[] = [];
      for (let i = 0; i < count; i++) {
        stops.push(ColorConverter.hsvToHex(fromWheelHue(table, (i * 360) / count), 100, 100));
      }
      return stops;
    },
  };
}
