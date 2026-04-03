/**
 * XIV Dye Tools v4.0 - Dye Filter Utilities
 *
 * Pure functions for filtering dyes based on DyeFiltersConfig.
 * Decoupled from any component — can be used anywhere.
 *
 * @module shared/dye-filter-utils
 */

import type { Dye } from '@xivdyetools/types';
import type { DyeFiltersConfig } from '@shared/tool-config-types';
import { EXPENSIVE_DYE_IDS, PRICE_CATEGORIES } from '@shared/constants';

/**
 * Check if a dye should be excluded based on filter configuration.
 *
 * @param config The current dye filter settings
 * @param dye The dye to check
 * @returns true if the dye should be excluded
 */
export function isDyeExcluded(config: DyeFiltersConfig, dye: Dye): boolean {
  // Type-based exclusions
  if (config.excludeMetallic && dye.isMetallic) return true;
  if (config.excludePastel && dye.isPastel) return true;
  if (config.excludeDark && dye.isDark) return true;
  if (config.excludeCosmic && dye.isCosmic) return true;
  if (config.excludeIshgardian && dye.isIshgardian) return true;
  if (config.excludeExpensive && EXPENSIVE_DYE_IDS.includes(dye.itemID)) return true;

  // Acquisition-based exclusions
  if (config.excludeVendorDyes) {
    const vendorAcquisitions = PRICE_CATEGORIES.baseDyes.acquisitions as readonly string[];
    if (vendorAcquisitions.includes(dye.acquisition)) return true;
  }

  if (config.excludeCraftDyes) {
    const craftAcquisitions = PRICE_CATEGORIES.craftDyes.acquisitions as readonly string[];
    if (craftAcquisitions.includes(dye.acquisition)) return true;
  }

  if (config.excludeAlliedSocietyDyes) {
    const alliedAcquisitions = PRICE_CATEGORIES.alliedSocietyDyes.acquisitions as readonly string[];
    if (alliedAcquisitions.includes(dye.acquisition)) return true;
  }

  return false;
}

/**
 * Filter an array of dyes, removing excluded ones.
 *
 * @param config The current dye filter settings
 * @param dyes Array of dyes to filter
 * @returns Filtered array with excluded dyes removed
 */
export function filterDyes<T extends Dye>(config: DyeFiltersConfig, dyes: T[]): T[] {
  return dyes.filter((dye) => !isDyeExcluded(config, dye));
}

/**
 * Check if any filters are active (any exclusion enabled).
 *
 * @param config The current dye filter settings
 * @returns true if at least one filter is enabled
 */
export function hasActiveFilters(config: DyeFiltersConfig): boolean {
  return (
    config.excludeMetallic ||
    config.excludePastel ||
    config.excludeDark ||
    config.excludeCosmic ||
    config.excludeIshgardian ||
    config.excludeExpensive ||
    config.excludeVendorDyes ||
    config.excludeCraftDyes ||
    config.excludeAlliedSocietyDyes
  );
}
