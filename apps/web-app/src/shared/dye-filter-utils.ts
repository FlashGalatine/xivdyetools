/**
 * XIV Dye Tools v4.0 - Dye Filter Utilities
 *
 * Wraps @xivdyetools/core's filter vocabulary with the web-side Coffer
 * exclusion ("hide the twenty market-only dyes", drawn 9C). Core's
 * excludeCraftDyes bundles Venture Coffers with Firmament dyes and can't
 * express coffer-only, so the overlay lives here — every tool imports
 * these three functions from this module, never from core directly.
 *
 * @module shared/dye-filter-utils
 */

import {
  isDyeExcluded as coreIsDyeExcluded,
  filterDyes as coreFilterDyes,
  hasActiveFilters as coreHasActiveFilters,
} from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import type { DyeFiltersConfig } from '@shared/tool-config-types';

const COFFER_ACQUISITION = 'Venture Coffers';

export function isDyeExcluded(filters: DyeFiltersConfig, dye: Dye): boolean {
  if (filters.excludeCoffers && dye.acquisition === COFFER_ACQUISITION) return true;
  return coreIsDyeExcluded(filters, dye);
}

export function filterDyes<T extends Dye>(filters: DyeFiltersConfig, dyes: T[]): T[] {
  if (!filters.excludeCoffers) return coreFilterDyes(filters, dyes);
  return coreFilterDyes(
    filters,
    dyes.filter((d) => d.acquisition !== COFFER_ACQUISITION)
  );
}

export function hasActiveFilters(filters: DyeFiltersConfig): boolean {
  return Boolean(filters.excludeCoffers) || coreHasActiveFilters(filters);
}
