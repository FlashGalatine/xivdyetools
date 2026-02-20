/**
 * Comparison Command — Business Logic
 *
 * Generates a side-by-side dye comparison grid SVG for 2-4 dyes.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/comparison
 */

import { type Dye } from '@xivdyetools/core';
import { createTranslator, type LocaleCode } from '@xivdyetools/bot-i18n';
import { generateComparisonGrid } from '@xivdyetools/svg';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface ComparisonInput {
  /** 2-4 already-resolved Dye objects */
  dyes: Dye[];
  locale: LocaleCode;
}

export type ComparisonResult =
  | {
      ok: true;
      svgString: string;
      dyes: Dye[];
      embed: EmbedData;
    }
  | { ok: false; error: 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Execute
// ============================================================================

/**
 * Generates a comparison grid SVG and embed data for 2-4 dyes.
 *
 * The adapter is responsible for resolving dye inputs (via resolveColorInput)
 * before calling this function.
 */
export async function executeComparison(input: ComparisonInput): Promise<ComparisonResult> {
  const { dyes, locale } = input;
  const t = createTranslator(locale);

  await initializeLocale(locale);

  try {
    // Build dyes with localized names for the SVG
    const dyesWithLocalizedNames = dyes.map((dye) => ({
      ...dye,
      name: getLocalizedDyeName(dye.itemID, dye.name, locale),
    }));

    const svgString = generateComparisonGrid({
      dyes: dyesWithLocalizedNames,
      width: 800,
      showHsv: true,
    });

    // Build description with localized names
    const dyeList = dyes
      .map((dye, i) => {
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    const embed: EmbedData = {
      title: `${t.t('comparison.title')} (${dyes.length})`,
      description: dyeList,
      color: parseInt(dyes[0].hex.replace('#', ''), 16),
      footer: t.t('common.footer'),
    };

    return { ok: true, svgString, dyes, embed };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to generate comparison grid.' };
  }
}
