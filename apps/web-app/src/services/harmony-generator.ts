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
import { ColorConverter } from '@xivdyetools/core';
import type { Dye } from '@shared/types';
import type { MatchingMethod } from '@shared/tool-config-types';
import type { DyeFilters, DyeFilterConfig } from '@components/dye-filters';

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
  { id: 'square', icon: 'square' },
  { id: 'monochromatic', icon: 'monochromatic' },
  { id: 'compound', icon: 'compound' },
  { id: 'shades', icon: 'shades' },
] as const;

/**
 * Harmony offsets (in degrees) for each harmony type
 */
export const HARMONY_OFFSETS: Record<string, number[]> = {
  complementary: [180],
  analogous: [30, 330],
  triadic: [120, 240],
  'split-complementary': [150, 210],
  tetradic: [60, 180, 240],
  square: [90, 180, 270],
  monochromatic: [0],
  compound: [30, 180, 330],
  shades: [15, 345],
};

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
  switch (matchingMethod) {
    case 'rgb':
      return ColorService.getColorDistance(hex1, hex2);
    case 'cie76':
      return ColorConverter.getDeltaE(hex1, hex2, 'cie76');
    case 'ciede2000':
      return ColorConverter.getDeltaE(hex1, hex2, 'cie2000');
    case 'oklab':
      return ColorConverter.getDeltaE_Oklab(hex1, hex2);
    case 'hyab':
      return ColorConverter.getDeltaE_HyAB(hex1, hex2);
    case 'oklch-weighted':
      return ColorConverter.getDeltaE_OklchWeighted(hex1, hex2);
    default:
      return ColorConverter.getDeltaE_Oklab(hex1, hex2);
  }
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
  let targetHex: string | undefined;
  if (config.usePerceptualMatching && baseDye) {
    const baseSaturation = baseDye.hsv?.s ?? 50;
    const baseValue = baseDye.hsv?.v ?? 50;
    targetHex = ColorService.hsvToHex(targetHue, baseSaturation, baseValue);
  }

  for (const dye of dyes) {
    // Skip Facewear dyes - they have generic names and shouldn't appear in harmony results
    if (dye.category === 'Facewear') {
      continue;
    }

    let deviance: number;

    if (config.usePerceptualMatching && targetHex) {
      // Perceptual matching: use configured matching algorithm
      deviance = calculateColorDistance(targetHex, dye.hex, config.matchingMethod);
    } else {
      // Hue-based matching: use angular distance on color wheel
      const dyeHsv = ColorService.hexToHsv(dye.hex);
      const hueDiff = Math.abs(dyeHsv.h - targetHue);
      deviance = Math.min(hueDiff, 360 - hueDiff);
    }

    scored.push({ dye, deviance });
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
 * @param dyeFilters DyeFilters instance with exclusion rules
 * @param filterConfig Current filter configuration (optional check)
 * @returns Filtered array with excluded dyes replaced by alternatives
 */
export function replaceExcludedDyes(
  dyes: ScoredDyeMatch[],
  targetHue: number,
  dyeFilters: DyeFilters | null,
  filterConfig: DyeFilterConfig | null
): ScoredDyeMatch[] {
  if (!filterConfig || !dyeFilters) {
    return dyes; // No filters active
  }

  const result: ScoredDyeMatch[] = [];
  const usedDyeIds = new Set<number>();
  const allDyes = dyeService.getAllDyes();

  for (const item of dyes) {
    // If dye is not excluded, keep it
    if (!dyeFilters.isDyeExcluded(item.dye)) {
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
        dyeFilters.isDyeExcluded(dye)
      ) {
        continue;
      }

      const distance = ColorService.getColorDistance(targetColor, dye.hex);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestAlternative = dye;
      }
    }

    if (bestAlternative) {
      const deviance = calculateHueDeviance(bestAlternative, targetHue);
      result.push({ dye: bestAlternative, deviance });
      usedDyeIds.add(bestAlternative.itemID);
    }
  }

  return result;
}

/**
 * Find matching dyes for a specific harmony type.
 *
 * @param baseDye The base dye to generate harmonies from
 * @param harmonyType The harmony type ID (e.g., 'complementary', 'triadic')
 * @param config Harmony configuration
 * @param dyeFilters Optional DyeFilters for exclusion rules
 * @param filterConfig Current filter configuration
 * @returns Array of scored dye matches
 */
export function findHarmonyDyes(
  baseDye: Dye,
  harmonyType: string,
  config: HarmonyConfig,
  dyeFilters?: DyeFilters | null,
  filterConfig?: DyeFilterConfig | null
): ScoredDyeMatch[] {
  const offsets = HARMONY_OFFSETS[harmonyType] || [];
  const baseHsv = ColorService.hexToHsv(baseDye.hex);
  const results: ScoredDyeMatch[] = [];

  // Get all dyes from service
  const allDyes = dyeService.getAllDyes();

  for (const offset of offsets) {
    const targetHue = (baseHsv.h + offset) % 360;

    // Find closest dyes to the target hue
    const matches = findClosestDyesToHue(
      allDyes,
      targetHue,
      config.companionDyesCount,
      config,
      baseDye
    );

    for (const match of matches) {
      // Apply filters if configured
      if (filterConfig && dyeFilters?.isDyeExcluded(match.dye)) {
        continue;
      }
      results.push(match);
    }
  }

  return results.slice(0, config.companionDyesCount * offsets.length);
}

/**
 * Generate harmony panel data for a specific offset.
 *
 * @param baseDye The base dye
 * @param offset Hue offset in degrees
 * @param config Harmony configuration
 * @param dyeFilters Optional DyeFilters for exclusion rules
 * @param filterConfig Current filter configuration
 * @param swappedDye Optional user-swapped dye to use instead of best match
 * @returns Object with displayDye, targetColor, deviance, and closestDyes
 */
export function generateHarmonyPanelData(
  baseDye: Dye,
  offset: number,
  config: HarmonyConfig,
  dyeFilters?: DyeFilters | null,
  filterConfig?: DyeFilterConfig | null,
  swappedDye?: Dye | null
): {
  displayDye: Dye;
  targetColor: string;
  deviance: number;
  closestDyes: Dye[];
} {
  const baseHsv = ColorService.hexToHsv(baseDye.hex);
  const targetHue = (baseHsv.h + offset) % 360;
  const targetColor = ColorService.hsvToHex(targetHue, baseHsv.s, baseHsv.v);

  const allDyes = dyeService.getAllDyes();

  // Get extra candidates to allow for filter replacements, then apply filters
  let matches = findClosestDyesToHue(
    allDyes,
    targetHue,
    config.companionDyesCount + 10,
    config,
    baseDye
  );
  matches = replaceExcludedDyes(matches, targetHue, dyeFilters ?? null, filterConfig ?? null);

  // Use swapped dye if user has selected one, otherwise use best match
  const displayDye = swappedDye || matches[0]?.dye || baseDye;
  const deviance = swappedDye
    ? calculateHueDeviance(swappedDye, targetHue)
    : (matches[0]?.deviance ?? 0);

  // Closest dyes excludes the currently displayed dye
  const closestDyes = matches
    .filter((m) => m.dye.itemID !== displayDye.itemID)
    .slice(0, config.companionDyesCount)
    .map((m) => m.dye);

  return { displayDye, targetColor, deviance, closestDyes };
}
