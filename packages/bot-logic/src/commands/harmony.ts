/**
 * Harmony Command — Business Logic
 *
 * Generates color harmony dye sets for a given base color.
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/harmony
 */

import type { Dye, DyeTypeFilters } from '@xivdyetools/types';
import {
  type HarmonyOptions,
  type HarmonyColorSpace,
  type MatchingMethod,
} from '@xivdyetools/core';
import { filterDyes } from '@xivdyetools/core';
import { createTranslator, type Translator, type LocaleCode } from '@xivdyetools/bot-i18n';
import { generateHarmonyWheel, type HarmonyDye } from '@xivdyetools/svg';
import { dyeService } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

/** @internal Reference constant — not required by external consumers. */
export const HARMONY_TYPES = [
  'triadic',
  'complementary',
  'analogous',
  'split-complementary',
  'tetradic',
  'square',
  'monochromatic',
] as const;

export type HarmonyType = (typeof HARMONY_TYPES)[number];

export interface HarmonyInput {
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
  /** Algorithm used to find closest dye for companion expansion (default: 'oklab'). */
  matchingMethod?: MatchingMethod;
  /** When true, applies a tighter distance threshold via deltaE matching (default: false). */
  strictMatching?: boolean;
  /** When true, deduplicates dyes by id across all output slots (default: false). */
  preventDuplicates?: boolean;
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

function getHarmonyDyes(hex: string, type: HarmonyType, options?: HarmonyOptions): Dye[] {
  switch (type) {
    case 'triadic':
      return dyeService.findTriadicDyes(hex, options);
    case 'complementary': {
      const comp = dyeService.findComplementaryPair(hex, options);
      return comp ? [comp] : [];
    }
    case 'analogous':
      return dyeService.findAnalogousDyes(hex, 30, options);
    case 'split-complementary':
      return dyeService.findSplitComplementaryDyes(hex, options);
    case 'tetradic':
      return dyeService.findTetradicDyes(hex, options);
    case 'square':
      return dyeService.findSquareDyes(hex, options);
    case 'monochromatic':
      return dyeService.findMonochromaticDyes(hex, 5, options);
    default:
      return dyeService.findTriadicDyes(hex, options);
  }
}

function getLocalizedHarmonyType(type: string, t: Translator): string {
  const keyMap: Record<string, string> = {
    complementary: 'harmony.complementary',
    analogous: 'harmony.analogous',
    triadic: 'harmony.triadic',
    'split-complementary': 'harmony.splitComplementary',
    tetradic: 'harmony.tetradic',
    square: 'harmony.square',
    monochromatic: 'harmony.monochromatic',
  };
  const key = keyMap[type];
  if (key) return t.t(key);
  // Fallback: capitalize first letter
  const formats: Record<string, string> = {
    complementary: 'Complementary', analogous: 'Analogous', triadic: 'Triadic',
    'split-complementary': 'Split-Complementary', tetradic: 'Tetradic',
    square: 'Square', monochromatic: 'Monochromatic',
  };
  return formats[type] || type.charAt(0).toUpperCase() + type.slice(1);
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
    matchingMethod = 'oklab',
    strictMatching = false,
    preventDuplicates = false,
  } = input;
  const t = createTranslator(locale);

  await initializeLocale(locale);

  try {
    // Apply strict-matching by tightening deltaE tolerance via harmonyOptions
    const effectiveHarmonyOptions: HarmonyOptions | undefined = strictMatching
      ? {
          ...(harmonyOptions ?? {}),
          algorithm: 'deltaE',
          deltaEFormula: harmonyOptions?.deltaEFormula ?? 'cie2000',
          deltaETolerance: harmonyOptions?.deltaETolerance ?? 15,
        }
      : harmonyOptions;

    const baseHarmonyDyes = dyeFilters
      ? filterDyes(dyeFilters, getHarmonyDyes(baseHex, harmonyType, effectiveHarmonyOptions))
      : getHarmonyDyes(baseHex, harmonyType, effectiveHarmonyOptions);

    if (baseHarmonyDyes.length === 0) {
      return { ok: false, error: 'NO_MATCHES', errorMessage: 'No harmony dyes found.' };
    }

    // Companion expansion: for each base harmony dye, find N-1 additional close matches
    const harmonyDyes: Dye[] = [];
    const seenIds = new Set<number>();
    if (baseId !== undefined) seenIds.add(baseId);
    const clampedCompanionCount = Math.max(1, Math.min(3, Math.floor(companionCount)));

    for (const baseDye of baseHarmonyDyes) {
      const slotDyes: Dye[] = [];
      const excludeIds: number[] = preventDuplicates ? Array.from(seenIds) : [];
      // Always include the base harmony dye first
      slotDyes.push(baseDye);
      if (preventDuplicates) seenIds.add(baseDye.id);
      excludeIds.push(baseDye.id);
      // Find (companionCount - 1) additional close matches around this base hue
      for (let i = 1; i < clampedCompanionCount; i++) {
        const candidate = dyeService.findClosestDye(baseDye.hex, {
          excludeIds: [...excludeIds],
          matchingMethod,
        });
        if (!candidate) break;
        if (candidate.category === 'Facewear') break;
        if (dyeFilters && filterDyes(dyeFilters, [candidate]).length === 0) {
          excludeIds.push(candidate.id);
          i--;
          continue;
        }
        slotDyes.push(candidate);
        excludeIds.push(candidate.id);
        if (preventDuplicates) seenIds.add(candidate.id);
      }
      harmonyDyes.push(...slotDyes);
    }


    // Convert to HarmonyDye[] with localized names for the SVG
    const dyesForWheel: HarmonyDye[] = harmonyDyes.map((dye) => ({
      id: dye.id,
      name: getLocalizedDyeName(dye.itemID, dye.name, locale),
      hex: dye.hex,
      category: dye.category,
    }));

    const svgString = generateHarmonyWheel({
      baseColor: baseHex,
      harmonyType,
      dyes: dyesForWheel,
      width: 600,
      height: 600,
    });

    // Build embed description text (no platform-specific emoji)
    const dyeList = harmonyDyes
      .map((dye, i) => {
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    // Localize base name if it's a dye
    const localizedBaseName = baseItemID && baseName
      ? getLocalizedDyeName(baseItemID, baseName, locale)
      : (baseName || baseHex.toUpperCase());
    const baseColorText = `${t.t('harmony.baseColor')}: **${localizedBaseName}** (\`${baseHex.toUpperCase()}\`)`;

    const harmonyTitle = getLocalizedHarmonyType(harmonyType, t);

    const embed: EmbedData = {
      title: t.t('harmony.title', { type: harmonyTitle }),
      description: `${baseColorText}\n\n${dyeList}`,
      color: parseInt(baseHex.replace('#', ''), 16),
      footer: t.t('common.footer'),
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
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to generate harmony wheel.' };
  }
}

/**
 * Returns autocomplete choices for harmony types (English labels, for Discord autocomplete).
 */
export function getHarmonyTypeChoices(): Array<{ name: string; value: string }> {
  const formats: Record<string, string> = {
    complementary: 'Complementary', analogous: 'Analogous', triadic: 'Triadic',
    'split-complementary': 'Split-Complementary', tetradic: 'Tetradic',
    square: 'Square', monochromatic: 'Monochromatic',
  };
  return HARMONY_TYPES.map((type) => ({ name: formats[type] || type, value: type }));
}

export type { HarmonyColorSpace };
