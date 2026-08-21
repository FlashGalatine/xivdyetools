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
import { messageResponse, deferredResponse, errorEmbed } from '../../utils/response.js';
import {
  getUserPreferences,
  resolveBlendingMode,
  resolveMatchingMethod,
} from '../../services/preferences.js';
import { createUserTranslator } from '../../services/bot-i18n.js';
import { initializeLocale } from '../../services/i18n.js';
import { resolveColorInput, executeMixer } from '@xivdyetools/bot-logic';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

export async function handleMixerV4Command(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger,
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  const options = interaction.data?.options || [];
  const dye1Input = options.find((opt) => opt.name === 'dye1')?.value as string | undefined;
  const dye2Input = options.find((opt) => opt.name === 'dye2')?.value as string | undefined;
  const explicitMode = options.find((opt) => opt.name === 'mode')?.value as string | undefined;
  const explicitMatching = options.find((opt) => opt.name === 'matching')?.value as
    string | undefined;

  if (!dye1Input || !dye2Input) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('mixer.bothRequired'))],
      flags: 64,
    });
  }

  const dye1Resolved = resolveColorInput(dye1Input, { excludeFacewear: true, locale: t.getLocale() });
  if (!dye1Resolved) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: dye1Input }))],
      flags: 64,
    });
  }

  const dye2Resolved = resolveColorInput(dye2Input, { excludeFacewear: true, locale: t.getLocale() });
  if (!dye2Resolved) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: dye2Input }))],
      flags: 64,
    });
  }

  const prefs = await getUserPreferences(env.KV, userId, logger);
  const blendingMode = resolveBlendingMode(explicitMode, prefs);
  const matchingMethod = resolveMatchingMethod(explicitMatching, prefs);
  const locale = t.getLocale();

  await initializeLocale(locale);

  // 12F renders a card — defer and follow up with the PNG
  ctx.waitUntil(
    (async () => {
      try {
        const result = await executeMixer({
          dye1: dye1Resolved,
          dye2: dye2Resolved,
          blendingMode,
          matchingMethod,
          locale,
          dyeFilters: prefs.dyeFilters,
          theme: prefs.theme,
        });

        if (!result.ok) {
          const message =
            result.error === 'NO_MATCHES'
              ? t.t('errors.noMatchFound')
              : t.t('errors.generationFailed');
          if (result.error !== 'NO_MATCHES' && logger) logger.error('Mixer command error');
          await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
            embeds: [errorEmbed(t.t('common.error'), message)],
          });
          return;
        }

        const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });
        await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
          embeds: [
            {
              title: result.embed.title,
              description: result.embed.description,
              color: result.embed.color,
              image: { url: 'attachment://mixer.png' },
            },
          ],
          file: {
            name: 'mixer.png',
            data: pngBuffer,
            contentType: 'image/png',
          },
        });
      } catch (error) {
        if (logger) logger.error('Mixer render error', error instanceof Error ? error : undefined);
        await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
          embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
        });
      }
    })(),
  );

  return deferredResponse();
}
