/**
 * /comparison Command Handler (Adapter)
 *
 * Thin adapter: extracts Discord options, delegates to executeComparison(),
 * renders the PNG, and formats the Discord response with emojis.
 */

import type { Dye } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed } from '../../utils/response.js';
import { resolveColorInput as resolveColor } from '../../utils/color.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createUserTranslator, createTranslator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, type LocaleCode } from '../../services/i18n.js';
import { executeComparison } from '@xivdyetools/bot-logic';
import type { Env, DiscordInteraction } from '../../types/env.js';

function resolveColorInput(input: string): Dye | null {
  const resolved = resolveColor(input, { excludeFacewear: true, findClosestForHex: true });
  return resolved?.dye ?? null;
}

export async function handleComparisonCommand(
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
  const dye3Input = options.find((opt) => opt.name === 'dye3')?.value as string | undefined;
  const dye4Input = options.find((opt) => opt.name === 'dye4')?.value as string | undefined;

  if (!dye1Input || !dye2Input) {
    return Response.json({
      type: 4,
      data: { embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))], flags: 64 },
    });
  }

  const resolvedDyes: Array<{ input: string; dye: Dye | null }> = [
    { input: dye1Input, dye: resolveColorInput(dye1Input) },
    { input: dye2Input, dye: resolveColorInput(dye2Input) },
  ];
  if (dye3Input) resolvedDyes.push({ input: dye3Input, dye: resolveColorInput(dye3Input) });
  if (dye4Input) resolvedDyes.push({ input: dye4Input, dye: resolveColorInput(dye4Input) });

  const failures = resolvedDyes.filter((r) => r.dye === null);
  if (failures.length > 0) {
    const failedInputs = failures.map((f) => `"${f.input}"`).join(', ');
    return Response.json({
      type: 4,
      data: {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: failedInputs }))],
        flags: 64,
      },
    });
  }

  const dyes = resolvedDyes.map((r) => r.dye as Dye);
  const locale = t.getLocale();
  const deferResponse = deferredResponse();
  ctx.waitUntil(processComparisonCommand(interaction, env, dyes, locale, logger));
  return deferResponse;
}

async function processComparisonCommand(
  interaction: DiscordInteraction,
  env: Env,
  dyes: Dye[],
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  const t = createTranslator(locale);
  await initializeLocale(locale);

  const result = await executeComparison({ dyes, locale });

  if (!result.ok) {
    if (logger) logger.error('Comparison command failed');
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
    return;
  }

  try {
    const pngBuffer = await renderSvgToPng(result.svgString, { scale: 2 });

    // Build Discord embed description with platform-specific emojis
    const dyeList = dyes
      .map((dye, i) => {
        const emoji = getDyeEmoji(dye.id);
        const emojiPrefix = emoji ? `${emoji} ` : '';
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${emojiPrefix}${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [{
        title: result.embed.title,
        description: dyeList,
        color: result.embed.color,
        image: { url: 'attachment://image.png' },
        footer: { text: result.embed.footer ?? t.t('common.footer') },
      }],
      file: { name: 'comparison.png', data: pngBuffer, contentType: 'image/png' },
    });
  } catch (error) {
    if (logger) logger.error('Comparison render error', error instanceof Error ? error : undefined);
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.generationFailed'))],
    });
  }
}
