/**
 * Gradient Tool OG Image Generator
 *
 * Creates an OG image showing a color gradient between two dyes
 * with step swatches and names.
 *
 * Layout (1200x630):
 * ┌──────────────────────────────────────────────────────┐
 * │  ✦ XIV DYE TOOLS    GRADIENT BUILDER     5 STEPS    │
 * ├──────────────────────────────────────────────────────┤
 * │                                                      │
 * │  START                                          END  │
 * │  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐     │
 * │  │    │──│    │──│    │──│    │──│    │──│    │     │
 * │  └────┘  └────┘  └────┘  └────┘  └────┘  └────┘     │
 * │  Snow    Step 1  Step 2  Step 3  Step 4  Lilac      │
 * │  White   #CCCC   #BBBB   #AAAA   #9999   Purple     │
 * │                                                      │
 * ├──────────────────────────────────────────────────────┤
 * │  🎨 xivdyetools.app                    Algorithm: OKLAB │
 * └──────────────────────────────────────────────────────┘
 */

import { ColorService } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { rect, text, line, truncateText, THEME, FONTS, OG_DIMENSIONS } from './base';
import { generateOGCard, LAYOUT } from './og-card';
import { dyeService, findClosestDyesWithDistance, getDyeByItemId } from './dye-helpers';
import { getLocalizedDyeName } from '../translator';
import type { MatchingAlgorithm } from '../../types';

export interface GradientOGOptions {
  /** Start dye itemID */
  startDyeId: number;
  /** End dye itemID */
  endDyeId: number;
  /** Number of steps (including start and end) */
  steps: number;
  /** Matching algorithm */
  algorithm?: MatchingAlgorithm;
  /** Locale for dye name display */
  locale?: LocaleCode;
}

/**
 * Interpolates between two hex colors in the space implied by the requested
 * algorithm (BUG-031: previously always raw RGB regardless of ?algo=, while
 * the footer printed the algorithm name).
 * - oklab → OKLAB interpolation
 * - ciede2000 → CIELAB interpolation (the space the metric is defined over)
 * - euclidean → RGB interpolation
 */
function interpolateColor(
  color1: string,
  color2: string,
  ratio: number,
  algorithm: MatchingAlgorithm
): string {
  switch (algorithm) {
    case 'ciede2000':
      return ColorService.mixColorsLab(color1, color2, ratio);
    case 'euclidean':
      return ColorService.mixColorsRgb(color1, color2, ratio);
    case 'oklab':
    default:
      return ColorService.mixColorsOklab(color1, color2, ratio);
  }
}

/**
 * Generates gradient steps with matched dyes
 */
function generateGradientSteps(
  startHex: string,
  endHex: string,
  stepCount: number,
  algorithm: MatchingAlgorithm
): Array<{ hex: string; matchedDye?: Dye; delta?: number }> {
  const steps: Array<{ hex: string; matchedDye?: Dye; delta?: number }> = [];

  for (let i = 0; i < stepCount; i++) {
    const ratio = i / (stepCount - 1);
    const hex = interpolateColor(startHex, endHex, ratio, algorithm);

    // Find closest matching dye with the requested metric (BUG-031)
    const matches = findClosestDyesWithDistance(hex, { limit: 1, algorithm });
    const match = matches[0];

    steps.push({
      hex,
      matchedDye: match?.dye,
      delta: match?.distance,
    });
  }

  return steps;
}

/**
 * Generates the Gradient tool OG image SVG
 */
export function generateGradientOG(options: GradientOGOptions): string {
  const { startDyeId, endDyeId, steps: stepCount, algorithm = 'oklab', locale = 'en' } = options;

  // Look up the dyes
  const startDye = getDyeByItemId(startDyeId);
  const endDye = getDyeByItemId(endDyeId);

  if (!startDye || !endDye) {
    return generateFallbackGradientOG(stepCount, algorithm);
  }

  // Generate gradient steps
  const gradientSteps = generateGradientSteps(startDye.hex, endDye.hex, stepCount, algorithm);

  // Build content elements
  const contentElements: string[] = [];
  const { contentTop, contentHeight, padding, contentWidth } = LAYOUT;

  // Calculate swatch layout (larger swatches)
  const maxSwatches = Math.min(stepCount, 7); // Max 7 for readability
  const swatchSize = 110;
  const minGap = 18;
  const totalSwatchWidth = maxSwatches * swatchSize + (maxSwatches - 1) * minGap;
  const startX = (OG_DIMENSIONS.width - totalSwatchWidth) / 2;

  // Vertical centering: labels above (20px) + swatches + bar area (28px) + labels below (50px)
  const totalVisualHeight = 20 + swatchSize + 28 + 50;
  const swatchY = contentTop + (contentHeight - totalVisualHeight) / 2 + 20;

  // START label
  contentElements.push(
    text(startX + swatchSize / 2, swatchY - 20, 'START', {
      fill: THEME.textMuted,
      fontSize: 12,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // END label
  contentElements.push(
    text(startX + totalSwatchWidth - swatchSize / 2, swatchY - 20, 'END', {
      fill: THEME.textMuted,
      fontSize: 12,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  // Draw gradient bar across the top
  const barY = swatchY + swatchSize + 20;
  const barHeight = 8;

  // Create gradient stops
  contentElements.push(`
    <defs>
      <linearGradient id="gradientBar" x1="0%" y1="0%" x2="100%" y2="0%">
        ${gradientSteps.map((step, i) => `<stop offset="${(i / (gradientSteps.length - 1)) * 100}%" stop-color="${step.hex}"/>`).join('')}
      </linearGradient>
    </defs>
  `);

  contentElements.push(
    rect(startX, barY, totalSwatchWidth, barHeight, 'url(#gradientBar)', { rx: 4 })
  );

  // Draw swatches
  gradientSteps.slice(0, maxSwatches).forEach((step, i) => {
    const x = startX + i * (swatchSize + minGap);
    const isEndpoint = i === 0 || i === gradientSteps.length - 1;

    // Swatch
    contentElements.push(
      rect(x, swatchY, swatchSize, swatchSize, step.hex, {
        rx: 8,
        stroke: isEndpoint ? '#ffffff' : THEME.border,
        strokeWidth: isEndpoint ? 3 : 1,
      })
    );

    // Connection line to gradient bar
    contentElements.push(
      line(x + swatchSize / 2, swatchY + swatchSize, x + swatchSize / 2, barY, THEME.border, 1)
    );

    // Dye name (or "Step N")
    const labelY = barY + barHeight + 30;
    const matchName = step.matchedDye ? getLocalizedDyeName(step.matchedDye, locale) : null;
    const dyeName = matchName
      ? truncateText(matchName, 10)
      : `Step ${i + 1}`;

    contentElements.push(
      text(x + swatchSize / 2, labelY, dyeName, {
        fill: THEME.text,
        fontSize: 12,
        fontFamily: FONTS.primaryCjk,
        fontWeight: isEndpoint ? 600 : 400,
        textAnchor: 'middle',
      })
    );

    // Hex code
    contentElements.push(
      text(x + swatchSize / 2, labelY + 20, step.hex.toUpperCase(), {
        fill: THEME.textMuted,
        fontSize: 11,
        fontFamily: FONTS.mono,
        textAnchor: 'middle',
      })
    );
  });

  // Summary text
  const summaryY = contentTop + contentHeight - 60;
  contentElements.push(
    text(
      OG_DIMENSIONS.width / 2,
      summaryY,
      `${getLocalizedDyeName(startDye, locale)} → ${getLocalizedDyeName(endDye, locale)}`,
      {
        fill: THEME.text,
        fontSize: 20,
        fontFamily: FONTS.headerCjk,
        fontWeight: 500,
        textAnchor: 'middle',
      }
    )
  );

  return generateOGCard({
    toolName: 'Gradient Builder',
    subtitle: `${stepCount} Steps`,
    content: contentElements.join('\n'),
    algorithm,
  });
}

/**
 * Generates a fallback OG image when dyes are not found
 */
function generateFallbackGradientOG(
  steps: number,
  algorithm: MatchingAlgorithm
): string {
  const contentElements: string[] = [];
  const { contentTop, contentHeight } = LAYOUT;

  // Centered message
  contentElements.push(
    text(OG_DIMENSIONS.width / 2, contentTop + contentHeight / 2 - 20, 'Create Color Gradients', {
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
      'Build smooth transitions between FFXIV dyes',
      {
        fill: THEME.textMuted,
        fontSize: 18,
        fontFamily: FONTS.primary,
        textAnchor: 'middle',
      }
    )
  );

  // Example gradient bar
  const barWidth = 600;
  const barHeight = 40;
  const barX = (OG_DIMENSIONS.width - barWidth) / 2;
  const barY = contentTop + contentHeight / 2 + 80;

  contentElements.push(`
    <defs>
      <linearGradient id="exampleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ef4444"/>
        <stop offset="50%" stop-color="#eab308"/>
        <stop offset="100%" stop-color="#22c55e"/>
      </linearGradient>
    </defs>
  `);

  contentElements.push(
    rect(barX, barY, barWidth, barHeight, 'url(#exampleGradient)', { rx: 8 })
  );

  return generateOGCard({
    toolName: 'Gradient Builder',
    subtitle: `${steps} Steps`,
    content: contentElements.join('\n'),
    algorithm,
  });
}
