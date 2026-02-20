/**
 * Accessibility Command — Business Logic
 *
 * Single dye: colorblind simulation (protanopia, deuteranopia, tritanopia).
 * Multiple dyes (2-4): WCAG contrast matrix.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/accessibility
 */

import { type Dye } from '@xivdyetools/core';
import { createTranslator, type LocaleCode } from '@xivdyetools/bot-i18n';
import {
  generateAccessibilityComparison,
  generateContrastMatrix,
  type VisionType,
  type ContrastDye,
} from '@xivdyetools/svg';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export const VISION_TYPES: VisionType[] = ['protanopia', 'deuteranopia', 'tritanopia'];

export interface AccessibilityDye {
  dye?: Dye;
  hex: string;
  name: string;
  /** FFXIV item ID for localization (optional — hex inputs won't have this) */
  itemID?: number | null;
}

export interface AccessibilityInput {
  /** 1 dye → simulation mode; 2-4 dyes → contrast matrix mode */
  dyes: AccessibilityDye[];
  visionTypes?: VisionType[];
  locale: LocaleCode;
}

export type AccessibilityResult =
  | {
      ok: true;
      svgString: string;
      mode: 'simulation' | 'contrast';
      embed: EmbedData;
    }
  | { ok: false; error: 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Execute
// ============================================================================

/**
 * Generates an accessibility SVG (colorblind simulation or contrast matrix)
 * and embed data.
 *
 * The adapter resolves dye inputs and constructs AccessibilityDye objects
 * before calling this function.
 */
export async function executeAccessibility(input: AccessibilityInput): Promise<AccessibilityResult> {
  const { dyes, locale } = input;
  const visionTypes = input.visionTypes ?? VISION_TYPES;
  const t = createTranslator(locale);

  await initializeLocale(locale);

  try {
    if (dyes.length === 1) {
      return await processSingleDye(dyes[0], visionTypes, locale, t);
    } else {
      return await processMultiDye(dyes, locale, t);
    }
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to generate accessibility image.' };
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

async function processSingleDye(
  dyeInput: AccessibilityDye,
  visionTypes: VisionType[],
  locale: LocaleCode,
  t: ReturnType<typeof createTranslator>
): Promise<AccessibilityResult> {
  const localizedName = dyeInput.itemID
    ? getLocalizedDyeName(dyeInput.itemID, dyeInput.name, locale)
    : dyeInput.name;

  const svgString = generateAccessibilityComparison({
    dyeHex: dyeInput.hex,
    dyeName: localizedName,
    visionTypes,
  });

  const description =
    `**${localizedName}** (\`${dyeInput.hex.toUpperCase()}\`)\n\n` +
    `${t.t('accessibility.description')}\n\n` +
    `• **${t.t('accessibility.protanopia')}** - ${t.t('accessibility.protanopiaDesc')}\n` +
    `• **${t.t('accessibility.deuteranopia')}** - ${t.t('accessibility.deuteranopiaDesc')}\n` +
    `• **${t.t('accessibility.tritanopia')}** - ${t.t('accessibility.tritanopiaDesc')}`;

  const embed: EmbedData = {
    title: t.t('accessibility.title'),
    description,
    color: parseInt(dyeInput.hex.replace('#', ''), 16),
    footer: `${t.t('common.footer')} • ${t.t('accessibility.simulationMethod')}`,
  };

  return { ok: true, svgString, mode: 'simulation', embed };
}

async function processMultiDye(
  dyeInputs: AccessibilityDye[],
  locale: LocaleCode,
  t: ReturnType<typeof createTranslator>
): Promise<AccessibilityResult> {
  const contrastDyes: ContrastDye[] = dyeInputs.map((d) => ({
    name: d.itemID ? getLocalizedDyeName(d.itemID, d.name, locale) : d.name,
    hex: d.hex,
  }));

  const svgString = generateContrastMatrix({
    dyes: contrastDyes,
    title: t.t('accessibility.contrastTitle'),
  });

  const dyeList = dyeInputs
    .map((d) => {
      const localizedName = d.itemID ? getLocalizedDyeName(d.itemID, d.name, locale) : d.name;
      return `**${localizedName}** (\`${d.hex.toUpperCase()}\`)`;
    })
    .join('\n');

  const description =
    `${t.t('accessibility.comparing', { count: dyeInputs.length })}:\n${dyeList}\n\n` +
    `${t.t('accessibility.matrixDescription')}\n\n` +
    `🟢 **AAA** (7:1+) - ${t.t('accessibility.wcagAAADesc')}\n` +
    `🟡 **AA** (4.5:1+) - ${t.t('accessibility.wcagAADesc')}\n` +
    `🔴 **${t.t('comparison.fails')}** (<4.5:1) - ${t.t('accessibility.wcagFailDesc')}`;

  const embed: EmbedData = {
    title: t.t('accessibility.contrastAnalysis'),
    description,
    color: parseInt(dyeInputs[0].hex.replace('#', ''), 16),
    footer: `${t.t('common.footer')} • ${t.t('accessibility.wcagGuidelines')}`,
  };

  return { ok: true, svgString, mode: 'contrast', embed };
}

export type { VisionType };
