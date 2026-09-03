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
  // BUG-034: the 1-hour-cached wrappers, exported so callers outside this
  // directory can reach them. `/manual` was using the UNCACHED fetchWorlds /
  // fetchDataCenters on a non-deferred path purely because these were
  // module-private. Those two are no longer re-exported here: every consumer
  // outside this directory wants the cache, and the dead-code gate flagged
  // them the moment `/manual` stopped being the one caller that did not.
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
