/**
 * /harmony Command Handler (Adapter)
 *
 * Thin adapter: extracts Discord options, delegates to executeHarmony(),
 * renders the PNG, and formats the Discord response with emojis.
 */

import { parseColorWheelId, type ColorWheelId, type MatchingMethod } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { DyeTypeFilters } from '@xivdyetools/types';
import { deferredResponse, errorEmbed } from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createUserTranslator, createTranslator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, type LocaleCode } from '../../services/i18n.js';
import { resolveColorInput, executeHarmony, dyeService, type HarmonyType } from '@xivdyetools/bot-logic';
import { getUserPreferences, resolveMatchingMethod } from '../../services/preferences.js';
import { markCommandOutcome, classifyError } from '../../services/command-trace.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

export async function handleHarmonyCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger,
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  const options = interaction.data?.options || [];
  const colorOption = options.find((opt) => opt.name === 'color');
  const typeOption = options.find((opt) => opt.name === 'type');
  const wheelOption = options.find((opt) => opt.name === 'wheel');
  // Validated here so a stale registered choice can never reach the selector as a
  // string. Core's one normaliser (trim + lower-case + membership), the same
  // function the web app, the OG worker and bot-logic read a wheel id with —
  // `undefined` for absent/unknown keeps "the user did not choose" distinct
  // from "the user chose rgb", which is what elides `wheel=` from the card.
  const wheel: ColorWheelId | undefined = parseColorWheelId(wheelOption?.value);
  const companionsOption = options.find((opt) => opt.name === 'companions');
  const matchingOption = options.find((opt) => opt.name === 'matching');
  const strictOption = options.find((opt) => opt.name === 'strict_matching');
  const preventDupOption = options.find((opt) => opt.name === 'prevent_duplicates');

  const colorInput = colorOption?.value as string | undefined;
  const harmonyType = (typeOption?.value as HarmonyType) || 'triadic';
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

  const resolved = resolveColorInput(colorInput, { excludeFacewear: false, locale: t.getLocale() });
  if (!resolved) {
    return Response.json({
      type: 4,
      data: {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: colorInput })),
        ],
        flags: 64,
      },
    });
  }

  const locale = t.getLocale();
  const deferResponse = deferredResponse();
  const prefs = await getUserPreferences(env.KV, userId, logger);

  // Resolve matching method: explicit option > stored preference > suite default
  // (dE2000). Never leave it undefined - bot-logic's own default must not be
  // the thing that decides which bands a first-time user's card is graded on.
  const effectiveMatching: MatchingMethod = resolveMatchingMethod(matchingMethod, prefs);

  ctx.waitUntil(
    processHarmonyCommand(
      interaction,
      env,
      resolved.hex,
      resolved.name,
      resolved.id,
      resolved.itemID ?? undefined,
      harmonyType,
      locale,
      logger,
      wheel,
      prefs.dyeFilters,
      companionCount,
      effectiveMatching,
      strictMatching,
      preventDuplicates,
      prefs.theme,
    ),
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
  wheel?: ColorWheelId,
  dyeFilters?: DyeTypeFilters,
  companionCount?: number,
  matchingMethod?: MatchingMethod,
  strictMatching?: boolean,
  preventDuplicates?: boolean,
  theme?: 'dark' | 'light',
): Promise<void> {
  const t = createTranslator(locale);
  await initializeLocale(locale);

  const result = await executeHarmony({
    baseHex,
    baseName,
    baseId,
    baseItemID,
    harmonyType,
    locale,
    wheel,
    dyeFilters,
    companionCount,
    matchingMethod,
    strictMatching,
    preventDuplicates,
    theme,
    logger,
  });

  if (!result.ok) {
    if (result.error === 'NO_MATCHES') {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.noMatchFound'))],
      });
    } else {
      // GENERATION_FAILED: the card generator threw inside bot-logic.
      markCommandOutcome(interaction, 'render');
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
        const emoji = getDyeEmoji(dye.stainID ?? 0, env.DISCORD_CLIENT_ID);
        const emojiPrefix = emoji ? `${emoji} ` : '';
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${emojiPrefix}${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    // BUG-033: `baseId` is an itemID (`resolveColorInput` returns `dye.id`),
    // but `emoji-mapping.json` is keyed by stainID — 1..125, so a 5729+ lookup
    // always missed and the base row was the one line in this embed with no
    // colour chip, while every numbered row below it had one (line 161 passes
    // `dye.stainID`). Resolve the stain number the emoji map actually uses.
    const baseStainID = baseId != null ? (dyeService.getDyeById(baseId)?.stainID ?? null) : null;
    const baseEmoji = baseStainID ? getDyeEmoji(baseStainID, env.DISCORD_CLIENT_ID) : undefined;
    const baseEmojiPrefix = baseEmoji ? `${baseEmoji} ` : '';
    const baseColorText = `${t.t('harmony.baseColor')}: ${baseEmojiPrefix}**${result.baseName}** (\`${baseHex.toUpperCase()}\`)`;

    // bot-logic hands the share URL over as `embed.description`, and this
    // handler replaces the description with the dye list — so the link it
    // built (wheel and all) used to be computed and dropped. Discord turns an
    // embed's `url` into the title's href, which is how `dye.ts` surfaces the
    // same thing. Guarded on the scheme because `description` is only a URL
    // when bot-logic could resolve the base dye's stainID.
    const shareUrl = result.embed.description?.startsWith('https://')
      ? result.embed.description
      : undefined;

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: result.embed.title,
          ...(shareUrl ? { url: shareUrl } : {}),
          description: `${baseColorText}\n\n${dyeList}`,
          color: result.embed.color,
          image: { url: 'attachment://image.png' },
          footer: { text: result.embed.footer ?? t.t('common.footer') },
        },
      ],
      file: { name: `harmony-${harmonyType}.png`, data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error, 'render'));
    if (logger) logger.error('Harmony render error', error instanceof Error ? error : undefined);
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}
