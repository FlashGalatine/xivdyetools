/**
 * /contrast Command Handler (Adapter)
 *
 * WCAG 1.4.11 non-text contrast between 2–4 dyes. The pair count routes
 * the frame (13A/13B/13C·1); four is the command's own limit, enforced at
 * the schema by four discrete dye options.
 *
 * @module handlers/commands/contrast
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed } from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { createTranslator, createUserTranslator } from '../../services/bot-i18n.js';
import {
  discordLocaleToLocaleCode,
  initializeLocale,
  type LocaleCode,
} from '../../services/i18n.js';
import { resolveColorInput, executeContrast, type ContrastDyeInput } from '@xivdyetools/bot-logic';
import { getUserPreferences } from '../../services/preferences.js';
import { markCommandOutcome, classifyError } from '../../services/command-trace.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

export async function handleContrastCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger,
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  const options = interaction.data?.options || [];
  const dyeInputs: string[] = [];
  for (const opt of options) {
    if (opt.name.startsWith('dye') && opt.value) {
      dyeInputs.push(opt.value as string);
    }
  }

  const t = userId
    ? await createUserTranslator(env.KV, userId, interaction.locale)
    : createTranslator(discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en');
  const theme = userId ? (await getUserPreferences(env.KV, userId)).theme : undefined;

  if (dyeInputs.length < 2) {
    return Response.json({
      type: 4,
      data: { embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))], flags: 64 },
    });
  }

  const resolvedDyes: ContrastDyeInput[] = [];
  for (const value of dyeInputs.slice(0, 4)) {
    const resolved = resolveColorInput(value, { excludeFacewear: true, findClosestForHex: true, locale: t.getLocale() });
    if (!resolved) {
      return Response.json({
        type: 4,
        data: {
          embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: value }))],
          flags: 64,
        },
      });
    }
    resolvedDyes.push({
      dye: resolved.dye,
      hex: resolved.hex,
      name: resolved.name ?? resolved.hex.toUpperCase(),
      itemID: resolved.itemID,
    });
  }

  const locale = t.getLocale();
  const deferResponse = deferredResponse();
  ctx.waitUntil(processContrastCommand(interaction, env, resolvedDyes, locale, theme, logger));
  return deferResponse;
}

async function processContrastCommand(
  interaction: DiscordInteraction,
  env: Env,
  dyes: ContrastDyeInput[],
  locale: LocaleCode,
  theme?: 'dark' | 'light',
  logger?: ExtendedLogger,
): Promise<void> {
  const t = createTranslator(locale);
  await initializeLocale(locale);

  const result = await executeContrast({ dyes, locale, theme, logger });

  if (!result.ok) {
    if (logger) logger.error('Contrast command failed');
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: result.embed.title,
          description: result.embed.description,
          color: result.embed.color,
          image: { url: 'attachment://contrast.png' },
        },
      ],
      file: { name: 'contrast.png', data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    markCommandOutcome(interaction, classifyError(error, 'render'));
    if (logger) logger.error('Contrast render error', error instanceof Error ? error : undefined);
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}
