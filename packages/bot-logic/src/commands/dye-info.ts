/**
 * Dye Info / Random Command — Business Logic
 *
 * executeDyeInfo: the 11B dye sheet (name band, numeric grid, SRC/MKT,
 * nearest-dyes strip). executeRandom: the 11B table (five rows + header is
 * exactly what 350 px buys).
 *
 * The PNG is self-contained, so the embed is one line — never a second copy
 * of the picture.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/dye-info
 */

import type { Dye } from '@xivdyetools/types';
import { ColorService, CONSOLIDATED_DYES } from '@xivdyetools/core';
import { createTranslator, type LocaleCode, type TranslatorLogger } from '../i18n/index.js';
import {
  generateDyeInfoCard,
  generateRandomDyesGrid,
  grp,
  ROW_CAP,
  type NearestDyeInfo,
  type RandomDyeRow,
} from '@xivdyetools/svg';
import { dyeService } from '../input-resolution.js';
import {
  initializeLocale,
  getLocalizedDyeName,
  getLocalizedCategory,
  getLocalizedAcquisition,
  getLocalizedCurrency,
} from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Dye Info
// ============================================================================

export interface DyeInfoInput {
  /**
   * Optional logger — surfaces Translator missing-key warnings, which are
   * otherwise silent (2026-08-20 i18n audit, F-13). Any `{ warn(msg) }`.
   */
  logger?: TranslatorLogger;
  dye: Dye;
  locale: LocaleCode;
  /** Card theme (stored user preference; defaults dark) */
  theme?: 'dark' | 'light';
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

/** Nearest-strip sizing: three columns drawn. */
const NEAREST_DRAWN = 3;

/**
 * The "+n more" line counts undrawn dyes this close and no further.
 *
 * 10 is the match ramp's CLOSE cut (`classifyBandTier(…, 'match')` runs
 * 5/10/20), so the label means "n further dyes are still a close match" —
 * which is the question a player is actually asking when they read it.
 *
 * Measured against the real 125-dye set: the EXACT cut (5) admits nothing at
 * all — the tightest fourth-nearest neighbour in the whole database is Ink Blue
 * / Jet Black at ΔE 5.41 — so it would have replaced one constant with another.
 * At 10, forty dyes carry the line with n between 1 and 6 and eighty-five omit
 * it. At the LOOSE cut (20) it fires for 122 of 125 with n up to 33, which is
 * noise rather than information.
 */
const NEAREST_MORE_MAX_DELTA_E = 10;

/**
 * The MKT row value. Consolidated dyes name the market item players actually
 * search for — in the user's locale, since the market board lists the
 * localized item name (F-10, 2026-08-20 audit: this was pinned to `names.en`;
 * `CONSOLIDATED_DYES[].names` has carried all six languages since 7.5) —
 * plus its item ID. Unconsolidated tradeable dyes print their own item ID.
 */
function marketValue(dye: Dye, locale: LocaleCode): string {
  const type = dye.consolidationType;
  if (type) {
    const consolidated = CONSOLIDATED_DYES[type];
    return `${consolidated.names[locale] ?? consolidated.names.en} · ${consolidated.itemID}`;
  }
  return dye.itemID > 0 ? String(dye.itemID) : '—';
}

/**
 * Generates the 11B dye info sheet and a one-line embed.
 */
export async function executeDyeInfo(input: DyeInfoInput): Promise<DyeInfoResult> {
  const { dye, locale, theme } = input;
  const t = createTranslator(locale, input.logger);

  await initializeLocale(locale);

  try {
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
    const localizedCategory = getLocalizedCategory(dye.category, locale);

    // SRC carries the vendor price (the 350 cap cost the COST row)
    const acquisition = getLocalizedAcquisition(dye.acquisition, locale);
    const srcValue =
      dye.cost != null && dye.currency
        ? `${acquisition} · ${grp(dye.cost, locale)} ${getLocalizedCurrency(dye.currency, locale)}`
        : acquisition;

    // Nearest dyes: ΔE2000 over the non-Facewear pool, excluding self
    const ranked = dyeService
      .getAllDyes()
      .filter((d) => d.category !== 'Facewear' && d.id !== dye.id)
      .map((d) => ({
        dye: d,
        deltaE: ColorService.getDistanceForMethod(dye.hex, d.hex, 'ciede2000'),
      }))
      .sort((a, b) => a.deltaE - b.deltaE);
    const nearest: NearestDyeInfo[] = ranked.slice(0, NEAREST_DRAWN).map((n) => ({
      hex: n.dye.hex,
      name: getLocalizedDyeName(n.dye.itemID, n.dye.name, locale),
      deltaE: n.deltaE,
    }));

    // pkg-svg-bot-logic-09: this counted the pool minus the drawn columns —
    // a four-entry pool and three columns, so it was the constant 1 on every
    // card ever rendered, and the `: ''` arm below was unreachable. A player
    // reads "+1 more" as "one further dye is near this one" when 121 others
    // were ranked and the fourth simply was not drawn.
    //
    // Count what the sentence claims instead: further dyes still inside the
    // CLOSE band, beyond the three already drawn. Eighty-five of the 125 have
    // none, so the empty arm below is now the common case rather than dead
    // code, and the number varies with the dye rather than being 1 forever.
    const omitted = ranked
      .slice(NEAREST_DRAWN)
      .filter((n) => n.deltaE <= NEAREST_MORE_MAX_DELTA_E).length;

    const svgString = generateDyeInfoCard({
      dye,
      localizedName,
      localizedCategory,
      stainID: dye.stainID,
      srcValue,
      mktValue: marketValue(dye, locale),
      nearest,
      labels: {
        stain: t.t('card.stain'),
        src: t.t('card.src'),
        mkt: t.t('card.mkt'),
        nearest: t.t('card.nearest'),
        nearestMore: omitted > 0 ? t.t('card.nearestMore', { n: omitted }) : '',
      },
      lang: locale,
      theme,
    });

    // One line: the picture is self-contained
    const shareUrl =
      dye.stainID != null
        ? `https://xivdyetools.app/comparison?dyes=${dye.stainID}`
        : 'https://xivdyetools.app';
    const embed: EmbedData = {
      title: localizedName,
      description: shareUrl,
      color: parseInt(dye.hex.replace('#', ''), 16),
    };

    return { ok: true, svgString, dye, localizedName, localizedCategory, embed };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: t.t('errors.generationFailed') };
  }
}

// ============================================================================
// Random Dyes
// ============================================================================

export interface RandomInput {
  /**
   * Optional logger — surfaces Translator missing-key warnings, which are
   * otherwise silent (2026-08-20 i18n audit, F-13). Any `{ warn(msg) }`.
   */
  logger?: TranslatorLogger;
  locale: LocaleCode;
  /** Number of dyes to select (default and cap: 5 — R1) */
  count?: number;
  /** If true, pick one dye per category */
  uniqueCategories?: boolean;
  /** Card theme (stored user preference; defaults dark) */
  theme?: 'dark' | 'light';
}

export type RandomResult =
  | {
      ok: true;
      svgString: string;
      dyes: Dye[];
      title: string;
      embed: EmbedData;
    }
  | { ok: false; error: 'NO_DYES' | 'GENERATION_FAILED'; errorMessage: string };

/**
 * Selects random dyes and generates the 11B table.
 */
export async function executeRandom(input: RandomInput): Promise<RandomResult> {
  const { locale, uniqueCategories = false, theme } = input;
  // R1 Cap: five rows is the ceiling for every list graphic
  const count = Math.max(1, Math.min(input.count ?? ROW_CAP, ROW_CAP));
  const t = createTranslator(locale, input.logger);

  await initializeLocale(locale);

  // Get all non-Facewear dyes
  const allDyes = dyeService.getAllDyes().filter((d) => d.category !== 'Facewear');

  if (allDyes.length === 0) {
    return { ok: false, error: 'NO_DYES', errorMessage: t.t('errors.noDyesAvailable') };
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
    const rows: RandomDyeRow[] = selectedDyes.map((dye) => ({
      hex: dye.hex,
      localizedName: getLocalizedDyeName(dye.itemID, dye.name, locale),
      localizedCategory: getLocalizedCategory(dye.category, locale),
      stainID: dye.stainID,
    }));

    const title = uniqueCategories ? t.t('dye.random.titleUnique') : t.t('dye.random.title');

    const svgString = generateRandomDyesGrid({
      dyes: rows,
      title,
      labels: {
        name: t.t('card.name'),
        cat: t.t('card.cat'),
        stain: t.t('card.stain'),
      },
      theme,
    });

    // One line: the table already names every dye
    const embed: EmbedData = {
      title,
      color: parseInt(selectedDyes[0].hex.replace('#', ''), 16),
      footer: t.t('dye.search.useInfoHint'),
    };

    return { ok: true, svgString, dyes: selectedDyes, title, embed };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: t.t('errors.generationFailed') };
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
