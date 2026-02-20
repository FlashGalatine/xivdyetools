/**
 * Gradient Bar SVG Generator
 *
 * Generates a color gradient visualization showing steps between two colors
 * with hex codes and matched dye names below each step.
 */

import {
  createSvgDocument,
  rect,
  line,
  text,
  getContrastTextColor,
  THEME,
  FONTS,
} from './base.js';

export interface GradientStep {
  /** Hex color at this step */
  hex: string;
  /** Matched dye name (optional) */
  dyeName?: string;
  /** Matched dye ID (optional) */
  dyeId?: number;
}

export interface GradientBarOptions {
  /** Array of gradient steps from start to end */
  steps: GradientStep[];
  /** Width of the output image */
  width?: number;
  /** Height of the output image */
  height?: number;
  /** Show tick marks between steps */
  showTicks?: boolean;
  /** Show START/END labels */
  showEndLabels?: boolean;
  /** Localized "START" label text (default: "START") */
  startLabel?: string;
  /** Localized "END" label text (default: "END") */
  endLabel?: string;
}

/**
 * Generates a gradient bar SVG showing color progression with dye matches
 */
export function generateGradientBar(options: GradientBarOptions): string {
  const {
    steps,
    width = 800,
    height = 200,
    showTicks = true,
    showEndLabels = true,
    startLabel = 'START',
    endLabel = 'END',
  } = options;

  if (steps.length < 2) {
    throw new Error('Gradient requires at least 2 steps');
  }

  const elements: string[] = [];

  // Layout constants
  const padding = 20;
  const barHeight = 60;
  const barY = 40;
  const hexLabelY = barY + barHeight + 20;
  const nameLabelY = hexLabelY + 18;
  const endLabelY = barY - 10;

  const barWidth = width - padding * 2;
  const stepWidth = barWidth / steps.length;

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12 }));

  // Draw each color step
  steps.forEach((step, i) => {
    const x = padding + i * stepWidth;

    // Color rectangle
    elements.push(
      rect(x, barY, stepWidth, barHeight, step.hex, {
        stroke: i === 0 || i === steps.length - 1 ? '#ffffff' : undefined,
        strokeWidth: i === 0 || i === steps.length - 1 ? 2 : undefined,
      })
    );

    // Hex label below the bar
    const centerX = x + stepWidth / 2;
    elements.push(
      text(centerX, hexLabelY, step.hex.toUpperCase(), {
        fill: THEME.textMuted,
        fontSize: 11,
        fontFamily: FONTS.mono,
        textAnchor: 'middle',
      })
    );

    // Dye name below hex (if available)
    // Uses primaryCjk font for CJK language support (Japanese/Korean/Chinese dye names)
    if (step.dyeName) {
      const truncatedName = truncateName(step.dyeName, 12);
      elements.push(
        text(centerX, nameLabelY, truncatedName, {
          fill: THEME.text,
          fontSize: 10,
          fontFamily: FONTS.primaryCjk,
          textAnchor: 'middle',
        })
      );
    }
  });

  // Draw tick marks between steps
  if (showTicks) {
    for (let i = 1; i < steps.length; i++) {
      const tickX = padding + i * stepWidth;
      elements.push(
        line(tickX, barY - 5, tickX, barY, THEME.textDim, 1)
      );
      elements.push(
        line(tickX, barY + barHeight, tickX, barY + barHeight + 5, THEME.textDim, 1)
      );
    }
  }

  // Draw START/END labels (localized)
  // Uses primaryCjk font for CJK language support (e.g., 開始/終了 in Japanese)
  if (showEndLabels) {
    elements.push(
      text(padding + stepWidth / 2, endLabelY, startLabel, {
        fill: THEME.textMuted,
        fontSize: 10,
        fontFamily: FONTS.primaryCjk,
        textAnchor: 'middle',
        fontWeight: 'bold',
      })
    );
    elements.push(
      text(padding + (steps.length - 0.5) * stepWidth, endLabelY, endLabel, {
        fill: THEME.textMuted,
        fontSize: 10,
        fontFamily: FONTS.primaryCjk,
        textAnchor: 'middle',
        fontWeight: 'bold',
      })
    );
  }

  // Outer border around the gradient bar
  elements.push(
    rect(padding, barY, barWidth, barHeight, 'none', {
      stroke: THEME.border,
      strokeWidth: 1,
    })
  );

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Truncates a name to fit within the step width
 */
function truncateName(name: string, maxLength: number): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength - 2) + '..';
}

/**
 * Interpolates between two colors in RGB space
 * @param color1 Starting hex color
 * @param color2 Ending hex color
 * @param ratio Interpolation ratio (0 = color1, 1 = color2)
 */
export function interpolateColor(color1: string, color2: string, ratio: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');

  const r1 = parseInt(hex1.slice(0, 2), 16);
  const g1 = parseInt(hex1.slice(2, 4), 16);
  const b1 = parseInt(hex1.slice(4, 6), 16);

  const r2 = parseInt(hex2.slice(0, 2), 16);
  const g2 = parseInt(hex2.slice(2, 4), 16);
  const b2 = parseInt(hex2.slice(4, 6), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Generates an array of interpolated colors between start and end
 * @param startColor Starting hex color
 * @param endColor Ending hex color
 * @param stepCount Number of steps (including start and end)
 */
export function generateGradientColors(
  startColor: string,
  endColor: string,
  stepCount: number
): string[] {
  const colors: string[] = [];

  for (let i = 0; i < stepCount; i++) {
    const ratio = i / (stepCount - 1);
    colors.push(interpolateColor(startColor, endColor, ratio));
  }

  return colors;
}
