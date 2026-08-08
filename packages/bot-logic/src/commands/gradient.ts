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

import type { Dye, DyeTypeFilters } from '@xivdyetools/types';
import { ColorService, type MatchingMethod, isDyeExcluded } from '@xivdyetools/core';
import { blendColors } from '@xivdyetools/core/blending';
import { createTranslator, type LocaleCode } from '../i18n/index.js';
import {
  generateGradientCard,
  type GradientRowEntry,
  type GradientStripCell,
} from '@xivdyetools/svg';
import { dyeService, type ResolvedColor } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export type InterpolationMode =
  | 'rgb'
  | 'hsv'
  | 'lab'
  | 'oklch'
  | 'lch'
  | 'oklab'
  | 'ryb'
  | 'hsl'
  | 'spectral';

export interface GradientInput {
  startColor: ResolvedColor;
  endColor: ResolvedColor;
  /** Number of steps including start and end (default: 6) */
  stepCount?: number;
  colorSpace?: InterpolationMode;
  matchingMethod?: MatchingMethod;
  locale: LocaleCode;
  /** Optional dye type filters (e.g., exclude metallic, pastel, etc.) */
  dyeFilters?: DyeTypeFilters;
  /** Card theme (stored user preference; defaults dark) */
  theme?: 'dark' | 'light';
}

export interface GradientStepResult {
  /** The ideal interpolated colour for this step */
  hex: string;
  /** Localized nearest-dye name */
  dyeName?: string;
  dyeId?: number;
  dye?: Dye;
  /** ΔE2000 ideal → dye (the number the old boundary threw away) */
  distance: number;
}

export type GradientResult =
  | {
      ok: true;
      svgString: string;
      gradientSteps: GradientStepResult[];
      startColor: ResolvedColor;
      endColor: ResolvedColor;
      /** Rows omitted by the cap's stage 3 — named in the embed */
      omittedRows: number;
      embed: EmbedData;
    }
  | { ok: false; error: 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Helpers
// ============================================================================

/**
 * The cap as three stages (12H·2/·3, one function for both frames):
 * 1. Merge adjacent steps resolving to one dye — one row, step range, the
 *    WORST ΔE of the covered steps.
 * 2. Drop rows whose worst step is ΔE 0.0 — testing the VALUE, never the
 *    position (a bare-hex endpoint has a real ΔE and becomes the most
 *    informative row on the card).
 * 3. Keep the widest gaps, rendered in step order; the omitted count goes
 *    to the embed.
 */
export function capGradientRows(steps: GradientStepResult[]): {
  rows: Array<{ startStep: number; endStep: number; step: GradientStepResult; deltaE: number }>;
  merged: number;
  omitted: number;
} {
  // Stage 1: merge
  const merged: Array<{ startStep: number; endStep: number; step: GradientStepResult; deltaE: number }> = [];
  steps.forEach((step, i) => {
    const prev = merged[merged.length - 1];
    if (prev && step.dyeId !== undefined && prev.step.dyeId === step.dyeId) {
      prev.endStep = i + 1;
      if (step.distance > prev.deltaE) {
        prev.deltaE = step.distance;
        prev.step = step;
      }
      return;
    }
    merged.push({ startStep: i + 1, endStep: i + 1, step, deltaE: step.distance });
  });

  if (merged.length <= 5) return { rows: merged, merged: merged.length, omitted: 0 };

  // Stage 2: drop zero-ΔE rows (by value, never position)
  let rows = merged.filter((r) => r.deltaE >= 0.05);
  if (rows.length <= 5) return { rows, merged: merged.length, omitted: merged.length - rows.length };

  // Stage 3: keep the five widest gaps, back in step order
  const keep = new Set(
    [...rows].sort((a, b) => b.deltaE - a.deltaE).slice(0, 5)
  );
  const omitted = merged.length - keep.size;
  rows = rows.filter((r) => keep.has(r));
  return { rows, merged: merged.length, omitted };
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

      case 'oklab':
      case 'ryb':
      case 'hsl':
      case 'spectral': {
        interpolatedColor = blendColors(startColor, endColor, mode, t).hex;
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
    dyeFilters,
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

    // Find the closest non-Facewear dye per step; ΔE2000 is the number the
    // old boundary threw away.
    const gradientSteps: GradientStepResult[] = [];

    for (const hex of gradientHexColors) {
      let closestDye: Dye | null = null;
      const excludeIds: number[] = [];

      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = dyeService.findClosestDye(hex, { excludeIds, matchingMethod });
        if (!candidate) break;
        if (candidate.category !== 'Facewear' && (!dyeFilters || !isDyeExcluded(dyeFilters, candidate))) {
          closestDye = candidate;
          break;
        }
        excludeIds.push(candidate.id);
      }

      const distance = closestDye
        ? ColorService.getDistanceForMethod(hex, closestDye.hex, 'ciede2000')
        : 999;
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

    // 12H·2/·3: the strip carries every step (ideal cap over the dye block);
    // the rows are the distinct dyes after the cap's stages.
    const strip: GradientStripCell[] = gradientSteps.map((s) => ({
      idealHex: s.hex,
      dyeHex: s.dye?.hex ?? s.hex,
    }));
    const { rows: capped, omitted } = capGradientRows(gradientSteps);
    const rows: GradientRowEntry[] = capped.map((r) => ({
      stepText: r.startStep === r.endStep ? String(r.startStep) : `${r.startStep}–${r.endStep}`,
      idealHex: r.step.hex,
      dyeHex: r.step.dye?.hex ?? r.step.hex,
      name: r.step.dyeName ?? t.t('errors.noMatchFound'),
      deltaE: r.step.distance,
    }));

    // 12H·4 stage 0: four or more steps resolving to two rows or fewer —
    // measured on rows after the merge, never on endpoint separation.
    const distinctAfterMerge = capGradientRows(gradientSteps).merged;
    const verdict =
      stepCount >= 4 && distinctAfterMerge <= 2
        ? t.t('card.gradVerdict', { n: stepCount, k: distinctAfterMerge })
        : null;

    const legend =
      omitted > 0
        ? t.t('card.gradKeyCut', { n: stepCount, k: rows.length })
        : t.t('card.gradKey');

    const svgString = generateGradientCard({
      headerText: `${colorSpace.toUpperCase()} · ${stepCount}`,
      strip,
      rows,
      verdict,
      legend,
      lang: locale,
      theme: input.theme,
    });

    // One line: the card carries every step; the embed names the omissions
    const embed: EmbedData = {
      title: `${t.t('gradient.title')} • ${t.t('gradient.steps', { count: stepCount })}`,
      description: omitted > 0 ? t.t('card.gradOmitted', { n: omitted }) : undefined,
      color: parseInt(startColor.hex.replace('#', ''), 16),
    };

    return { ok: true, svgString, gradientSteps, startColor, endColor, omittedRows: omitted, embed };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to generate gradient.' };
  }
}

export type { MatchingMethod };
