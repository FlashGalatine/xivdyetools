/**
 * /mixer Command Handler (V4) - Dye Blending
 *
 * Blends two dyes using various color mixing algorithms and finds
 * the closest FFXIV dye(s) to the blended result.
 *
 * NOTE: This is the NEW v4 /mixer command for dye blending.
 * The old /mixer (gradient) is now /gradient.
 *
 * Blending Modes:
 * - RGB: Simple additive channel averaging
 * - LAB: Perceptually uniform CIELAB blending
 * - OKLAB: Modern perceptual (fixes LAB blue→purple)
 * - RYB: Traditional artist's color wheel
 * - HSL: Hue-Saturation-Lightness interpolation
 * - Spectral: Kubelka-Munk pigment simulation
 *
 * @module handlers/commands/mixer-v4
 */

import { ColorService, type Dye } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  messageResponse,
  deferredResponse,
  errorEmbed,
  hexToDiscordColor,
} from '../../utils/response.js';
import { resolveColorInput, dyeService, type ResolvedColor } from '../../utils/color.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { blendColors, getBlendingModeDescription } from '../../services/color-blending.js';
import {
  getUserPreferences,
  resolveBlendingMode,
  resolveMatchingMethod,
  resolveCount,
} from '../../services/preferences.js';
import {
  type BlendingMode,
} from '../../types/preferences.js';
import {
  createTranslator,
  createUserTranslator,
  type Translator,
} from '../../services/bot-i18n.js';
import {
  discordLocaleToLocaleCode,
  initializeLocale,
  getLocalizedDyeName,
  type LocaleCode,
} from '../../services/i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Constants
// ============================================================================

/** Color for blend result embeds */
const BLEND_COLOR = 0x9b59b6; // Purple for mixing theme

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /mixer command (V4 - Dye Blending)
 *
 * Blends two dyes and finds the closest matching FFXIV dye(s).
 */
export async function handleMixerV4Command(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';

  // Get translator for validation errors (before deferring)
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Extract options
  const options = interaction.data?.options || [];
  const dye1Option = options.find((opt) => opt.name === 'dye1');
  const dye2Option = options.find((opt) => opt.name === 'dye2');
  const modeOption = options.find((opt) => opt.name === 'mode');
  const countOption = options.find((opt) => opt.name === 'count');

  const dye1Input = dye1Option?.value as string | undefined;
  const dye2Input = dye2Option?.value as string | undefined;
  const explicitMode = modeOption?.value as string | undefined;
  const explicitCount = countOption?.value as number | undefined;

  // Validate required inputs
  if (!dye1Input || !dye2Input) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('mixer.bothRequired'))],
      flags: 64,
    });
  }

  // Resolve the first dye
  const dye1Resolved = resolveColorInput(dye1Input, { excludeFacewear: true });
  if (!dye1Resolved) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: dye1Input })),
      ],
      flags: 64,
    });
  }

  // Resolve the second dye
  const dye2Resolved = resolveColorInput(dye2Input, { excludeFacewear: true });
  if (!dye2Resolved) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: dye2Input })),
      ],
      flags: 64,
    });
  }

  // Get user preferences for defaults
  const prefs = await getUserPreferences(env.KV, userId, logger);
  const blendingMode = resolveBlendingMode(explicitMode, prefs);
  const count = resolveCount(explicitCount, prefs);

  // Resolve locale for response
  const locale = t.getLocale();

  // Process the blend (quick operation, no need to defer for simple blending)
  return processMixerCommand(
    interaction,
    env,
    dye1Resolved,
    dye2Resolved,
    blendingMode,
    count,
    locale,
    logger
  );
}

// ============================================================================
// Processing
// ============================================================================

/**
 * Process the mixer command and return the response
 */
async function processMixerCommand(
  interaction: DiscordInteraction,
  env: Env,
  dye1: ResolvedColor,
  dye2: ResolvedColor,
  blendingMode: BlendingMode,
  count: number,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<Response> {
  const t = createTranslator(locale);

  // Initialize localization for dye names
  await initializeLocale(locale);

  try {
    // Blend the two colors
    const blendResult = blendColors(dye1.hex, dye2.hex, blendingMode, 0.5);

    // Find closest dye(s) to the blended color
    const matches: Array<{ dye: Dye; distance: number }> = [];
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
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.noMatchFound'))],
        flags: 64,
      });
    }

    // Build the response
    return buildMixerResponse(dye1, dye2, blendResult.hex, blendingMode, matches, t);
  } catch (error) {
    if (logger) {
      logger.error('Mixer command error', error instanceof Error ? error : undefined);
    }

    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
      flags: 64,
    });
  }
}

// ============================================================================
// Response Building
// ============================================================================

/**
 * Build the mixer command response
 */
function buildMixerResponse(
  dye1: ResolvedColor,
  dye2: ResolvedColor,
  blendedHex: string,
  mode: BlendingMode,
  matches: Array<{ dye: Dye; distance: number }>,
  t: Translator
): Response {
  const locale = t.getLocale();

  // Format input dyes
  const dye1Emoji = dye1.id ? getDyeEmoji(dye1.id) : undefined;
  const dye2Emoji = dye2.id ? getDyeEmoji(dye2.id) : undefined;
  const dye1Name = dye1.itemID && dye1.name
    ? getLocalizedDyeName(dye1.itemID, dye1.name, locale)
    : dye1.name;
  const dye2Name = dye2.itemID && dye2.name
    ? getLocalizedDyeName(dye2.itemID, dye2.name, locale)
    : dye2.name;

  const dye1Display = dye1Name
    ? `${dye1Emoji ? `${dye1Emoji} ` : ''}**${dye1Name}** (\`${dye1.hex.toUpperCase()}\`)`
    : `\`${dye1.hex.toUpperCase()}\``;
  const dye2Display = dye2Name
    ? `${dye2Emoji ? `${dye2Emoji} ` : ''}**${dye2Name}** (\`${dye2.hex.toUpperCase()}\`)`
    : `\`${dye2.hex.toUpperCase()}\``;

  // Format blending mode (localized)
  const modeDisplay = t.t(`mixer.modes.${mode}`) || mode;

  // Format matches
  const matchLines = matches.map((match, i) => {
    const { dye, distance } = match;
    const quality = getMatchQuality(distance, t);
    const emoji = getDyeEmoji(dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);

    return `**${i + 1}.** ${emojiPrefix}**${localizedName}** • \`${dye.hex.toUpperCase()}\` • ${quality.emoji} ${quality.label} (Δ ${distance.toFixed(1)})`;
  }).join('\n');

  // Build embed
  const topMatch = matches[0];
  const topMatchName = getLocalizedDyeName(topMatch.dye.itemID, topMatch.dye.name, locale);

  return messageResponse({
    embeds: [
      {
        title: `🎨 ${t.t('mixer.blendResult')}`,
        description: [
          `**${t.t('mixer.inputDyes')}:**`,
          `• ${dye1Display}`,
          `• ${dye2Display}`,
          '',
          `**${t.t('mixer.blendingMode')}:** ${modeDisplay}`,
          `**${t.t('mixer.blendedColor')}:** \`${blendedHex.toUpperCase()}\``,
          '',
          matches.length > 1
            ? `**${t.t('mixer.topMatches', { count: matches.length })}:**`
            : `**${t.t('mixer.closestMatch')}:**`,
          matchLines,
        ].join('\n'),
        color: hexToDiscordColor(blendedHex),
        footer: {
          text: t.t('mixer.footer', { dyeName: topMatchName }),
        },
      },
    ],
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Finds closest dye excluding Facewear category
 */
function findClosestDyeExcludingFacewear(
  targetHex: string,
  excludeIds: number[] = [],
  maxAttempts = 20
): Dye | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = dyeService.findClosestDye(targetHex, excludeIds);
    if (!candidate) break;

    if (candidate.category !== 'Facewear') {
      return candidate;
    }
    excludeIds.push(candidate.id);
  }
  return null;
}

/**
 * Calculates Euclidean distance between two hex colors
 */
function getColorDistance(hex1: string, hex2: string): number {
  const rgb1 = ColorService.hexToRgb(hex1);
  const rgb2 = ColorService.hexToRgb(hex2);

  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

/**
 * Gets match quality emoji and label based on color distance
 */
function getMatchQuality(distance: number, t: Translator): { emoji: string; label: string } {
  if (distance === 0) return { emoji: '🎯', label: t.t('quality.perfect') };
  if (distance < 10) return { emoji: '✨', label: t.t('quality.excellent') };
  if (distance < 25) return { emoji: '👍', label: t.t('quality.good') };
  if (distance < 50) return { emoji: '⚠️', label: t.t('quality.fair') };
  return { emoji: '🔍', label: t.t('quality.approximate') };
}
