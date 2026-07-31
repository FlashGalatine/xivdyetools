/**
 * Facewear colors — the 11 glasses-color entries split out of the dye
 * database in schema v2 (Monorepo 2.0; docs/research/monorepo-2.0/01 §3).
 *
 * They are not stains: no stainID, no market presence, no Stain-sheet row.
 */
import type { FacewearColor } from '@xivdyetools/types';
import facewearData from '../data/facewear_colors.json' with { type: 'json' };

export const facewearColors: readonly FacewearColor[] = facewearData as FacewearColor[];

/**
 * Frozen mapping of the pre-v2 synthetic negative itemIDs to facewear slugs.
 *
 * Before schema v2, `DyeDatabase.initialize()` assigned each Facewear entry
 * `-(1000 + Σ charCode(name))`. Those IDs escaped into serialized data
 * (api-worker's public negative-ID lookups, potentially localStorage). This
 * table is FROZEN — computed once from the names as they existed at the
 * split (2026-07-31) and must never be regenerated from live data, or a
 * rename would silently orphan persisted references (research/monorepo-2.0/02).
 */
export const LEGACY_FACEWEAR_ITEM_IDS: Readonly<Record<number, string>> = {
  [-1629]: 'silver',
  [-1390]: 'gold',
  [-1477]: 'black',
  [-1513]: 'white',
  [-1407]: 'grey',
  [-1283]: 'red',
  [-1392]: 'blue',
  [-1497]: 'green',
  [-1507]: 'brass',
  [-1632]: 'purple',
  [-1520]: 'brown',
};

/** Look up a facewear color by its slug id. */
export function getFacewearColor(id: string): FacewearColor | null {
  return facewearColors.find((f) => f.id === id) ?? null;
}

/** Resolve a pre-v2 synthetic negative itemID to its facewear color. */
export function getFacewearColorByLegacyItemID(legacyId: number): FacewearColor | null {
  const slug = LEGACY_FACEWEAR_ITEM_IDS[legacyId];
  return slug ? getFacewearColor(slug) : null;
}
