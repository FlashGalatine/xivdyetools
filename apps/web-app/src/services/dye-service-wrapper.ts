/* istanbul ignore file */
/**
 * Dye Service Singleton Wrapper
 * Wraps xivdyetools-core DyeService with singleton pattern for web app compatibility
 */

import { DyeService as CoreDyeService, dyeDatabase } from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import { logger } from '@shared/logger';

/**
 * Web app singleton wrapper for DyeService
 * Maintains backward compatibility with existing code using getInstance()
 */
export class DyeService {
  private static instance: CoreDyeService | null = null;

  /**
   * Get singleton instance of DyeService
   */
  static getInstance(): CoreDyeService {
    if (!DyeService.instance) {
      DyeService.instance = new CoreDyeService(dyeDatabase);
      logger.info('✅ DyeService initialized from xivdyetools-core');
    }
    return DyeService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    DyeService.instance = null;
  }
}

// Export singleton instance for direct use
export const dyeService = DyeService.getInstance();

/**
 * Resolve a preset dye reference. Every source of preset dyes stores stainIDs
 * (1-254): `presets.json` 2.0.0, the community rows in D1, the bot's
 * `/preset submit` (since discord-worker 5.1.0) and this app's own submission
 * form, which rejects anything ≥ 5000.
 *
 * The 4.x legacy-itemID fallback that used to sit here was retired on
 * 2026-09-01 (dead-code audit DEAD-007) once its gate was met: the stainID D1
 * rewrite ran 2026-08-28, and a re-check on the day of removal found 0 legacy
 * IDs across every position of every `dyes` array in all 16 rows (and an empty
 * `previous_values` on all of them).
 *
 * Out-of-range input now resolves to `undefined` — the same "unknown dye"
 * outcome callers already handle for an unrecognised stainID — rather than
 * silently reaching into a second ID space. It is logged, so if legacy data
 * ever reappears it surfaces instead of being quietly absorbed.
 */
export function resolvePresetDye(id: number): Dye | undefined {
  if (!Number.isInteger(id) || id < 1 || id > 254) {
    logger.warn(`resolvePresetDye: ${id} is not a stainID (1-254); no dye resolved`);
    return undefined;
  }
  return dyeService.getByStainId(id) ?? undefined;
}

/** Highest stainID the 5.0 ID space uses. */
const STAIN_ID_MAX = 254;

/**
 * Resolve a *stored* dye reference to a stainID.
 *
 * This is the one place the retired 4.x itemID space is still understood, and
 * it exists for exactly one reason: data this app persisted to the browser
 * before the 2026-08-28 stainID rewrite. Live sources are all stainID-only, so
 * `resolvePresetDye` stays strict; a value that predates the rewrite is
 * converted HERE, once, as it is read back out of local storage.
 *
 * 5.0 values (1-254) pass through when the stainID exists. 4.x values (legacy
 * itemIDs) resolve through the dye database, whose `id`/`itemID` map is built
 * from each dye's `legacyItemID`. Returns null for anything unresolvable — the
 * caller decides whether to drop it or leave it alone.
 */
export function toStainId(stored: number): number | null {
  if (!Number.isFinite(stored)) return null;
  if (stored >= 1 && stored <= STAIN_ID_MAX) {
    return dyeService.getByStainId(stored) ? stored : null;
  }
  // Legacy itemID (dye.id === dye.itemID in 4.x)
  return dyeService.getDyeById(stored)?.stainID ?? null;
}

// Re-export Dye type for convenience
export type { Dye };
