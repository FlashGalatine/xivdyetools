/**
 * /comparison Command Handler
 *
 * Compares 2-4 FFXIV dyes side-by-side, showing color values,
 * distances, and contrast ratios.
 */

import type { Dye } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed } from '../../utils/response.js';
// DISCORD-REF-001 FIX: Import from centralized color utilities
import { resolveColorInput as resolveColor } from '../../utils/color.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { generateComparisonGrid } from '../../services/svg/comparison-grid.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createUserTranslator, createTranslator, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, type LocaleCode } from '../../services/i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

/**
 * Resolves color input to a dye
 * DISCORD-REF-001 FIX: Uses shared color utilities with findClosestForHex option
 */
function resolveColorInput(input: string): Dye | null {
  const resolved = resolveColor(input, { excludeFacewear: true, findClosestForHex: true });
  return resolved?.dye ?? null;
}

/**
 * Handles the /comparison command
 */
export async function handleComparisonCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Extract options
  const options = interaction.data?.options || [];
  const dye1Input = options.find((opt) => opt.name === 'dye1')?.value as string | undefined;
  const dye2Input = options.find((opt) => opt.name === 'dye2')?.value as string | undefined;
  const dye3Input = options.find((opt) => opt.name === 'dye3')?.value as string | undefined;
  const dye4Input = options.find((opt) => opt.name === 'dye4')?.value as string | undefined;

  // Validate required inputs
  if (!dye1Input || !dye2Input) {
    return Response.json({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
        flags: 64, // Ephemeral
      },
    });
  }

  // Resolve all dye inputs
  const resolvedDyes: Array<{ input: string; dye: Dye | null }> = [
    { input: dye1Input, dye: resolveColorInput(dye1Input) },
    { input: dye2Input, dye: resolveColorInput(dye2Input) },
  ];

  if (dye3Input) {
    resolvedDyes.push({ input: dye3Input, dye: resolveColorInput(dye3Input) });
  }
  if (dye4Input) {
    resolvedDyes.push({ input: dye4Input, dye: resolveColorInput(dye4Input) });
  }

  // Check for any resolution failures
  const failures = resolvedDyes.filter((r) => r.dye === null);
  if (failures.length > 0) {
    const failedInputs = failures.map((f) => `"${f.input}"`).join(', ');
    return Response.json({
      type: 4,
      data: {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: failedInputs })),
        ],
        flags: 64,
      },
    });
  }

  // Extract valid dyes (we know they're all non-null now)
  const dyes = resolvedDyes.map((r) => r.dye as Dye);

  // Defer the response (image generation takes time)
  const deferResponse = deferredResponse();

  // Use translator's resolved locale instead of calling resolveUserLocale again
  const locale = t.getLocale();

  // Process in background
  ctx.waitUntil(processComparisonCommand(interaction, env, dyes, locale, logger));

  return deferResponse;
}

/**
 * Background processing for comparison command
 */
async function processComparisonCommand(
  interaction: DiscordInteraction,
  env: Env,
  dyes: Dye[],
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  const t = createTranslator(locale);

  // Initialize xivdyetools-core localization for dye names
  await initializeLocale(locale);

  try {
    // Build dyes with localized names for SVG
    const dyesWithLocalizedNames = dyes.map((dye) => ({
      ...dye,
      name: getLocalizedDyeName(dye.itemID, dye.name, locale),
    }));

    // Generate SVG with localized names
    const svg = generateComparisonGrid({
      dyes: dyesWithLocalizedNames,
      width: 800,
      showHsv: true,
    });

    // Render to PNG
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

    // Build description with dye list and emojis (using localized names)
    const dyeList = dyes
      .map((dye, i) => {
        const emoji = getDyeEmoji(dye.id);
        const emojiPrefix = emoji ? `${emoji} ` : '';
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${emojiPrefix}${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    // Calculate the embed color from the first dye
    const embedColor = parseInt(dyes[0].hex.replace('#', ''), 16);

    // Send follow-up with image
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: `${t.t('comparison.title')} (${dyes.length})`,
          description: dyeList,
          color: embedColor,
          image: { url: 'attachment://image.png' },
          footer: {
            text: t.t('common.footer'),
          },
        },
      ],
      file: {
        name: 'comparison.png',
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
  } catch (error) {
    if (logger) {
      logger.error('Comparison command error', error instanceof Error ? error : undefined);
    }

    // Send error response
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.generationFailed')),
      ],
    });
  }
}
