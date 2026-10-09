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
import { createTranslator, type LocaleCode, type TranslatorLogger } from '../i18n/index.js';
import { blendColors, type BlendingMode } from '@xivdyetools/core/blending';
import { generateMixerCard, type MixerCardRow } from '@xivdyetools/svg';
import { dyeService, type ResolvedColor } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import { failureKind } from './failure-kind.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface MixerInput {
  /**
   * Optional logger — surfaces Translator missing-key warnings, which are
   * otherwise silent (2026-08-20 i18n audit, F-13). Any `{ warn(msg) }`.
   */
  logger?: TranslatorLogger;
  dye1: ResolvedColor;
  dye2: ResolvedColor;
  blendingMode: BlendingMode;
  /** Matching method for the blended result's nearest dye (default: `DEFAULT_MATCHING_METHOD`, ΔE2000). */
  matchingMethod?: MatchingMethod;
  locale: LocaleCode;
  /** Optional dye type filters (e.g., exclude metallic, pastel, etc.) */
  dyeFilters?: DyeTypeFilters;
  /** Card theme (stored user preference; defaults dark) */
  theme?: 'dark' | 'light';
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
      blendingMode: BlendingMode;
      /** The five-ratio sweep behind the card */
      sweep: MixerSweepStop[];
      embed: EmbedData;
    }
  | { ok: false; error: 'NO_MATCHES' | 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Helpers
// ============================================================================

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
  const t = createTranslator(locale, input.logger);

  await initializeLocale(locale);

  try {
    // 12F: the sweep replaces the hardcoded midpoint — five ratios, each
    // blended and matched, because "which ratio lands on a buyable dye" is
    // the question a mixer is for.
    //
    // BUG-033 (2026-10-04 deep dive): the filters narrow the POOL before the
    // search, so each stop lands on "the nearest allowed dye". They used to
    // be checked on the search's answer one dye at a time, giving up after
    // twenty rejections — with `/preferences vendor` the Snow White + Soot
    // Black sweep silently lost its 65% stop (first allowed dye: rank 31).
    // Core's own search still does the ranking and skips Facewear.
    const excludeIds = dyeFilters ? filteredOutDyeIds(dyeFilters) : [];
    const sweep: MixerSweepStop[] = MIXER_SWEEP_RATIOS.map((pct) => {
      const blend = blendColors(dye1.hex, dye2.hex, blendingMode, pct / 100);
      const dye = dyeService.findClosestDye(blend.hex, { excludeIds, matchingMethod });
      const deltaE = dye ? ColorService.getDistanceForMethod(blend.hex, dye.hex, 'ciede2000') : 999;
      return { pct, blendHex: blend.hex, dye: dye as Dye, deltaE, best: false };
    }).filter((s) => s.dye != null);

    if (sweep.length === 0) {
      return { ok: false, error: 'NO_MATCHES', errorMessage: t.t('errors.noMatchFound') };
    }
    const bestStop = sweep.reduce((a, b) => (b.deltaE < a.deltaE ? b : a));
    bestStop.best = true;

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
      blendingMode,
      sweep,
      embed,
    };
  } catch (error) {
    // BUG-125: log the cause rather than discard it — its class, never its
    // message, which quotes the hex the user typed ("Invalid hex color: …").
    input.logger?.warn(`[mixer] generation failed: ${failureKind(error)}`);
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: t.t('errors.generationFailed') };
  }
}

export type { BlendingMode, ResolvedColor };
