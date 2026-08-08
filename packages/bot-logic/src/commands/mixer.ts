/**
 * Mixer Command — Business Logic
 *
 * Blends two colors using a color mixing algorithm and finds the
 * closest FFXIV dye(s) to the blended result.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/mixer
 */

import type { Dye, DyeTypeFilters } from '@xivdyetools/types';
import { ColorService, isDyeExcluded, type MatchingMethod } from '@xivdyetools/core';
import { createTranslator, type LocaleCode } from '../i18n/index.js';
import { blendColors, type BlendingMode } from '@xivdyetools/core/blending';
import { generateMixerCard, type MixerCardRow } from '@xivdyetools/svg';
import { dyeService, type ResolvedColor } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface MixerInput {
  dye1: ResolvedColor;
  dye2: ResolvedColor;
  blendingMode: BlendingMode;
  /** Number of closest dyes to return (default: 1) */
  count?: number;
  /** Algorithm used to find closest dye for the blended result (default: 'oklab'). */
  matchingMethod?: MatchingMethod;
  locale: LocaleCode;
  /** Optional dye type filters (e.g., exclude metallic, pastel, etc.) */
  dyeFilters?: DyeTypeFilters;
  /** Card theme (stored user preference; defaults dark) */
  theme?: 'dark' | 'light';
}

export interface MixerMatch {
  dye: Dye;
  distance: number;
}

/** One sweep stop: the ratio, its blend, and the nearest buyable dye. */
export interface MixerSweepStop {
  /** Share of dye 2 in the blend, 0–100 */
  pct: number;
  blendHex: string;
  dye: Dye;
  /** ΔE2000 blend → dye */
  deltaE: number;
  /** The sweep's best landing */
  best: boolean;
}

/** 12F: the five ratios the sweep runs — the midpoint is just one of them. */
export const MIXER_SWEEP_RATIOS = [25, 40, 50, 65, 80] as const;

export type MixerResult =
  | {
      ok: true;
      /** The 12F ratio-sweep card — the command's first image */
      svgString: string;
      /** The 50% blend (kept for adapters that surface a single colour) */
      blendedHex: string;
      blendingMode: BlendingMode;
      inputDyes: [ResolvedColor, ResolvedColor];
      /** Nearest dyes to the 50% blend (legacy shape, still returned) */
      matches: MixerMatch[];
      /** The five-ratio sweep behind the card */
      sweep: MixerSweepStop[];
      embed: EmbedData;
    }
  | { ok: false; error: 'NO_MATCHES' | 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Helpers
// ============================================================================

function findClosestDyeExcludingFacewear(
  targetHex: string,
  excludeIds: number[] = [],
  maxAttempts = 20,
  dyeFilters?: DyeTypeFilters,
  matchingMethod?: MatchingMethod
): Dye | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = dyeService.findClosestDye(targetHex, { excludeIds, matchingMethod });
    if (!candidate) break;
    if (candidate.category !== 'Facewear' && (!dyeFilters || !isDyeExcluded(dyeFilters, candidate))) return candidate;
    excludeIds.push(candidate.id);
  }
  return null;
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Blends two dyes and finds the closest FFXIV dye matches.
 *
 * The adapter is responsible for:
 * - Resolving color inputs (via resolveColorInput from input-resolution)
 * - Resolving blendingMode from user preferences / command options
 * - Building copy buttons (Discord-specific)
 */
export async function executeMixer(input: MixerInput): Promise<MixerResult> {
  const { dye1, dye2, blendingMode, locale, dyeFilters, matchingMethod } = input;
  const count = Math.max(1, input.count ?? 1);
  const t = createTranslator(locale);

  await initializeLocale(locale);

  try {
    // 12F: the sweep replaces the hardcoded midpoint — five ratios, each
    // blended and matched, because "which ratio lands on a buyable dye" is
    // the question a mixer is for.
    const sweep: MixerSweepStop[] = MIXER_SWEEP_RATIOS.map((pct) => {
      const blend = blendColors(dye1.hex, dye2.hex, blendingMode, pct / 100);
      const dye = findClosestDyeExcludingFacewear(blend.hex, [], 20, dyeFilters, matchingMethod);
      const deltaE = dye
        ? ColorService.getDistanceForMethod(blend.hex, dye.hex, 'ciede2000')
        : 999;
      return { pct, blendHex: blend.hex, dye: dye as Dye, deltaE, best: false };
    }).filter((s) => s.dye != null);

    if (sweep.length === 0) {
      return { ok: false, error: 'NO_MATCHES', errorMessage: 'No matching dyes found.' };
    }
    const bestStop = sweep.reduce((a, b) => (b.deltaE < a.deltaE ? b : a));
    bestStop.best = true;

    // Legacy shape: nearest dyes to the 50% blend
    const blendResult = blendColors(dye1.hex, dye2.hex, blendingMode, 0.5);
    const matches: MixerMatch[] = [];
    const excludeIds: number[] = [];
    for (let i = 0; i < count; i++) {
      const closestDye = findClosestDyeExcludingFacewear(
        blendResult.hex,
        [...excludeIds],
        20,
        dyeFilters,
        matchingMethod
      );
      if (closestDye) {
        matches.push({
          dye: closestDye,
          distance: ColorService.getDistanceForMethod(blendResult.hex, closestDye.hex, 'ciede2000'),
        });
        excludeIds.push(closestDye.id);
      }
    }

    // Localized input names for the card header
    const dye1Name =
      (dye1.itemID && dye1.name
        ? getLocalizedDyeName(dye1.itemID, dye1.name, locale)
        : dye1.name) ?? dye1.hex.toUpperCase();
    const dye2Name =
      (dye2.itemID && dye2.name
        ? getLocalizedDyeName(dye2.itemID, dye2.name, locale)
        : dye2.name) ?? dye2.hex.toUpperCase();

    const rows: MixerCardRow[] = sweep.map((s) => ({
      pct: s.pct,
      blendHex: s.blendHex,
      dyeHex: s.dye.hex,
      name: getLocalizedDyeName(s.dye.itemID, s.dye.name, locale),
      deltaE: s.deltaE,
      best: s.best,
    }));

    const svgString = generateMixerCard({
      modeLabel: blendingMode,
      dyeA: { hex: dye1.hex, name: dye1Name },
      dyeB: { hex: dye2.hex, name: dye2Name },
      rows,
      ratioKey: t.t('card.ratioKey'),
      lang: locale,
      theme: input.theme,
    });

    // One line: the card carries the sweep; the embed leads with the best stop
    const bestName = getLocalizedDyeName(bestStop.dye.itemID, bestStop.dye.name, locale);
    const embed: EmbedData = {
      title: `🎨 ${t.t('mixer.blendResult')}`,
      description: `**${bestStop.pct}%** · ${bestName}`,
      color: parseInt(bestStop.dye.hex.replace('#', ''), 16),
    };

    return {
      ok: true,
      svgString,
      blendedHex: blendResult.hex,
      blendingMode,
      inputDyes: [dye1, dye2],
      matches,
      sweep,
      embed,
    };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to blend colors.' };
  }
}

export type { BlendingMode, ResolvedColor };
