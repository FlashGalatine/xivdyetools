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
  type PaletteMatch,
} from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  messageResponse,
  deferredResponse,
  errorEmbed,
  hexToDiscordColor,
} from '../../utils/response.js';
import { resolveColorInput as resolveColor, dyeService } from '../../utils/color.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { createCopyButtons } from '../buttons/index.js';
import {
  createTranslator,
  createUserTranslator,
  createUserTranslatorWithPrefs,
  type Translator,
} from '../../services/bot-i18n.js';
import {
  discordLocaleToLocaleCode,
  initializeLocale,
  getLocalizedDyeName,
  type LocaleCode,
} from '../../services/i18n.js';
import { generatePaletteGrid, generateNearestSheet } from '@xivdyetools/svg';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { validateAndFetchImage, processImageForExtraction } from '../../services/image/index.js';
import { getUserPreferences } from '../../services/preferences.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// ============================================================================
// Service Initialization
// ============================================================================

const paletteService = new PaletteService();

// ============================================================================
// Constants
// ============================================================================

/** Minimum colors to extract from image (matches web-app ExtractorConfig) */
const MIN_COLORS = 3;

/** Maximum colors to extract from image (matches web-app ExtractorConfig) */
const MAX_COLORS = 10;

/** Default number of colors for image extraction (matches web-app default) */
const DEFAULT_IMAGE_COLORS = 4;

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
 * Deduplicates palette matches so each slot shows a unique dye.
 *
 * When multiple extracted colors map to the same dye (common with monochromatic
 * images), later slots are reassigned to the next-best unique alternative using
 * a ranked distance search.
 */
function deduplicatePaletteResults(matches: PaletteMatch[]): PaletteMatch[] {
  if (matches.length <= 1) return matches;

  const usedDyeIds = new Set<number>();
  const dedupedMatches: PaletteMatch[] = [];

  for (const match of matches) {
    if (!usedDyeIds.has(match.matchedDye.itemID)) {
      usedDyeIds.add(match.matchedDye.itemID);
      dedupedMatches.push(match);
    } else {
      // Duplicate — find the next-best unique dye for this extracted color
      const hex = ColorService.rgbToHex(match.extracted.r, match.extracted.g, match.extracted.b);
      const candidates = dyeService.findDyesWithinDistance(hex, {
        maxDistance: 200,
        limit: 20,
      });

      const alternative = candidates.find((dye) => !usedDyeIds.has(dye.itemID));
      if (alternative) {
        const distance = ColorService.getColorDistance(hex, alternative.hex);
        usedDyeIds.add(alternative.itemID);
        dedupedMatches.push({
          extracted: match.extracted,
          matchedDye: alternative,
          distance,
          dominance: match.dominance,
        });
      } else {
        // No unique alternative found — keep the duplicate as last resort
        usedDyeIds.add(match.matchedDye.itemID);
        dedupedMatches.push(match);
      }
    }
  }

  return dedupedMatches;
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
  ctx: ExecutionContext,
  options: Array<{ name: string; value?: string | number | boolean }>
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const { t, prefs } = await createUserTranslatorWithPrefs(env.KV, userId, interaction.locale);
  const theme = prefs.theme;

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

  // 14J·2: ranking is ΔE2000 over the whole non-Facewear pool — the shipped
  // raw-RGB order could differ, so this changes the answer, not just the
  // picture.
  const matches = dyeService
    .getAllDyes()
    .filter((d) => d.category !== 'Facewear')
    .map((dye) => ({
      dye,
      distance: ColorService.getDistanceForMethod(targetHex, dye.hex, 'ciede2000'),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, matchCount);

  if (matches.length === 0) {
    return messageResponse({
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.noMatchFound')),
      ],
      flags: 64,
    });
  }

  // Defer — the card renders to PNG in the background
  ctx.waitUntil(
    renderColorSheet(interaction, env, targetHex, matches, t, theme, resolved.fromDye)
  );
  return deferredResponse();
}

/**
 * Background rendering for /extractor color (14J·2).
 * The card holds five rows; when more were asked for, the tail — the
 * FURTHEST matches — is listed in the message (the opposite of a
 * popularity-sorted list's tail).
 */
async function renderColorSheet(
  interaction: DiscordInteraction,
  env: Env,
  targetHex: string,
  matches: Array<{ dye: Dye; distance: number }>,
  t: Translator,
  theme?: 'dark' | 'light',
  fromDye?: Dye
): Promise<void> {
  const locale = t.getLocale();
  try {
    const targetText = fromDye
      ? getLocalizedDyeName(fromDye.itemID, fromDye.name, locale)
      : targetHex.toUpperCase();

    const svg = generateNearestSheet({
      targetHex,
      targetText,
      rows: matches.slice(0, 5).map((m, i) => ({
        rank: i + 1,
        hex: m.dye.hex,
        name: getLocalizedDyeName(m.dye.itemID, m.dye.name, locale),
        deltaE: m.distance,
      })),
      labels: {
        target: t.t('card.target'),
        rank: t.t('card.rank'),
        nearest: t.t('card.found'),
        matchKey: t.t('card.matchKey'),
      },
      lang: locale,
      theme,
    });
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

    // One-line embed; the tail (matches 6+) rides the message text
    const tail = matches.slice(5);
    const tailLines = tail
      .map((m, i) => {
        const name = getLocalizedDyeName(m.dye.itemID, m.dye.name, locale);
        return `**${i + 6}.** ${name} (\`${m.dye.hex.toUpperCase()}\`) · ${m.distance.toFixed(1)}`;
      })
      .join('\n');

    // Copy buttons stay for the single-match case
    const components =
      matches.length === 1
        ? (() => {
            const dye = matches[0].dye;
            const rgb = ColorService.hexToRgb(dye.hex);
            const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
            return [
              createCopyButtons(dye.hex, rgb, {
                h: Math.round(hsv.h),
                s: Math.round(hsv.s),
                v: Math.round(hsv.v),
              }),
            ];
          })()
        : undefined;

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: t.t('card.matchTitle'),
          description: tailLines || undefined,
          color: hexToDiscordColor(matches[0].dye.hex),
          image: { url: 'attachment://extractor-color.png' },
        },
      ],
      components,
      file: {
        name: 'extractor-color.png',
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
  } catch {
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), t.t('errors.noMatchFound'))],
    });
  }
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
  const theme = userId ? (await getUserPreferences(env.KV, userId)).theme : undefined;
  ctx.waitUntil(
    processImageExtraction(interaction, env, attachment.url, colorCount, locale, theme, logger)
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
  theme?: 'dark' | 'light',
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
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('matchImage.noColors')),
        ],
      });
      return;
    }

    // Step 4: Extract and match palette
    const rawMatches = paletteService.extractAndMatchPalette(rgbPixels, dyeService, {
      colorCount,
      maxIterations: 25,
      maxSamples: 10000,
    });

    // Step 4b: Deduplicate — ensure each slot shows a unique dye
    const matches = deduplicatePaletteResults(rawMatches);

    if (matches.length === 0) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('matchImage.extractionFailed')),
        ],
      });
      return;
    }

    // Step 5: 14K — the band carries ALL colours at their real share; the
    // list is a top five by share. ΔE2000 per row (extracted → matched).
    const sortedByShare = [...matches].sort((a, b) => b.dominance - a.dominance);
    const entryHex = (m: PaletteMatch) =>
      ColorService.rgbToHex(m.extracted.r, m.extracted.g, m.extracted.b);
    const band = sortedByShare.map((m) => ({ hex: entryHex(m), share: m.dominance }));
    const rows = sortedByShare.slice(0, 5).map((m) => ({
      share: m.dominance,
      extractedHex: entryHex(m),
      matchedHex: m.matchedDye.hex,
      matchedName: getLocalizedDyeName(m.matchedDye.itemID, m.matchedDye.name, locale),
      deltaE: ColorService.getDistanceForMethod(entryHex(m), m.matchedDye.hex, 'ciede2000'),
    }));

    // Step 6: Generate the card + render to PNG
    const svg = generatePaletteGrid({
      title: t.t('card.rampTitle'),
      band,
      rows,
      labels: {
        share: t.t('card.share'),
        matched: t.t('card.matched'),
        rampKey: t.t('card.rampKey'),
      },
      lang: locale,
      theme,
    });
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

    // Step 7: One-line embed — count as description, manual pointer where a
    // context-dependent actionable line belongs (never the PNG); the accent
    // bar takes the dominant extracted colour.
    const dominantHex = band[0]?.hex ?? matches[0].matchedDye.hex;
    const manualLine = `${t.t('card.manualLead')} \`/manual topic:📸\`${t.t('card.manualTail')}`;
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: t.t('card.rampTitle'),
          description: `${t.t('card.colours', { n: matches.length })}\n${manualLine}`,
          color: parseInt(dominantHex.replace('#', ''), 16),
          image: { url: 'attachment://extractor-image.png' },
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

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), errorMessage)],
    });
  }
}

