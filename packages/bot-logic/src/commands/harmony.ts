/**
 * Harmony Command — Business Logic
 *
 * Generates color harmony dye sets for a given base color.
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/harmony
 */

import type { Dye, DyeTypeFilters } from '@xivdyetools/types';
import type { HarmonyOptions, HarmonySlot, MatchingMethod } from '@xivdyetools/core';
import {
  filterDyes,
  ColorService,
  DEFAULT_MATCHING_METHOD,
  generateHarmonySlots,
} from '@xivdyetools/core';
import { createTranslator, type Translator, type LocaleCode, type TranslatorLogger } from '../i18n/index.js';
import { generateHarmonyCard, num, type HarmonyCardSlot } from '@xivdyetools/svg';
import { dyeService } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

/** @internal Reference constant — not required by external consumers. */
/**
 * The harmony types the bot serves.
 *
 * These are exactly the rows of `HARMONY_OFFSETS`, which is what makes them
 * the same ten the web app offers. Before 2026-09-03 this list held eight,
 * because each one needed a bespoke `DyeService.find*Dyes()` method and no
 * method existed for `compound` or `shades`; selection now reads the table, so
 * a harmony type is a row rather than a function.
 */
export const HARMONY_TYPES = [
  'triadic',
  'complementary',
  'analogous',
  'split-complementary',
  'tetradic',
  'inverted-tetradic',
  'square',
  'monochromatic',
  'compound',
  'shades',
] as const;

export type HarmonyType = (typeof HARMONY_TYPES)[number];

export interface HarmonyInput {
  /**
   * Optional logger — surfaces Translator missing-key warnings, which are
   * otherwise silent (2026-08-20 i18n audit, F-13). Any `{ warn(msg) }`.
   */
  logger?: TranslatorLogger;
  /** Base color as normalized hex (#RRGGBB) */
  baseHex: string;
  /** Dye name for the base color, if known */
  baseName?: string;
  /** Internal dye ID for the base color, if known */
  baseId?: number;
  /** FFXIV item ID for the base color, if known (for localization) */
  baseItemID?: number;
  harmonyType: HarmonyType;
  locale: LocaleCode;
  harmonyOptions?: HarmonyOptions;
  /** Optional dye type filters (e.g., exclude metallic, pastel, etc.) */
  dyeFilters?: DyeTypeFilters;
  /** Companion dyes per harmony slot (1-3, default 1). Each base hue is expanded to N closest matches. */
  companionCount?: number;
  /** Matching method for ideal → dye distances and companion expansion (default: `DEFAULT_MATCHING_METHOD`, ΔE2000 — the suite default). */
  matchingMethod?: MatchingMethod;
  /** When true, applies a tighter distance threshold via deltaE matching (default: false). */
  strictMatching?: boolean;
  /** When true, deduplicates dyes by id across all output slots (default: false). */
  preventDuplicates?: boolean;
  /** Card theme (stored user preference; defaults dark) */
  theme?: 'dark' | 'light';
}

export type HarmonyResult =
  | {
      ok: true;
      svgString: string;
      baseHex: string;
      baseName: string;
      harmonyDyes: Dye[];
      embed: EmbedData;
    }
  | { ok: false; error: 'NO_MATCHES' | 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Helpers
// ============================================================================



function getLocalizedHarmonyType(type: string, t: Translator): string {
  const keyMap: Record<string, string> = {
    complementary: 'harmony.complementary',
    analogous: 'harmony.analogous',
    triadic: 'harmony.triadic',
    'split-complementary': 'harmony.splitComplementary',
    tetradic: 'harmony.tetradic',
    'inverted-tetradic': 'harmony.invertedTetradic',
    square: 'harmony.square',
    monochromatic: 'harmony.monochromatic',
    compound: 'harmony.compound',
    shades: 'harmony.shades',
  };
  const key = keyMap[type];
  if (key) return t.t(key);
  // pkg-svg-bot-logic-08: an English `formats` table used to sit here as a
  // "fallback", duplicating all eight names. It could never run — `keyMap`
  // covers every HarmonyType, so the return above always fires, and even on a
  // missing locale key `Translator.t()` returns the raw key rather than
  // undefined. The reverse-key gate is what actually guards the locale files.
  // Only a genuinely unknown type reaches here, and capitalising it is the
  // honest answer for one.
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Generates a harmony wheel SVG and embed data for the given color.
 */
export async function executeHarmony(input: HarmonyInput): Promise<HarmonyResult> {
  const {
    baseHex,
    baseName,
    baseId,
    baseItemID,
    harmonyType,
    locale,
    harmonyOptions,
    dyeFilters,
    companionCount = 1,
    matchingMethod = DEFAULT_MATCHING_METHOD,
    strictMatching = false,
    preventDuplicates = false,
  } = input;
  const t = createTranslator(locale, input.logger);

  await initializeLocale(locale);

  try {
    // REFACTOR (2026-09-03): selection runs through core's shared
    // `generateHarmonySlots`, the web app's algorithm, so `/harmony` and the
    // Harmony Explorer now answer the same question the same way.
    //
    // They did not before. The bot called a named `DyeService.find*Dyes()` per
    // type, which rotates hue WITHOUT preserving the base's saturation and
    // value — and `findComplementaryPair` did not rotate at all, it inverted
    // the RGB. Measured over all 125 dyes, the two surfaces disagreed on the
    // returned dyes for 89-100% of bases on every harmony type: `/harmony
    // analogous` on Snow White answered Neon Green and Kobold Brown where the
    // page shows Pure White and Pearl White.
    //
    // Filters are applied to the CANDIDATE POOL rather than to the result, so
    // "the nearest allowed dye to the ideal" is the answer, instead of "the
    // nearest allowed dye to one that was thrown away".
    const candidatePool = dyeFilters
      ? filterDyes(dyeFilters, dyeService.getAllDyes())
      : dyeService.getAllDyes();

    const clampedCompanionCount = Math.max(1, Math.min(3, Math.floor(companionCount)));

    // Annotated because two differently-shaped "slot" types meet in this
    // function: core's HarmonySlot (an ideal hue and the dye nearest it) and
    // svg's HarmonyCardSlot (one printed row). The conversion between them is
    // below; naming both makes which is which readable at a glance.
    const harmonySlots: HarmonySlot[] = generateHarmonySlots(
      baseHex,
      harmonyType,
      candidatePool,
      {
        // `strictMatching` is the bot's spelling of the page's perceptual
        // ranking; both default it on for the shared algorithm, because the
        // S/V-preserving target is the algorithm.
        usePerceptualMatching: true,
        matchingMethod,
        companionCount: clampedCompanionCount - 1,
        preventDuplicates,
      },
      { excludeItemIDs: baseItemID != null ? [baseItemID] : [] },
    );

    // The strict-matching toggle no longer tightens a deltaE tolerance on the
    // finders (there are no finders); it is folded into the ranking above.
    void strictMatching;
    void harmonyOptions;

    const harmonyDyes: Dye[] = harmonySlots.flatMap((slot) =>
      slot.dye ? [slot.dye, ...slot.companions] : [],
    );

    if (harmonyDyes.length === 0) {
      return { ok: false, error: 'NO_MATCHES', errorMessage: t.t('errors.noMatchFound') };
    }

    // 11A: the ideal hue the maths asked for, beside the dye that exists. Each
    // slot already carries its own ideal and the distance to it, so the card
    // no longer has to re-derive "which ideal is this dye nearest to" — that
    // pass is what used to let a spurious offset mislabel a row.
    //
    // The distance runs in the CHOSEN method, not always ΔE2000: a tier is a
    // property of the method, so the card prints which one produced it. Two
    // players with different stored preferences get different dyes back, and
    // without the tag one of the two PNGs looks wrong.
    const stainLabel = t.t('card.stain');
    const slots: HarmonyCardSlot[] = harmonySlots.flatMap((slot) => {
      if (!slot.dye) return [];
      const angleLabel = `${slot.offset}°`;

      const row = (dye: Dye, deltaE: number | null): HarmonyCardSlot => {
        const stainText = dye.stainID != null ? ` · ${stainLabel} ${dye.stainID}` : '';
        return {
          idealHex: slot.targetHex,
          hex: dye.hex,
          localizedName: getLocalizedDyeName(dye.itemID, dye.name, locale),
          subText: `${dye.hex.toUpperCase()}${stainText}`,
          deltaE,
          angleLabel,
        };
      };

      return [
        row(slot.dye, slot.deviance),
        // A companion is measured against the SAME ideal as the slot it sits
        // in, so the numbers down a column are comparable.
        ...slot.companions.map((dye) =>
          row(dye, ColorService.getDistanceForMethod(slot.targetHex, dye.hex, matchingMethod)),
        ),
      ];
    });

    // The verdict names the weakest slot only — a glyph and three values,
    // because "weakest slot" as a label overran the row in German. The card
    // draws the ↓; every word here is already localized.
    const weakest = slots.reduce<HarmonyCardSlot | null>(
      (worst, s) =>
        s.deltaE != null && (worst?.deltaE == null || s.deltaE > worst.deltaE) ? s : worst,
      null,
    );
    const verdict =
      weakest && weakest.deltaE != null
        ? [weakest.angleLabel, weakest.localizedName, num(weakest.deltaE, locale, 1)]
            .filter(Boolean)
            .join(' · ')
        : null;

    // Localize base name if it's a dye
    const localizedBaseName =
      baseItemID && baseName
        ? getLocalizedDyeName(baseItemID, baseName, locale)
        : baseName || baseHex.toUpperCase();
    const harmonyTitle = getLocalizedHarmonyType(harmonyType, t);

    const baseDye = baseId !== undefined ? dyeService.getDyeById(baseId) : null;

    const svgString = generateHarmonyCard({
      typeLabel: harmonyTitle,
      baseHex,
      baseName: localizedBaseName,
      // Turn 13 dropped the base hex line — the swatch pair already implies
      // it, and that line is what pays for the verdict block.
      baseAngle: '0°',
      slots,
      labels: {
        base: t.t('card.base'),
        ideal: t.t('card.ideal'),
        found: t.t('card.found'),
        bandKey: t.t('card.bandKey'),
        derivedNote: t.t('card.derivedNote'),
      },
      tierWords: [t.t('card.tier0'), t.t('card.tier1'), t.t('card.tier2'), t.t('card.tier3')],
      verdict,
      method: matchingMethod,
      lang: locale,
      theme: input.theme,
    });

    // One line: the card names every slot; the embed carries the share URL
    const shareUrl =
      baseDye?.stainID != null
        ? `https://xivdyetools.app/harmony?dye=${baseDye.stainID}&harmony=${harmonyType}`
        : 'https://xivdyetools.app/harmony';
    const embed: EmbedData = {
      title: t.t('harmony.title', { type: harmonyTitle }),
      description: shareUrl,
      color: parseInt(baseHex.replace('#', ''), 16),
    };

    return {
      ok: true,
      svgString,
      baseHex,
      baseName: localizedBaseName,
      harmonyDyes,
      embed,
    };
  } catch {
    return {
      ok: false,
      error: 'GENERATION_FAILED',
      errorMessage: t.t('errors.generationFailed'),
    };
  }
}

/**
 * Returns autocomplete choices for harmony types (English labels, for Discord autocomplete).
 */
export function getHarmonyTypeChoices(): Array<{ name: string; value: string }> {
  const formats: Record<string, string> = {
    complementary: 'Complementary',
    analogous: 'Analogous',
    triadic: 'Triadic',
    'split-complementary': 'Split-Complementary',
    tetradic: 'Tetradic',
    'inverted-tetradic': 'Inverted Tetradic',
    square: 'Square',
    monochromatic: 'Monochromatic',
    compound: 'Compound',
    shades: 'Shades',
  };
  // Own-property lookup: a type named `toString` would otherwise take a
  // Function down the `||` and produce a choice Discord cannot render.
  return HARMONY_TYPES.map((type) => ({
    name: Object.hasOwn(formats, type) ? formats[type] : type,
    value: type,
  }));
}
