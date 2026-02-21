/**
 * Contrast Matrix SVG Generator
 *
 * Generates a visual matrix showing pairwise contrast ratios
 * between multiple dyes, with WCAG compliance badges.
 *
 * Layout (for 3 dyes):
 * +-------------------------------------------------------+
 * |              |   Dye 1   |   Dye 2   |   Dye 3        |
 * +--------------+-----------+-----------+----------------+
 * |    Dye 1     |     --    | 4.52:1 AA | 7.21:1 AAA     |
 * +--------------+-----------+-----------+----------------+
 * |    Dye 2     | 4.52:1 AA |     --    | 2.31:1 FAIL    |
 * +--------------+-----------+-----------+----------------+
 *
 * @module services/svg/contrast-matrix
 */

import { ColorService } from '@xivdyetools/core';
import {
  createSvgDocument,
  rect,
  text,
  truncateText,
  THEME,
  FONTS,
} from './base.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A dye entry for the contrast matrix
 */
export interface ContrastDye {
  /** Dye name */
  name: string;
  /** Hex color */
  hex: string;
}

/**
 * Options for generating the contrast matrix
 */
export interface ContrastMatrixOptions {
  /** Array of dyes to compare (2-4) */
  dyes: ContrastDye[];
  /** Title text (optional) */
  title?: string;
  /** Canvas width (default: auto-calculated) */
  width?: number;
}

/**
 * WCAG compliance level
 */
export type WCAGLevel = 'AAA' | 'AA' | 'FAIL';

/**
 * Contrast result between two colors
 */
export interface ContrastResult {
  /** Contrast ratio (1:1 to 21:1) */
  ratio: number;
  /** WCAG compliance level */
  level: WCAGLevel;
}

// ============================================================================
// Constants
// ============================================================================

const PADDING = 20;
const TITLE_HEIGHT = 50;
const HEADER_HEIGHT = 60;
const CELL_SIZE = 120;
const HEADER_WIDTH = 140;
const SWATCH_SIZE = 24;

/** WCAG contrast thresholds */
const WCAG_AAA_THRESHOLD = 7.0;
const WCAG_AA_THRESHOLD = 4.5;

/** Badge colors */
const BADGE_COLORS: Record<WCAGLevel, { bg: string; text: string }> = {
  AAA: { bg: '#22c55e', text: '#ffffff' }, // Green
  AA: { bg: '#eab308', text: '#000000' }, // Yellow
  FAIL: { bg: '#ef4444', text: '#ffffff' }, // Red
};

// ============================================================================
// Contrast Calculation
// ============================================================================

/**
 * Calculate contrast ratio between two colors
 *
 * @param hex1 - First color hex
 * @param hex2 - Second color hex
 * @returns Contrast result with ratio and WCAG level
 */
export function calculateContrast(hex1: string, hex2: string): ContrastResult {
  const ratio = ColorService.getContrastRatio(hex1, hex2);

  let level: WCAGLevel;
  if (ratio >= WCAG_AAA_THRESHOLD) {
    level = 'AAA';
  } else if (ratio >= WCAG_AA_THRESHOLD) {
    level = 'AA';
  } else {
    level = 'FAIL';
  }

  return { ratio, level };
}

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Generate a contrast matrix SVG showing pairwise contrast ratios
 *
 * @param options - Matrix configuration
 * @returns SVG string
 *
 * @example
 * ```typescript
 * const svg = generateContrastMatrix({
 *   dyes: [
 *     { name: 'Dalamud Red', hex: '#AA1111' },
 *     { name: 'Jet Black', hex: '#0A0A0A' },
 *     { name: 'Snow White', hex: '#FFFFFF' },
 *   ],
 * });
 * const png = await renderSvgToPng(svg);
 * ```
 */
export function generateContrastMatrix(options: ContrastMatrixOptions): string {
  const { dyes, title } = options;

  if (dyes.length < 2) {
    return generateErrorMatrix('Need at least 2 dyes for contrast comparison');
  }

  if (dyes.length > 4) {
    return generateErrorMatrix('Maximum 4 dyes for contrast comparison');
  }

  // Calculate dimensions
  const gridWidth = dyes.length * CELL_SIZE;
  const width = PADDING * 2 + HEADER_WIDTH + gridWidth;
  const hasTitle = Boolean(title);
  const titleSpace = hasTitle ? TITLE_HEIGHT : 0;
  const gridHeight = dyes.length * CELL_SIZE;
  const legendHeight = 50;
  const height = PADDING * 2 + titleSpace + HEADER_HEIGHT + gridHeight + legendHeight;

  const elements: string[] = [];

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  // Title
  if (title) {
    elements.push(
      text(width / 2, PADDING + 24, title, {
        fill: THEME.text,
        fontSize: 20,
        fontFamily: FONTS.header,
        fontWeight: 600,
        textAnchor: 'middle',
      })
    );
  }

  const gridStartX = PADDING + HEADER_WIDTH;
  const gridStartY = PADDING + titleSpace + HEADER_HEIGHT;

  // Column headers (dye swatches + names)
  dyes.forEach((dye, i) => {
    const x = gridStartX + i * CELL_SIZE + CELL_SIZE / 2;
    const y = PADDING + titleSpace + HEADER_HEIGHT / 2;

    // Swatch
    elements.push(
      rect(x - SWATCH_SIZE / 2, y - 20, SWATCH_SIZE, SWATCH_SIZE, dye.hex, {
        rx: 4,
        ry: 4,
        stroke: THEME.border,
        strokeWidth: 1,
      })
    );

    // Name (truncated if needed)
    const displayName = truncateName(dye.name, 12);
    elements.push(
      text(x, y + 16, displayName, {
        fill: THEME.text,
        fontSize: 11,
        fontFamily: FONTS.primaryCjk,
        fontWeight: 500,
        textAnchor: 'middle',
      })
    );
  });

  // Row headers and cells
  dyes.forEach((rowDye, rowIndex) => {
    const rowY = gridStartY + rowIndex * CELL_SIZE;

    // Row header (left side)
    const headerX = PADDING + HEADER_WIDTH / 2;
    const headerY = rowY + CELL_SIZE / 2;

    // Swatch
    elements.push(
      rect(headerX - 40, headerY - SWATCH_SIZE / 2, SWATCH_SIZE, SWATCH_SIZE, rowDye.hex, {
        rx: 4,
        ry: 4,
        stroke: THEME.border,
        strokeWidth: 1,
      })
    );

    // Name
    const displayName = truncateName(rowDye.name, 10);
    elements.push(
      text(headerX + 10, headerY + 4, displayName, {
        fill: THEME.text,
        fontSize: 11,
        fontFamily: FONTS.primaryCjk,
        fontWeight: 500,
        textAnchor: 'start',
      })
    );

    // Cells in this row
    dyes.forEach((colDye, colIndex) => {
      const cellX = gridStartX + colIndex * CELL_SIZE;
      const cellY = rowY;

      if (rowIndex === colIndex) {
        // Diagonal - same dye
        elements.push(generateDiagonalCell(cellX, cellY, CELL_SIZE));
      } else {
        // Calculate contrast
        const contrast = calculateContrast(rowDye.hex, colDye.hex);
        elements.push(generateContrastCell(cellX, cellY, CELL_SIZE, contrast));
      }
    });
  });

  // Legend
  const legendY = gridStartY + gridHeight + 20;
  elements.push(generateLegend(PADDING, legendY, width - PADDING * 2));

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Generate a diagonal cell (same dye comparison)
 */
function generateDiagonalCell(x: number, y: number, size: number): string {
  const elements: string[] = [];

  // Cell background
  elements.push(
    rect(x + 2, y + 2, size - 4, size - 4, THEME.backgroundLight, {
      rx: 6,
      ry: 6,
    })
  );

  // Diagonal line pattern or dash
  elements.push(
    text(x + size / 2, y + size / 2 + 4, '—', {
      fill: THEME.textDim,
      fontSize: 24,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  return elements.join('\n');
}

/**
 * Generate a contrast cell with ratio and badge
 */
function generateContrastCell(
  x: number,
  y: number,
  size: number,
  contrast: ContrastResult
): string {
  const elements: string[] = [];
  const badgeColors = BADGE_COLORS[contrast.level];

  // Cell background with subtle tint based on level
  const bgTint =
    contrast.level === 'AAA'
      ? '#1a2e1a'
      : contrast.level === 'AA'
        ? '#2e2a1a'
        : '#2e1a1a';
  elements.push(
    rect(x + 2, y + 2, size - 4, size - 4, bgTint, {
      rx: 6,
      ry: 6,
    })
  );

  // Contrast ratio
  const ratioText = `${contrast.ratio.toFixed(2)}:1`;
  elements.push(
    text(x + size / 2, y + size / 2 - 8, ratioText, {
      fill: THEME.text,
      fontSize: 14,
      fontFamily: FONTS.mono,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // WCAG badge
  const badgeWidth = 44;
  const badgeHeight = 22;
  const badgeX = x + (size - badgeWidth) / 2;
  const badgeY = y + size / 2 + 6;

  elements.push(
    rect(badgeX, badgeY, badgeWidth, badgeHeight, badgeColors.bg, {
      rx: 4,
      ry: 4,
    })
  );

  elements.push(
    text(badgeX + badgeWidth / 2, badgeY + 15, contrast.level, {
      fill: badgeColors.text,
      fontSize: 11,
      fontFamily: FONTS.primary,
      fontWeight: 700,
      textAnchor: 'middle',
    })
  );

  return elements.join('\n');
}

/**
 * Generate the legend row
 */
function generateLegend(x: number, y: number, width: number): string {
  const elements: string[] = [];

  // Legend items
  const items: { label: string; level: WCAGLevel; description: string }[] = [
    { label: 'AAA', level: 'AAA', description: '7:1+' },
    { label: 'AA', level: 'AA', description: '4.5:1+' },
    { label: 'FAIL', level: 'FAIL', description: '<4.5:1' },
  ];

  const itemWidth = width / items.length;

  items.forEach((item, i) => {
    const itemX = x + i * itemWidth + itemWidth / 2;
    const colors = BADGE_COLORS[item.level];

    // Badge
    const badgeWidth = 36;
    const badgeHeight = 18;
    elements.push(
      rect(itemX - 50, y, badgeWidth, badgeHeight, colors.bg, {
        rx: 3,
        ry: 3,
      })
    );

    elements.push(
      text(itemX - 50 + badgeWidth / 2, y + 13, item.label, {
        fill: colors.text,
        fontSize: 10,
        fontFamily: FONTS.primary,
        fontWeight: 700,
        textAnchor: 'middle',
      })
    );

    // Description
    elements.push(
      text(itemX + 5, y + 13, item.description, {
        fill: THEME.textMuted,
        fontSize: 11,
        fontFamily: FONTS.mono,
        textAnchor: 'start',
      })
    );
  });

  return elements.join('\n');
}

/**
 * Generate an error message matrix
 */
function generateErrorMatrix(message: string): string {
  const width = 400;
  const height = 100;
  const elements: string[] = [];

  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));
  elements.push(
    text(width / 2, height / 2, message, {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    })
  );

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Truncate a name to fit in the available space
 */
function truncateName(name: string, maxLength: number): string {
  return truncateText(name, maxLength);
}
