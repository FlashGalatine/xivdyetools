/**
 * Accessibility Comparison SVG Generator
 *
 * Generates a visual comparison showing how a dye color appears
 * under different types of color vision deficiency.
 *
 * Layout (2x2 grid):
 * +------------------------------------------+
 * |              Dalamud Red                 |
 * +------------------------------------------+
 * | [Normal Vision]   | [Protanopia]         |
 * | #AA1111           | #967D34              |
 * +------------------------------------------+
 * | [Deuteranopia]    | [Tritanopia]         |
 * | #8F8020           | #A81825              |
 * +------------------------------------------+
 *
 * @module services/svg/accessibility-comparison
 */

import { ColorService, type RGB } from '@xivdyetools/core';
import {
  createSvgDocument,
  rect,
  text,
  THEME,
  FONTS,
  rgbToHex,
  hexToRgb,
} from './base.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Vision types for colorblind simulation
 */
export type VisionType = 'protanopia' | 'deuteranopia' | 'tritanopia';

/**
 * All vision types including normal
 */
export type AllVisionTypes = 'normal' | VisionType;

/**
 * Options for generating the accessibility comparison
 */
export interface AccessibilityComparisonOptions {
  /** Hex color of the dye */
  dyeHex: string;
  /** Name of the dye */
  dyeName: string;
  /** Vision types to show (default: all) */
  visionTypes?: VisionType[];
  /** Canvas width (default: 500) */
  width?: number;
}

/**
 * A simulated color result
 */
interface SimulatedColor {
  type: AllVisionTypes;
  label: string;
  description: string;
  hex: string;
  rgb: RGB;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 500;
const PADDING = 20;
const TITLE_HEIGHT = 50;
const SWATCH_SIZE = 140;
const SWATCH_GAP = 20;
const LABEL_HEIGHT = 60;

/**
 * Vision type metadata
 */
const VISION_LABELS: Record<AllVisionTypes, { label: string; description: string }> = {
  normal: {
    label: 'Normal Vision',
    description: 'Full color perception',
  },
  protanopia: {
    label: 'Protanopia',
    description: 'Red-blind (~1% of males)',
  },
  deuteranopia: {
    label: 'Deuteranopia',
    description: 'Green-blind (~1% of males)',
  },
  tritanopia: {
    label: 'Tritanopia',
    description: 'Blue-blind (rare)',
  },
};

// ColorService methods are static - no need for instance

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Generate an accessibility comparison SVG showing colorblind simulations
 *
 * @param options - Comparison configuration
 * @returns SVG string
 *
 * @example
 * ```typescript
 * const svg = generateAccessibilityComparison({
 *   dyeHex: '#AA1111',
 *   dyeName: 'Dalamud Red',
 * });
 * const png = await renderSvgToPng(svg);
 * ```
 */
export function generateAccessibilityComparison(
  options: AccessibilityComparisonOptions
): string {
  const {
    dyeHex,
    dyeName,
    visionTypes = ['protanopia', 'deuteranopia', 'tritanopia'],
    width = DEFAULT_WIDTH,
  } = options;

  // Simulate colors for all vision types
  const simulations = simulateAllVisions(dyeHex, visionTypes);

  // Calculate dimensions for 2x2 grid
  const gridCols = 2;
  const gridRows = Math.ceil(simulations.length / gridCols);
  const cellWidth = (width - PADDING * 3) / gridCols;
  const cellHeight = SWATCH_SIZE + LABEL_HEIGHT;
  const gridHeight = gridRows * (cellHeight + SWATCH_GAP) - SWATCH_GAP;
  const height = PADDING * 2 + TITLE_HEIGHT + gridHeight;

  const elements: string[] = [];

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  // Title
  elements.push(
    text(width / 2, PADDING + 24, dyeName, {
      fill: THEME.text,
      fontSize: 22,
      fontFamily: FONTS.headerCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  elements.push(
    text(width / 2, PADDING + 44, 'Color Vision Accessibility', {
      fill: THEME.textMuted,
      fontSize: 12,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  // Render grid of swatches
  const gridStartY = PADDING + TITLE_HEIGHT;
  simulations.forEach((sim, index) => {
    const col = index % gridCols;
    const row = Math.floor(index / gridCols);
    const x = PADDING + col * (cellWidth + SWATCH_GAP);
    const y = gridStartY + row * (cellHeight + SWATCH_GAP);

    elements.push(generateVisionSwatch(sim, x, y, cellWidth));
  });

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Simulate a color for all requested vision types (plus normal)
 */
function simulateAllVisions(hex: string, visionTypes: VisionType[]): SimulatedColor[] {
  const results: SimulatedColor[] = [];
  const rgb = hexToRgb(hex);

  // Always include normal vision first
  results.push({
    type: 'normal',
    ...VISION_LABELS.normal,
    hex,
    rgb,
  });

  // Add simulated versions
  for (const visionType of visionTypes) {
    const simulated = ColorService.simulateColorblindness(rgb, visionType);
    const simHex = rgbToHex(simulated.r, simulated.g, simulated.b);

    results.push({
      type: visionType,
      ...VISION_LABELS[visionType],
      hex: simHex,
      rgb: simulated,
    });
  }

  return results;
}

/**
 * Generate a single vision swatch
 */
function generateVisionSwatch(
  sim: SimulatedColor,
  x: number,
  y: number,
  width: number
): string {
  const elements: string[] = [];
  const swatchX = x + (width - SWATCH_SIZE) / 2;

  // Swatch background (slightly larger for border effect)
  elements.push(
    rect(swatchX - 2, y - 2, SWATCH_SIZE + 4, SWATCH_SIZE + 4, THEME.border, {
      rx: 10,
      ry: 10,
    })
  );

  // Color swatch
  elements.push(
    rect(swatchX, y, SWATCH_SIZE, SWATCH_SIZE, sim.hex, {
      rx: 8,
      ry: 8,
    })
  );

  // Vision type label
  elements.push(
    text(x + width / 2, y + SWATCH_SIZE + 20, sim.label, {
      fill: THEME.text,
      fontSize: 13,
      fontFamily: FONTS.primary,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Hex code
  elements.push(
    text(x + width / 2, y + SWATCH_SIZE + 38, sim.hex.toUpperCase(), {
      fill: THEME.textMuted,
      fontSize: 12,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );

  // Description
  elements.push(
    text(x + width / 2, y + SWATCH_SIZE + 54, sim.description, {
      fill: THEME.textDim,
      fontSize: 10,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  return elements.join('\n');
}

/**
 * Generate a compact accessibility comparison (single row)
 * Useful for inline display in other components
 */
export function generateCompactAccessibilityRow(
  hex: string,
  visionTypes: VisionType[] = ['protanopia', 'deuteranopia', 'tritanopia']
): { type: AllVisionTypes; hex: string; label: string }[] {
  const rgb = hexToRgb(hex);
  const results: { type: AllVisionTypes; hex: string; label: string }[] = [];

  // Normal vision
  results.push({
    type: 'normal',
    hex,
    label: 'Normal',
  });

  // Simulated versions
  for (const visionType of visionTypes) {
    const simulated = ColorService.simulateColorblindness(rgb, visionType);
    const simHex = rgbToHex(simulated.r, simulated.g, simulated.b);

    results.push({
      type: visionType,
      hex: simHex,
      label: VISION_LABELS[visionType].label.split(' ')[0], // Just "Protanopia" etc
    });
  }

  return results;
}
