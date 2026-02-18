/**
 * Mixer Blending Engine
 * WEB-REF-003 FIX: Extracted from mixer-tool.ts to reduce component size.
 *
 * Provides pure algorithmic functions for:
 * - Color blending (RGB, LAB, OKLAB, RYB, HSL, Spectral)
 * - Color distance calculation for dye matching
 * - Finding closest matching dyes to a blended color
 *
 * @module services/mixer-blending-engine
 */

import { ColorService, dyeService } from '@services/index';
import { ColorConverter } from '@xivdyetools/core';
import type { Dye } from '@shared/types';
import type { MixingMode, MatchingMethod } from '@shared/tool-config-types';
import type { DyeFilters } from '@components/dye-filters';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of mixing colors and finding matching dyes
 */
export interface MixedColorResult {
  blendedHex: string;
  matchedDye: Dye;
  distance: number;
}

/**
 * Configuration for the blending engine
 */
export interface BlendingConfig {
  mixingMode: MixingMode;
  matchingMethod: MatchingMethod;
  maxResults: number;
}

// ============================================================================
// Color Blending Functions
// ============================================================================

/**
 * Blend two hex colors using the specified mixing algorithm.
 *
 * Color mixing modes and their characteristics:
 * - RGB: Light mixing (additive) - Blue + Yellow = Gray
 * - LAB: Perceptual uniform - Blue + Yellow = Pink (LAB hue distortion)
 * - OKLAB: Modern perceptual - Blue + Yellow = Cyan (fixes LAB issues)
 * - RYB: Paint simulation (Gossett-Chen) - Blue + Yellow = Olive Green
 * - HSL: Hue-based blending
 * - Spectral: Kubelka-Munk physics - Blue + Yellow = Green (most realistic)
 *
 * @param hex1 First hex color
 * @param hex2 Second hex color
 * @param mixingMode The mixing algorithm to use
 * @param ratio Blend ratio (0-1, default 0.5 for equal mix)
 * @returns Blended hex color
 */
export function blendTwoColors(
  hex1: string,
  hex2: string,
  mixingMode: MixingMode,
  ratio: number = 0.5
): string {
  switch (mixingMode) {
    case 'rgb':
      return ColorService.mixColorsRgb(hex1, hex2, ratio);
    case 'lab':
      return ColorService.mixColorsLab(hex1, hex2, ratio);
    case 'oklab':
      return ColorService.mixColorsOklab(hex1, hex2, ratio);
    case 'ryb':
      return ColorService.mixColorsRyb(hex1, hex2, ratio);
    case 'hsl':
      return ColorService.mixColorsHsl(hex1, hex2, ratio);
    case 'spectral':
      return ColorService.mixColorsSpectral(hex1, hex2, ratio);
    default:
      // Default to RYB for paint-like results
      return ColorService.mixColorsRyb(hex1, hex2, ratio);
  }
}

/**
 * Blend multiple hex colors (2 or more) using iterative mixing.
 * Each color contributes equally to the final result.
 *
 * @param hexColors Array of hex colors to blend
 * @param mixingMode The mixing algorithm to use
 * @returns Blended hex color
 */
export function blendColors(hexColors: string[], mixingMode: MixingMode): string {
  if (hexColors.length === 0) return '#000000';
  if (hexColors.length === 1) return hexColors[0];

  // Blend iteratively with weighted ratios for equal contribution
  // Color 1 + Color 2 at 50/50, then result + Color 3 at 66/33
  let result = hexColors[0];
  for (let i = 1; i < hexColors.length; i++) {
    // Each new color contributes 1/(i+1) so all colors end up equal weight
    const ratio = 1 / (i + 1);
    result = blendTwoColors(result, hexColors[i], mixingMode, ratio);
  }
  return result;
}

// ============================================================================
// Color Distance Functions
// ============================================================================

/**
 * Calculate color distance using the specified matching method.
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

// ============================================================================
// Dye Matching Functions
// ============================================================================

/**
 * Find the closest matching dyes to a blended color.
 *
 * @param blendedColor The target color to match (hex)
 * @param config Blending configuration (matchingMethod, maxResults)
 * @param excludeIds Array of dye IDs to exclude from results (e.g., input dyes)
 * @param dyeFilters Optional DyeFilters instance to apply user filter preferences
 * @returns Array of matched dye results sorted by distance
 */
export function findMatchingDyes(
  blendedColor: string,
  config: Pick<BlendingConfig, 'matchingMethod' | 'maxResults'>,
  excludeIds: number[] = [],
  dyeFilters?: DyeFilters | null
): MixedColorResult[] {
  const allDyes = dyeService.getAllDyes();
  const results: MixedColorResult[] = [];

  for (const dye of allDyes) {
    // Skip excluded dyes and Facewear
    if (excludeIds.includes(dye.id) || dye.category === 'Facewear') {
      continue;
    }

    // Apply user filters if available
    if (dyeFilters?.isDyeExcluded(dye)) {
      continue;
    }

    const distance = calculateColorDistance(blendedColor, dye.hex, config.matchingMethod);
    results.push({
      blendedHex: blendedColor,
      matchedDye: dye,
      distance,
    });
  }

  // Sort by distance and take top maxResults
  results.sort((a, b) => a.distance - b.distance);
  return results.slice(0, config.maxResults);
}

/**
 * Get contrasting text color for a background.
 * Returns black or white depending on background luminance.
 *
 * @param hex Background color in hex format
 * @returns '#000000' or '#ffffff'
 */
export function getContrastColor(hex: string): string {
  const rgb = ColorService.hexToRgb(hex);
  // Calculate luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
