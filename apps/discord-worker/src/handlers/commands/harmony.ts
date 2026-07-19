/**
 * /harmony Command Handler (Adapter)
 *
 * Thin adapter: extracts Discord options, delegates to executeHarmony(),
 * renders the PNG, and formats the Discord response with emojis.
 */

import type { HarmonyColorSpace, MatchingMethod } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { DyeTypeFilters } from '@xivdyetools/types';
import { deferredResponse, errorEmbed } from '../../utils/response.js';
import { resolveColorInput } from '../../utils/color.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createUserTranslator, createTranslator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, type LocaleCode } from '../../services/i18n.js';
import { executeHarmony, getHarmonyTypeChoices, type HarmonyType } from '@xivdyetools/bot-logic';
import { getUserPreferences } from '../../services/preferences.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

export async function handleHarmonyCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  const options = interaction.data?.options || [];
  const colorOption = options.find((opt) => opt.name === 'color');
  const typeOption = options.find((opt) => opt.name === 'type');
  const colorSpaceOption = options.find((opt) => opt.name === 'color_space');
  const companionsOption = options.find((opt) => opt.name === 'companions');
  const matchingOption = options.find((opt) => opt.name === 'matching');
  const strictOption = options.find((opt) => opt.name === 'strict_matching');
  const preventDupOption = options.find((opt) => opt.name === 'prevent_duplicates');

  const colorInput = colorOption?.value as string | undefined;
  const harmonyType = (typeOption?.value as HarmonyType) || 'triadic';
  const colorSpace = (colorSpaceOption?.value as HarmonyColorSpace) || undefined;
  const companionCount = (companionsOption?.value as number) ?? undefined;
  const matchingMethod = (matchingOption?.value as MatchingMethod) ?? undefined;
  const strictMatching = (strictOption?.value as boolean) ?? undefined;
  const preventDuplicates = (preventDupOption?.value as boolean) ?? undefined;

  if (!colorInput) {
    return Response.json({
      type: 4,
      data: { embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))], flags: 64 },
    });
  }

  const resolved = resolveColorInput(colorInput, { excludeFacewear: false });
  if (!resolved) {
    return Response.json({
      type: 4,
      data: {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: colorInput }))],
        flags: 64,
      },
    });
  }

  const locale = t.getLocale();
  const harmonyOptions = colorSpace ? { colorSpace } : undefined;
  const deferResponse = deferredResponse();
  const prefs = await getUserPreferences(env.KV, userId, logger);

  // Resolve matching method: explicit option > pref > undefined (let executeHarmony default).
  const effectiveMatching: MatchingMethod | undefined = matchingMethod ?? prefs.matching;

  ctx.waitUntil(
    processHarmonyCommand(
      interaction, env,
      resolved.hex, resolved.name, resolved.id, resolved.itemID ?? undefined,
      harmonyType, locale, logger, harmonyOptions, prefs.dyeFilters,
      companionCount, effectiveMatching, strictMatching, preventDuplicates
    )
  );
  return deferResponse;
}

async function processHarmonyCommand(
  interaction: DiscordInteraction,
  env: Env,
  baseHex: string,
  baseName: string | undefined,
  baseId: number | undefined,
  baseItemID: number | undefined,
  harmonyType: HarmonyType,
  locale: LocaleCode,
  logger?: ExtendedLogger,
  harmonyOptions?: { colorSpace?: HarmonyColorSpace },
  dyeFilters?: DyeTypeFilters,
  companionCount?: number,
  matchingMethod?: MatchingMethod,
  strictMatching?: boolean,
  preventDuplicates?: boolean
): Promise<void> {
  const t = createTranslator(locale);
  await initializeLocale(locale);

  const result = await executeHarmony({
    baseHex, baseName, baseId, baseItemID, harmonyType, locale,
    harmonyOptions,
    dyeFilters,
    companionCount,
    matchingMethod,
    strictMatching,
    preventDuplicates,
  });

  if (!result.ok) {
    if (result.error === 'NO_MATCHES') {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.noMatchFound'))],
      });
    } else {
      if (logger) logger.error('Harmony command error');
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
      });
    }
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });

    // Build description with Discord emojis
    const dyeList = result.harmonyDyes
      .map((dye, i) => {
        const emoji = getDyeEmoji(dye.id);
        const emojiPrefix = emoji ? `${emoji} ` : '';
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${emojiPrefix}${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    const baseEmoji = baseId ? getDyeEmoji(baseId) : undefined;
    const baseEmojiPrefix = baseEmoji ? `${baseEmoji} ` : '';
    const baseColorText = `${t.t('harmony.baseColor')}: ${baseEmojiPrefix}**${result.baseName}** (\`${baseHex.toUpperCase()}\`)`;

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [{
        title: result.embed.title,
        description: `${baseColorText}\n\n${dyeList}`,
        color: result.embed.color,
        image: { url: 'attachment://image.png' },
        footer: { text: result.embed.footer ?? t.t('common.footer') },
      }],
      file: { name: `harmony-${harmonyType}.png`, data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    if (logger) logger.error('Harmony render error', error instanceof Error ? error : undefined);
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}

export { getHarmonyTypeChoices };
