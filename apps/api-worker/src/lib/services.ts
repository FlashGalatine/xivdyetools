/**
 * Module-scope service singletons.
 *
 * Initialized once per Worker isolate. The DyeService constructor
 * builds the k-d tree (~1-2ms for 125 dyes), which is then reused
 * for all requests handled by this isolate.
 */

import { DyeService, dyeDatabase, ColorService, LocalizationService } from '@xivdyetools/core';
import type { MatchingMethod } from '@xivdyetools/core';

export const dyeService = new DyeService(dyeDatabase);

export { LocalizationService };

/**
 * Calculate color distance in a 5.0 matching-vocabulary method's native
 * unit. Delegates to the one shared dispatch in core.
 */
export function calculateDistance(hex1: string, hex2: string, method: MatchingMethod): number {
  return ColorService.getDistanceForMethod(hex1, hex2, method);
}
