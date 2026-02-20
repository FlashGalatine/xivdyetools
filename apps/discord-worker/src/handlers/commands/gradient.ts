/**
 * /gradient Command Handler (Adapter)
 *
 * Thin adapter: extracts Discord options, delegates to executeGradient(),
 * renders the PNG, and formats the Discord response with emojis.
 */

import type { MatchingMethod } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed, hexToDiscordColor } from '../../utils/response.js';
import { resolveColorInput } from '../../utils/color.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createTranslator, createUserTranslator } from '../../services/bot-i18n.js';
import { discordLocaleToLocaleCode, initializeLocale, type LocaleCode } from '../../services/i18n.js';
import { executeGradient, type InterpolationMode } from '@xivdyetools/bot-logic';
import type { Env, DiscordInteraction } from '../../types/env.js';

export async function handleGradientCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  const options = interaction.data?.options || [];
  const startInput = options.find((opt) => opt.name === 'start_color')?.value as string | undefined;
  const endInput = options.find((opt) => opt.name === 'end_color')?.value as string | undefined;
  const stepCount = (options.find((opt) => opt.name === 'steps')?.value as number) || 6;
  const colorSpace = (options.find((opt) => opt.name === 'color_space')?.value as InterpolationMode) || 'hsv';
  const matchingMethod = (options.find((opt) => opt.name === 'matching')?.value as MatchingMethod) || 'oklab';

  const t = userId
    ? await createUserTranslator(env.KV, userId, interaction.locale)
    : createTranslator(discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en');

  if (!startInput || !endInput) {
    return Response.json({
      type: 4,
      data: { embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))], flags: 64 },
    });
  }

  const startResolved = resolveColorInput(startInput);
  if (!startResolved) {
    return Response.json({
      type: 4,
      data: {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: startInput }))],
        flags: 64,
      },
    });
  }

  const endResolved = resolveColorInput(endInput);
  if (!endResolved) {
    return Response.json({
      type: 4,
      data: {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: endInput }))],
        flags: 64,
      },
    });
  }

  const locale = t.getLocale();
  const deferResponse = deferredResponse();
  ctx.waitUntil(
    processGradientCommand(
      interaction, env, startResolved, endResolved, stepCount, colorSpace, matchingMethod, locale, logger
    )
  );
  return deferResponse;
}

async function processGradientCommand(
  interaction: DiscordInteraction,
  env: Env,
  startColor: { hex: string; name?: string; id?: number; itemID?: number | null },
  endColor: { hex: string; name?: string; id?: number; itemID?: number | null },
  stepCount: number,
  colorSpace: InterpolationMode,
  matchingMethod: MatchingMethod,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  const t = createTranslator(locale);
  await initializeLocale(locale);

  const result = await executeGradient({
    startColor,
    endColor,
    stepCount,
    colorSpace,
    matchingMethod,
    locale,
  });

  if (!result.ok) {
    if (logger) logger.error('Gradient command error');
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });

    // Rebuild description with Discord emojis for each step's dye
    const dyeLines = result.gradientSteps.map((step, i) => {
      const emoji = step.dyeId ? getDyeEmoji(step.dyeId) : undefined;
      const emojiPrefix = emoji ? `${emoji} ` : '';
      const quality = getMatchQualityLabel(step.distance, t);
      const dyeText = step.dyeName
        ? `${emojiPrefix}**${step.dyeName}**`
        : `_${t.t('errors.noMatchFound')}_`;

      let label = '';
      if (i === 0) label = ` (${t.t('gradient.startColor')})`;
      else if (i === result.gradientSteps.length - 1) label = ` (${t.t('gradient.endColor')})`;

      return `**${i + 1}.** ${dyeText} • \`${step.hex.toUpperCase()}\` • ${quality}${label}`;
    }).join('\n');

    const startEmoji = startColor.id ? getDyeEmoji(startColor.id) : undefined;
    const endEmoji = endColor.id ? getDyeEmoji(endColor.id) : undefined;
    const startText = startColor.name
      ? `${startEmoji ? `${startEmoji} ` : ''}**${startColor.name}** (\`${startColor.hex.toUpperCase()}\`)`
      : `\`${startColor.hex.toUpperCase()}\``;
    const endText = endColor.name
      ? `${endEmoji ? `${endEmoji} ` : ''}**${endColor.name}** (\`${endColor.hex.toUpperCase()}\`)`
      : `\`${endColor.hex.toUpperCase()}\``;

    const colorSpaceLabel = colorSpace.toUpperCase();
    const matchingLabel = matchingMethod === 'ciede2000' ? 'CIEDE2000' :
      matchingMethod === 'cie76' ? 'CIE76' : matchingMethod.toUpperCase();

    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [{
        title: result.embed.title,
        description: [
          `**${t.t('gradient.startColor')}:** ${startText}`,
          `**${t.t('gradient.endColor')}:** ${endText}`,
          `**${t.t('gradient.colorSpace') || 'Color Space'}:** ${colorSpaceLabel} • **${t.t('gradient.matching') || 'Matching'}:** ${matchingLabel}`,
          '',
          `**${t.t('extractor.topMatches', { count: stepCount })}:**`,
          dyeLines,
        ].join('\n'),
        color: hexToDiscordColor(startColor.hex),
        image: { url: 'attachment://image.png' },
        footer: { text: result.embed.footer ?? t.t('common.footer') },
      }],
      file: { name: `gradient-${stepCount}-steps.png`, data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    if (logger) logger.error('Gradient render error', error instanceof Error ? error : undefined);
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}

function getMatchQualityLabel(distance: number, t: ReturnType<typeof createTranslator>): string {
  if (distance === 0) return t.t('quality.perfect');
  if (distance < 10) return t.t('quality.excellent');
  if (distance < 25) return t.t('quality.good');
  if (distance < 50) return t.t('quality.fair');
  return t.t('quality.approximate');
}
