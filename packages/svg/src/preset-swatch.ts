/**
 * Preset Swatch SVG Generator
 *
 * Generates a visual display of preset color palettes.
 * Shows the preset name, description, and color swatches with dye names.
 *
 * Layout:
 * +----------------------------------------------------------+
 * |              [Icon] Preset Name                          |
 * |        Brief description of the preset palette           |
 * |                   by Author • 42★                        |
 * +----------+----------+----------+----------+--------------+
 * | [Color1] | [Color2] | [Color3] | [Color4] |              |
 * |   Name   |   Name   |   Name   |   Name   |              |
 * |  #HEX    |  #HEX    |  #HEX    |  #HEX    |              |
 * +----------+----------+----------+----------+--------------+
 *
 * @module svg/preset-swatch
 */

import type { Dye } from '@xivdyetools/core';
import type { PresetCategory } from '@xivdyetools/types';
import {
  createSvgDocument,
  rect,
  text,
  THEME,
  FONTS,
  escapeXml,
} from './base.js';

// ============================================================================
// Category Display (visual display constant, moved from discord-worker)
// ============================================================================

/**
 * Category display metadata for preset swatches.
 * Moved here from discord-worker's types/preset.ts since it is purely visual.
 */
export const CATEGORY_DISPLAY: Record<PresetCategory, { icon: string; name: string }> = {
  jobs: { icon: '⚔️', name: 'FFXIV Jobs' },
  'grand-companies': { icon: '🏛️', name: 'Grand Companies' },
  seasons: { icon: '🍂', name: 'Seasons' },
  events: { icon: '🎉', name: 'FFXIV Events' },
  aesthetics: { icon: '🎨', name: 'Aesthetics' },
  community: { icon: '🌐', name: 'Community' },
};

// ============================================================================
// Types
// ============================================================================

/**
 * Options for generating a preset swatch
 */
export interface PresetSwatchOptions {
  /** Preset name */
  name: string;
  /** Preset description */
  description: string;
  /** Preset category */
  category: PresetCategory;
  /** Array of dyes in the preset (null for invalid dye IDs) */
  dyes: (Dye | null)[];
  /** Author display name (null for curated presets) */
  authorName?: string | null;
  /** Vote count */
  voteCount?: number;
  /** Canvas width in pixels (default: 600) */
  width?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 600;
const PADDING = 24;
const HEADER_HEIGHT = 90;
const SWATCH_HEIGHT = 80;
const LABEL_HEIGHT = 50;
const SWATCH_GAP = 8;
const MIN_SWATCH_WIDTH = 80;

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Generate a preset swatch SVG showing the palette colors
 *
 * @param options - Preset swatch configuration
 * @returns SVG string
 *
 * @example
 * ```typescript
 * const svg = generatePresetSwatch({
 *   name: 'Crimson Elegance',
 *   description: 'A refined red and gold palette',
 *   category: 'aesthetics',
 *   dyes: [dalamudRedDye, jetBlackDye, metallicGoldDye],
 *   authorName: 'ExampleUser',
 *   voteCount: 42,
 * });
 * const png = await renderSvgToPng(svg);
 * ```
 */
export function generatePresetSwatch(options: PresetSwatchOptions): string {
  const {
    name,
    description,
    category,
    dyes,
    authorName,
    voteCount,
    width = DEFAULT_WIDTH,
  } = options;

  // Filter out null dyes (invalid dye IDs)
  const validDyes = dyes.filter((d): d is Dye => d !== null);

  if (validDyes.length === 0) {
    return generateEmptySwatch(width, name);
  }

  // Calculate dimensions
  const swatchAreaWidth = width - PADDING * 2 - SWATCH_GAP * (validDyes.length - 1);
  const swatchWidth = Math.max(MIN_SWATCH_WIDTH, Math.floor(swatchAreaWidth / validDyes.length));
  const height = PADDING * 2 + HEADER_HEIGHT + SWATCH_HEIGHT + LABEL_HEIGHT;

  const elements: string[] = [];

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  // Header section
  const categoryDisplay = CATEGORY_DISPLAY[category] || { icon: '🎨', name: 'Preset' };

  // Category icon and title
  elements.push(
    text(width / 2, PADDING + 24, `${categoryDisplay.icon} ${escapeXml(name)}`, {
      fill: THEME.text,
      fontSize: 22,
      fontFamily: FONTS.headerCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Description (truncated if too long)
  const maxDescLength = 60;
  const truncatedDesc =
    description.length > maxDescLength
      ? description.substring(0, maxDescLength - 3) + '...'
      : description;

  elements.push(
    text(width / 2, PADDING + 50, escapeXml(truncatedDesc), {
      fill: THEME.textMuted,
      fontSize: 13,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  // Author and votes metadata line
  const metaParts: string[] = [];
  if (authorName) {
    metaParts.push(`by ${authorName}`);
  } else {
    metaParts.push('Official');
  }
  if (voteCount !== undefined) {
    metaParts.push(`${voteCount}★`);
  }

  elements.push(
    text(width / 2, PADDING + 72, metaParts.join(' • '), {
      fill: THEME.textDim,
      fontSize: 11,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  // Color swatches section
  const swatchY = PADDING + HEADER_HEIGHT;
  const totalSwatchesWidth =
    validDyes.length * swatchWidth + (validDyes.length - 1) * SWATCH_GAP;
  const startX = (width - totalSwatchesWidth) / 2;

  validDyes.forEach((dye, index) => {
    const x = startX + index * (swatchWidth + SWATCH_GAP);
    elements.push(generateDyeSwatch(dye, x, swatchY, swatchWidth));
  });

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Generate a single dye swatch with label
 */
function generateDyeSwatch(dye: Dye, x: number, y: number, width: number): string {
  const elements: string[] = [];

  // Color swatch rectangle
  elements.push(
    rect(x, y, width, SWATCH_HEIGHT, dye.hex, {
      rx: 6,
      ry: 6,
      stroke: THEME.border,
      strokeWidth: 1,
    })
  );

  // Dye name (truncated if needed)
  const labelY = y + SWATCH_HEIGHT + 18;
  const maxNameLength = Math.floor(width / 7); // Approximate chars that fit
  const truncatedName =
    dye.name.length > maxNameLength
      ? dye.name.substring(0, maxNameLength - 2) + '..'
      : dye.name;

  elements.push(
    text(x + width / 2, labelY, escapeXml(truncatedName), {
      fill: THEME.text,
      fontSize: 11,
      fontFamily: FONTS.primaryCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Hex code
  elements.push(
    text(x + width / 2, labelY + 16, dye.hex.toUpperCase(), {
      fill: THEME.textDim,
      fontSize: 10,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );

  return elements.join('\n');
}

/**
 * Generate an empty swatch for presets with no valid dyes
 */
function generateEmptySwatch(width: number, name: string): string {
  const height = 120;
  const elements: string[] = [];

  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  elements.push(
    text(width / 2, 40, escapeXml(name), {
      fill: THEME.text,
      fontSize: 18,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  elements.push(
    text(width / 2, 75, 'No valid dyes in this preset', {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Generate a compact preset swatch for list views (smaller size)
 *
 * @param options - Preset swatch configuration
 * @returns SVG string
 */
export function generateCompactPresetSwatch(options: PresetSwatchOptions): string {
  const { name, dyes, width = 300 } = options;

  const validDyes = dyes.filter((d): d is Dye => d !== null);

  if (validDyes.length === 0) {
    return generateEmptySwatch(width, name);
  }

  const height = 60;
  const swatchSize = 40;
  const gap = 4;
  const elements: string[] = [];

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 8, ry: 8 }));

  // Preset name (left aligned)
  elements.push(
    text(12, height / 2 + 4, escapeXml(name), {
      fill: THEME.text,
      fontSize: 14,
      fontFamily: FONTS.primary,
      fontWeight: 600,
    })
  );

  // Color swatches (right aligned)
  const totalSwatchWidth = validDyes.length * swatchSize + (validDyes.length - 1) * gap;
  const startX = width - 12 - totalSwatchWidth;
  const swatchY = (height - swatchSize) / 2;

  validDyes.forEach((dye, index) => {
    const x = startX + index * (swatchSize + gap);
    elements.push(
      rect(x, swatchY, swatchSize, swatchSize, dye.hex, {
        rx: 4,
        ry: 4,
        stroke: THEME.border,
        strokeWidth: 1,
      })
    );
  });

  return createSvgDocument(width, height, elements.join('\n'));
}
