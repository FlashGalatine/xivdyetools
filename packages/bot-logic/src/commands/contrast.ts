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
import { createTranslator, type LocaleCode } from '../i18n/index.js';
import { generateContrastCard, contrastRatio, type ContrastPair } from '@xivdyetools/svg';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
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
  | { ok: false; error: 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Execute
// ============================================================================

/**
 * Generates the /contrast card and a one-line embed.
 */
export async function executeContrast(input: ContrastInput): Promise<ContrastResult> {
  const { dyes, locale, theme } = input;
  const t = createTranslator(locale);

  await initializeLocale(locale);

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

    // One line: the worst pair and its ratio
    const worst = pairs[0];
    const embed: EmbedData = {
      title: t.t('card.contrastTitle', { n: dyes.length }),
      description: `${worst.nameA} ↔ ${worst.nameB} · ${worst.ratio.toFixed(2)}:1`,
      color: parseInt(dyes[0].hex.replace('#', ''), 16),
    };

    return {
      ok: true,
      svgString,
      pairs: pairs.map((p) => ({ nameA: p.nameA, nameB: p.nameB, ratio: p.ratio })),
      embed,
    };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to generate contrast card.' };
  }
}
