/**
 * Gradient Command — Business Logic
 *
 * Generates a multi-step color gradient between two colors and finds
 * the closest FFXIV dye for each step.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/gradient
 */

import { ColorService, type Dye, type MatchingMethod } from '@xivdyetools/core';
import { createTranslator, type LocaleCode } from '@xivdyetools/bot-i18n';
import { generateGradientBar, type GradientStep } from '@xivdyetools/svg';
import { dyeService, type ResolvedColor } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export type InterpolationMode = 'rgb' | 'hsv' | 'lab' | 'oklch' | 'lch';

export interface GradientInput {
  startColor: ResolvedColor;
  endColor: ResolvedColor;
  /** Number of steps including start and end (default: 6) */
  stepCount?: number;
  colorSpace?: InterpolationMode;
  matchingMethod?: MatchingMethod;
  locale: LocaleCode;
}

export interface GradientStepResult extends GradientStep {
  dye?: Dye;
  distance: number;
}

export type GradientResult =
  | {
      ok: true;
      svgString: string;
      gradientSteps: GradientStepResult[];
      startColor: ResolvedColor;
      endColor: ResolvedColor;
      embed: EmbedData;
    }
  | { ok: false; error: 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Helpers
// ============================================================================

function getColorDistance(hex1: string, hex2: string): number {
  const rgb1 = ColorService.hexToRgb(hex1);
  const rgb2 = ColorService.hexToRgb(hex2);
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

function getMatchQualityLabel(distance: number, t: ReturnType<typeof createTranslator>): string {
  if (distance === 0) return t.t('quality.perfect');
  if (distance < 10) return t.t('quality.excellent');
  if (distance < 25) return t.t('quality.good');
  if (distance < 50) return t.t('quality.fair');
  return t.t('quality.approximate');
}

/**
 * Generates interpolated colors between start and end in the specified color space.
 */
function generateGradientColorsMultiSpace(
  startColor: string,
  endColor: string,
  stepCount: number,
  mode: InterpolationMode
): string[] {
  const colors: string[] = [];

  for (let i = 0; i < stepCount; i++) {
    const t = stepCount === 1 ? 0 : i / (stepCount - 1);
    let interpolatedColor: string;

    switch (mode) {
      case 'rgb': {
        const startRgb = ColorService.hexToRgb(startColor);
        const endRgb = ColorService.hexToRgb(endColor);
        const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * t);
        const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * t);
        const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * t);
        interpolatedColor = ColorService.rgbToHex(r, g, b);
        break;
      }

      case 'hsv': {
        const startHsv = ColorService.hexToHsv(startColor);
        const endHsv = ColorService.hexToHsv(endColor);
        let hueDiff = endHsv.h - startHsv.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const h = (startHsv.h + hueDiff * t + 360) % 360;
        const s = startHsv.s + (endHsv.s - startHsv.s) * t;
        const v = startHsv.v + (endHsv.v - startHsv.v) * t;
        interpolatedColor = ColorService.hsvToHex(h, s, v);
        break;
      }

      case 'lab': {
        const startLab = ColorService.hexToLab(startColor);
        const endLab = ColorService.hexToLab(endColor);
        const L = startLab.L + (endLab.L - startLab.L) * t;
        const a = startLab.a + (endLab.a - startLab.a) * t;
        const b = startLab.b + (endLab.b - startLab.b) * t;
        interpolatedColor = ColorService.labToHex(L, a, b);
        break;
      }

      case 'oklch': {
        const startOklch = ColorService.hexToOklch(startColor);
        const endOklch = ColorService.hexToOklch(endColor);
        let hueDiff = endOklch.h - startOklch.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const L = startOklch.L + (endOklch.L - startOklch.L) * t;
        const C = startOklch.C + (endOklch.C - startOklch.C) * t;
        const h = (startOklch.h + hueDiff * t + 360) % 360;
        interpolatedColor = ColorService.oklchToHex(L, C, h);
        break;
      }

      case 'lch': {
        const startLch = ColorService.hexToLch(startColor);
        const endLch = ColorService.hexToLch(endColor);
        let hueDiff = endLch.h - startLch.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const L = startLch.L + (endLch.L - startLch.L) * t;
        const C = startLch.C + (endLch.C - startLch.C) * t;
        const h = (startLch.h + hueDiff * t + 360) % 360;
        interpolatedColor = ColorService.lchToHex(L, C, h);
        break;
      }

      default: {
        // Default to HSV
        const startHsv = ColorService.hexToHsv(startColor);
        const endHsv = ColorService.hexToHsv(endColor);
        let hueDiff = endHsv.h - startHsv.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const h = (startHsv.h + hueDiff * t + 360) % 360;
        const s = startHsv.s + (endHsv.s - startHsv.s) * t;
        const v = startHsv.v + (endHsv.v - startHsv.v) * t;
        interpolatedColor = ColorService.hsvToHex(h, s, v);
      }
    }

    colors.push(interpolatedColor);
  }

  return colors;
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Generates a gradient bar SVG and embed data for the given color range.
 */
export async function executeGradient(input: GradientInput): Promise<GradientResult> {
  const {
    startColor,
    endColor,
    locale,
    stepCount = 6,
    colorSpace = 'hsv',
    matchingMethod = 'oklab',
  } = input;
  const t = createTranslator(locale);

  await initializeLocale(locale);

  try {
    const gradientHexColors = generateGradientColorsMultiSpace(
      startColor.hex,
      endColor.hex,
      stepCount,
      colorSpace
    );

    // Find closest non-Facewear dye for each gradient step
    const gradientSteps: GradientStepResult[] = [];

    for (const hex of gradientHexColors) {
      let closestDye: Dye | null = null;
      const excludeIds: number[] = [];

      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = dyeService.findClosestDye(hex, { excludeIds, matchingMethod });
        if (!candidate) break;
        if (candidate.category !== 'Facewear') {
          closestDye = candidate;
          break;
        }
        excludeIds.push(candidate.id);
      }

      const distance = closestDye ? getColorDistance(hex, closestDye.hex) : 999;
      const localizedDyeName = closestDye
        ? getLocalizedDyeName(closestDye.itemID, closestDye.name, locale)
        : undefined;

      gradientSteps.push({
        hex,
        dyeName: localizedDyeName,
        dyeId: closestDye?.id,
        dye: closestDye ?? undefined,
        distance,
      });
    }

    const svgString = generateGradientBar({
      steps: gradientSteps,
      width: 800,
      height: 200,
      startLabel: t.t('gradient.start') || 'START',
      endLabel: t.t('gradient.end') || 'END',
    });

    // Build description
    const dyeLines = gradientSteps.map((step, i) => {
      const quality = getMatchQualityLabel(step.distance, t);
      const dyeText = step.dyeName
        ? `**${step.dyeName}**`
        : `_${t.t('errors.noMatchFound')}_`;

      let label = '';
      if (i === 0) label = ` (${t.t('gradient.startColor')})`;
      else if (i === gradientSteps.length - 1) label = ` (${t.t('gradient.endColor')})`;

      return `**${i + 1}.** ${dyeText} • \`${step.hex.toUpperCase()}\` • ${quality}${label}`;
    }).join('\n');

    const localizedStartName = startColor.itemID && startColor.name
      ? getLocalizedDyeName(startColor.itemID, startColor.name, locale)
      : startColor.name;
    const localizedEndName = endColor.itemID && endColor.name
      ? getLocalizedDyeName(endColor.itemID, endColor.name, locale)
      : endColor.name;

    const startText = localizedStartName
      ? `**${localizedStartName}** (\`${startColor.hex.toUpperCase()}\`)`
      : `\`${startColor.hex.toUpperCase()}\``;
    const endText = localizedEndName
      ? `**${localizedEndName}** (\`${endColor.hex.toUpperCase()}\`)`
      : `\`${endColor.hex.toUpperCase()}\``;

    const colorSpaceLabel = colorSpace.toUpperCase();
    const matchingLabel = matchingMethod === 'ciede2000' ? 'CIEDE2000' :
      matchingMethod === 'cie76' ? 'CIE76' : matchingMethod.toUpperCase();

    const embed: EmbedData = {
      title: `${t.t('gradient.title')} • ${t.t('gradient.steps', { count: stepCount })}`,
      description: [
        `**${t.t('gradient.startColor')}:** ${startText}`,
        `**${t.t('gradient.endColor')}:** ${endText}`,
        `**${t.t('gradient.colorSpace') || 'Color Space'}:** ${colorSpaceLabel} • **${t.t('gradient.matching') || 'Matching'}:** ${matchingLabel}`,
        '',
        `**${t.t('extractor.topMatches', { count: stepCount })}:**`,
        dyeLines,
      ].join('\n'),
      color: parseInt(startColor.hex.replace('#', ''), 16),
      footer: `${t.t('common.footer')} • ${t.t('extractor.useInfoNameHint')}`,
    };

    return { ok: true, svgString, gradientSteps, startColor, endColor, embed };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to generate gradient.' };
  }
}

export type { MatchingMethod };
