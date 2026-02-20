/**
 * /mixer Command Handler (V4 Adapter) - Dye Blending
 *
 * Thin adapter: extracts Discord options + user preferences,
 * delegates to executeMixer(), and formats the Discord response with emojis.
 *
 * NOTE: This is the NEW v4 /mixer command for dye blending.
 * The old /mixer (gradient) is now /gradient.
 *
 * @module handlers/commands/mixer-v4
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { messageResponse, errorEmbed } from '../../utils/response.js';
import { resolveColorInput } from '../../utils/color.js';
import { getDyeEmoji } from '../../services/emoji.js';
import {
  getUserPreferences,
  resolveBlendingMode,
  resolveCount,
} from '../../services/preferences.js';
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
import { executeMixer } from '@xivdyetools/bot-logic';
import type { Env, DiscordInteraction } from '../../types/env.js';

export async function handleMixerV4Command(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  const options = interaction.data?.options || [];
  const dye1Input = options.find((opt) => opt.name === 'dye1')?.value as string | undefined;
  const dye2Input = options.find((opt) => opt.name === 'dye2')?.value as string | undefined;
  const explicitMode = options.find((opt) => opt.name === 'mode')?.value as string | undefined;
  const explicitCount = options.find((opt) => opt.name === 'count')?.value as number | undefined;

  if (!dye1Input || !dye2Input) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('mixer.bothRequired'))],
      flags: 64,
    });
  }

  const dye1Resolved = resolveColorInput(dye1Input, { excludeFacewear: true });
  if (!dye1Resolved) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: dye1Input }))],
      flags: 64,
    });
  }

  const dye2Resolved = resolveColorInput(dye2Input, { excludeFacewear: true });
  if (!dye2Resolved) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: dye2Input }))],
      flags: 64,
    });
  }

  const prefs = await getUserPreferences(env.KV, userId, logger);
  const blendingMode = resolveBlendingMode(explicitMode, prefs);
  const count = resolveCount(explicitCount, prefs);
  const locale = t.getLocale();

  await initializeLocale(locale);

  const result = await executeMixer({
    dye1: dye1Resolved,
    dye2: dye2Resolved,
    blendingMode,
    count,
    locale,
  });

  if (!result.ok) {
    if (result.error === 'NO_MATCHES') {
      return messageResponse({
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.noMatchFound'))],
        flags: 64,
      });
    }
    if (logger) logger.error('Mixer command error');
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
      flags: 64,
    });
  }

  // Build Discord embed description with emojis
  const dye1Name = dye1Resolved.itemID && dye1Resolved.name
    ? getLocalizedDyeName(dye1Resolved.itemID, dye1Resolved.name, locale)
    : dye1Resolved.name;
  const dye2Name = dye2Resolved.itemID && dye2Resolved.name
    ? getLocalizedDyeName(dye2Resolved.itemID, dye2Resolved.name, locale)
    : dye2Resolved.name;

  const dye1Emoji = dye1Resolved.id ? getDyeEmoji(dye1Resolved.id) : undefined;
  const dye2Emoji = dye2Resolved.id ? getDyeEmoji(dye2Resolved.id) : undefined;

  const dye1Display = dye1Name
    ? `${dye1Emoji ? `${dye1Emoji} ` : ''}**${dye1Name}** (\`${dye1Resolved.hex.toUpperCase()}\`)`
    : `\`${dye1Resolved.hex.toUpperCase()}\``;
  const dye2Display = dye2Name
    ? `${dye2Emoji ? `${dye2Emoji} ` : ''}**${dye2Name}** (\`${dye2Resolved.hex.toUpperCase()}\`)`
    : `\`${dye2Resolved.hex.toUpperCase()}\``;

  const modeDisplay = t.t(`mixer.modes.${blendingMode}`) || blendingMode;

  const matchLines = result.matches.map((match, i) => {
    const emoji = getDyeEmoji(match.dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const localizedName = getLocalizedDyeName(match.dye.itemID, match.dye.name, locale);
    const quality = getMatchQualityLabel(match.distance, t);
    return `**${i + 1}.** ${emojiPrefix}**${localizedName}** • \`${match.dye.hex.toUpperCase()}\` • ${quality} (Δ ${match.distance.toFixed(1)})`;
  }).join('\n');

  const topMatchName = getLocalizedDyeName(result.matches[0].dye.itemID, result.matches[0].dye.name, locale);

  return messageResponse({
    embeds: [{
      title: `🎨 ${t.t('mixer.blendResult')}`,
      description: [
        `**${t.t('mixer.inputDyes')}:**`,
        `• ${dye1Display}`,
        `• ${dye2Display}`,
        '',
        `**${t.t('mixer.blendingMode')}:** ${modeDisplay}`,
        `**${t.t('mixer.blendedColor')}:** \`${result.blendedHex.toUpperCase()}\``,
        '',
        result.matches.length > 1
          ? `**${t.t('mixer.topMatches', { count: result.matches.length })}:**`
          : `**${t.t('mixer.closestMatch')}:**`,
        matchLines,
      ].join('\n'),
      color: parseInt(result.blendedHex.replace('#', ''), 16),
      footer: { text: t.t('mixer.footer', { dyeName: topMatchName }) },
    }],
  });
}

function getMatchQualityLabel(distance: number, t: Translator): string {
  if (distance === 0) return `🎯 ${t.t('quality.perfect')}`;
  if (distance < 10) return `✨ ${t.t('quality.excellent')}`;
  if (distance < 25) return `👍 ${t.t('quality.good')}`;
  if (distance < 50) return `⚠️ ${t.t('quality.fair')}`;
  return `🔍 ${t.t('quality.approximate')}`;
}
