/**
 * Dye Filter Utilities
 *
 * Pure functions for filtering dyes by type and acquisition source.
 * Shared across web-app, discord-worker, api-worker, and bot-logic.
 *
 * @module services/dye/DyeFilter
 */

import type { Dye, DyeTypeFilters } from '@xivdyetools/types';

// ============================================================================
// Constants
// ============================================================================

/** Item IDs for Pure White and Jet Black dyes */
export const EXPENSIVE_DYE_IDS: readonly number[] = [13114, 13115];

/** Acquisition strings for vendor-sold (base) dyes */
export const VENDOR_ACQUISITIONS: readonly string[] = ['Dye Vendor'];

/** Acquisition strings for crafted dyes */
export const CRAFT_ACQUISITIONS: readonly string[] = ['Crafting', 'Treasure Chest'];

/** Acquisition strings for allied society dyes */
export const ALLIED_SOCIETY_ACQUISITIONS: readonly string[] = [
  "Amalj'aa Vendor",
  'Ixali Vendor',
  'Sahagin Vendor',
  'Kobold Vendor',
  'Sylphic Vendor',
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Check if a dye should be excluded based on filter configuration.
 *
 * @param filters - The active dye filters (undefined fields = not excluded)
 * @param dye - The dye to check
 * @returns `true` if the dye should be excluded from results
 */
export function isDyeExcluded(filters: DyeTypeFilters, dye: Dye): boolean {
  // Type-based exclusions
  if (filters.excludeMetallic && dye.isMetallic) return true;
  if (filters.excludePastel && dye.isPastel) return true;
  if (filters.excludeDark && dye.isDark) return true;
  if (filters.excludeCosmic && dye.isCosmic) return true;
  if (filters.excludeIshgardian && dye.isIshgardian) return true;
  if (filters.excludeExpensive && EXPENSIVE_DYE_IDS.includes(dye.itemID)) return true;

  // Acquisition-based exclusions
  if (filters.excludeVendorDyes && VENDOR_ACQUISITIONS.includes(dye.acquisition)) return true;
  if (filters.excludeCraftDyes && CRAFT_ACQUISITIONS.includes(dye.acquisition)) return true;
  if (filters.excludeAlliedSocietyDyes && ALLIED_SOCIETY_ACQUISITIONS.includes(dye.acquisition)) return true;

  return false;
}

/**
 * Filter an array of dyes, removing excluded ones.
 *
 * @param filters - The active dye filters
 * @param dyes - Array of dyes to filter
 * @returns Filtered array with excluded dyes removed
 */
export function filterDyes<T extends Dye>(filters: DyeTypeFilters, dyes: T[]): T[] {
  return dyes.filter((dye) => !isDyeExcluded(filters, dye));
}

/**
 * Check if any filters are active (any exclusion enabled).
 *
 * @param filters - The filter configuration to check
 * @returns `true` if at least one filter is enabled
 */
export function hasActiveFilters(filters: DyeTypeFilters): boolean {
  return !!(
    filters.excludeMetallic ||
    filters.excludePastel ||
    filters.excludeDark ||
    filters.excludeCosmic ||
    filters.excludeIshgardian ||
    filters.excludeExpensive ||
    filters.excludeVendorDyes ||
    filters.excludeCraftDyes ||
    filters.excludeAlliedSocietyDyes
  );
}
