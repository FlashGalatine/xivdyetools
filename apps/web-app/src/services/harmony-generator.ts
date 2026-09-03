/**
 * Harmony Generator Service
 * WEB-REF-003 FIX: Extracted from harmony-tool.ts to reduce component size.
 *
 * Provides pure algorithmic functions for:
 * - Harmony offset calculations
 * - Finding dyes closest to target hues
 * - Replacing excluded dyes with alternatives
 * - Color distance calculations for harmony matching
 *
 * @module services/harmony-generator
 */

import { ColorService, dyeService, LanguageService } from '@services/index';
import type { Dye } from '@xivdyetools/types';
import type { MatchingMethod, DyeFiltersConfig } from '@shared/tool-config-types';
import { isDyeExcluded, hasActiveFilters } from '@shared/dye-filter-utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Harmony type info for UI display
 */
export interface HarmonyTypeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/**
 * Scored dye match result
 */
export interface ScoredDyeMatch {
  dye: Dye;
  deviance: number;
}

/**
 * Configuration for harmony generation
 */
export interface HarmonyConfig {
  usePerceptualMatching: boolean;
  matchingMethod: MatchingMethod;
  companionDyesCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Harmony type IDs with their SVG icon names
 */
export const HARMONY_TYPE_IDS = [
  { id: 'complementary', icon: 'complementary' },
  { id: 'analogous', icon: 'analogous' },
  { id: 'triadic', icon: 'triadic' },
  { id: 'split-complementary', icon: 'split-complementary' },
  { id: 'tetradic', icon: 'tetradic' },
  { id: 'inverted-tetradic', icon: 'inverted-tetradic' },
  { id: 'square', icon: 'square' },
  { id: 'monochromatic', icon: 'monochromatic' },
  { id: 'compound', icon: 'compound' },
  { id: 'shades', icon: 'shades' },
] as const;

/**
 * Harmony offsets (in degrees) for each harmony type.
 *
 * BUG-022 (deep dive 2026-09-02): this used to be a private copy, and
 * og-worker's card carried a *different* private copy — so an unfurled share
 * link drew dyes the page it opened never shows. The table now lives in
 * `@xivdyetools/core` and both read it; this re-export keeps the existing
 * `@services/index` consumers (`harmony-tool.ts`, `v4-color-wheel.ts`)
 * unchanged. The values are byte-identical to what this file held.
 */
export { HARMONY_OFFSETS } from '@xivdyetools/core';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get harmony types with localized names and descriptions
 */
export function getHarmonyTypes(): HarmonyTypeInfo[] {
  return HARMONY_TYPE_IDS.map(({ id, icon }) => {
    // Convert id with hyphen to camelCase for core library lookups
    const camelCaseKey = id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return {
      id,
      name: LanguageService.getHarmonyType(camelCaseKey),
      description: LanguageService.t(`harmony.types.${camelCaseKey}Desc`),
      icon,
    };
  });
}

// ============================================================================
// Color Distance Calculations
// ============================================================================

/**
 * Calculate perceptual color distance using the configured matching method.
 *
 * @param hex1 First hex color
 * @param hex2 Second hex color
 * @param matchingMethod The distance algorithm to use
 * @returns Numeric distance (lower = more similar)
 */
export function calculateColorDistance(
  hex1: string,
  hex2: string,
  matchingMethod: MatchingMethod
): number {
  // 5.0: one dispatch suite-wide (dE2000 default lives in core)
  return ColorService.getDistanceForMethod(hex1, hex2, matchingMethod);
}

/**
 * Calculate hue deviance between a dye and target hue.
 *
 * @param dye The dye to compare
 * @param targetHue Target hue in degrees (0-360)
 * @returns Angular distance in degrees (0-180)
 */
export function calculateHueDeviance(dye: Dye, targetHue: number): number {
  const dyeHsv = ColorService.hexToHsv(dye.hex);
  const hueDiff = Math.abs(dyeHsv.h - targetHue);
  return Math.min(hueDiff, 360 - hueDiff);
}

// ============================================================================
// Dye Matching Functions
// ============================================================================

/**
 * The colour a hue offset actually targets under perceptual matching: the base
 * dye's saturation and value carried onto the new hue. `undefined` when
 * perceptual matching is off or there is no base dye, which is the signal to
 * fall back to angular hue distance.
 */
function perceptualTargetHex(
  targetHue: number,
  config: Pick<HarmonyConfig, 'usePerceptualMatching' | 'matchingMethod'>,
  baseDye?: Dye | null
): string | undefined {
  if (!config.usePerceptualMatching || !baseDye) return undefined;
  const baseSaturation = baseDye.hsv?.s ?? 50;
  const baseValue = baseDye.hsv?.v ?? 50;
  return ColorService.hsvToHex(targetHue, baseSaturation, baseValue);
}

/**
 * BUG-064: the single definition of "how far is this dye from the slot's
 * target". Both the primary ranking and the filtered-out-companion REPLACEMENT
 * go through here, so a panel can never mix ΔE units with degrees of hue --
 * which is exactly what it used to do.
 */
function devianceFor(
  dye: Dye,
  targetHue: number,
  config: Pick<HarmonyConfig, 'usePerceptualMatching' | 'matchingMethod'>,
  targetHex: string | undefined
): number {
  if (config.usePerceptualMatching && targetHex) {
    // Perceptual matching: use configured matching algorithm
    return calculateColorDistance(targetHex, dye.hex, config.matchingMethod);
  }
  // Hue-based matching: use angular distance on color wheel
  const dyeHsv = ColorService.hexToHsv(dye.hex);
  const hueDiff = Math.abs(dyeHsv.h - targetHue);
  return Math.min(hueDiff, 360 - hueDiff);
}

/**
 * Find dyes closest to a target hue.
 * Excludes Facewear dyes (generic names like "Red", "Blue").
 * Supports both hue-based (fast) and DeltaE-based (perceptual) matching.
 *
 * @param dyes Array of dyes to search
 * @param targetHue Target hue in degrees (0-360)
 * @param count Number of results to return
 * @param config Harmony configuration
 * @param baseDye Optional base dye for perceptual matching (uses its S/V values)
 * @returns Array of scored dye matches sorted by deviance
 */
export function findClosestDyesToHue(
  dyes: Dye[],
  targetHue: number,
  count: number,
  config: Pick<HarmonyConfig, 'usePerceptualMatching' | 'matchingMethod'>,
  baseDye?: Dye | null
): ScoredDyeMatch[] {
  const scored: ScoredDyeMatch[] = [];

  // For perceptual matching, generate target color from hue
  // Use base dye's saturation and value for consistent matching
  const targetHex = perceptualTargetHex(targetHue, config, baseDye);

  for (const dye of dyes) {
    // Skip Facewear dyes - they have generic names and shouldn't appear in harmony results
    if (dye.category === 'Facewear') {
      continue;
    }

    scored.push({ dye, deviance: devianceFor(dye, targetHue, config, targetHex) });
  }

  scored.sort((a, b) => a.deviance - b.deviance);
  return scored.slice(0, count);
}

/**
 * Replace excluded dyes with alternatives that don't match exclusion criteria.
 * This ensures harmony panels always show the expected number of qualifying dyes.
 *
 * @param dyes Array of scored dye matches to filter
 * @param targetHue Target hue for finding alternatives
 * @param dyeFiltersConfig Dye filter configuration with exclusion rules
 * @returns Filtered array with excluded dyes replaced by alternatives
 */
export function replaceExcludedDyes(
  dyes: ScoredDyeMatch[],
  targetHue: number,
  dyeFiltersConfig: DyeFiltersConfig | null,
  config: Pick<HarmonyConfig, 'usePerceptualMatching' | 'matchingMethod'>,
  baseDye?: Dye | null
): ScoredDyeMatch[] {
  if (!dyeFiltersConfig || !hasActiveFilters(dyeFiltersConfig)) {
    return dyes; // No filters active
  }

  const result: ScoredDyeMatch[] = [];
  const usedDyeIds = new Set<number>();
  const allDyes = dyeService.getAllDyes();
  const targetHex = perceptualTargetHex(targetHue, config, baseDye);

  for (const item of dyes) {
    // If dye is not excluded, keep it
    if (!isDyeExcluded(dyeFiltersConfig, item.dye)) {
      result.push(item);
      usedDyeIds.add(item.dye.itemID);
      continue;
    }

    // Dye is excluded, find alternative using color distance
    const targetColor = item.dye.hex;
    let bestAlternative: Dye | null = null;
    let bestDistance = Infinity;

    for (const dye of allDyes) {
      if (
        usedDyeIds.has(dye.itemID) ||
        dye.category === 'Facewear' ||
        isDyeExcluded(dyeFiltersConfig, dye)
      ) {
        continue;
      }

      // BUG-064: this used ColorService.getColorDistance -- plain Euclidean
      // RGB -- while every other candidate in the same panel was ranked by the
      // user's configured ΔE method. A replacement could therefore be a dye the
      // configured metric would never have chosen.
      const distance = calculateColorDistance(targetColor, dye.hex, config.matchingMethod);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestAlternative = dye;
      }
    }

    if (bestAlternative) {
      // ...and the deviance was on a DIFFERENT SCALE from its siblings' --
      // degrees of hue next to ΔE units -- so the replacement's number could
      // not be compared with the numbers beside it. Same function as the main
      // path now, so the two cannot drift apart again.
      const deviance = devianceFor(bestAlternative, targetHue, config, targetHex);
      result.push({ dye: bestAlternative, deviance });
      usedDyeIds.add(bestAlternative.itemID);
    }
  }

  return result;
}
