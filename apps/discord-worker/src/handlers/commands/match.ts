/**
 * /match Command Handler (Adapter)
 *
 * Thin adapter: extracts Discord options, delegates to executeMatch(),
 * builds the Discord response with emojis and copy buttons.
 */

import { ColorService } from '@xivdyetools/core';
import { messageResponse, errorEmbed } from '../../utils/response.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createCopyButtons } from '../buttons/index.js';
import { createUserTranslator, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName } from '../../services/i18n.js';
import { executeMatch } from '@xivdyetools/bot-logic';
import type { Env, DiscordInteraction } from '../../types/env.js';

export async function handleMatchCommand(
  interaction: DiscordInteraction,
  env: Env,
  _ctx: ExecutionContext
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);
  const locale = t.getLocale();
  await initializeLocale(locale);

  const options = interaction.data?.options || [];
  const colorInput = options.find((opt) => opt.name === 'color')?.value as string | undefined;
  const matchCount = Math.min(Math.max((options.find((opt) => opt.name === 'count')?.value as number) || 1, 1), 10);

  if (!colorInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
      flags: 64,
    });
  }

  const result = await executeMatch({ colorInput, count: matchCount, locale });

  if (!result.ok) {
    const msg = result.error === 'INVALID_INPUT'
      ? t.t('errors.invalidColor', { input: colorInput })
      : t.t('errors.noMatchFound');
    return messageResponse({ embeds: [errorEmbed(t.t('common.error'), msg)], flags: 64 });
  }

  const { targetHex, fromDye, matches } = result;

  if (matchCount === 1) {
    const { dye, distance } = matches[0];
    const quality = getMatchQuality(distance, t);
    const emoji = getDyeEmoji(dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const localizedDyeName = getLocalizedDyeName(dye.itemID, dye.name, locale);

    let inputDesc = `**Hex:** \`${targetHex.toUpperCase()}\`\n`;
    inputDesc += `**${t.t('common.rgb')}:** \`${formatRgb(targetHex)}\`\n`;
    inputDesc += `**${t.t('common.hsv')}:** \`${formatHsv(targetHex)}\``;
    if (fromDye) {
      const fromEmoji = getDyeEmoji(fromDye.id);
      const fromEmojiPrefix = fromEmoji ? `${fromEmoji} ` : '';
      const fromDyeName = getLocalizedDyeName(fromDye.itemID, fromDye.name, locale);
      inputDesc = `${fromEmojiPrefix}**${fromDyeName}**\n${inputDesc}`;
    }

    let matchDesc = `${emojiPrefix}**${localizedDyeName}**\n`;
    matchDesc += `**Hex:** \`${dye.hex.toUpperCase()}\`\n`;
    matchDesc += `**${t.t('common.rgb')}:** \`${formatRgb(dye.hex)}\`\n`;
    matchDesc += `**${t.t('common.hsv')}:** \`${formatHsv(dye.hex)}\`\n`;
    matchDesc += `**${t.t('common.category')}:** ${dye.category}`;

    const rgb = ColorService.hexToRgb(dye.hex);
    const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
    const copyButtons = createCopyButtons(dye.hex, rgb, {
      h: Math.round(hsv.h), s: Math.round(hsv.s), v: Math.round(hsv.v),
    });

    return messageResponse({
      embeds: [{
        title: `${quality.emoji} ${t.t('match.title', { name: localizedDyeName })}`,
        color: parseInt(dye.hex.replace('#', ''), 16),
        fields: [
          { name: `🎨 ${t.t('common.inputColor')}`, value: inputDesc, inline: true },
          { name: `🧪 ${t.t('common.closestDye')}`, value: matchDesc, inline: true },
          {
            name: `📊 ${t.t('common.matchQuality')}`,
            value: `**${t.t('common.distance')}:** ${distance.toFixed(2)}\n**${t.t('common.quality')}:** ${quality.label}`,
            inline: true,
          },
        ],
        footer: { text: `${t.t('common.footer')} • ${t.t('match.useInfoHint')}` },
      }],
      components: [copyButtons],
    });
  }

  // Multi-match: add emojis to the pre-formatted description
  const matchLines = matches.map((match, i) => {
    const quality = getMatchQuality(match.distance, t);
    const emoji = getDyeEmoji(match.dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const localizedName = getLocalizedDyeName(match.dye.itemID, match.dye.name, locale);
    return `**${i + 1}.** ${emojiPrefix}**${localizedName}** • \`${match.dye.hex.toUpperCase()}\` • ${quality.emoji} ${quality.label} (Δ ${match.distance.toFixed(1)})`;
  }).join('\n');

  const fromDyeName = fromDye ? getLocalizedDyeName(fromDye.itemID, fromDye.name, locale) : null;
  const inputText = fromDyeName
    ? `**${fromDyeName}** (\`${targetHex.toUpperCase()}\`)`
    : `\`${targetHex.toUpperCase()}\``;

  return messageResponse({
    embeds: [{
      title: `🎨 ${t.t('match.topMatches', { count: matches.length })}`,
      description: `${t.t('match.findingMatches', { input: inputText })}\n\n${matchLines}`,
      color: parseInt(matches[0].dye.hex.replace('#', ''), 16),
      footer: { text: `${t.t('common.footer')} • ${t.t('match.useInfoNameHint')}` },
    }],
  });
}

function getMatchQuality(distance: number, t: Translator) {
  if (distance === 0) return { emoji: '🎯', label: t.t('quality.perfect') };
  if (distance < 10) return { emoji: '✨', label: t.t('quality.excellent') };
  if (distance < 25) return { emoji: '👍', label: t.t('quality.good') };
  if (distance < 50) return { emoji: '⚠️', label: t.t('quality.fair') };
  return { emoji: '🔍', label: t.t('quality.approximate') };
}

function formatRgb(hex: string): string {
  const rgb = ColorService.hexToRgb(hex);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function formatHsv(hex: string): string {
  const rgb = ColorService.hexToRgb(hex);
  const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
  return `${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%`;
}
