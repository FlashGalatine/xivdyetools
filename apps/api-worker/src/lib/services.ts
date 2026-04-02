/**
 * Module-scope service singletons.
 *
 * Initialized once per Worker isolate. The DyeService constructor
 * builds the k-d tree (~1-2ms for 136 dyes), which is then reused
 * for all requests handled by this isolate.
 */

import { DyeService, dyeDatabase, ColorConverter, LocalizationService } from '@xivdyetools/core';
import type { MatchingMethod, OklchWeights } from '@xivdyetools/core';

export const dyeService = new DyeService(dyeDatabase);

export { LocalizationService };

/**
 * Calculate color distance using the specified matching method.
 * Mirrors the private DyeSearch.calculateDistance() logic using
 * public ColorConverter static methods.
 */
export function calculateDistance(
  hex1: string,
  hex2: string,
  method: MatchingMethod,
  weights?: OklchWeights,
): number {
  switch (method) {
    case 'rgb':
      return ColorConverter.getColorDistance(hex1, hex2);
    case 'cie76':
      return ColorConverter.getDeltaE(hex1, hex2, 'cie76');
    case 'ciede2000':
      return ColorConverter.getDeltaE(hex1, hex2, 'cie2000');
    case 'oklab':
      return ColorConverter.getDeltaE_Oklab(hex1, hex2);
    case 'hyab':
      return ColorConverter.getDeltaE_HyAB(hex1, hex2);
    case 'oklch-weighted':
      return ColorConverter.getDeltaE_OklchWeighted(hex1, hex2, weights);
    default:
      return ColorConverter.getDeltaE_Oklab(hex1, hex2);
  }
}
