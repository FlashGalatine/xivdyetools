/**
 * Harmony Command — Business Logic
 *
 * Generates color harmony dye sets for a given base color.
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/harmony
 */

import { type Dye, type HarmonyOptions, type HarmonyColorSpace } from '@xivdyetools/core';
import { createTranslator, type Translator, type LocaleCode } from '@xivdyetools/bot-i18n';
import { generateHarmonyWheel, type HarmonyDye } from '@xivdyetools/svg';
import { dyeService } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

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
  const { baseHex, baseName, baseId: _baseId, baseItemID, harmonyType, locale, harmonyOptions } = input;
  const t = createTranslator(locale);

  await initializeLocale(locale);

  try {
    const harmonyDyes = getHarmonyDyes(baseHex, harmonyType, harmonyOptions);

    if (harmonyDyes.length === 0) {
      return { ok: false, error: 'NO_MATCHES', errorMessage: 'No harmony dyes found.' };
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
      baseName: baseName || baseHex.toUpperCase(),
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
