/**
 * Accessibility Tool OG Image Generator
 *
 * Creates an OG image showing dyes with color vision deficiency simulation.
 *
 * Layout (1200x630):
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  ✦ XIV DYE TOOLS       ACCESSIBILITY         PROTANOPIA VIEW    │
 * ├──────────────────────────────────────────────────────────────────┤
 * │                                                                  │
 * │    ORIGINAL COLORS              SIMULATED VIEW                   │
 * │    ┌───┐ ┌───┐ ┌───┐          ┌───┐ ┌───┐ ┌───┐                │
 * │    │   │ │   │ │   │    →     │   │ │   │ │   │                │
 * │    └───┘ └───┘ └───┘          └───┘ └───┘ └───┘                │
 * │    Red   Green  Blue          [Simulated colors]                │
 * │                                                                  │
 * │    Test how your dye choices appear to colorblind players       │
 * │                                                                  │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  🎨 xivdyetools.app                                              │
 * └──────────────────────────────────────────────────────────────────┘
 */

import { type Dye } from '@xivdyetools/core';
import { rect, text, hexToRgb, rgbToHex, THEME, FONTS, OG_DIMENSIONS } from './base';
import { generateOGCard, LAYOUT } from './og-card';
import { getDyeByItemId } from './dye-helpers';
import type { VisionType } from '../../types';

export interface AccessibilityOGOptions {
  /** Array of dye itemIDs (1-4) */
  dyeIds: number[];
  /** Vision type to simulate */
  visionType?: VisionType;
}

/**
 * Vision type display names
 */
const VISION_NAMES: Record<VisionType, string> = {
  normal: 'Normal Vision',
  protanopia: 'Protanopia',
  deuteranopia: 'Deuteranopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
};

/**
 * Vision type descriptions
 */
const VISION_DESCRIPTIONS: Record<VisionType, string> = {
  normal: 'Full color vision',
  protanopia: 'Red-blind (no red cones)',
  deuteranopia: 'Green-blind (no green cones)',
  tritanopia: 'Blue-blind (no blue cones)',
  achromatopsia: 'Complete color blindness',
};

/**
 * Color vision simulation matrices
 * Based on Brettel, Viénot, and Mollon (1997) simulation
 */
const VISION_MATRICES: Record<VisionType, number[][]> = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protanopia: [
    [0.567, 0.433, 0],
    [0.558, 0.442, 0],
    [0, 0.242, 0.758],
  ],
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  tritanopia: [
    [0.95, 0.05, 0],
    [0, 0.433, 0.567],
    [0, 0.475, 0.525],
  ],
  achromatopsia: [
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
    [0.299, 0.587, 0.114],
  ],
};

/**
 * Simulates how a color appears under a specific vision type
 */
function simulateColorVision(hex: string, visionType: VisionType): string {
  if (visionType === 'normal') return hex;

  const { r, g, b } = hexToRgb(hex);
  const matrix = VISION_MATRICES[visionType];

  // Apply the transformation matrix
  const newR = Math.round(
    Math.min(255, Math.max(0, matrix[0][0] * r + matrix[0][1] * g + matrix[0][2] * b))
  );
  const newG = Math.round(
    Math.min(255, Math.max(0, matrix[1][0] * r + matrix[1][1] * g + matrix[1][2] * b))
  );
  const newB = Math.round(
    Math.min(255, Math.max(0, matrix[2][0] * r + matrix[2][1] * g + matrix[2][2] * b))
  );

  return rgbToHex(newR, newG, newB);
}

/**
 * Generates the Accessibility tool OG image SVG
 */
export function generateAccessibilityOG(options: AccessibilityOGOptions): string {
  const { dyeIds, visionType = 'protanopia' } = options;

  // Look up all dyes
  const dyes: Dye[] = dyeIds
    .map((id) => getDyeByItemId(id))
    .filter((d): d is Dye => d !== undefined)
    .slice(0, 4);

  if (dyes.length === 0) {
    return generateFallbackAccessibilityOG(visionType);
  }

  // Build content elements
  const contentElements: string[] = [];
  const { contentTop, contentHeight, padding } = LAYOUT;

  // Calculate layout based on number of dyes
  const numDyes = dyes.length;
  const swatchSize = numDyes === 1 ? 140 : numDyes === 2 ? 120 : numDyes === 3 ? 100 : 85;
  const gap = numDyes <= 2 ? 20 : 15;

  // Two columns: Original and Simulated
  const columnWidth = (OG_DIMENSIONS.width - padding * 3) / 2;
  const leftColumnX = padding;
  const rightColumnX = padding * 2 + columnWidth;

  // Arrow position
  const arrowX = OG_DIMENSIONS.width / 2;

  // Calculate total content height for vertical centering
  const labelHeight = 25;
  const labelToSwatchGap = 20;
  const swatchLabelHeight = 30;
  const swatchToInfoGap = 25;
  const infoBoxHeight = 80;

  const totalContentHeight = labelHeight + labelToSwatchGap + swatchSize + swatchLabelHeight + swatchToInfoGap + infoBoxHeight;
  // Center content vertically with offset to account for header/footer visual weight
  const contentStartY = contentTop + (contentHeight - totalContentHeight) / 2 + 40;

  // "ORIGINAL COLORS" label
  contentElements.push(
    text(leftColumnX + columnWidth / 2, contentStartY + labelHeight / 2, 'ORIGINAL COLORS', {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // "SIMULATED VIEW" label
  contentElements.push(
    text(rightColumnX + columnWidth / 2, contentStartY + labelHeight / 2, 'SIMULATED VIEW', {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Calculate swatch positioning
  const totalSwatchWidth = numDyes * swatchSize + (numDyes - 1) * gap;
  const swatchStartXLeft = leftColumnX + (columnWidth - totalSwatchWidth) / 2;
  const swatchStartXRight = rightColumnX + (columnWidth - totalSwatchWidth) / 2;
  const swatchY = contentStartY + labelHeight + labelToSwatchGap;

  // Draw original colors (left side)
  dyes.forEach((dye, index) => {
    const x = swatchStartXLeft + index * (swatchSize + gap);

    // Original color swatch
    contentElements.push(
      rect(x, swatchY, swatchSize, swatchSize, dye.hex, {
        rx: 8,
        stroke: THEME.border,
        strokeWidth: 2,
      })
    );

    // Dye name
    const truncatedName = dye.name.length > 10 ? dye.name.slice(0, 8) + '..' : dye.name;
    contentElements.push(
      text(x + swatchSize / 2, swatchY + swatchSize + 18, truncatedName, {
        fill: THEME.text,
        fontSize: numDyes <= 2 ? 13 : 11,
        fontFamily: FONTS.primary,
        fontWeight: 500,
        textAnchor: 'middle',
      })
    );
  });

  // Draw arrow between columns
  const arrowY = swatchY + swatchSize / 2;
  contentElements.push(
    text(arrowX, arrowY, '→', {
      fill: THEME.accent,
      fontSize: 48,
      fontFamily: FONTS.primary,
      fontWeight: 700,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    })
  );

  // Draw simulated colors (right side)
  dyes.forEach((dye, index) => {
    const x = swatchStartXRight + index * (swatchSize + gap);
    const simulatedHex = simulateColorVision(dye.hex, visionType);

    // Simulated color swatch
    contentElements.push(
      rect(x, swatchY, swatchSize, swatchSize, simulatedHex, {
        rx: 8,
        stroke: THEME.border,
        strokeWidth: 2,
      })
    );

    // Simulated hex
    contentElements.push(
      text(x + swatchSize / 2, swatchY + swatchSize + 18, simulatedHex.toUpperCase(), {
        fill: THEME.textMuted,
        fontSize: numDyes <= 2 ? 11 : 9,
        fontFamily: FONTS.mono,
        textAnchor: 'middle',
      })
    );
  });

  // Vision type info box at bottom (positioned relative to centered content)
  const infoBoxY = swatchY + swatchSize + swatchLabelHeight + swatchToInfoGap;
  const infoBoxWidth = 500;
  const infoBoxX = (OG_DIMENSIONS.width - infoBoxWidth) / 2;

  // Info box background
  contentElements.push(
    rect(infoBoxX, infoBoxY, infoBoxWidth, infoBoxHeight, THEME.backgroundCard, {
      rx: 12,
      stroke: THEME.border,
      strokeWidth: 1,
    })
  );

  // Vision type name
  contentElements.push(
    text(OG_DIMENSIONS.width / 2, infoBoxY + 30, VISION_NAMES[visionType], {
      fill: THEME.text,
      fontSize: 22,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Vision type description
  contentElements.push(
    text(OG_DIMENSIONS.width / 2, infoBoxY + 58, VISION_DESCRIPTIONS[visionType], {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  return generateOGCard({
    toolName: 'Accessibility',
    subtitle: VISION_NAMES[visionType],
    content: contentElements.join('\n'),
  });
}

/**
 * Generates a fallback OG image when no dyes are provided
 */
function generateFallbackAccessibilityOG(visionType: VisionType): string {
  const contentElements: string[] = [];
  const { contentTop, contentHeight } = LAYOUT;

  // Centered message
  contentElements.push(
    text(
      OG_DIMENSIONS.width / 2,
      contentTop + contentHeight / 2 - 40,
      'Color Vision Accessibility',
      {
        fill: THEME.text,
        fontSize: 32,
        fontFamily: FONTS.header,
        fontWeight: 600,
        textAnchor: 'middle',
      }
    )
  );

  contentElements.push(
    text(
      OG_DIMENSIONS.width / 2,
      contentTop + contentHeight / 2 + 10,
      'See how your dye choices appear to colorblind players',
      {
        fill: THEME.textMuted,
        fontSize: 18,
        fontFamily: FONTS.primary,
        textAnchor: 'middle',
      }
    )
  );

  // Example showing vision type simulations
  const exampleColors = ['#ef4444', '#22c55e', '#3b82f6', '#eab308'];
  const swatchSize = 50;
  const gap = 15;

  // Original row
  const totalWidth = exampleColors.length * swatchSize + (exampleColors.length - 1) * gap;
  const startX = (OG_DIMENSIONS.width - totalWidth) / 2;
  const originalY = contentTop + contentHeight / 2 + 70;

  contentElements.push(
    text(startX - 100, originalY + swatchSize / 2, 'Original:', {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primary,
      textAnchor: 'end',
      dominantBaseline: 'middle',
    })
  );

  exampleColors.forEach((color, i) => {
    const x = startX + i * (swatchSize + gap);
    contentElements.push(rect(x, originalY, swatchSize, swatchSize, color, { rx: 6 }));
  });

  // Simulated row
  const simulatedY = originalY + swatchSize + 20;

  contentElements.push(
    text(startX - 100, simulatedY + swatchSize / 2, `${VISION_NAMES[visionType]}:`, {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primary,
      textAnchor: 'end',
      dominantBaseline: 'middle',
    })
  );

  exampleColors.forEach((color, i) => {
    const x = startX + i * (swatchSize + gap);
    const simulated = simulateColorVision(color, visionType);
    contentElements.push(rect(x, simulatedY, swatchSize, swatchSize, simulated, { rx: 6 }));
  });

  return generateOGCard({
    toolName: 'Accessibility',
    subtitle: VISION_NAMES[visionType],
    content: contentElements.join('\n'),
  });
}
