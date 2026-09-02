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
  fetchWorlds,
  fetchDataCenters,
  // BUG-034: the 1-hour-cached wrappers, exported so callers outside this
  // directory can reach them. `/manual` was using the uncached pair on a
  // non-deferred path because these were module-private.
  getCachedWorlds,
  getCachedDataCenters,
  validateWorld,
  getWorldAutocomplete,
} from './universalis-client.js';

// Budget calculator (13G ledger model)
export {
  findBudgetLedger,
  resolveTargetDye,
  getDyeByName,
  getDyeAutocomplete,
} from './budget-calculator.js';

// Quick picks
export { getQuickPickById } from './quick-picks.js';
