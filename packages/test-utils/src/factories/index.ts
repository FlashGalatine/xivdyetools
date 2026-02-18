/**
 * Domain object factories for testing
 *
 * Provides factory functions to create mock domain objects
 * with sensible defaults and random IDs (TEST-DESIGN-001).
 */

export * from './preset.js';
export * from './category.js';
export * from './vote.js';
export * from './user.js';
export * from './dye.js';

// Re-export ID utilities for test setup
// TEST-DESIGN-001: randomId and randomStringId are the recommended functions for parallel-safe tests
export {
  randomId,
  randomStringId,
  resetCounters,
  resetCounter,
  getCounterValue,
} from '../utils/counters.js';
