/**
 * /match_image Command Handler
 *
 * Extracts dominant colors from an uploaded image and matches
 * each color to the closest FFXIV dye.
 *
 * Features:
 * - 1-5 color extraction using K-means clustering
 * - Quality indicators (PERFECT/EXCELLENT/GOOD/FAIR/APPROX)
 * - Visual palette grid showing extracted vs matched colors
 * - Dominance percentages for each color
 */

import {
  PaletteService,
  type PaletteMatch,
} from '@xivdyetools/core';
import { dyeService } from '../../utils/color.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed } from '../../utils/response.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { generatePaletteGrid, type PaletteEntry, type PaletteGridLabels } from '@xivdyetools/svg';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { validateAndFetchImage, processImageForExtraction } from '../../services/image/index.js';
import { getMatchQuality } from '../../types/image.js';
import { createTranslator, createUserTranslator, type Translator } from '../../services/bot-i18n.js';
import { discordLocaleToLocaleCode, initializeLocale, getLocalizedDyeName, type LocaleCode } from '../../services/i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Service Initialization
// ============================================================================

const paletteService = new PaletteService();

// ============================================================================
// Constants
// ============================================================================

/** Minimum colors to extract */
const MIN_COLORS = 1;

/** Maximum colors to extract */
const MAX_COLORS = 5;

/** Default number of colors */
const DEFAULT_COLORS = 1;

// ============================================================================
// Command Handler
// ============================================================================

/**
 * Handles the /match_image command
 */
export async function handleMatchImageCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  // Extract options
  const options = interaction.data?.options || [];
  const attachments = interaction.data?.resolved?.attachments || {};

  // Get the image attachment option
  const imageOption = options.find((opt) => opt.name === 'image');
  const colorsOption = options.find((opt) => opt.name === 'colors');

  // Get translator for validation errors (before deferring)
  const t = userId
    ? await createUserTranslator(env.KV, userId, interaction.locale)
    : createTranslator(discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en');

  // Validate image attachment
  if (!imageOption?.value) {
    return Response.json({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        embeds: [errorEmbed(t.t('common.error'), t.t('matchImage.missingImage'))],
        flags: 64, // Ephemeral
      },
    });
  }

  // Get attachment data from resolved
  const attachmentId = imageOption.value as string;
  const attachment = attachments[attachmentId];

  if (!attachment) {
    return Response.json({
      type: 4,
      data: {
        embeds: [errorEmbed(t.t('common.error'), t.t('matchImage.invalidAttachment'))],
        flags: 64,
      },
    });
  }

  // Validate color count
  let colorCount = DEFAULT_COLORS;
  if (colorsOption?.value !== undefined) {
    colorCount = Math.max(MIN_COLORS, Math.min(MAX_COLORS, Number(colorsOption.value)));
  }

  // Resolve locale for background processing
  // Use translator's resolved locale instead of calling resolveUserLocale again
  const locale = t.getLocale();

  // Defer the response (image processing takes time)
  const deferResponse = deferredResponse();

  // Process in background
  ctx.waitUntil(processMatchImageCommand(interaction, env, attachment.url, colorCount, locale, logger));

  return deferResponse;
}

/**
 * Background processing for match_image command
 */
async function processMatchImageCommand(
  interaction: DiscordInteraction,
  env: Env,
  imageUrl: string,
  colorCount: number,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  const t = createTranslator(locale);

  // Initialize xivdyetools-core localization for dye names
  await initializeLocale(locale);

  try {
    // Step 1: Validate and fetch image
    const { buffer } = await validateAndFetchImage(imageUrl);

    // Step 2: Process image to extract pixels
    const processed = await processImageForExtraction(buffer);

    // Step 3: Convert pixels to RGB array (filtering transparent pixels)
    const rgbPixels = PaletteService.pixelDataToRGBFiltered(
      processed.pixels as unknown as Uint8ClampedArray,
      128 // Alpha threshold
    );

    if (rgbPixels.length === 0) {
      await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('matchImage.noColors')),
        ],
      });
      return;
    }

    // Step 4: Extract and match palette
    const matches = paletteService.extractAndMatchPalette(rgbPixels, dyeService, {
      colorCount,
      maxIterations: 25,
      maxSamples: 10000,
    });

    if (matches.length === 0) {
      await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('matchImage.extractionFailed')),
        ],
      });
      return;
    }

    // Step 5: Convert to PaletteEntry format with localized names
    const entries: PaletteEntry[] = matches.map((match: PaletteMatch) => ({
      extracted: match.extracted,
      matchedDye: {
        ...match.matchedDye,
        name: getLocalizedDyeName(match.matchedDye.itemID, match.matchedDye.name, locale),
      },
      distance: match.distance,
      dominance: match.dominance,
    }));

    // Step 6: Build localized labels for SVG
    const paletteLabels: PaletteGridLabels = {
      extracted: t.t('paletteGrid.extracted'),
      matchedDye: t.t('paletteGrid.matchedDye'),
      ofImage: t.t('paletteGrid.ofImage'),
      noColors: t.t('paletteGrid.noColors'),
      quality: {
        perfect: t.t('paletteGrid.quality.perfect'),
        excellent: t.t('paletteGrid.quality.excellent'),
        good: t.t('paletteGrid.quality.good'),
        fair: t.t('paletteGrid.quality.fair'),
        approximate: t.t('paletteGrid.quality.approximate'),
      },
    };

    // Step 7: Generate SVG
    const svg = generatePaletteGrid({
      entries,
      title: colorCount === 1 ? t.t('matchImage.colorMatch') : t.t('matchImage.colorPalette', { count: colorCount }),
      labels: paletteLabels,
    });

    // Step 8: Render to PNG
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

    // Step 9: Build description
    const description = buildMatchDescription(matches, t);

    // Step 10: Send response
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: colorCount === 1 ? t.t('matchImage.closestMatch') : t.t('matchImage.topMatches', { count: matches.length }),
          description,
          color: parseInt(matches[0].matchedDye.hex.replace('#', ''), 16),
          image: { url: 'attachment://image.png' },
          footer: {
            text: `${t.t('common.footer')} • ${t.t('matchImage.extractionMethod')}`,
          },
        },
      ],
      file: {
        name: 'match-image.png',
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
  } catch (error) {
    if (logger) {
      logger.error('Match image command error', error instanceof Error ? error : undefined);
    }

    // Determine error message
    let errorMessage = t.t('matchImage.processingFailed');
    if (error instanceof Error) {
      // Use specific error messages for known issues
      if (error.message.includes('SSRF') || error.message.includes('Discord CDN')) {
        errorMessage = t.t('matchImage.onlyDiscord');
      } else if (error.message.includes('too large')) {
        errorMessage = t.t('matchImage.imageTooLarge');
      } else if (error.message.includes('format')) {
        errorMessage = t.t('matchImage.unsupportedFormat');
      } else if (error.message.includes('timeout')) {
        errorMessage = t.t('matchImage.timeout');
      }
    }

    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), errorMessage)],
    });
  }
}

/**
 * Build description text for matches
 */
function buildMatchDescription(matches: PaletteMatch[], t: Translator): string {
  const lines = matches.map((match, i) => {
    const emoji = getDyeEmoji(match.matchedDye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const quality = getMatchQuality(match.distance);
    // Use localized quality labels
    const qualityLabel = t.t(`quality.${quality.shortLabel.toLowerCase()}`);
    const qualityBadge = `[${qualityLabel.toUpperCase()}]`;
    // Use localized dye name
    const localizedName = getLocalizedDyeName(match.matchedDye.itemID, match.matchedDye.name, t.getLocale());

    // Format: **1.** 🎨 Dalamud Red (#AA1111) [EXCELLENT] - 42%
    return (
      `**${i + 1}.** ${emojiPrefix}**${localizedName}** ` +
      `(\`${match.matchedDye.hex.toUpperCase()}\`) ${qualityBadge} - ${match.dominance}%`
    );
  });

  return lines.join('\n');
}
