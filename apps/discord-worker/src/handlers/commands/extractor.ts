/**
 * /extractor Command Handler (V4)
 *
 * Unified command for extracting/matching colors to FFXIV dyes.
 *
 * Subcommands:
 * - color: Find closest dye(s) to a hex color or dye name
 * - image: Extract colors from an image and match to dyes
 *
 * Replaces: /match, /match_image (v2.x)
 *
 * @module handlers/commands/extractor
 */

import {
  ColorService,
  PaletteService,
  type Dye,
  type PaletteMatch,
} from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  messageResponse,
  deferredResponse,
  errorEmbed,
  hexToDiscordColor,
} from '../../utils/response.js';
import { resolveColorInput as resolveColor, dyeService } from '../../utils/color.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createCopyButtons } from '../buttons/index.js';
import {
  createTranslator,
  createUserTranslator,
  type Translator,
} from '../../services/bot-i18n.js';
import {
  discordLocaleToLocaleCode,
  initializeLocale,
  getLocalizedDyeName,
  type LocaleCode,
} from '../../services/i18n.js';
import { generatePaletteGrid, type PaletteEntry, type PaletteGridLabels } from '@xivdyetools/svg';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { validateAndFetchImage, processImageForExtraction } from '../../services/image/index.js';
import { getMatchQuality as getImageMatchQuality } from '../../types/image.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Service Initialization
// ============================================================================

const paletteService = new PaletteService();

// ============================================================================
// Constants
// ============================================================================

/** Minimum colors to extract from image */
const MIN_COLORS = 1;

/** Maximum colors to extract from image */
const MAX_COLORS = 5;

/** Default number of colors for image extraction */
const DEFAULT_IMAGE_COLORS = 1;

/** Minimum match count for color subcommand */
const MIN_MATCH_COUNT = 1;

/** Maximum match count for color subcommand */
const MAX_MATCH_COUNT = 10;

// ============================================================================
// Shared Utilities
// ============================================================================

/**
 * Resolves color input to a hex value
 */
function resolveColorInput(input: string): { hex: string; fromDye?: Dye } | null {
  const resolved = resolveColor(input, { excludeFacewear: true });
  if (!resolved) return null;
  return { hex: resolved.hex, fromDye: resolved.dye };
}

/**
 * Calculates Euclidean distance between two hex colors
 */
function getColorDistance(hex1: string, hex2: string): number {
  const rgb1 = ColorService.hexToRgb(hex1);
  const rgb2 = ColorService.hexToRgb(hex2);

  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

/**
 * Gets match quality emoji and label based on color distance
 */
function getMatchQuality(distance: number, t: Translator): { emoji: string; label: string } {
  if (distance === 0) return { emoji: '🎯', label: t.t('quality.perfect') };
  if (distance < 10) return { emoji: '✨', label: t.t('quality.excellent') };
  if (distance < 25) return { emoji: '👍', label: t.t('quality.good') };
  if (distance < 50) return { emoji: '⚠️', label: t.t('quality.fair') };
  return { emoji: '🔍', label: t.t('quality.approximate') };
}

/**
 * Formats RGB values for display
 */
function formatRgb(hex: string): string {
  const rgb = ColorService.hexToRgb(hex);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Formats HSV values for display
 */
function formatHsv(hex: string): string {
  const rgb = ColorService.hexToRgb(hex);
  const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
  return `${Math.round(hsv.h)}°, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%`;
}

/**
 * Finds closest dye excluding Facewear category
 */
function findClosestDyeExcludingFacewear(
  targetHex: string,
  excludeIds: number[] = [],
  maxAttempts = 20
): Dye | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = dyeService.findClosestDye(targetHex, excludeIds);
    if (!candidate) break;

    if (candidate.category !== 'Facewear') {
      return candidate;
    }
    excludeIds.push(candidate.id);
  }
  return null;
}

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /extractor command
 *
 * Routes to appropriate subcommand handler based on interaction data.
 */
export async function handleExtractorCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  // Get subcommand from options
  const options = interaction.data?.options || [];
  const subcommandOption = options[0];

  if (!subcommandOption) {
    return messageResponse({
      embeds: [errorEmbed('Error', 'No subcommand provided')],
      flags: 64,
    });
  }

  const subcommand = subcommandOption.name;

  switch (subcommand) {
    case 'color':
      return handleColorSubcommand(interaction, env, ctx, subcommandOption.options || []);

    case 'image':
      return handleImageSubcommand(interaction, env, ctx, subcommandOption.options || [], logger);

    default:
      return messageResponse({
        embeds: [errorEmbed('Error', `Unknown subcommand: ${subcommand}`)],
        flags: 64,
      });
  }
}

// ============================================================================
// Color Subcommand (formerly /match)
// ============================================================================

/**
 * Handles /extractor color subcommand
 *
 * Finds the closest FFXIV dye(s) to a given color input.
 */
async function handleColorSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  _ctx: ExecutionContext,
  options: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Initialize localization for dye names
  const locale = t.getLocale();
  await initializeLocale(locale);

  // Extract options
  const colorOption = options.find((opt) => opt.name === 'color');
  const countOption = options.find((opt) => opt.name === 'count');
  // TODO: matching and market options for v4 enhancements

  const colorInput = colorOption?.value as string | undefined;
  const matchCount = Math.min(
    Math.max((countOption?.value as number) || 1, MIN_MATCH_COUNT),
    MAX_MATCH_COUNT
  );

  // Validate required input
  if (!colorInput) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
      flags: 64,
    });
  }

  // Resolve the color input
  const resolved = resolveColorInput(colorInput);
  if (!resolved) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: colorInput })),
      ],
      flags: 64,
    });
  }

  const targetHex = resolved.hex;

  // Find closest dye(s)
  const matches: Array<{ dye: Dye; distance: number }> = [];
  const excludeIds: number[] = [];

  for (let i = 0; i < matchCount; i++) {
    const closestDye = findClosestDyeExcludingFacewear(targetHex, [...excludeIds]);

    if (closestDye) {
      const distance = getColorDistance(targetHex, closestDye.hex);
      matches.push({ dye: closestDye, distance });
      excludeIds.push(closestDye.id);
    }
  }

  if (matches.length === 0) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.noMatchFound')),
      ],
      flags: 64,
    });
  }

  // Build response based on single or multiple matches
  if (matchCount === 1) {
    return buildSingleMatchResponse(targetHex, matches[0], t, resolved.fromDye);
  } else {
    return buildMultiMatchResponse(targetHex, matches, t, resolved.fromDye);
  }
}

/**
 * Builds response for a single match
 */
function buildSingleMatchResponse(
  targetHex: string,
  match: { dye: Dye; distance: number },
  t: Translator,
  fromDye?: Dye
): Response {
  const { dye, distance } = match;
  const quality = getMatchQuality(distance, t);
  const emoji = getDyeEmoji(dye.id);
  const emojiPrefix = emoji ? `${emoji} ` : '';

  // Build input color description
  let inputDesc = `**Hex:** \`${targetHex.toUpperCase()}\`\n`;
  inputDesc += `**${t.t('common.rgb')}:** \`${formatRgb(targetHex)}\`\n`;
  inputDesc += `**${t.t('common.hsv')}:** \`${formatHsv(targetHex)}\``;

  if (fromDye) {
    const fromEmoji = getDyeEmoji(fromDye.id);
    const fromEmojiPrefix = fromEmoji ? `${fromEmoji} ` : '';
    const fromDyeName = getLocalizedDyeName(fromDye.itemID, fromDye.name, t.getLocale());
    inputDesc = `${fromEmojiPrefix}**${fromDyeName}**\n${inputDesc}`;
  }

  // Build match description with localized dye name
  const localizedDyeName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());
  let matchDesc = `${emojiPrefix}**${localizedDyeName}**\n`;
  matchDesc += `**Hex:** \`${dye.hex.toUpperCase()}\`\n`;
  matchDesc += `**${t.t('common.rgb')}:** \`${formatRgb(dye.hex)}\`\n`;
  matchDesc += `**${t.t('common.hsv')}:** \`${formatHsv(dye.hex)}\`\n`;
  matchDesc += `**${t.t('common.category')}:** ${dye.category}`;

  // Create copy buttons for the matched dye
  const rgb = ColorService.hexToRgb(dye.hex);
  const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
  const copyButtons = createCopyButtons(
    dye.hex,
    rgb,
    { h: Math.round(hsv.h), s: Math.round(hsv.s), v: Math.round(hsv.v) }
  );

  return messageResponse({
    embeds: [
      {
        title: `${quality.emoji} ${t.t('extractor.title', { name: localizedDyeName })}`,
        color: hexToDiscordColor(dye.hex),
        fields: [
          {
            name: `🎨 ${t.t('common.inputColor')}`,
            value: inputDesc,
            inline: true,
          },
          {
            name: `🧪 ${t.t('common.closestDye')}`,
            value: matchDesc,
            inline: true,
          },
          {
            name: `📊 ${t.t('common.matchQuality')}`,
            value: `**${t.t('common.distance')}:** ${distance.toFixed(2)}\n**${t.t('common.quality')}:** ${quality.label}`,
            inline: true,
          },
        ],
        footer: {
          text: `${t.t('common.footer')} • ${t.t('extractor.useInfoHint')}`,
        },
      },
    ],
    components: [copyButtons],
  });
}

/**
 * Builds response for multiple matches
 */
function buildMultiMatchResponse(
  targetHex: string,
  matches: Array<{ dye: Dye; distance: number }>,
  t: Translator,
  fromDye?: Dye
): Response {
  // Build input description with localized name
  const fromDyeName = fromDye ? getLocalizedDyeName(fromDye.itemID, fromDye.name, t.getLocale()) : null;
  const inputText = fromDyeName
    ? `**${fromDyeName}** (\`${targetHex.toUpperCase()}\`)`
    : `\`${targetHex.toUpperCase()}\``;

  // Build matches list with localized names
  const matchLines = matches.map((match, i) => {
    const { dye, distance } = match;
    const quality = getMatchQuality(distance, t);
    const emoji = getDyeEmoji(dye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const localizedName = getLocalizedDyeName(dye.itemID, dye.name, t.getLocale());

    return `**${i + 1}.** ${emojiPrefix}**${localizedName}** • \`${dye.hex.toUpperCase()}\` • ${quality.emoji} ${quality.label} (Δ ${distance.toFixed(1)})`;
  }).join('\n');

  return messageResponse({
    embeds: [
      {
        title: `🎨 ${t.t('extractor.topMatches', { count: matches.length })}`,
        description: `${t.t('extractor.findingMatches', { input: inputText })}\n\n${matchLines}`,
        color: hexToDiscordColor(matches[0].dye.hex),
        footer: {
          text: `${t.t('common.footer')} • ${t.t('extractor.useInfoNameHint')}`,
        },
      },
    ],
  });
}

// ============================================================================
// Image Subcommand (formerly /match_image)
// ============================================================================

/**
 * Handles /extractor image subcommand
 *
 * Extracts dominant colors from an uploaded image and matches to dyes.
 */
async function handleImageSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  options: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
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
  let colorCount = DEFAULT_IMAGE_COLORS;
  if (colorsOption?.value !== undefined) {
    colorCount = Math.max(MIN_COLORS, Math.min(MAX_COLORS, Number(colorsOption.value)));
  }

  // Resolve locale for background processing
  const locale = t.getLocale();

  // Defer the response (image processing takes time)
  const deferResponse = deferredResponse();

  // Process in background
  ctx.waitUntil(
    processImageExtraction(interaction, env, attachment.url, colorCount, locale, logger)
  );

  return deferResponse;
}

/**
 * Background processing for image extraction
 */
async function processImageExtraction(
  interaction: DiscordInteraction,
  env: Env,
  imageUrl: string,
  colorCount: number,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  const t = createTranslator(locale);

  // Initialize localization for dye names
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
      title: colorCount === 1
        ? t.t('matchImage.colorMatch')
        : t.t('matchImage.colorPalette', { count: colorCount }),
      labels: paletteLabels,
    });

    // Step 8: Render to PNG
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

    // Step 9: Build description
    const description = buildImageMatchDescription(matches, t);

    // Step 10: Send response
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: colorCount === 1
            ? t.t('matchImage.closestMatch')
            : t.t('matchImage.topMatches', { count: matches.length }),
          description,
          color: parseInt(matches[0].matchedDye.hex.replace('#', ''), 16),
          image: { url: 'attachment://image.png' },
          footer: {
            text: `${t.t('common.footer')} • ${t.t('matchImage.extractionMethod')}`,
          },
        },
      ],
      file: {
        name: 'extractor-image.png',
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
  } catch (error) {
    if (logger) {
      logger.error('Extractor image command error', error instanceof Error ? error : undefined);
    }

    // Determine error message
    let errorMessage = t.t('matchImage.processingFailed');
    if (error instanceof Error) {
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
 * Build description text for image matches
 */
function buildImageMatchDescription(matches: PaletteMatch[], t: Translator): string {
  const lines = matches.map((match, i) => {
    const emoji = getDyeEmoji(match.matchedDye.id);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const quality = getImageMatchQuality(match.distance);
    const qualityLabel = t.t(`quality.${quality.shortLabel.toLowerCase()}`);
    const qualityBadge = `[${qualityLabel.toUpperCase()}]`;
    const localizedName = getLocalizedDyeName(match.matchedDye.itemID, match.matchedDye.name, t.getLocale());

    return (
      `**${i + 1}.** ${emojiPrefix}**${localizedName}** ` +
      `(\`${match.matchedDye.hex.toUpperCase()}\`) ${qualityBadge} - ${match.dominance}%`
    );
  });

  return lines.join('\n');
}
