/**
 * The colour-wheel registry — the ONE list every surface reads.
 *
 * @module services/dye/wheels/ColorWheel
 */

import type { ColorWheelId } from '@xivdyetools/types';
import { MUNSELL_WHEEL } from './munsell.js';
import { OKLCH_HUE_WHEEL } from './oklch-hue.js';
import { OKLCH_LIGHTNESS_WHEEL } from './oklch-lightness.js';
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

/** Lower-cased, trimmed id when recognised; undefined for anything else (absent, empty, unknown). */
export function parseColorWheelId(value: unknown): ColorWheelId | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  return isColorWheelId(v) ? v : undefined;
}

/** `parseColorWheelId(value) ?? DEFAULT_COLOR_WHEEL` — "absent or unknown means rgb", in one place. */
export function normalizeColorWheelId(value: unknown): ColorWheelId {
  return parseColorWheelId(value) ?? DEFAULT_COLOR_WHEEL;
}

/**
 * The short tag each wheel prints in a card footer. Identifiers, never
 * localised — the OG footer tag sits beside `algoTag`, which is the same kind
 * of token, and a translated one would make two cards of the same wheel
 * unrecognisable as such.
 */
export const COLOR_WHEEL_TAGS: Record<ColorWheelId, string> = {
  rgb: 'RGB',
  ryb: 'RYB',
  munsell: 'MUNSELL',
  'oklch-hue': 'OKLCH·H',
  'oklch-lightness': 'OKLCH·L',
};

const WHEELS: Readonly<Record<ColorWheelId, ColorWheel>> = {
  rgb: RGB_WHEEL,
  ryb: RYB_WHEEL,
  munsell: MUNSELL_WHEEL,
  'oklch-hue': OKLCH_HUE_WHEEL,
  'oklch-lightness': OKLCH_LIGHTNESS_WHEEL,
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
