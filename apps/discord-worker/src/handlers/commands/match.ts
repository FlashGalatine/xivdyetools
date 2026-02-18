/**
 * /match Command Handler
 *
 * Finds the closest FFXIV dye(s) to a given color input.
 * Accepts hex codes or dye names, returns match quality and details.
 */

import { ColorService, type Dye } from '@xivdyetools/core';
import { messageResponse, errorEmbed, hexToDiscordColor } from '../../utils/response.js';
// DISCORD-REF-001 FIX: Import from centralized color utilities
import { resolveColorInput as resolveColor, dyeService } from '../../utils/color.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createCopyButtons } from '../buttons/index.js';
import { createUserTranslator, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName } from '../../services/i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

/**
 * Resolves color input to a hex value
 * DISCORD-REF-001 FIX: Uses shared color utilities, adapts result to local interface
 */
function resolveColorInput(input: string): { hex: string; fromDye?: Dye } | null {
  const resolved = resolveColor(input, { excludeFacewear: true });
  if (!resolved) return null;
  return { hex: resolved.hex, fromDye: resolved.dye };
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

/**
 * Formats RGB values for display
 */
function formatRgb(hex: string): string {
  const rgb = ColorService.hexToRgb(hex);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Formats HSV values for display
 */
function formatHsv(hex: string): string {
  const rgb = ColorService.hexToRgb(hex);
  const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
  return `${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%`;
}

/**
 * Handles the /match command
 */
export async function handleMatchCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Initialize xivdyetools-core localization for dye names
  // Use translator's resolved locale instead of calling resolveUserLocale again
  const locale = t.getLocale();
  await initializeLocale(locale);

  // Extract options
  const options = interaction.data?.options || [];
  const colorOption = options.find((opt) => opt.name === 'color');
  const countOption = options.find((opt) => opt.name === 'count');

  const colorInput = colorOption?.value as string | undefined;
  const matchCount = Math.min(Math.max((countOption?.value as number) || 1, 1), 10);

  // Validate required input
  if (!colorInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
      flags: 64,
    });
  }

  // Resolve the color input
  const resolved = resolveColorInput(colorInput);
  if (!resolved) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: colorInput })),
      ],
      flags: 64,
    });
  }

  const targetHex = resolved.hex;

  // Find closest dye(s), excluding Facewear
  const matches: Array<{ dye: Dye; distance: number }> = [];
  const excludeIds: number[] = [];

  for (let i = 0; i < matchCount; i++) {
    // Find closest dye, iterating until we find a non-Facewear dye
    let closestDye: Dye | null = null;

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = dyeService.findClosestDye(targetHex, excludeIds);
      if (!candidate) break;

      if (candidate.category !== 'Facewear') {
        closestDye = candidate;
        break;
      }
      excludeIds.push(candidate.id);
    }

    if (closestDye) {
      const distance = getColorDistance(targetHex, closestDye.hex);
      matches.push({ dye: closestDye, distance });
      excludeIds.push(closestDye.id);
    }
  }

  if (matches.length === 0) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.noMatchFound')),
      ],
      flags: 64,
    });
  }

  // Build response based on single or multiple matches
  if (matchCount === 1) {
    return buildSingleMatchResponse(targetHex, matches[0], t, resolved.fromDye);
  } else {
    return buildMultiMatchResponse(targetHex, matches, t, resolved.fromDye);
  }
}

/**
 * Builds response for a single match
 */
function buildSingleMatchResponse(
  targetHex: string,
  match: { dye: Dye; distance: number },
  t: Translator,
  fromDye?: Dye
): Response {
  const { dye, distance } = match;
  const quality = getMatchQuality(distance, t);
  const emoji = getDyeEmoji(dye.id);
  const emojiPrefix = emoji ? `${emoji} ` : '';

  // Build input color description
  let inputDesc = `**Hex:** \`${targetHex.toUpperCase()}\`\n`;
  inputDesc += `**${t.t('common.rgb')}:** \`${formatRgb(targetHex)}\`\n`;
  inputDesc += `**${t.t('common.hsv')}:** \`${formatHsv(targetHex)}\``;

  if (fromDye) {
    const fromEmoji = getDyeEmoji(fromDye.id);
    const fromEmojiPrefix = fromEmoji ? `${fromEmoji} ` : '';
    const fromDyeName = getLocalizedDyeName(fromDye.itemID, fromDye.name, t.getLocale());
    inputDesc = `${fromEmojiPrefix}**${fromDyeName}**\n${inputDesc}`;
  }

  // Build match description with localized dye name
  const localizedDyeName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());
  let matchDesc = `${emojiPrefix}**${localizedDyeName}**\n`;
  matchDesc += `**Hex:** \`${dye.hex.toUpperCase()}\`\n`;
  matchDesc += `**${t.t('common.rgb')}:** \`${formatRgb(dye.hex)}\`\n`;
  matchDesc += `**${t.t('common.hsv')}:** \`${formatHsv(dye.hex)}\`\n`;
  matchDesc += `**${t.t('common.category')}:** ${dye.category}`;

  // Create copy buttons for the matched dye
  const rgb = ColorService.hexToRgb(dye.hex);
  const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
  const copyButtons = createCopyButtons(
    dye.hex,
    rgb,
    { h: Math.round(hsv.h), s: Math.round(hsv.s), v: Math.round(hsv.v) }
  );

  return messageResponse({
    embeds: [
      {
        title: `${quality.emoji} ${t.t('match.title', { name: localizedDyeName })}`,
        color: hexToDiscordColor(dye.hex),
        fields: [
          {
            name: `🎨 ${t.t('common.inputColor')}`,
            value: inputDesc,
            inline: true,
          },
          {
            name: `🧪 ${t.t('common.closestDye')}`,
            value: matchDesc,
            inline: true,
          },
          {
            name: `📊 ${t.t('common.matchQuality')}`,
            value: `**${t.t('common.distance')}:** ${distance.toFixed(2)}\n**${t.t('common.quality')}:** ${quality.label}`,
            inline: true,
          },
        ],
        footer: {
          text: `${t.t('common.footer')} • ${t.t('match.useInfoHint')}`,
        },
      },
    ],
    components: [copyButtons],
  });
}

/**
 * Builds response for multiple matches
 */
function buildMultiMatchResponse(
  targetHex: string,
  matches: Array<{ dye: Dye; distance: number }>,
  t: Translator,
  fromDye?: Dye
): Response {
  // Build input description with localized name
  const fromDyeName = fromDye ? getLocalizedDyeName(fromDye.itemID, fromDye.name, t.getLocale()) : null;
  let inputText = fromDyeName
    ? `**${fromDyeName}** (\`${targetHex.toUpperCase()}\`)`
    : `\`${targetHex.toUpperCase()}\``;

  // Build matches list with localized names
  const matchLines = matches.map((match, i) => {
    const { dye, distance } = match;
    const quality = getMatchQuality(distance, t);
    const emoji = getDyeEmoji(dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());

    return `**${i + 1}.** ${emojiPrefix}**${localizedName}** • \`${dye.hex.toUpperCase()}\` • ${quality.emoji} ${quality.label} (Δ ${distance.toFixed(1)})`;
  }).join('\n');

  return messageResponse({
    embeds: [
      {
        title: `🎨 ${t.t('match.topMatches', { count: matches.length })}`,
        description: `${t.t('match.findingMatches', { input: inputText })}\n\n${matchLines}`,
        color: hexToDiscordColor(matches[0].dye.hex),
        footer: {
          text: `${t.t('common.footer')} • ${t.t('match.useInfoNameHint')}`,
        },
      },
    ],
  });
}
