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
import {
  ColorService,
  type MatchingMethod,
  isDyeExcluded,
  DEFAULT_MATCHING_METHOD,
} from '@xivdyetools/core';
import { blendColors } from '@xivdyetools/core/blending';
import { createTranslator, type LocaleCode, type TranslatorLogger } from '../i18n/index.js';
import {
  generateGradientCard,
  type GradientRowEntry,
  type GradientStripCell,
} from '@xivdyetools/svg';
import { dyeService, type ResolvedColor } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import { failureKind } from './failure-kind.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export type InterpolationMode =
  'rgb' | 'hsv' | 'lab' | 'oklch' | 'lch' | 'oklab' | 'ryb' | 'hsl' | 'spectral';

export interface GradientInput {
  /**
   * Optional logger — surfaces Translator missing-key warnings, which are
   * otherwise silent (2026-08-20 i18n audit, F-13). Any `{ warn(msg) }`.
   */
  logger?: TranslatorLogger;
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
  const merged: Array<{
    startStep: number;
    endStep: number;
    step: GradientStepResult;
    deltaE: number;
  }> = [];
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
  if (rows.length <= 5)
    return { rows, merged: merged.length, omitted: merged.length - rows.length };

  // Stage 3: keep the five widest gaps, back in step order
  const keep = new Set([...rows].sort((a, b) => b.deltaE - a.deltaE).slice(0, 5));
  const omitted = merged.length - keep.size;
  rows = rows.filter((r) => keep.has(r));
  return { rows, merged: merged.length, omitted };
}

/**
 * IDs of every dye the user's filters exclude — handed to core's
 * `findClosestDye` as `excludeIds`, so its search runs over the allowed pool
 * only (BUG-033).
 */
function filteredOutDyeIds(dyeFilters: DyeTypeFilters): number[] {
  return dyeService
    .getAllDyes()
    .filter((dye) => isDyeExcluded(dyeFilters, dye))
    .map((dye) => dye.id);
}

/**
 * Below these chromas an OKLCH / LCH endpoint is grey, and its hue is a
 * placeholder. Core rounds chroma (OKLCH to 6 dp, LCH to 4 dp), so an exact
 * grey (r = g = b) reads C = 0 in both — but not hue 0 in LCH, where float
 * noise in a and b (raw chroma ≤ 2e-5) comes out of atan2 as h ≈ 158.2. The
 * least chromatic non-greys found, scanning every colour within three units
 * of a grey, are #FEFFFF at OKLCH C 0.001059 and #000101 at LCH C 0.2773.
 * These thresholds sit 10× and 28× below those and far above the noise, so
 * exactly the r = g = b colours count as grey — the set core's blendHSL treats
 * as powerless (s === 0) — whether or not core keeps its rounding. The web
 * app's gradient tool (components/gradient-tool.ts) uses the same two values.
 */
const OKLCH_GREY_CHROMA = 1e-4;
const LCH_GREY_CHROMA = 0.01;

/**
 * The hue at `t` along the shorter arc from start to end, with CSS Color 4's
 * "powerless hue" rule — the one core's blendHSL applies (BUG-035).
 *
 * A grey endpoint (white and black included) has no hue of its own; the hue
 * core reports for it is a placeholder — 0 in HSV and OKLCH, ~158 in LCH.
 * Interpolating it as a real hue swung every grey ramp through whatever lay
 * between: Slate Grey #656565 → #2A3FD0 drew a purple midpoint (#975D9B) in
 * HSV, the default, and ran through teal in LCH; white → blue went pink. So a
 * grey side takes the other side's hue, and the chromatic end's hue holds
 * along the whole ramp while the other two channels still interpolate. When
 * both sides are grey the hue is irrelevant — the ramp has no chroma — and
 * each keeps its own, so a grey-to-grey ramp is unchanged.
 */
function interpolateHue(
  startHue: number,
  endHue: number,
  startIsGrey: boolean,
  endIsGrey: boolean,
  t: number,
): number {
  const from = startIsGrey && !endIsGrey ? endHue : startHue;
  const to = endIsGrey && !startIsGrey ? startHue : endHue;
  let hueDiff = to - from;
  if (hueDiff > 180) hueDiff -= 360;
  if (hueDiff < -180) hueDiff += 360;
  return (from + hueDiff * t + 360) % 360;
}

/** One HSV step — the `hsv` mode and the fallback for an unknown one. */
function interpolateHsv(startColor: string, endColor: string, t: number): string {
  const startHsv = ColorService.hexToHsv(startColor);
  const endHsv = ColorService.hexToHsv(endColor);
  // From integer RGB, s is exactly 0 when r = g = b
  const h = interpolateHue(startHsv.h, endHsv.h, startHsv.s === 0, endHsv.s === 0, t);
  const s = startHsv.s + (endHsv.s - startHsv.s) * t;
  const v = startHsv.v + (endHsv.v - startHsv.v) * t;
  return ColorService.hsvToHex(h, s, v);
}

/**
 * Generates interpolated colors between start and end in the specified color space.
 */
function generateGradientColorsMultiSpace(
  startColor: string,
  endColor: string,
  stepCount: number,
  mode: InterpolationMode,
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
        interpolatedColor = interpolateHsv(startColor, endColor, t);
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
        const L = startOklch.L + (endOklch.L - startOklch.L) * t;
        const C = startOklch.C + (endOklch.C - startOklch.C) * t;
        const h = interpolateHue(
          startOklch.h,
          endOklch.h,
          startOklch.C < OKLCH_GREY_CHROMA,
          endOklch.C < OKLCH_GREY_CHROMA,
          t,
        );
        interpolatedColor = ColorService.oklchToHex(L, C, h);
        break;
      }

      case 'lch': {
        const startLch = ColorService.hexToLch(startColor);
        const endLch = ColorService.hexToLch(endColor);
        const L = startLch.L + (endLch.L - startLch.L) * t;
        const C = startLch.C + (endLch.C - startLch.C) * t;
        const h = interpolateHue(
          startLch.h,
          endLch.h,
          startLch.C < LCH_GREY_CHROMA,
          endLch.C < LCH_GREY_CHROMA,
          t,
        );
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
        interpolatedColor = interpolateHsv(startColor, endColor, t);
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
    matchingMethod = DEFAULT_MATCHING_METHOD,
    dyeFilters,
  } = input;
  const t = createTranslator(locale, input.logger);

  await initializeLocale(locale);

  try {
    const gradientHexColors = generateGradientColorsMultiSpace(
      startColor.hex,
      endColor.hex,
      stepCount,
      colorSpace,
    );

    // Find the closest dye per step; ΔE2000 is the number the old boundary
    // threw away.
    //
    // BUG-033 (2026-10-04 deep dive): the filters narrow the POOL before the
    // search, so the answer is "the nearest allowed dye". They used to be
    // checked on the search's answer one dye at a time, giving up after ten
    // rejections — with `/preferences vendor` (85 of 125 dyes excluded) a
    // white→black gradient printed "no match" on its #666666 step although
    // 40 allowed dyes exist. Core's own search still does the ranking (k-d
    // tree for rgb, unrounded percent for distinguish) and skips Facewear.
    const excludeIds = dyeFilters ? filteredOutDyeIds(dyeFilters) : [];
    const gradientSteps: GradientStepResult[] = [];

    for (const hex of gradientHexColors) {
      const closestDye = dyeService.findClosestDye(hex, { excludeIds, matchingMethod });

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
    const { rows: capped, omitted, merged: distinctAfterMerge } = capGradientRows(gradientSteps);
    const rows: GradientRowEntry[] = capped.map((r) => ({
      stepText: r.startStep === r.endStep ? String(r.startStep) : `${r.startStep}–${r.endStep}`,
      idealHex: r.step.hex,
      dyeHex: r.step.dye?.hex ?? r.step.hex,
      name: r.step.dyeName ?? t.t('errors.noMatchFound'),
      deltaE: r.step.distance,
    }));

    // 12H·4 stage 0: four or more steps resolving to two rows or fewer —
    // measured on rows after the merge, never on endpoint separation.
    // (pkg-svg-bot-logic-11: `merged` comes off the call above; asking
    // `capGradientRows` again re-ran the whole merge/filter/sort per /gradient
    // to read a number the first call had already returned.)
    const verdict =
      stepCount >= 4 && distinctAfterMerge <= 2
        ? t.tc('card.gradVerdict', distinctAfterMerge, { n: stepCount, k: distinctAfterMerge })
        : null;

    const legend =
      omitted > 0 ? t.tc('card.gradKeyCut', rows.length, { n: stepCount, k: rows.length }) : t.t('card.gradKey');

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
      title: `${t.t('gradient.title')} • ${t.tc('gradient.steps', stepCount)}`,
      description: omitted > 0 ? t.t('card.gradOmitted', { n: omitted }) : undefined,
      color: parseInt(startColor.hex.replace('#', ''), 16),
    };

    return {
      ok: true,
      svgString,
      gradientSteps,
      startColor,
      endColor,
      omittedRows: omitted,
      embed,
    };
  } catch (error) {
    // BUG-125: log the cause rather than discard it — its class, never its
    // message, which quotes the hex the user typed ("Invalid hex color: …").
    input.logger?.warn(`[gradient] generation failed: ${failureKind(error)}`);
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: t.t('errors.generationFailed') };
  }
}
