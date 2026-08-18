/**
 * /gradient Command Handler (Adapter)
 *
 * Thin adapter: extracts Discord options, delegates to executeGradient(),
 * renders the PNG, and formats the Discord response with emojis.
 */

import type { MatchingMethod } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { DyeTypeFilters, MatchQualityKey } from '@xivdyetools/types';
import { classifyMatchDistance } from '@xivdyetools/types';
import { deferredResponse, errorEmbed, hexToDiscordColor } from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createTranslator, createUserTranslator } from '../../services/bot-i18n.js';
import {
  discordLocaleToLocaleCode,
  initializeLocale,
  type LocaleCode,
} from '../../services/i18n.js';
import { resolveColorInput, executeGradient, type InterpolationMode } from '@xivdyetools/bot-logic';
import { getUserPreferences, resolveMatchingMethod } from '../../services/preferences.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

export async function handleGradientCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger,
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  const options = interaction.data?.options || [];
  const startInput = options.find((opt) => opt.name === 'start_color')?.value as string | undefined;
  const endInput = options.find((opt) => opt.name === 'end_color')?.value as string | undefined;
  const stepCount = (options.find((opt) => opt.name === 'steps')?.value as number) || 6;
  const colorSpace =
    (options.find((opt) => opt.name === 'color_space')?.value as InterpolationMode) || 'hsv';
  const explicitMatching = options.find((opt) => opt.name === 'matching')?.value as
    string | undefined;

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
        embeds: [
          errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: startInput })),
        ],
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
  const prefs = userId ? await getUserPreferences(env.KV, userId) : {};
  // Matching method: explicit option > stored preference > suite default (dE2000)
  const matchingMethod = resolveMatchingMethod(explicitMatching, prefs);
  ctx.waitUntil(
    processGradientCommand(
      interaction,
      env,
      startResolved,
      endResolved,
      stepCount,
      colorSpace,
      matchingMethod,
      locale,
      logger,
      prefs.dyeFilters,
      prefs.theme,
    ),
  );
  return deferResponse;
}

async function processGradientCommand(
  interaction: DiscordInteraction,
  env: Env,
  startColor: {
    hex: string;
    name?: string;
    id?: number;
    itemID?: number | null;
    stainID?: number | null;
  },
  endColor: {
    hex: string;
    name?: string;
    id?: number;
    itemID?: number | null;
    stainID?: number | null;
  },
  stepCount: number,
  colorSpace: InterpolationMode,
  matchingMethod: MatchingMethod,
  locale: LocaleCode,
  logger?: ExtendedLogger,
  dyeFilters?: DyeTypeFilters,
  theme?: 'dark' | 'light',
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
    dyeFilters,
    theme,
  });

  if (!result.ok) {
    if (logger) logger.error('Gradient command error');
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });

    // Rebuild description with Discord emojis for each step's dye
    const dyeLines = result.gradientSteps
      .map((step, i) => {
        const emoji = step.dyeId ? getDyeEmoji(step.dyeId, env.DISCORD_CLIENT_ID) : undefined;
        const emojiPrefix = emoji ? `${emoji} ` : '';
        const quality = getMatchQualityLabel(step.distance, t);
        const dyeText = step.dyeName
          ? `${emojiPrefix}**${step.dyeName}**`
          : `_${t.t('errors.noMatchFound')}_`;

        let label = '';
        if (i === 0) label = ` (${t.t('gradient.startColor')})`;
        else if (i === result.gradientSteps.length - 1) label = ` (${t.t('gradient.endColor')})`;

        return `**${i + 1}.** ${dyeText} • \`${step.hex.toUpperCase()}\` • ${quality}${label}`;
      })
      .join('\n');

    const startEmoji = startColor.id
      ? getDyeEmoji(startColor.stainID ?? 0, env.DISCORD_CLIENT_ID)
      : undefined;
    const endEmoji = endColor.id
      ? getDyeEmoji(endColor.stainID ?? 0, env.DISCORD_CLIENT_ID)
      : undefined;
    const startText = startColor.name
      ? `${startEmoji ? `${startEmoji} ` : ''}**${startColor.name}** (\`${startColor.hex.toUpperCase()}\`)`
      : `\`${startColor.hex.toUpperCase()}\``;
    const endText = endColor.name
      ? `${endEmoji ? `${endEmoji} ` : ''}**${endColor.name}** (\`${endColor.hex.toUpperCase()}\`)`
      : `\`${endColor.hex.toUpperCase()}\``;

    const colorSpaceLabel = colorSpace.toUpperCase();
    const matchingLabel =
      matchingMethod === 'ciede2000'
        ? 'CIEDE2000'
        : matchingMethod === 'cie76'
          ? 'CIE76'
          : matchingMethod.toUpperCase();

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
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
        },
      ],
      file: { name: `gradient-${stepCount}-steps.png`, data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    if (logger) logger.error('Gradient render error', error instanceof Error ? error : undefined);
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}

/** Maps `classifyMatchDistance`'s tier key onto the bot's `quality.*` locale keys. */
const QUALITY_LOCALE_KEY: Record<MatchQualityKey, string> = {
  perfect: 'quality.perfect',
  excellent: 'quality.excellent',
  good: 'quality.good',
  fair: 'quality.fair',
  approximate: 'quality.approximate',
};

function getMatchQualityLabel(distance: number, t: ReturnType<typeof createTranslator>): string {
  return t.t(QUALITY_LOCALE_KEY[classifyMatchDistance(distance)]);
}
