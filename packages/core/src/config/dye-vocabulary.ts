/**
 * Closed vocabularies for the dye database.
 *
 * Single source of truth for the category/acquisition/currency value sets and
 * the acquisition → (price, currency) coupling. Ported from the retired
 * `apps/maintainer` tool during the Monorepo 2.0 consolidation — but corrected:
 * the maintainer's lists had drifted badly (8 of its 10 acquisition values
 * appeared in zero dyes while 3 real ones were missing).
 *
 * These constants are enforced against `colors_xiv.json` by
 * `__tests__/dye-vocabulary.test.ts`, which replaces the maintainer's
 * validation role (duplicate-ID checks, closed-vocabulary checks) with CI.
 *
 * See docs/research/monorepo-2.0/01-dye-data-format.md — under schema v2 the
 * per-entry `price`/`currency` fields are dropped entirely in favor of
 * `ACQUISITION_META`.
 */

/** Every category value present in the dye database, in display order. */
export const DYE_CATEGORIES = [
  'Neutral',
  'Reds',
  'Browns',
  'Yellows',
  'Greens',
  'Blues',
  'Purples',
  'Special',
  'Facewear',
] as const;

export type DyeCategory = (typeof DYE_CATEGORIES)[number];

/** Every acquisition source present in the dye database. */
export const DYE_ACQUISITIONS = [
  'Dye Vendor',
  'The Firmament',
  'Cosmic Exploration',
  'Venture Coffers',
  'Facewear Collection',
] as const;

export type DyeAcquisition = (typeof DYE_ACQUISITIONS)[number];

export interface AcquisitionMeta {
  /** Vendor price, or null when the source has no fixed price (Facewear). */
  price: number | null;
  /** Currency name, or null when the source has no fixed price (Facewear). */
  currency: string | null;
}

/**
 * The acquisition → (price, currency) coupling. Exactly one pair per
 * acquisition value — verified 136/136 against the dye database.
 */
export const ACQUISITION_META: Record<DyeAcquisition, AcquisitionMeta> = {
  'Dye Vendor': { price: 216, currency: 'Gil' },
  'The Firmament': { price: 100, currency: "Skybuilders' Scrips" },
  'Cosmic Exploration': { price: 600, currency: 'Cosmocredits' },
  'Venture Coffers': { price: 1, currency: 'Venture Coffer' },
  'Facewear Collection': { price: null, currency: null },
};
