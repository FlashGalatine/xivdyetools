/* istanbul ignore file */
/**
 * Dye Service Singleton Wrapper
 * Wraps xivdyetools-core DyeService with singleton pattern for web app compatibility
 */

import { DyeService as CoreDyeService, dyeDatabase, type Dye } from '@xivdyetools/core';
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

// Re-export Dye type for convenience
export type { Dye };
