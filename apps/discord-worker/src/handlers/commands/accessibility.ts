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
import { editOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createTranslator, createUserTranslator } from '../../services/bot-i18n.js';
import { discordLocaleToLocaleCode, initializeLocale, type LocaleCode } from '../../services/i18n.js';
import {
  executeAccessibility,
  type VisionType,
  type AccessibilityDye,
} from '@xivdyetools/bot-logic';
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
  const visionFilter = visionOption?.value as VisionType | undefined;

  const t = userId
    ? await createUserTranslator(env.KV, userId, interaction.locale)
    : createTranslator(discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en');

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
  const deferResponse = deferredResponse();
  ctx.waitUntil(
    processAccessibilityCommand(interaction, env, resolvedDyes, visionFilter, locale, logger)
  );
  return deferResponse;
}

async function processAccessibilityCommand(
  interaction: DiscordInteraction,
  env: Env,
  dyes: AccessibilityDye[],
  visionFilter: VisionType | undefined,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  const t = createTranslator(locale);
  await initializeLocale(locale);

  const visionTypes = visionFilter ? [visionFilter] : undefined;
  const result = await executeAccessibility({ dyes, visionTypes, locale });

  if (!result.ok) {
    if (logger) logger.error('Accessibility command failed');
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });
    const filename = result.mode === 'simulation' ? 'accessibility.png' : 'contrast-matrix.png';

    // Build Discord embed description with emojis (for single-dye mode, add emoji prefix)
    let description = result.embed.description ?? '';
    if (result.mode === 'simulation' && dyes[0]?.dye) {
      const emoji = getDyeEmoji(dyes[0].dye.id);
      if (emoji) description = description.replace(/^\*\*/, `${emoji} **`);
    } else if (result.mode === 'contrast') {
      // Add emojis to the dye list lines in contrast mode
      const lines = description.split('\n');
      description = lines.map((line) => {
        const dyeMatch = dyes.find((d) => d.dye && line.includes(d.name));
        if (dyeMatch?.dye) {
          const emoji = getDyeEmoji(dyeMatch.dye.id);
          return emoji ? line.replace(dyeMatch.name, `${emoji} ${dyeMatch.name}`) : line;
        }
        return line;
      }).join('\n');
    }

    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [{
        title: result.embed.title,
        description,
        color: result.embed.color,
        image: { url: 'attachment://image.png' },
        footer: { text: result.embed.footer ?? t.t('common.footer') },
      }],
      file: { name: filename, data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    if (logger) logger.error('Accessibility render error', error instanceof Error ? error : undefined);
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}
