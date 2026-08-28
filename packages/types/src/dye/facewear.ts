/**
 * Facewear color entry.
 *
 * Facewear colors are NOT dyes/stains — the game models glasses coloring as a
 * separate system with no Stain-sheet presence (Glamourer: "Glasses do not
 * support dyes whatsoever"). Prior to schema v2 (Monorepo 2.0) they were
 * wedged into the dye database with synthetic negative itemIDs; they now live
 * in their own collection (`facewearColors` in @xivdyetools/core).
 *
 * Tools that support both accept a discriminated union — a `FacewearColor`
 * has a string `id`, a `Dye` has numeric identifiers.
 */
export interface FacewearColor {
  /** Stable slug identifier, e.g. 'silver', 'gold' */
  id: string;
  /** Display name (English), e.g. 'Silver' */
  name: string;
  /** Lowercase 6-digit hex color, e.g. '#c0c0c0' */
  hex: string;
}
