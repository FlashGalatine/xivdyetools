/**
 * Random Dyes Grid SVG Generator (V4)
 *
 * Generates a visual infographic grid for the /dye random command.
 * Shows 5 randomly selected dyes in an attractive card layout.
 *
 * Layout:
 * +--------------------------------------------------+
 * |  🎲 Random Dyes                                  |
 * +--------------------------------------------------+
 * |  [Swatch 1]  [Swatch 2]  [Swatch 3]             |
 * |  Name        Name        Name                    |
 * |  Category    Category    Category                |
 * +--------------------------------------------------+
 * |  [Swatch 4]  [Swatch 5]                         |
 * |  Name        Name                                |
 * |  Category    Category                            |
 * +--------------------------------------------------+
 *
 * @module services/svg/random-dyes-grid
 */

import type { Dye } from '@xivdyetools/core';
import {
  createSvgDocument,
  rect,
  text,
  THEME,
  FONTS,
  escapeXml,
  getContrastTextColor,
} from './base.js';

// ============================================================================
// Types
// ============================================================================

export interface RandomDyeInfo {
  /** The dye */
  dye: Dye;
  /** Localized dye name */
  localizedName: string;
  /** Localized category name */
  localizedCategory: string;
}

export interface RandomDyesGridOptions {
  /** Array of dyes to display (typically 5) */
  dyes: RandomDyeInfo[];
  /** Title for the grid */
  title?: string;
  /** Grid width in pixels (default: 600) */
  width?: number;
  /** Whether dyes are from unique categories */
  uniqueCategories?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 600;
const PADDING = 20;
const TITLE_HEIGHT = 50;
const CARD_WIDTH = 170;
const CARD_HEIGHT = 140;
const CARD_GAP = 20;

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Generate a visual grid of random dyes
 */
export function generateRandomDyesGrid(options: RandomDyesGridOptions): string {
  const {
    dyes,
    title = '🎲 Random Dyes',
    width = DEFAULT_WIDTH,
    uniqueCategories = false,
  } = options;

  // Calculate layout
  const cardsPerRow = 3;
  const rows = Math.ceil(dyes.length / cardsPerRow);
  const gridHeight = rows * (CARD_HEIGHT + CARD_GAP) - CARD_GAP;
  const height = TITLE_HEIGHT + gridHeight + PADDING * 2;

  const elements: string[] = [];

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 16, ry: 16 }));

  // Title
  elements.push(
    text(width / 2, PADDING + 24, title, {
      fill: THEME.text,
      fontSize: 22,
      fontFamily: FONTS.headerCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Subtitle based on mode
  const subtitle = uniqueCategories
    ? 'One from each category'
    : `${dyes.length} randomly selected dyes`;
  elements.push(
    text(width / 2, PADDING + 42, subtitle, {
      fill: THEME.textMuted,
      fontSize: 12,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  // Calculate starting position for cards (centered)
  const startY = TITLE_HEIGHT + PADDING;

  // Draw dye cards
  dyes.forEach((dyeInfo, index) => {
    const row = Math.floor(index / cardsPerRow);
    const col = index % cardsPerRow;

    // Center the last row if it has fewer cards
    const cardsInThisRow = Math.min(cardsPerRow, dyes.length - row * cardsPerRow);
    const rowWidth = cardsInThisRow * (CARD_WIDTH + CARD_GAP) - CARD_GAP;
    const rowStartX = (width - rowWidth) / 2;

    const cardX = rowStartX + col * (CARD_WIDTH + CARD_GAP);
    const cardY = startY + row * (CARD_HEIGHT + CARD_GAP);

    elements.push(generateDyeCard(dyeInfo, cardX, cardY));
  });

  // Footer
  elements.push(
    text(width / 2, height - 8, 'XIV Dye Tools • Run again for new results', {
      fill: THEME.textDim,
      fontSize: 10,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Generate a single dye card
 */
function generateDyeCard(dyeInfo: RandomDyeInfo, x: number, y: number): string {
  const { dye, localizedName, localizedCategory } = dyeInfo;
  const elements: string[] = [];

  const swatchHeight = 80;

  // Card background
  elements.push(
    rect(x, y, CARD_WIDTH, CARD_HEIGHT, THEME.backgroundLight, {
      rx: 12,
      ry: 12,
    })
  );

  // Color swatch (top portion)
  elements.push(
    rect(x, y, CARD_WIDTH, swatchHeight, dye.hex, {
      rx: 12,
      ry: 12,
    })
  );
  // Flatten bottom corners of swatch
  elements.push(rect(x, y + swatchHeight - 12, CARD_WIDTH, 12, dye.hex));

  // Hex value on swatch
  const textColor = getContrastTextColor(dye.hex);
  elements.push(
    text(x + CARD_WIDTH / 2, y + swatchHeight / 2 + 4, dye.hex.toUpperCase(), {
      fill: textColor,
      fontSize: 14,
      fontFamily: FONTS.mono,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Info section
  const infoY = y + swatchHeight + 12;

  // Dye name (truncate if too long)
  const maxNameLength = 18;
  const displayName = localizedName.length > maxNameLength
    ? localizedName.substring(0, maxNameLength - 1) + '…'
    : localizedName;

  elements.push(
    text(x + CARD_WIDTH / 2, infoY, escapeXml(displayName), {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.primaryCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Category
  elements.push(
    text(x + CARD_WIDTH / 2, infoY + 18, localizedCategory, {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primaryCjk,
      textAnchor: 'middle',
    })
  );

  return elements.join('\n');
}
