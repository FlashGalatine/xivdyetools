/**
 * Contrast Command — Business Logic (13A/13B/13C·1 router)
 *
 * WCAG 1.4.11 non-text contrast between dye pairs. The pair count routes
 * the frame — 2 dyes → 13A (the worst pair gets the whole card), 3 → 13B
 * (the ledger), 4 → 13C·1 (the plot with the value column). Four is the
 * command's own limit, enforced at the schema — a picture that silently
 * drops the fifth dye is a truncated list with no tail.
 *
 * Polarity: green = far apart = safe. Bands are named by their ratio,
 * never a letter grade — AA/AAA leave the bot entirely.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/contrast
 */

import type { Dye } from '@xivdyetools/types';
import { abbreviateDyeName } from '@xivdyetools/core';
import { createTranslator, type LocaleCode, type TranslatorLogger } from '../i18n/index.js';
import { generateContrastCard, contrastRatio, formatContrastRatio, type ContrastPair } from '@xivdyetools/svg';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import { failureKind } from './failure-kind.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface ContrastDyeInput {
  dye?: Dye;
  hex: string;
  name: string;
  itemID?: number | null;
}

export interface ContrastInput {
  /**
   * Optional logger — surfaces Translator missing-key warnings, which are
   * otherwise silent (2026-08-20 i18n audit, F-13). Any `{ warn(msg) }`.
   */
  logger?: TranslatorLogger;
  /** 2–4 dyes (the schema caps at four; more pairs would sink the plot) */
  dyes: ContrastDyeInput[];
  locale: LocaleCode;
  theme?: 'dark' | 'light';
}

export type ContrastResult =
  | {
      ok: true;
      svgString: string;
      /** Every pair, worst (lowest ratio) first */
      pairs: Array<{ nameA: string; nameB: string; ratio: number }>;
      embed: EmbedData;
    }
  | {
      ok: false;
      /**
       * NOT_ENOUGH_DYES: fewer than two dyes (or no list at all) — refused
       * before anything is drawn. GENERATION_FAILED: the card generator threw.
       */
      error: 'NOT_ENOUGH_DYES' | 'GENERATION_FAILED';
      errorMessage: string;
    };

// ============================================================================
// Execute
// ============================================================================

/**
 * Generates the /contrast card and a one-line embed.
 */
export async function executeContrast(input: ContrastInput): Promise<ContrastResult> {
  const { dyes, locale, theme } = input;
  const t = createTranslator(locale, input.logger);

  await initializeLocale(locale);

  // A contrast needs a pair. Fewer dyes used to reach `pairs[0].nameA` below
  // and throw a TypeError that the catch reported as GENERATION_FAILED — a
  // caller's mistake dressed as a render bug. `Array.isArray` first: this runs
  // outside the try, so a non-array is refused, never thrown across the boundary.
  if (!Array.isArray(dyes) || dyes.length < 2) {
    return { ok: false, error: 'NOT_ENOUGH_DYES', errorMessage: t.t('mixer.bothRequired') };
  }

  try {
    const localized = dyes.map((d) =>
      d.itemID ? getLocalizedDyeName(d.itemID, d.name, locale) : d.name
    );

    // Every pair once, worst first — the router's subject
    const pairs: ContrastPair[] = [];
    for (let i = 0; i < dyes.length; i++) {
      for (let j = i + 1; j < dyes.length; j++) {
        pairs.push({
          hexA: dyes[i].hex,
          hexB: dyes[j].hex,
          nameA: localized[i],
          nameB: localized[j],
          abbrA: abbreviateDyeName(localized[i], locale),
          abbrB: abbreviateDyeName(localized[j], locale),
          ratio: contrastRatio(dyes[i].hex, dyes[j].hex),
        });
      }
    }
    pairs.sort((a, b) => a.ratio - b.ratio);

    const svgString = generateContrastCard({
      pairs,
      labels: {
        worstPair: t.t('card.worstPair'),
        pairCol: t.t('card.pairCol'),
        ratioCol: t.t('card.ratioCol'),
        ratioShort: t.t('card.ratioShort'),
        rest: t.t('card.restCol'),
        bands: [
          t.t('card.ratioBand0'),
          t.t('card.ratioBand1'),
          t.t('card.ratioBand2'),
          t.t('card.ratioBand3'),
        ],
        floorKey: t.t('card.floorKey'),
        plotKey: t.t('card.plotKey'),
        title: t.t('card.contrastTitle', { n: dyes.length }),
      },
      lang: locale,
      theme,
    });

    // One line: the worst pair and its ratio. The figure goes through the
    // card's own printer (floored, the language's separator) — the card sits
    // directly under this line, and a rounded 3.00:1 above a floored 2.99:1
    // "under 3:1" is two answers to one question (BUG-142).
    const worst = pairs[0];
    const embed: EmbedData = {
      title: t.t('card.contrastTitle', { n: dyes.length }),
      description: `${worst.nameA} ↔ ${worst.nameB} · ${formatContrastRatio(worst.ratio, 2, locale)}:1`,
      color: parseInt(dyes[0].hex.replace('#', ''), 16),
    };

    return {
      ok: true,
      svgString,
      pairs: pairs.map((p) => ({ nameA: p.nameA, nameB: p.nameB, ratio: p.ratio })),
      embed,
    };
  } catch (error) {
    input.logger?.warn(`[contrast] generation failed: ${failureKind(error)}`);
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: t.t('errors.generationFailed') };
  }
}
