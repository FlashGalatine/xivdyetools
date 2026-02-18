/**
 * Budget Services
 *
 * Exports for the budget dye finder feature.
 *
 * @module services/budget
 */

// Universalis API client
export {
  isUniversalisEnabled,
  fetchPrices,
  fetchPricesBatched,
  fetchWorlds,
  fetchDataCenters,
  validateWorld,
  getWorldAutocomplete,
} from './universalis-client.js';

export type { UniversalisWorld, UniversalisDataCenter } from './universalis-client.js';

// Price cache
export {
  CACHE_TTL_SECONDS,
  getCachedPrice,
  getCachedPriceWithStale,
  setCachedPrice,
  getCachedPrices,
  setCachedPrices,
  fetchWithCache,
  invalidateCachedPrice,
} from './price-cache.js';

// Budget calculator
export {
  findCheaperAlternatives,
  searchDyes,
  getDyeById,
  getDyeByName,
  getDyeAutocomplete,
  getAllDyes,
  getCategories,
} from './budget-calculator.js';

// Quick picks
export { QUICK_PICKS, getQuickPickById, getQuickPickChoices } from './quick-picks.js';
