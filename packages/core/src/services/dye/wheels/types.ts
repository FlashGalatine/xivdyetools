/**
 * A colour wheel for the Harmony Explorer: how a colour becomes an angle, how
 * an angle becomes a target colour, and how the ring is painted.
 *
 * Every consumer — the web app, the Discord bot, the OG card — reads wheels
 * from this package and holds no list of its own (spec §2).
 *
 * @module services/dye/wheels/types
 */

import type { ColorWheelId, HexColor } from '@xivdyetools/types';

export type { ColorWheelId };

export interface ColorWheel {
  readonly id: ColorWheelId;
  /** Where a colour sits on this wheel, 0–360. */
  hueOf(hex: string): number;
  /**
   * The ideal colour for a slot at `wheelHue`, carrying whatever this wheel
   * preserves from the base. `targetHue` is always an sRGB/HSV hue, because
   * the non-perceptual ranking branch compares dye HSV hue against it.
   */
  target(baseHex: string, wheelHue: number): { targetHex: HexColor; targetHue: number };
  /** Ring paint at `count` evenly spaced wheel angles, plain in-gamut hex. */
  ringStops(count: number): readonly HexColor[];
}

/**
 * `[wheelAngle, hsvHue]` pairs, both 0–360, first pair `[0, 0]`, last pair
 * `[360, 360]`, both columns strictly increasing. A hue-warp wheel is defined
 * entirely by one of these.
 */
export type WarpTable = ReadonlyArray<readonly [number, number]>;
