/**
 * The colour-wheel registry — the ONE list every surface reads.
 *
 * @module services/dye/wheels/ColorWheel
 */

import type { ColorWheelId } from '@xivdyetools/types';
import { OKLCH_HUE_WHEEL } from './oklch-hue.js';
import { RGB_WHEEL, RYB_WHEEL } from './rgb-ryb.js';
import type { ColorWheel } from './types.js';

export type { ColorWheel } from './types.js';

/** Display order. `rgb` first, and the default. */
export const COLOR_WHEEL_IDS = [
  'rgb',
  'ryb',
  'munsell',
  'oklch-hue',
  'oklch-lightness',
] as const satisfies readonly ColorWheelId[];

export const DEFAULT_COLOR_WHEEL: ColorWheelId = 'rgb';

export function isColorWheelId(value: unknown): value is ColorWheelId {
  return typeof value === 'string' && (COLOR_WHEEL_IDS as readonly string[]).includes(value);
}

/** A wheel that is registered but not yet implemented fails loudly, never like RGB. */
function notYet(id: ColorWheelId): ColorWheel {
  const fail = (): never => {
    throw new Error(`ColorWheel ${id} is not implemented yet`);
  };
  return { id, hueOf: fail, target: fail, ringStops: fail };
}

const WHEELS: Readonly<Record<ColorWheelId, ColorWheel>> = {
  rgb: RGB_WHEEL,
  ryb: RYB_WHEEL,
  munsell: notYet('munsell'),
  'oklch-hue': OKLCH_HUE_WHEEL,
  'oklch-lightness': notYet('oklch-lightness'),
};

/**
 * Own-property lookup: the id arrives from a share URL, and
 * `WHEELS['toString']` would be truthy under a plain index.
 */
export function getColorWheel(id: ColorWheelId): ColorWheel {
  if (!Object.hasOwn(WHEELS, id)) {
    throw new RangeError(`Unknown colour wheel: ${String(id)}`);
  }
  return WHEELS[id];
}
