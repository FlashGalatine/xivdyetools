/**
 * /accessibility Command Handler (Adapter)
 *
 * Thin adapter: extracts Discord options, delegates to executeAccessibility(),
 * renders the PNG, and formats the Discord response with emojis.
 *
 * Single dye → colorblind simulation.
 * Multiple dyes (2-4) → WCAG contrast matrix.
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed } from '../../utils/response.js';
import { resolveColorInput } from '../../utils/color.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { createTranslator, createUserTranslator } from '../../services/bot-i18n.js';
import { discordLocaleToLocaleCode, initializeLocale, type LocaleCode } from '../../services/i18n.js';
import {
  executeAccessibility,
  type VisionType,
  type AccessibilityDye,
} from '@xivdyetools/bot-logic';
import { getUserPreferences } from '../../services/preferences.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

export async function handleAccessibilityCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  const options = interaction.data?.options || [];
  const dyeInputs: { name: string; value: string }[] = [];
  for (const opt of options) {
    if (opt.name.startsWith('dye') && opt.value) {
      dyeInputs.push({ name: opt.name, value: opt.value as string });
    }
  }
  const visionOption = options.find((opt) => opt.name === 'vision');
  const visionFilter = visionOption?.value as VisionType | 'all' | undefined;

  const t = userId
    ? await createUserTranslator(env.KV, userId, interaction.locale)
    : createTranslator(discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en');
  const theme = userId ? (await getUserPreferences(env.KV, userId)).theme : undefined;

  if (dyeInputs.length === 0) {
    return Response.json({
      type: 4,
      data: { embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))], flags: 64 },
    });
  }

  // Resolve all dye inputs → AccessibilityDye[]
  const resolvedDyes: AccessibilityDye[] = [];
  for (const input of dyeInputs) {
    const resolved = resolveColorInput(input.value, { excludeFacewear: true, findClosestForHex: true });
    if (!resolved) {
      return Response.json({
        type: 4,
        data: {
          embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: input.value }))],
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
  // The chip prints the command the user actually typed (/a11y is a second
  // registration sharing this handler)
  const commandLabel = interaction.data?.name === 'a11y' ? '/A11Y' : '/ACCESSIBILITY';
  const deferResponse = deferredResponse();
  ctx.waitUntil(
    processAccessibilityCommand(interaction, env, resolvedDyes, visionFilter, locale, commandLabel, theme, logger)
  );
  return deferResponse;
}

async function processAccessibilityCommand(
  interaction: DiscordInteraction,
  env: Env,
  dyes: AccessibilityDye[],
  visionFilter: VisionType | 'all' | undefined,
  locale: LocaleCode,
  commandLabel: string,
  theme?: 'dark' | 'light',
  logger?: ExtendedLogger
): Promise<void> {
  const t = createTranslator(locale);
  await initializeLocale(locale);

  // The vision: option routes the frame — named lens → 13D, all/absent → 13E,
  // a single dye → 13H
  const result = await executeAccessibility({ dyes, vision: visionFilter, locale, commandLabel, theme });

  if (!result.ok) {
    if (logger) logger.error('Accessibility command failed');
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [{
        title: result.embed.title,
        description: result.embed.description,
        color: result.embed.color,
        image: { url: 'attachment://accessibility.png' },
      }],
      file: { name: 'accessibility.png', data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    if (logger) logger.error('Accessibility render error', error instanceof Error ? error : undefined);
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}
