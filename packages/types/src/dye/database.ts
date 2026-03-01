/**
 * @xivdyetools/types - Dye Database Types
 *
 * Types for dye database state and operations.
 *
 * @module dye/database
 */

import type { Dye } from './dye.js';

/**
 * Dye database state
 *
 * Represents the current state of the loaded dye database,
 * including all dyes and metadata about the load state.
 * @internal Apps use core's `DyeDatabase` class, not this interface directly
 */
export interface DyeDatabase {
  /** Array of all loaded dyes */
  dyes: Dye[];

  /** Timestamp when dyes were last loaded (ms since epoch) */
  lastLoaded: number;

  /** True if the database has been successfully loaded */
  isLoaded: boolean;
}
