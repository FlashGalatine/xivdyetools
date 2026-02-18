/**
 * Swatch Tool OG Image Generator
 *
 * Creates an OG image showing an input color with matched dyes.
 *
 * Layout (1200x630):
 * ┌──────────────────────────────────────────────────────┐
 * │  ✦ XIV DYE TOOLS    SWATCH MATCHER      #8B4513     │
 * ├──────────────────────────────────────────────────────┤
 * │                                                      │
 * │  INPUT COLOR              TOP 5 MATCHES              │
 * │  ┌──────────────┐        ┌────┐ ┌────┐ ┌────┐       │
 * │  │              │        │    │ │    │ │    │       │
 * │  │   #8B4513    │        └────┘ └────┘ └────┘       │
 * │  │              │        Ches.  Orch.  Bark         │
 * │  └──────────────┘        Δ1.2   Δ2.8   Δ3.4         │
 * │                          ┌────┐ ┌────┐               │
 * │                          │    │ │    │               │
 * │                          └────┘ └────┘               │
 * │                          Mesa   Rust                 │
 * │                          Δ4.1   Δ5.0                 │
 * ├──────────────────────────────────────────────────────┤
 * │  🎨 xivdyetools.app                    Algorithm: OKLAB │
 * └──────────────────────────────────────────────────────┘
 */

import { type Dye } from '@xivdyetools/core';
import { rect, text, getContrastTextColor, THEME, FONTS, OG_DIMENSIONS } from './base';
import { generateOGCard, LAYOUT } from './og-card';
import { findClosestDyesWithDistance, findCharacterColorByHex, getCharacterColorFromSheet, type CharacterColorContext } from './dye-helpers';
import type { MatchingAlgorithm, ColorSheetCategory, CharacterGender } from '../../types';

export interface SwatchOGOptions {
  /** Input color hex (without #) */
  color: string;
  /** Number of matches to show (defaults to 5) */
  limit?: number;
  /** Matching algorithm */
  algorithm?: MatchingAlgorithm;
  /** Which color sheet this color is from */
  sheet?: ColorSheetCategory;
  /** Subrace for race-specific sheets (hairColors, skinColors) */
  race?: string;
  /** Gender for race-specific sheets */
  gender?: CharacterGender;
}

/**
 * Generates the Swatch tool OG image SVG
 */
export async function generateSwatchOG(options: SwatchOGOptions): Promise<string> {
  const { color, limit = 5, algorithm = 'oklab', sheet, race, gender } = options;

  // Ensure hex has # prefix
  const hexColor = color.startsWith('#') ? color : `#${color}`;

  // Validate hex color
  if (!/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
    return generateFallbackSwatchOG(algorithm);
  }

  // Find matching dyes (max 4 for cleaner layout)
  const matchLimit = Math.min(Math.max(limit, 1), 4);
  const matches = findClosestDyesWithDistance(hexColor, { limit: matchLimit });

  // Build content elements
  const contentElements: string[] = [];
  const { contentTop, contentHeight, padding } = LAYOUT;

  // Left side: Input color card (vertically centered)
  const leftCardX = padding;
  const leftCardWidth = 320;
  const leftCardHeight = contentHeight - 100;
  const leftCardY = contentTop + (contentHeight - leftCardHeight) / 2;

  // Card background
  contentElements.push(
    rect(leftCardX, leftCardY, leftCardWidth, leftCardHeight, THEME.backgroundCard, {
      rx: 16,
      stroke: THEME.border,
      strokeWidth: 1,
    })
  );

  // "INPUT COLOR" label
  contentElements.push(
    text(leftCardX + leftCardWidth / 2, leftCardY + 30, 'INPUT COLOR', {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Large color swatch
  const inputSwatchSize = 180;
  const inputSwatchX = leftCardX + (leftCardWidth - inputSwatchSize) / 2;
  const inputSwatchY = leftCardY + 60;

  contentElements.push(
    rect(inputSwatchX, inputSwatchY, inputSwatchSize, inputSwatchSize, hexColor, {
      rx: 12,
      stroke: '#ffffff',
      strokeWidth: 3,
    })
  );

  // Hex code inside the swatch
  const textColor = getContrastTextColor(hexColor);
  contentElements.push(
    text(
      inputSwatchX + inputSwatchSize / 2,
      inputSwatchY + inputSwatchSize / 2,
      hexColor.toUpperCase(),
      {
        fill: textColor,
        fontSize: 24,
        fontFamily: FONTS.mono,
        fontWeight: 600,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      }
    )
  );

  // RGB values below
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  contentElements.push(
    text(
      leftCardX + leftCardWidth / 2,
      inputSwatchY + inputSwatchSize + 30,
      `RGB(${r}, ${g}, ${b})`,
      {
        fill: THEME.textMuted,
        fontSize: 13,
        fontFamily: FONTS.mono,
        textAnchor: 'middle',
      }
    )
  );

  // Show input color's position in character creator (if it's a known character color)
  // Use explicit sheet/race/gender params when available for more accurate display
  let characterColorInfo: CharacterColorContext | null = null;
  if (sheet) {
    characterColorInfo = await getCharacterColorFromSheet(hexColor, sheet, race, gender);
  } else {
    const basic = await findCharacterColorByHex(hexColor);
    characterColorInfo = basic
      ? { ...basic, fullName: basic.categoryName, isRaceSpecific: false }
      : null;
  }

  if (characterColorInfo) {
    contentElements.push(
      text(leftCardX + leftCardWidth / 2, inputSwatchY + inputSwatchSize + 55, 'FROM', {
        fill: THEME.textMuted,
        fontSize: 10,
        fontFamily: FONTS.header,
        fontWeight: 600,
        textAnchor: 'middle',
      })
    );

    // Use fullName for race-specific sheets (e.g., "Female Wildwood Hair Colors")
    // or categoryName for shared sheets (e.g., "Eye Colors")
    const displayName = characterColorInfo.fullName || characterColorInfo.categoryName;
    const nameFontSize = displayName.length > 25 ? 11 : displayName.length > 18 ? 12 : 14;

    contentElements.push(
      text(leftCardX + leftCardWidth / 2, inputSwatchY + inputSwatchSize + 75, displayName, {
        fill: THEME.text,
        fontSize: nameFontSize,
        fontFamily: FONTS.primary,
        fontWeight: 500,
        textAnchor: 'middle',
      })
    );

    contentElements.push(
      text(
        leftCardX + leftCardWidth / 2,
        inputSwatchY + inputSwatchSize + 95,
        `Row ${characterColorInfo.row}, Col ${characterColorInfo.col}`,
        {
          fill: THEME.textMuted,
          fontSize: 12,
          fontFamily: FONTS.mono,
          textAnchor: 'middle',
        }
      )
    );
  }

  // Right side: Matched dyes
  const rightStartX = leftCardX + leftCardWidth + 40;
  const rightWidth = OG_DIMENSIONS.width - rightStartX - padding;

  // "TOP MATCHES" label
  contentElements.push(
    text(rightStartX + rightWidth / 2, contentTop + 60, `TOP ${matches.length} MATCHES`, {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Match swatches (single row, vertically centered, larger size)
  const matchSwatchSize = 110;
  const matchGap = 18;
  const matchesPerRow = 4;

  const totalMatchWidth = Math.min(matches.length, matchesPerRow) * matchSwatchSize +
    (Math.min(matches.length, matchesPerRow) - 1) * matchGap;
  const matchStartX = rightStartX + (rightWidth - totalMatchWidth) / 2;

  // Vertical centering: swatch (90px) + labels below (40px) = 130px total
  const matchVisualHeight = matchSwatchSize + 40;
  const matchStartY = contentTop + (contentHeight - matchVisualHeight) / 2;

  matches.forEach((match, index) => {
    const row = Math.floor(index / matchesPerRow);
    const col = index % matchesPerRow;
    const x = matchStartX + col * (matchSwatchSize + matchGap);
    const y = matchStartY + row * (matchSwatchSize + 65);

    // Match swatch
    contentElements.push(
      rect(x, y, matchSwatchSize, matchSwatchSize, match.dye.hex, {
        rx: 8,
        stroke: index === 0 ? THEME.success : THEME.border,
        strokeWidth: index === 0 ? 3 : 1,
      })
    );

    // Rank badge for top match
    if (index === 0) {
      contentElements.push(
        rect(x + matchSwatchSize - 25, y - 5, 30, 20, THEME.success, { rx: 4 })
      );
      contentElements.push(
        text(x + matchSwatchSize - 10, y + 7, '#1', {
          fill: '#000',
          fontSize: 11,
          fontFamily: FONTS.header,
          fontWeight: 700,
          textAnchor: 'middle',
        })
      );
    }

    // Match name (truncated)
    const truncatedName =
      match.dye.name.length > 10 ? match.dye.name.slice(0, 8) + '..' : match.dye.name;
    contentElements.push(
      text(x + matchSwatchSize / 2, y + matchSwatchSize + 18, truncatedName, {
        fill: THEME.text,
        fontSize: 12,
        fontFamily: FONTS.primary,
        fontWeight: index === 0 ? 600 : 400,
        textAnchor: 'middle',
      })
    );

    // Delta value with color coding
    const deltaColor =
      match.distance < 3
        ? THEME.success
        : match.distance < 6
          ? THEME.warning
          : THEME.error;
    contentElements.push(
      text(x + matchSwatchSize / 2, y + matchSwatchSize + 38, `Δ${match.distance.toFixed(1)}`, {
        fill: deltaColor,
        fontSize: 11,
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

  return generateOGCard({
    toolName: 'Swatch Matcher',
    subtitle: hexColor.toUpperCase(),
    content: contentElements.join('\n'),
    algorithm,
  });
}

/**
 * Generates a fallback OG image when color is invalid
 */
function generateFallbackSwatchOG(algorithm: MatchingAlgorithm): string {
  const contentElements: string[] = [];
  const { contentTop, contentHeight } = LAYOUT;

  // Centered message
  contentElements.push(
    text(OG_DIMENSIONS.width / 2, contentTop + contentHeight / 2 - 20, 'Match Any Color', {
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
      'Find FFXIV dyes that match your custom colors',
      {
        fill: THEME.textMuted,
        fontSize: 18,
        fontFamily: FONTS.primary,
        textAnchor: 'middle',
      }
    )
  );

  // Example color swatches
  const colors = [
    { hex: '#8B4513', name: 'Brown' },
    { hex: '#4169E1', name: 'Blue' },
    { hex: '#228B22', name: 'Green' },
    { hex: '#DC143C', name: 'Red' },
    { hex: '#FFD700', name: 'Gold' },
  ];

  const swatchSize = 60;
  const gap = 20;
  const totalWidth = colors.length * swatchSize + (colors.length - 1) * gap;
  const startX = (OG_DIMENSIONS.width - totalWidth) / 2;
  const swatchY = contentTop + contentHeight / 2 + 90;

  colors.forEach((color, i) => {
    const x = startX + i * (swatchSize + gap);
    contentElements.push(rect(x, swatchY, swatchSize, swatchSize, color.hex, { rx: 8 }));
    contentElements.push(
      text(x + swatchSize / 2, swatchY + swatchSize + 18, color.name, {
        fill: THEME.textMuted,
        fontSize: 11,
        fontFamily: FONTS.primary,
        textAnchor: 'middle',
      })
    );
  });

  return generateOGCard({
    toolName: 'Swatch Matcher',
    content: contentElements.join('\n'),
    algorithm,
  });
}
