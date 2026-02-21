/**
 * Comparison Grid SVG Generator
 *
 * Generates a visual side-by-side comparison of 2-4 FFXIV dyes.
 * Shows color swatches, hex/RGB/HSV values, and pairwise analysis.
 *
 * Layout:
 * +----------------------------------------------------------+
 * |  [Swatch 1]    [Swatch 2]    [Swatch 3]    [Swatch 4]    |
 * |  Dye Name 1    Dye Name 2    Dye Name 3    Dye Name 4    |
 * |  #FF0000       #00FF00       #0000FF       #FFFF00       |
 * |  RGB: ...      RGB: ...      RGB: ...      RGB: ...      |
 * |  HSV: ...      HSV: ...      HSV: ...      HSV: ...      |
 * +----------------------------------------------------------+
 * |               Color Distance Matrix                       |
 * |  1↔2: 255   1↔3: 360   1↔4: 180                          |
 * +----------------------------------------------------------+
 *
 * @module services/svg/comparison-grid
 */

import type { Dye } from '@xivdyetools/core';
import { ColorService } from '@xivdyetools/core';
import {
  createSvgDocument,
  rect,
  text,
  line,
  THEME,
  FONTS,
  escapeXml,
  getContrastTextColor,
  hexToRgb,
} from './base.js';
import { rgbToLab } from '@xivdyetools/color-blending';

// ============================================================================
// Types
// ============================================================================

/**
 * A dye entry for comparison
 */
export interface ComparisonDye {
  /** Dye information */
  dye: Dye;
  /** Index in comparison (1-4) */
  index: number;
}

/**
 * Pairwise distance between two dyes
 */
export interface DyePair {
  /** First dye index */
  index1: number;
  /** Second dye index */
  index2: number;
  /** Color distance (Euclidean in RGB space) */
  distance: number;
  /** WCAG contrast ratio */
  contrastRatio: number;
}

/**
 * Options for generating the comparison grid
 */
export interface ComparisonGridOptions {
  /** Array of dyes to compare (2-4) */
  dyes: Dye[];
  /** Canvas width in pixels (default: 800) */
  width?: number;
  /** Show HSV values (default: true) */
  showHsv?: boolean;
  /** Show LAB values (default: true) - V4 enhancement for perceptual color info */
  showLab?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 800;
const PADDING = 24;
const SWATCH_SIZE = 100;
const TITLE_HEIGHT = 50;
const DYE_SECTION_HEIGHT = 220; // Increased for LAB values
const MATRIX_SECTION_HEIGHT = 120;

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Convert RGB to HSV
 */
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

/**
 * Calculate Euclidean color distance in RGB space.
 * Delegates to ColorService to avoid duplication (REFACTOR-001).
 */
function getColorDistance(hex1: string, hex2: string): number {
  return ColorService.getColorDistance(hex1, hex2);
}

/**
 * Calculate relative luminance for WCAG contrast
 */
function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate WCAG contrast ratio
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Get contrast rating based on WCAG guidelines
 */
function getContrastRating(ratio: number): { label: string; color: string } {
  if (ratio >= 7) return { label: 'AAA', color: THEME.success };
  if (ratio >= 4.5) return { label: 'AA', color: '#3b82f6' }; // Blue
  if (ratio >= 3) return { label: 'AA Large', color: '#22c55e' }; // Green
  return { label: 'Fail', color: THEME.error };
}

/**
 * Get distance quality label
 */
function getDistanceLabel(distance: number): { label: string; color: string } {
  if (distance < 30) return { label: 'Very Similar', color: THEME.success };
  if (distance < 80) return { label: 'Similar', color: '#22c55e' };
  if (distance < 150) return { label: 'Different', color: '#f59e0b' }; // Amber
  return { label: 'Very Different', color: THEME.error };
}

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Generate a comparison grid SVG showing dyes side-by-side
 */
export function generateComparisonGrid(options: ComparisonGridOptions): string {
  const { dyes, width = DEFAULT_WIDTH, showHsv = true, showLab = true } = options;

  if (dyes.length < 2) {
    return generateEmptyComparison(width);
  }

  // Calculate pairwise distances
  const pairs: DyePair[] = [];
  for (let i = 0; i < dyes.length; i++) {
    for (let j = i + 1; j < dyes.length; j++) {
      pairs.push({
        index1: i + 1,
        index2: j + 1,
        distance: getColorDistance(dyes[i].hex, dyes[j].hex),
        contrastRatio: getContrastRatio(dyes[i].hex, dyes[j].hex),
      });
    }
  }

  // Find most and least similar
  const sortedByDistance = [...pairs].sort((a, b) => a.distance - b.distance);
  const mostSimilar = sortedByDistance[0];
  const leastSimilar = sortedByDistance[sortedByDistance.length - 1];

  // Calculate dimensions
  const height = PADDING * 2 + TITLE_HEIGHT + DYE_SECTION_HEIGHT + MATRIX_SECTION_HEIGHT;

  const elements: string[] = [];

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  // Title
  elements.push(
    text(width / 2, PADDING + 24, 'Dye Comparison', {
      fill: THEME.text,
      fontSize: 22,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Dye columns
  const columnWidth = (width - PADDING * 2) / dyes.length;
  const dyeStartY = PADDING + TITLE_HEIGHT;

  dyes.forEach((dye, index) => {
    const columnX = PADDING + index * columnWidth + columnWidth / 2;
    elements.push(generateDyeColumn(dye, index + 1, columnX, dyeStartY, columnWidth, showHsv, showLab));
  });

  // Separator line
  const matrixY = dyeStartY + DYE_SECTION_HEIGHT;
  elements.push(line(PADDING, matrixY, width - PADDING, matrixY, THEME.border, 1));

  // Analysis section
  elements.push(generateAnalysisSection(pairs, mostSimilar, leastSimilar, dyes, PADDING, matrixY + 10, width - PADDING * 2));

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Generate a single dye column
 */
function generateDyeColumn(
  dye: Dye,
  index: number,
  centerX: number,
  startY: number,
  columnWidth: number,
  showHsv: boolean,
  showLab: boolean
): string {
  const elements: string[] = [];
  const rgb = hexToRgb(dye.hex);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const lab = showLab ? rgbToLab(rgb) : null;

  // Index badge
  elements.push(
    `<circle cx="${centerX}" cy="${startY + 10}" r="12" fill="${THEME.accent}"/>`
  );
  elements.push(
    text(centerX, startY + 14, index.toString(), {
      fill: '#ffffff',
      fontSize: 12,
      fontFamily: FONTS.primary,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Color swatch
  const swatchX = centerX - SWATCH_SIZE / 2;
  const swatchY = startY + 28;
  elements.push(
    rect(swatchX, swatchY, SWATCH_SIZE, SWATCH_SIZE, dye.hex, {
      rx: 8,
      ry: 8,
      stroke: THEME.border,
      strokeWidth: 2,
    })
  );

  // Dye name on swatch
  const textColor = getContrastTextColor(dye.hex);
  const maxNameLength = 12;
  const displayName = dye.name.length > maxNameLength
    ? dye.name.substring(0, maxNameLength - 1) + '...'
    : dye.name;
  elements.push(
    text(centerX, swatchY + SWATCH_SIZE / 2 + 4, displayName, {
      fill: textColor,
      fontSize: 11,
      fontFamily: FONTS.primaryCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Dye name (full, below swatch)
  let infoY = swatchY + SWATCH_SIZE + 20;
  elements.push(
    text(centerX, infoY, escapeXml(dye.name), {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.primaryCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Category
  infoY += 16;
  elements.push(
    text(centerX, infoY, dye.category, {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primaryCjk,
      textAnchor: 'middle',
    })
  );

  // Hex value
  infoY += 18;
  elements.push(
    text(centerX, infoY, dye.hex.toUpperCase(), {
      fill: THEME.text,
      fontSize: 12,
      fontFamily: FONTS.mono,
      fontWeight: 500,
      textAnchor: 'middle',
    })
  );

  // RGB value
  infoY += 16;
  elements.push(
    text(centerX, infoY, `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`, {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );

  // HSV value (optional)
  if (showHsv) {
    infoY += 14;
    elements.push(
      text(centerX, infoY, `HSV(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`, {
        fill: THEME.textDim,
        fontSize: 10,
        fontFamily: FONTS.mono,
        textAnchor: 'middle',
      })
    );
  }

  // LAB value (V4 enhancement - perceptual color space)
  if (showLab && lab) {
    infoY += 14;
    elements.push(
      text(centerX, infoY, `LAB(${lab.l.toFixed(0)}, ${lab.a.toFixed(0)}, ${lab.b.toFixed(0)})`, {
        fill: THEME.textDim,
        fontSize: 10,
        fontFamily: FONTS.mono,
        textAnchor: 'middle',
      })
    );
  }

  return elements.join('\n');
}

/**
 * Generate the analysis section showing pairwise comparisons
 */
function generateAnalysisSection(
  pairs: DyePair[],
  mostSimilar: DyePair,
  leastSimilar: DyePair,
  dyes: Dye[],
  x: number,
  y: number,
  width: number
): string {
  const elements: string[] = [];

  // Section title
  elements.push(
    text(x + width / 2, y + 20, 'Color Analysis', {
      fill: THEME.text,
      fontSize: 14,
      fontFamily: FONTS.primary,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Two columns: Most Similar and Most Different
  const columnWidth = width / 2;
  const infoY = y + 45;

  // Most Similar
  const simDist = getDistanceLabel(mostSimilar.distance);
  elements.push(
    text(x + columnWidth / 2, infoY, 'Most Similar', {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );
  elements.push(
    text(x + columnWidth / 2, infoY + 18, `${mostSimilar.index1} ↔ ${mostSimilar.index2}`, {
      fill: THEME.text,
      fontSize: 16,
      fontFamily: FONTS.primary,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );
  elements.push(
    text(x + columnWidth / 2, infoY + 36, `Distance: ${mostSimilar.distance.toFixed(1)}`, {
      fill: simDist.color,
      fontSize: 12,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );
  const simContrast = getContrastRating(mostSimilar.contrastRatio);
  elements.push(
    text(x + columnWidth / 2, infoY + 52, `Contrast: ${mostSimilar.contrastRatio.toFixed(2)}:1 (${simContrast.label})`, {
      fill: simContrast.color,
      fontSize: 11,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );

  // Vertical separator
  elements.push(line(x + columnWidth, y + 35, x + columnWidth, y + 100, THEME.border, 1));

  // Most Different (only show if more than 2 dyes or same info for 2)
  const diffDist = getDistanceLabel(leastSimilar.distance);
  elements.push(
    text(x + columnWidth + columnWidth / 2, infoY, 'Most Different', {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );
  elements.push(
    text(x + columnWidth + columnWidth / 2, infoY + 18, `${leastSimilar.index1} ↔ ${leastSimilar.index2}`, {
      fill: THEME.text,
      fontSize: 16,
      fontFamily: FONTS.primary,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );
  elements.push(
    text(x + columnWidth + columnWidth / 2, infoY + 36, `Distance: ${leastSimilar.distance.toFixed(1)}`, {
      fill: diffDist.color,
      fontSize: 12,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );
  const diffContrast = getContrastRating(leastSimilar.contrastRatio);
  elements.push(
    text(x + columnWidth + columnWidth / 2, infoY + 52, `Contrast: ${leastSimilar.contrastRatio.toFixed(2)}:1 (${diffContrast.label})`, {
      fill: diffContrast.color,
      fontSize: 11,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );

  return elements.join('\n');
}

/**
 * Generate an empty comparison message
 */
function generateEmptyComparison(width: number): string {
  const height = 120;
  const elements: string[] = [];

  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));
  elements.push(
    text(width / 2, height / 2, 'Please provide at least 2 dyes to compare', {
      fill: THEME.textMuted,
      fontSize: 16,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    })
  );

  return createSvgDocument(width, height, elements.join('\n'));
}
