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
 * Resolve a preset dye reference. presets.json 2.0.0 and migrated community
 * rows store stainIDs (1-254); community rows served by the live API keep
 * legacy itemIDs (>=5729) until the user-run D1 migration lands. The two ID
 * spaces are disjoint, so route by range — never guess.
 */
export function resolvePresetDye(id: number): Dye | undefined {
  return id > 0 && id <= 254
    ? (dyeService.getByStainId(id) ?? undefined)
    : (dyeService.getDyeById(id) ?? undefined);
}

// Re-export Dye type for convenience
export type { Dye };
