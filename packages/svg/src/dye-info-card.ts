/**
 * Dye Info Card SVG Generator (V4)
 *
 * Generates a visual result card for the /dye info command.
 * Shows the dye color prominently with all technical details.
 *
 * Layout:
 * +--------------------------------------------------+
 * |  [Large Color Swatch]                            |
 * |                                                   |
 * |  Dye Name                              Category  |
 * +--------------------------------------------------+
 * |  HEX: #RRGGBB    RGB: (R, G, B)                 |
 * |  HSV: H°, S%, V%   LAB: L, a, b                 |
 * +--------------------------------------------------+
 *
 * @module svg/dye-info-card
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
  hexToRgb,
} from './base.js';
import { rgbToLab } from '@xivdyetools/color-blending';

// ============================================================================
// Types
// ============================================================================

export interface DyeInfoCardOptions {
  /** The dye to display */
  dye: Dye;
  /** Localized dye name (if available) */
  localizedName?: string;
  /** Localized category name (if available) */
  localizedCategory?: string;
  /** Card width in pixels (default: 500) */
  width?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 500;
const PADDING = 20;
const SWATCH_HEIGHT = 160;
const INFO_SECTION_HEIGHT = 100;

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

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Generate a visual info card for a single dye
 */
export function generateDyeInfoCard(options: DyeInfoCardOptions): string {
  const {
    dye,
    localizedName,
    localizedCategory,
    width = DEFAULT_WIDTH,
  } = options;

  const height = SWATCH_HEIGHT + INFO_SECTION_HEIGHT + PADDING * 2;
  const elements: string[] = [];

  // Calculate color values
  const rgb = hexToRgb(dye.hex);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const lab = rgbToLab(rgb);

  // Display names
  const displayName = localizedName || dye.name;
  const displayCategory = localizedCategory || dye.category;
  const textColor = getContrastTextColor(dye.hex);

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 16, ry: 16 }));

  // Large color swatch (top section)
  elements.push(
    rect(0, 0, width, SWATCH_HEIGHT, dye.hex, {
      rx: 16,
      ry: 16,
    })
  );
  // Flatten bottom corners of swatch
  elements.push(rect(0, SWATCH_HEIGHT - 16, width, 16, dye.hex));

  // Dye name on swatch
  // Uses headerCjk for CJK language support (Japanese/Korean/Chinese dye names)
  elements.push(
    text(PADDING, SWATCH_HEIGHT - 50, escapeXml(displayName), {
      fill: textColor,
      fontSize: 28,
      fontFamily: FONTS.headerCjk,
      fontWeight: 600,
    })
  );

  // Category badge
  const categoryWidth = displayCategory.length * 8 + 20;
  elements.push(
    rect(width - PADDING - categoryWidth, SWATCH_HEIGHT - 45, categoryWidth, 26, 'rgba(0,0,0,0.3)', {
      rx: 6,
      ry: 6,
    })
  );
  // Category badge text - uses CJK font for localized category names
  elements.push(
    text(width - PADDING - categoryWidth / 2, SWATCH_HEIGHT - 28, displayCategory, {
      fill: textColor,
      fontSize: 12,
      fontFamily: FONTS.primaryCjk,
      fontWeight: 500,
      textAnchor: 'middle',
    })
  );

  // Hex value overlay on swatch
  elements.push(
    text(PADDING, SWATCH_HEIGHT - 20, dye.hex.toUpperCase(), {
      fill: textColor,
      fontSize: 14,
      fontFamily: FONTS.mono,
      fontWeight: 500,
    })
  );

  // Info section (bottom)
  const infoY = SWATCH_HEIGHT + PADDING;

  // Left column - Technical values
  let leftY = infoY;

  // HEX
  elements.push(
    text(PADDING, leftY, 'HEX', {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primary,
      fontWeight: 500,
    })
  );
  elements.push(
    text(PADDING + 40, leftY, dye.hex.toUpperCase(), {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.mono,
      fontWeight: 500,
    })
  );

  leftY += 22;

  // RGB
  elements.push(
    text(PADDING, leftY, 'RGB', {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primary,
      fontWeight: 500,
    })
  );
  elements.push(
    text(PADDING + 40, leftY, `${rgb.r}, ${rgb.g}, ${rgb.b}`, {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.mono,
      fontWeight: 500,
    })
  );

  leftY += 22;

  // HSV
  elements.push(
    text(PADDING, leftY, 'HSV', {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primary,
      fontWeight: 500,
    })
  );
  elements.push(
    text(PADDING + 40, leftY, `${hsv.h}°, ${hsv.s}%, ${hsv.v}%`, {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.mono,
      fontWeight: 500,
    })
  );

  // Right column - LAB and ID
  const rightX = width / 2 + 20;
  let rightY = infoY;

  // LAB
  elements.push(
    text(rightX, rightY, 'LAB', {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primary,
      fontWeight: 500,
    })
  );
  elements.push(
    text(rightX + 40, rightY, `${lab.l.toFixed(1)}, ${lab.a.toFixed(1)}, ${lab.b.toFixed(1)}`, {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.mono,
      fontWeight: 500,
    })
  );

  rightY += 22;

  // Dye ID
  elements.push(
    text(rightX, rightY, 'ID', {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primary,
      fontWeight: 500,
    })
  );
  elements.push(
    text(rightX + 40, rightY, dye.id.toString(), {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.mono,
      fontWeight: 500,
    })
  );

  rightY += 22;

  // Item ID (FFXIV item database ID)
  elements.push(
    text(rightX, rightY, 'Item', {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primary,
      fontWeight: 500,
    })
  );
  elements.push(
    text(rightX + 40, rightY, dye.itemID.toString(), {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.mono,
      fontWeight: 500,
    })
  );

  // Footer
  elements.push(
    text(width / 2, height - 10, 'XIV Dye Tools', {
      fill: THEME.textDim,
      fontSize: 10,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  return createSvgDocument(width, height, elements.join('\n'));
}
