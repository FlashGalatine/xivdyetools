/**
 * Harmony Wheel SVG Generator (v4 Style)
 *
 * Generates a modern color harmony wheel visualization matching the v4 web app design.
 * Features:
 * - Large center swatch showing the base color with glow effect
 * - Smooth conic gradient ring for the color spectrum
 * - Small colored dot nodes positioned on the ring
 * - Dashed connection lines between harmony points
 *
 * Colors are positioned on the wheel based on their HSV hue value,
 * matching the traditional color wheel representation.
 */

import {
  createSvgDocument,
  rect,
  hexToRgb,
  THEME,
} from './base.js';

export interface HarmonyDye {
  id: number;
  name: string;
  hex: string;
  category?: string;
}

export interface HarmonyWheelOptions {
  /** Base color hex */
  baseColor: string;
  /** Name of the base color/dye */
  baseName?: string;
  /** Type of harmony (triadic, complementary, etc.) */
  harmonyType: string;
  /** Matched dyes for the harmony */
  dyes: HarmonyDye[];
  /** Width of the output image */
  width?: number;
  /** Height of the output image */
  height?: number;
}

/**
 * Converts RGB to HSV and returns the hue (0-360)
 */
function rgbToHue(r: number, g: number, b: number): number {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let hue = 0;

  if (delta === 0) {
    hue = 0; // Achromatic (gray)
  } else if (max === r) {
    hue = 60 * (((g - b) / delta) % 6);
  } else if (max === g) {
    hue = 60 * ((b - r) / delta + 2);
  } else {
    hue = 60 * ((r - g) / delta + 4);
  }

  if (hue < 0) hue += 360;

  return hue;
}

/**
 * Gets the hue angle from a hex color
 */
function getHueFromHex(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHue(r, g, b);
}

/**
 * Generates a v4-style harmony wheel SVG
 */
export function generateHarmonyWheel(options: HarmonyWheelOptions): string {
  const {
    baseColor,
    dyes,
    width = 400,
    height = 400,
  } = options;

  const centerX = width / 2;
  const centerY = height / 2;
  const wheelRadius = Math.min(width, height) / 2 - 30;

  // v4 style sizing
  const innerRadiusRatio = 0.6; // Thinner ring
  const nodeRadiusRatio = 0.8; // Where nodes sit on the ring
  const centerSwatchRadius = wheelRadius * 0.4; // Large center swatch (v4 style: 120px equivalent)
  const harmonyNodeRadius = 10; // Small nodes (v4 style: 14px)
  const baseNodeRadius = 12; // Slightly larger for base (v4 style: 18px)

  const elements: string[] = [];

  // Background with rounded corners
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 16 }));

  // Generate defs for glow filter and drop shadow
  elements.push(`<defs>
    <filter id="centerGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.4 0"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.5"/>
    </filter>
  </defs>`);

  // Color wheel ring (v4 style: smoother gradient with reduced opacity)
  elements.push(generateColorWheelRing(centerX, centerY, wheelRadius, innerRadiusRatio));

  // Get base color hue for positioning
  const baseHue = getHueFromHex(baseColor);

  // Calculate positions for all nodes
  const baseAngle = baseHue - 90; // -90 to start from top
  const baseRad = (baseAngle * Math.PI) / 180;
  const baseX = centerX + Math.cos(baseRad) * wheelRadius * nodeRadiusRatio;
  const baseY = centerY + Math.sin(baseRad) * wheelRadius * nodeRadiusRatio;

  // Draw dashed connection lines (v4 style)
  // Line from center to base node
  elements.push(createDashedLine(centerX, centerY, baseX, baseY, 'rgba(255, 255, 255, 0.4)', 1.5));

  // Lines to harmony nodes
  dyes.forEach((dye) => {
    const dyeHue = getHueFromHex(dye.hex);
    const dyeAngle = dyeHue - 90;
    const dyeRad = (dyeAngle * Math.PI) / 180;
    const dyeX = centerX + Math.cos(dyeRad) * wheelRadius * nodeRadiusRatio;
    const dyeY = centerY + Math.sin(dyeRad) * wheelRadius * nodeRadiusRatio;

    elements.push(createDashedLine(centerX, centerY, dyeX, dyeY, 'rgba(255, 255, 255, 0.4)', 1.5));
  });

  // Center swatch with glow effect (v4 style: prominent center display)
  // Glow layer
  elements.push(
    `<circle cx="${centerX}" cy="${centerY}" r="${centerSwatchRadius}" fill="${baseColor}" filter="url(#centerGlow)"/>`
  );
  // Main center circle with border
  elements.push(
    `<circle cx="${centerX}" cy="${centerY}" r="${centerSwatchRadius}" fill="${baseColor}" stroke="${THEME.background}" stroke-width="4"/>`
  );

  // Draw harmony dye nodes (small colored dots)
  dyes.forEach((dye) => {
    const dyeHue = getHueFromHex(dye.hex);
    const dyeAngle = dyeHue - 90;
    const dyeRad = (dyeAngle * Math.PI) / 180;
    const dyeX = centerX + Math.cos(dyeRad) * wheelRadius * nodeRadiusRatio;
    const dyeY = centerY + Math.sin(dyeRad) * wheelRadius * nodeRadiusRatio;

    // Small colored node with white border
    elements.push(
      `<circle cx="${dyeX}" cy="${dyeY}" r="${harmonyNodeRadius}" fill="${dye.hex}" stroke="#ffffff" stroke-width="2" filter="url(#nodeShadow)"/>`
    );
  });

  // Draw base color node (slightly larger)
  elements.push(
    `<circle cx="${baseX}" cy="${baseY}" r="${baseNodeRadius}" fill="${baseColor}" stroke="#ffffff" stroke-width="3" filter="url(#nodeShadow)"/>`
  );

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Creates a dashed line SVG element
 */
function createDashedLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  strokeWidth: number
): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${strokeWidth}" stroke-dasharray="6,4"/>`;
}

/**
 * Generates a smooth color wheel ring (v4 style with reduced opacity)
 */
function generateColorWheelRing(
  cx: number,
  cy: number,
  radius: number,
  innerRadiusRatio: number = 0.6
): string {
  const segments: string[] = [];
  const segmentCount = 90; // More segments for smoother gradient
  const segmentAngle = 360 / segmentCount;
  const innerRadius = radius * innerRadiusRatio;

  for (let i = 0; i < segmentCount; i++) {
    const startAngle = i * segmentAngle;
    const endAngle = startAngle + segmentAngle + 0.5; // Slight overlap to prevent gaps
    const hue = startAngle;

    // Calculate arc points
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((endAngle - 90) * Math.PI) / 180;

    // Outer arc points
    const ox1 = cx + radius * Math.cos(startRad);
    const oy1 = cy + radius * Math.sin(startRad);
    const ox2 = cx + radius * Math.cos(endRad);
    const oy2 = cy + radius * Math.sin(endRad);

    // Inner arc points
    const ix1 = cx + innerRadius * Math.cos(startRad);
    const iy1 = cy + innerRadius * Math.sin(startRad);
    const ix2 = cx + innerRadius * Math.cos(endRad);
    const iy2 = cy + innerRadius * Math.sin(endRad);

    // Create wedge path
    const path = `M ${ix1} ${iy1} L ${ox1} ${oy1} A ${radius} ${radius} 0 0 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 0 0 ${ix1} ${iy1} Z`;

    // v4 style: slightly reduced saturation (85%) and opacity (0.8) for softer look
    segments.push(
      `<path d="${path}" fill="hsl(${hue}, 85%, 50%)" opacity="0.8" stroke="none"/>`
    );
  }

  return segments.join('\n');
}
