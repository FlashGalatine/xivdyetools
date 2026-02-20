/**
 * Dye Info / Random Command — Business Logic
 *
 * executeDyeInfo: generates a visual info card SVG for a single dye.
 * executeRandom: selects random dyes and generates a grid SVG.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/dye-info
 */

import { type Dye } from '@xivdyetools/core';
import { createTranslator, type LocaleCode } from '@xivdyetools/bot-i18n';
import { generateDyeInfoCard, generateRandomDyesGrid, type RandomDyeInfo } from '@xivdyetools/svg';
import { dyeService } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName, getLocalizedCategory } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Dye Info
// ============================================================================

export interface DyeInfoInput {
  dye: Dye;
  locale: LocaleCode;
}

export type DyeInfoResult =
  | {
      ok: true;
      svgString: string;
      dye: Dye;
      localizedName: string;
      localizedCategory: string;
      embed: EmbedData;
    }
  | { ok: false; error: 'GENERATION_FAILED'; errorMessage: string };

/**
 * Generates a visual dye info card SVG and embed data for a single dye.
 */
export async function executeDyeInfo(input: DyeInfoInput): Promise<DyeInfoResult> {
  const { dye, locale } = input;
  const t = createTranslator(locale);

  await initializeLocale(locale);

  try {
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
    const localizedCategory = getLocalizedCategory(dye.category, locale);

    const svgString = generateDyeInfoCard({
      dye,
      localizedName,
      localizedCategory,
    });

    const embed: EmbedData = {
      title: localizedName,
      description: t.t('dye.info.detailedInfo', { category: localizedCategory }),
      color: parseInt(dye.hex.replace('#', ''), 16),
      footer: t.t('common.footer'),
    };

    return { ok: true, svgString, dye, localizedName, localizedCategory, embed };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to generate dye info card.' };
  }
}

// ============================================================================
// Random Dyes
// ============================================================================

export interface RandomInput {
  locale: LocaleCode;
  /** Number of dyes to select (default: 5) */
  count?: number;
  /** If true, pick one dye per category */
  uniqueCategories?: boolean;
}

export type RandomResult =
  | {
      ok: true;
      svgString: string;
      dyes: Dye[];
      dyeInfos: RandomDyeInfo[];
      title: string;
      embed: EmbedData;
    }
  | { ok: false; error: 'NO_DYES' | 'GENERATION_FAILED'; errorMessage: string };

/**
 * Selects random dyes and generates a visual grid SVG.
 */
export async function executeRandom(input: RandomInput): Promise<RandomResult> {
  const { locale, uniqueCategories = false } = input;
  const count = Math.min(input.count ?? 5, 5);
  const t = createTranslator(locale);

  await initializeLocale(locale);

  // Get all non-Facewear dyes
  const allDyes = dyeService.getAllDyes().filter((d) => d.category !== 'Facewear');

  if (allDyes.length === 0) {
    return { ok: false, error: 'NO_DYES', errorMessage: 'No dyes available.' };
  }

  let selectedDyes: Dye[];

  if (uniqueCategories) {
    const dyesByCategory = new Map<string, Dye[]>();
    for (const dye of allDyes) {
      const existing = dyesByCategory.get(dye.category) || [];
      existing.push(dye);
      dyesByCategory.set(dye.category, existing);
    }

    const categories = Array.from(dyesByCategory.keys());
    shuffleArray(categories);

    selectedDyes = [];
    for (const category of categories.slice(0, count)) {
      const categoryDyes = dyesByCategory.get(category)!;
      selectedDyes.push(categoryDyes[Math.floor(Math.random() * categoryDyes.length)]);
    }
  } else {
    const usedIndices = new Set<number>();
    selectedDyes = [];
    while (selectedDyes.length < Math.min(count, allDyes.length)) {
      const index = Math.floor(Math.random() * allDyes.length);
      if (!usedIndices.has(index)) {
        usedIndices.add(index);
        selectedDyes.push(allDyes[index]);
      }
    }
  }

  try {
    const dyeInfos: RandomDyeInfo[] = selectedDyes.map((dye) => ({
      dye,
      localizedName: getLocalizedDyeName(dye.itemID, dye.name, locale),
      localizedCategory: getLocalizedCategory(dye.category, locale),
    }));

    const title = uniqueCategories ? t.t('dye.random.titleUnique') : t.t('dye.random.title');

    const svgString = generateRandomDyesGrid({ dyes: dyeInfos, title, uniqueCategories });

    const dyeList = selectedDyes
      .map((dye, i) => {
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    const embed: EmbedData = {
      title,
      description: dyeList,
      color: parseInt(selectedDyes[0].hex.replace('#', ''), 16),
      footer: `${t.t('dye.search.useInfoHint')} • ${t.t('dye.random.runAgainHint')}`,
    };

    return { ok: true, svgString, dyes: selectedDyes, dyeInfos, title, embed };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to generate random dyes grid.' };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
