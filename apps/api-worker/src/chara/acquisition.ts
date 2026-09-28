/**
 * GPOSERS "Acquisition" lines — a build-time table, English only.
 *
 * `scripts/build-acquisition.ts` regenerates `data/acquisition.en.json`
 * (equippable items that have a line) after each patch from Teamcraft's data
 * files and XIVAPI; the worker never computes or fetches acquisition data at
 * request time. Missing means "no line": the glamour export leaves the field
 * for the player (spec: docs/superpowers/specs/2026-09-27-glamour-acquisition-design.md).
 */

import table from './data/acquisition.en.json';

const lines = table as Record<string, string>;

export function acquisitionFor(itemId: number): string | undefined {
  return lines[String(itemId)];
}
