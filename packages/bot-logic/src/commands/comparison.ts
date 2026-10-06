/**
 * Comparison Command — Business Logic (14A/14C·2/14C router)
 *
 * The dye count routes the frame: 2 → 14A Duel (one pair, the whole card,
 * all seven readouts), 3 → 14C·2 (the triangle with full names), 4 → 14C
 * (the triangle with coded axes). Four is the command's own limit — the
 * schema caps it, so the router is total and no tail exists anywhere.
 *
 * Polarity: green = close. avgDistance is deleted, not fixed.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/comparison
 */

import type { Dye } from '@xivdyetools/types';
import { abbreviateDyeName, ColorService } from '@xivdyetools/core';
import { createTranslator, type LocaleCode, type TranslatorLogger } from '../i18n/index.js';
import {
  generateComparisonCard,
  contrastRatio,
  formatContrastRatio,
  num,
  type ComparisonDyeEntry,
  type ComparisonReadout,
} from '@xivdyetools/svg';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import { failureKind } from './failure-kind.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface ComparisonInput {
  /**
   * Optional logger — surfaces Translator missing-key warnings, which are
   * otherwise silent (2026-08-20 i18n audit, F-13). Any `{ warn(msg) }`.
   */
  logger?: TranslatorLogger;
  /** 2-4 already-resolved Dye objects (the schema caps at four) */
  dyes: Dye[];
  locale: LocaleCode;
  theme?: 'dark' | 'light';
}

export type ComparisonResult =
  | {
      ok: true;
      svgString: string;
      dyes: Dye[];
      embed: EmbedData;
    }
  | {
      ok: false;
      /**
       * NOT_ENOUGH_DYES: fewer than two dyes (or no list at all) — refused
       * before anything is drawn (BUG-125). GENERATION_FAILED: the card
       * generator threw.
       */
      error: 'NOT_ENOUGH_DYES' | 'GENERATION_FAILED';
      errorMessage: string;
    };

// ============================================================================
// Helpers
// ============================================================================

/**
 * The duel's seven readouts — one shared vocabulary, or the bot disagrees
 * with the app about what ΔE means. Labels are untranslated unit codes.
 * ΔEOK2 prints raw at three decimals (the band rules); the ratio is not a
 * colour distance and prints last — through /contrast's own printer
 * (floored, the language's separator), so one pair never reads 3.00:1 here
 * and 2.99:1 "under 3:1" on /contrast (BUG-142).
 *
 * Every figure goes through the card's own `num`, as the ΔE headline above
 * the strip does: the distances used to be bare `toFixed`, so a German card
 * read 27,2 in the headline, 27.2 under it, and 2,99:1 at the end of the
 * strip. The whole-number readouts carry no separator, but take the same
 * path so precision travels with the formatter.
 */
function buildReadouts(hexA: string, hexB: string, locale: LocaleCode): ComparisonReadout[] {
  const d = (m: Parameters<typeof ColorService.getDistanceForMethod>[2]): number =>
    ColorService.getDistanceForMethod(hexA, hexB, m);
  return [
    { short: 'ΔE2000', value: num(d('ciede2000'), locale, 1) },
    { short: 'ΔEOK2', value: num(d('oklab'), locale, 3) },
    { short: 'ΔE76', value: num(d('cie76'), locale, 1) },
    { short: 'REDMEAN', value: num(d('redmean'), locale, 0) },
    { short: 'RGB', value: num(d('rgb'), locale, 0) },
    { short: 'DIST%', value: `${num(d('distinguish'), locale, 0)}%` },
    { short: 'RATIO', value: `${formatContrastRatio(contrastRatio(hexA, hexB), 2, locale)}:1` },
  ];
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Generates the /compare card (14A/14C·2/14C by dye count) and a one-line
 * embed naming the closest pair.
 */
export async function executeComparison(input: ComparisonInput): Promise<ComparisonResult> {
  const { dyes, locale, theme } = input;
  const t = createTranslator(locale, input.logger);

  await initializeLocale(locale);

  // BUG-125: a comparison needs a pair. One dye used to reach the duel
  // renderer, whose `dyes[1].hex` read threw a TypeError that the catch below
  // reported as GENERATION_FAILED — a caller's mistake dressed as a render bug.
  // `Array.isArray` first: this runs outside the try, so a JavaScript caller's
  // non-array must be refused here, never thrown across the boundary.
  if (!Array.isArray(dyes) || dyes.length < 2) {
    return { ok: false, error: 'NOT_ENOUGH_DYES', errorMessage: t.t('mixer.bothRequired') };
  }

  try {
    const entries: ComparisonDyeEntry[] = dyes.map((dye) => {
      const name = getLocalizedDyeName(dye.itemID, dye.name, locale);
      const stainText = dye.stainID != null ? ` · ${t.t('card.stain')} ${dye.stainID}` : '';
      return {
        hex: dye.hex,
        name,
        abbr: abbreviateDyeName(name, locale),
        metaText: `${dye.hex.toUpperCase()}${stainText}`,
      };
    });

    const deltaE = (i: number, j: number): number =>
      ColorService.getDistanceForMethod(dyes[i].hex, dyes[j].hex, 'ciede2000');

    const svgString = generateComparisonCard({
      dyes: entries,
      deltaE,
      readouts: dyes.length === 2 ? buildReadouts(dyes[0].hex, dyes[1].hex, locale) : undefined,
      labels: {
        title: t.t('card.cmpTitle', { n: dyes.length }),
        tags: [t.t('card.cmpTag0'), t.t('card.cmpTag1'), t.t('card.cmpTag2'), t.t('card.cmpTag3')],
        cmpKey: t.t('card.cmpKey'),
        ratioKey: t.t('card.cmpRatioKey'),
        triKey: t.t('card.triKey'),
      },
      lang: locale,
      theme,
    });

    // One line: the closest pair
    let best: { i: number; j: number; de: number } | null = null;
    for (let i = 0; i < dyes.length; i++) {
      for (let j = i + 1; j < dyes.length; j++) {
        const de = deltaE(i, j);
        if (!best || de < best.de) best = { i, j, de };
      }
    }
    const embed: EmbedData = {
      title: t.t('card.cmpTitle', { n: dyes.length }),
      description: best
        ? `${entries[best.i].name} ↔ ${entries[best.j].name} · ${best.de.toFixed(1)}`
        : undefined,
      color: parseInt(dyes[0].hex.replace('#', ''), 16),
    };

    return { ok: true, svgString, dyes, embed };
  } catch (error) {
    input.logger?.warn(`[comparison] generation failed: ${failureKind(error)}`);
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: t.t('errors.generationFailed') };
  }
}
