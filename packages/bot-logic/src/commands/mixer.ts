/**
 * Mixer Command — Business Logic
 *
 * Blends two colors using a color mixing algorithm and finds the
 * closest FFXIV dye(s) to the blended result.
 *
 * Platform-agnostic: no Discord API calls, no file I/O.
 *
 * @module commands/mixer
 */

import { ColorService, type Dye } from '@xivdyetools/core';
import { createTranslator, type LocaleCode } from '@xivdyetools/bot-i18n';
import { blendColors, type BlendingMode } from '@xivdyetools/color-blending';
import { dyeService, type ResolvedColor } from '../input-resolution.js';
import { initializeLocale, getLocalizedDyeName } from '../localization.js';
import type { EmbedData } from './types.js';

// ============================================================================
// Types
// ============================================================================

export interface MixerInput {
  dye1: ResolvedColor;
  dye2: ResolvedColor;
  blendingMode: BlendingMode;
  /** Number of closest dyes to return (default: 1) */
  count?: number;
  locale: LocaleCode;
}

export interface MixerMatch {
  dye: Dye;
  distance: number;
}

export type MixerResult =
  | {
      ok: true;
      blendedHex: string;
      blendingMode: BlendingMode;
      inputDyes: [ResolvedColor, ResolvedColor];
      matches: MixerMatch[];
      embed: EmbedData;
    }
  | { ok: false; error: 'NO_MATCHES' | 'GENERATION_FAILED'; errorMessage: string };

// ============================================================================
// Helpers
// ============================================================================

function findClosestDyeExcludingFacewear(
  targetHex: string,
  excludeIds: number[] = [],
  maxAttempts = 20
): Dye | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = dyeService.findClosestDye(targetHex, excludeIds);
    if (!candidate) break;
    if (candidate.category !== 'Facewear') return candidate;
    excludeIds.push(candidate.id);
  }
  return null;
}

function getColorDistance(hex1: string, hex2: string): number {
  const rgb1 = ColorService.hexToRgb(hex1);
  const rgb2 = ColorService.hexToRgb(hex2);
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

function getMatchQualityLabel(distance: number, t: ReturnType<typeof createTranslator>): string {
  if (distance === 0) return `🎯 ${t.t('quality.perfect')}`;
  if (distance < 10) return `✨ ${t.t('quality.excellent')}`;
  if (distance < 25) return `👍 ${t.t('quality.good')}`;
  if (distance < 50) return `⚠️ ${t.t('quality.fair')}`;
  return `🔍 ${t.t('quality.approximate')}`;
}

// ============================================================================
// Execute
// ============================================================================

/**
 * Blends two dyes and finds the closest FFXIV dye matches.
 *
 * The adapter is responsible for:
 * - Resolving color inputs (via resolveColorInput from input-resolution)
 * - Resolving blendingMode from user preferences / command options
 * - Building copy buttons (Discord-specific)
 */
export async function executeMixer(input: MixerInput): Promise<MixerResult> {
  const { dye1, dye2, blendingMode, locale } = input;
  const count = Math.max(1, input.count ?? 1);
  const t = createTranslator(locale);

  await initializeLocale(locale);

  try {
    const blendResult = blendColors(dye1.hex, dye2.hex, blendingMode, 0.5);

    const matches: MixerMatch[] = [];
    const excludeIds: number[] = [];

    for (let i = 0; i < count; i++) {
      const closestDye = findClosestDyeExcludingFacewear(blendResult.hex, [...excludeIds]);
      if (closestDye) {
        const distance = getColorDistance(blendResult.hex, closestDye.hex);
        matches.push({ dye: closestDye, distance });
        excludeIds.push(closestDye.id);
      }
    }

    if (matches.length === 0) {
      return { ok: false, error: 'NO_MATCHES', errorMessage: 'No matching dyes found.' };
    }

    // Format input dye display names (localized)
    const dye1Name = dye1.itemID && dye1.name
      ? getLocalizedDyeName(dye1.itemID, dye1.name, locale)
      : dye1.name;
    const dye2Name = dye2.itemID && dye2.name
      ? getLocalizedDyeName(dye2.itemID, dye2.name, locale)
      : dye2.name;

    const dye1Display = dye1Name
      ? `**${dye1Name}** (\`${dye1.hex.toUpperCase()}\`)`
      : `\`${dye1.hex.toUpperCase()}\``;
    const dye2Display = dye2Name
      ? `**${dye2Name}** (\`${dye2.hex.toUpperCase()}\`)`
      : `\`${dye2.hex.toUpperCase()}\``;

    const modeDisplay = t.t(`mixer.modes.${blendingMode}`) || blendingMode;

    const matchLines = matches.map((match, i) => {
      const localizedName = getLocalizedDyeName(match.dye.itemID, match.dye.name, locale);
      const quality = getMatchQualityLabel(match.distance, t);
      return `**${i + 1}.** **${localizedName}** • \`${match.dye.hex.toUpperCase()}\` • ${quality} (Δ ${match.distance.toFixed(1)})`;
    }).join('\n');

    const topMatchName = getLocalizedDyeName(matches[0].dye.itemID, matches[0].dye.name, locale);

    const embed: EmbedData = {
      title: `🎨 ${t.t('mixer.blendResult')}`,
      description: [
        `**${t.t('mixer.inputDyes')}:**`,
        `• ${dye1Display}`,
        `• ${dye2Display}`,
        '',
        `**${t.t('mixer.blendingMode')}:** ${modeDisplay}`,
        `**${t.t('mixer.blendedColor')}:** \`${blendResult.hex.toUpperCase()}\``,
        '',
        matches.length > 1
          ? `**${t.t('mixer.topMatches', { count: matches.length })}:**`
          : `**${t.t('mixer.closestMatch')}:**`,
        matchLines,
      ].join('\n'),
      color: parseInt(blendResult.hex.replace('#', ''), 16),
      footer: t.t('mixer.footer', { dyeName: topMatchName }),
    };

    return {
      ok: true,
      blendedHex: blendResult.hex,
      blendingMode,
      inputDyes: [dye1, dye2],
      matches,
      embed,
    };
  } catch {
    return { ok: false, error: 'GENERATION_FAILED', errorMessage: 'Failed to blend colors.' };
  }
}

export type { BlendingMode, ResolvedColor };
