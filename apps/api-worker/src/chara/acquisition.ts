/**
 * GPOSERS "Acquisition" lines — a build-time table, English only.
 *
 * `scripts/build-acquisition.ts` regenerates `data/acquisition.en.json`
 * (equippable items that have a line) after each patch from Teamcraft's data
 * files and XIVAPI, including "The Faces We Wear" unlock items and their
 * GlassesStyle variant links; the worker never computes or fetches acquisition data at
 * request time. Missing means "no line": the glamour export leaves the field
 * for the player (spec: docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md).
 */

import table from './data/acquisition.en.json';
import facewearUnlocks from './data/facewear-unlocks.json';

const lines = table as Record<string, string>;

export function acquisitionFor(itemId: number): string | undefined {
  return lines[String(itemId)];
}

/** A Glasses row is a color variant; its source is the Item that unlocks the whole style. */
export function facewearAcquisitionFor(glassesId: number): string | undefined {
  const itemId = (facewearUnlocks as Record<string, number>)[String(glassesId)];
  return itemId === undefined ? undefined : acquisitionFor(itemId);
}
