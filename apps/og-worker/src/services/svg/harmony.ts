/**
 * Harmony Tool OG Image Generator
 *
 * Creates an OG image showing:
 * - Input dye (large swatch with name and hex)
 * - Harmony type visualization
 * - Matched harmony dyes (up to 4)
 *
 * Layout (1200x630):
 * ┌──────────────────────────────────────────────────────┐
 * │  ✦ XIV DYE TOOLS    HARMONY EXPLORER    TETRADIC    │
 * ├────────────────────────┬─────────────────────────────┤
 * │                        │                             │
 * │     INPUT DYE          │      HARMONY MATCHES        │
 * │   ┌──────────────┐     │    ┌────┐ ┌────┐ ┌────┐     │
 * │   │              │     │    │    │ │    │ │    │     │
 * │   │   [COLOR]    │     │    └────┘ └────┘ └────┘     │
 * │   │              │     │    Name   Name   Name       │
 * │   └──────────────┘     │    Δ2.4   Δ3.1   Δ4.2       │
 * │      Mud Green         │                             │
 * │      #585230           │                             │
 * │                        │                             │
 * ├────────────────────────┴─────────────────────────────┤
 * │  🎨 xivdyetools.app                    Algorithm: OKLAB │
 * └──────────────────────────────────────────────────────┘
 */

import { ColorService, ColorConverter, type Dye } from '@xivdyetools/core';
import {
  rect,
  text,
  circle,
  getContrastTextColor,
  THEME,
  FONTS,
  OG_DIMENSIONS,
} from './base';
import { generateOGCard, LAYOUT } from './og-card';
import { dyeService, findClosestDyesWithDistance, getDyeByItemId } from './dye-helpers';
import type { HarmonyType, MatchingAlgorithm } from '../../types';

export interface HarmonyOGOptions {
  /** Dye itemID */
  dyeId: number;
  /** Harmony type */
  harmonyType: HarmonyType;
  /** Matching algorithm */
  algorithm?: MatchingAlgorithm;
}

/**
 * Gets harmony match dyes for a given dye
 */
function getHarmonyMatches(
  dye: Dye,
  harmonyType: HarmonyType,
  _algorithm: MatchingAlgorithm = 'oklab'
): Array<{ dye: Dye; delta: number }> {
  // Generate harmony colors using ColorService (static methods)
  const baseColor = ColorService.hexToLab(dye.hex);
  let targetHues: number[] = [];

  // Convert LAB to approximate hue angle for harmony calculations
  const baseHue = Math.atan2(baseColor.b, baseColor.a) * (180 / Math.PI);

  switch (harmonyType) {
    case 'complementary':
      targetHues = [baseHue + 180];
      break;
    case 'analogous':
      targetHues = [baseHue - 30, baseHue + 30];
      break;
    case 'triadic':
      targetHues = [baseHue + 120, baseHue - 120];
      break;
    case 'split-complementary':
      targetHues = [baseHue + 150, baseHue - 150];
      break;
    case 'tetradic':
      targetHues = [baseHue + 60, baseHue + 180, baseHue + 240];
      break;
    case 'square':
      targetHues = [baseHue + 90, baseHue + 180, baseHue + 270];
      break;
    case 'monochromatic':
      // For monochromatic, find similar dyes with different lightness
      return findClosestDyesWithDistance(dye.hex, { limit: 4, excludeIds: [dye.id] }).map(
        (match) => ({
          dye: match.dye,
          delta: match.distance,
        })
      );
    case 'compound':
      targetHues = [baseHue + 30, baseHue + 150, baseHue - 150, baseHue - 30];
      break;
    case 'shades':
      // Similar to monochromatic
      return findClosestDyesWithDistance(dye.hex, { limit: 4, excludeIds: [dye.id] }).map(
        (match) => ({
          dye: match.dye,
          delta: match.distance,
        })
      );
    default:
      targetHues = [baseHue + 180]; // Default to complementary
  }

  // Find dyes closest to each target hue
  const allDyes = dyeService.getAllDyes();
  const matches: Array<{ dye: Dye; delta: number }> = [];

  for (const targetHue of targetHues) {
    // Normalize hue to 0-360
    const normalizedHue = ((targetHue % 360) + 360) % 360;

    // Find the dye with closest hue
    let bestMatch: { dye: Dye; delta: number } | null = null;
    let bestHueDiff = Infinity;

    for (const candidateDye of allDyes) {
      if (candidateDye.id === dye.id) continue;
      if (matches.some((m) => m.dye.id === candidateDye.id)) continue;

      const candidateLab = ColorService.hexToLab(candidateDye.hex);
      const candidateHue = Math.atan2(candidateLab.b, candidateLab.a) * (180 / Math.PI);
      const normalizedCandidateHue = ((candidateHue % 360) + 360) % 360;

      // Calculate hue difference
      let hueDiff = Math.abs(normalizedHue - normalizedCandidateHue);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;

      // Calculate color distance for delta display
      const delta = ColorConverter.getDeltaE_Oklab(dye.hex, candidateDye.hex);

      if (hueDiff < bestHueDiff) {
        bestHueDiff = hueDiff;
        bestMatch = { dye: candidateDye, delta };
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
    }
  }

  return matches.slice(0, 4);
}

/**
 * Generates the Harmony tool OG image SVG
 */
export function generateHarmonyOG(options: HarmonyOGOptions): string {
  const { dyeId, harmonyType, algorithm = 'oklab' } = options;

  // Look up the dye
  const dye = getDyeByItemId(dyeId);

  if (!dye) {
    return generateFallbackHarmonyOG(harmonyType, algorithm);
  }

  // Get harmony matches
  const matches = getHarmonyMatches(dye, harmonyType, algorithm);

  // Build content elements
  const contentElements: string[] = [];
  const { contentTop, contentHeight, padding } = LAYOUT;

  // Left side: Input dye card (vertically centered)
  const leftCardX = padding;
  const leftCardWidth = 350;
  const leftCardHeight = contentHeight - 60;
  const leftCardY = contentTop + (contentHeight - leftCardHeight) / 2;

  // Card background
  contentElements.push(
    rect(leftCardX, leftCardY, leftCardWidth, leftCardHeight, THEME.backgroundCard, {
      rx: 16,
      stroke: THEME.border,
      strokeWidth: 1,
    })
  );

  // "INPUT" label
  contentElements.push(
    text(leftCardX + leftCardWidth / 2, leftCardY + 30, 'INPUT', {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Large color swatch
  const swatchSize = 160;
  const swatchX = leftCardX + (leftCardWidth - swatchSize) / 2;
  const swatchY = leftCardY + 60;
  contentElements.push(
    rect(swatchX, swatchY, swatchSize, swatchSize, dye.hex, {
      rx: 12,
      stroke: '#ffffff',
      strokeWidth: 3,
    })
  );

  // Dye name
  contentElements.push(
    text(leftCardX + leftCardWidth / 2, swatchY + swatchSize + 40, dye.name, {
      fill: THEME.text,
      fontSize: 24,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Hex code
  contentElements.push(
    text(leftCardX + leftCardWidth / 2, swatchY + swatchSize + 70, dye.hex.toUpperCase(), {
      fill: THEME.textMuted,
      fontSize: 16,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );

  // RGB values
  const r = parseInt(dye.hex.slice(1, 3), 16);
  const g = parseInt(dye.hex.slice(3, 5), 16);
  const b = parseInt(dye.hex.slice(5, 7), 16);
  contentElements.push(
    text(leftCardX + leftCardWidth / 2, swatchY + swatchSize + 95, `RGB(${r}, ${g}, ${b})`, {
      fill: THEME.textMuted,
      fontSize: 12,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );

  // Category info
  contentElements.push(
    text(leftCardX + leftCardWidth / 2, swatchY + swatchSize + 120, `Category: ${dye.category}`, {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.primary,
      fontWeight: 500,
      textAnchor: 'middle',
    })
  );

  // Right side: Harmony matches
  const rightStartX = leftCardX + leftCardWidth + 40;
  const rightWidth = OG_DIMENSIONS.width - rightStartX - padding;

  // "HARMONY MATCHES" label
  contentElements.push(
    text(rightStartX + rightWidth / 2, contentTop + 40, 'HARMONY MATCHES', {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Match swatches (always single row, larger sizes)
  const maxMatches = Math.min(matches.length, 4);
  const matchSwatchSize = maxMatches <= 2 ? 140 : maxMatches === 3 ? 120 : 110;
  const matchGap = maxMatches <= 2 ? 25 : 18;

  const totalMatchWidth = maxMatches * matchSwatchSize + (maxMatches - 1) * matchGap;
  const matchStartX = rightStartX + (rightWidth - totalMatchWidth) / 2;
  const matchStartY = contentTop + (contentHeight - matchSwatchSize - 70) / 2;

  matches.slice(0, maxMatches).forEach((match, index) => {
    const x = matchStartX + index * (matchSwatchSize + matchGap);
    const y = matchStartY;

    // Match swatch
    contentElements.push(
      rect(x, y, matchSwatchSize, matchSwatchSize, match.dye.hex, {
        rx: 10,
        stroke: THEME.border,
        strokeWidth: 2,
      })
    );

    // Match name (truncated)
    const truncatedName =
      match.dye.name.length > 14 ? match.dye.name.slice(0, 12) + '..' : match.dye.name;
    contentElements.push(
      text(x + matchSwatchSize / 2, y + matchSwatchSize + 25, truncatedName, {
        fill: THEME.text,
        fontSize: 14,
        fontFamily: FONTS.primary,
        fontWeight: 500,
        textAnchor: 'middle',
      })
    );

    // Delta value with color coding
    const deltaColor =
      match.delta < 5
        ? THEME.success
        : match.delta < 10
          ? THEME.warning
          : THEME.error;
    contentElements.push(
      text(x + matchSwatchSize / 2, y + matchSwatchSize + 48, `Δ${match.delta.toFixed(1)}`, {
        fill: deltaColor,
        fontSize: 13,
        fontFamily: FONTS.mono,
        textAnchor: 'middle',
      })
    );
  });

  // If no matches found, show a message
  if (matches.length === 0) {
    contentElements.push(
      text(rightStartX + rightWidth / 2, contentTop + contentHeight / 2, 'No matches found', {
        fill: THEME.textMuted,
        fontSize: 18,
        fontFamily: FONTS.primary,
        textAnchor: 'middle',
      })
    );
  }

  // Harmony type name mapping
  const harmonyNames: Record<HarmonyType, string> = {
    complementary: 'Complementary',
    analogous: 'Analogous',
    triadic: 'Triadic',
    'split-complementary': 'Split-Complementary',
    tetradic: 'Tetradic',
    square: 'Square',
    monochromatic: 'Monochromatic',
    compound: 'Compound',
    shades: 'Shades',
  };

  return generateOGCard({
    toolName: 'Harmony Explorer',
    subtitle: harmonyNames[harmonyType] || harmonyType,
    content: contentElements.join('\n'),
    algorithm,
  });
}

/**
 * Generates a fallback OG image when dye is not found
 */
function generateFallbackHarmonyOG(
  harmonyType: HarmonyType,
  algorithm: MatchingAlgorithm
): string {
  const harmonyNames: Record<HarmonyType, string> = {
    complementary: 'Complementary',
    analogous: 'Analogous',
    triadic: 'Triadic',
    'split-complementary': 'Split-Complementary',
    tetradic: 'Tetradic',
    square: 'Square',
    monochromatic: 'Monochromatic',
    compound: 'Compound',
    shades: 'Shades',
  };

  const contentElements: string[] = [];
  const { contentTop, contentHeight } = LAYOUT;

  // Centered message
  contentElements.push(
    text(OG_DIMENSIONS.width / 2, contentTop + contentHeight / 2 - 20, 'Explore Color Harmonies', {
      fill: THEME.text,
      fontSize: 32,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  contentElements.push(
    text(
      OG_DIMENSIONS.width / 2,
      contentTop + contentHeight / 2 + 30,
      'Find matching dyes for your FFXIV glamour',
      {
        fill: THEME.textMuted,
        fontSize: 18,
        fontFamily: FONTS.primary,
        textAnchor: 'middle',
      }
    )
  );

  // Decorative color circles
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];
  const circleY = contentTop + contentHeight / 2 + 100;
  const circleSpacing = 80;
  const startX = (OG_DIMENSIONS.width - (colors.length - 1) * circleSpacing) / 2;

  colors.forEach((color, i) => {
    contentElements.push(circle(startX + i * circleSpacing, circleY, 25, color));
  });

  return generateOGCard({
    toolName: 'Harmony Explorer',
    subtitle: harmonyNames[harmonyType] || harmonyType,
    content: contentElements.join('\n'),
    algorithm,
  });
}
