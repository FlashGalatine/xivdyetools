/**
 * /harmony Command Handler
 *
 * Generates color harmony visualizations for FFXIV dyes.
 * Accepts a color (hex or dye name) and harmony type, then
 * creates a visual wheel showing harmonious dye combinations.
 */

import type { Dye, HarmonyOptions, HarmonyColorSpace } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed } from '../../utils/response.js';
// DISCORD-REF-001 FIX: Import from centralized color utilities
import { resolveColorInput, dyeService } from '../../utils/color.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import { generateHarmonyWheel, type HarmonyDye } from '@xivdyetools/svg';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
import { createUserTranslator, createTranslator, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, type LocaleCode } from '../../services/i18n.js';
import type { Env, DiscordInteraction } from '../../types/env.js';

// Valid harmony types
const HARMONY_TYPES = [
  'triadic',
  'complementary',
  'analogous',
  'split-complementary',
  'tetradic',
  'square',
  'monochromatic',
] as const;

type HarmonyType = (typeof HARMONY_TYPES)[number];

/**
 * Gets harmony dyes based on the harmony type
 * Note: xivdyetools-core v1.3.6+ natively excludes Facewear dyes from all harmony functions
 */
function getHarmonyDyes(hex: string, type: HarmonyType, options?: HarmonyOptions): Dye[] {
  switch (type) {
    case 'triadic':
      return dyeService.findTriadicDyes(hex, options);
    case 'complementary': {
      const comp = dyeService.findComplementaryPair(hex, options);
      return comp ? [comp] : [];
    }
    case 'analogous':
      return dyeService.findAnalogousDyes(hex, 30, options);
    case 'split-complementary':
      return dyeService.findSplitComplementaryDyes(hex, options);
    case 'tetradic':
      return dyeService.findTetradicDyes(hex, options);
    case 'square':
      return dyeService.findSquareDyes(hex, options);
    case 'monochromatic':
      return dyeService.findMonochromaticDyes(hex, 5, options);
    default:
      return dyeService.findTriadicDyes(hex, options);
  }
}

/**
 * Handles the /harmony command
 */
export async function handleHarmonyCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  // Extract options
  const options = interaction.data?.options || [];
  const colorOption = options.find((opt) => opt.name === 'color');
  const typeOption = options.find((opt) => opt.name === 'type');
  const colorSpaceOption = options.find((opt) => opt.name === 'color_space');

  const colorInput = colorOption?.value as string | undefined;
  const harmonyType = (typeOption?.value as HarmonyType) || 'triadic';
  const colorSpace = (colorSpaceOption?.value as HarmonyColorSpace) || undefined;

  // Validate required color input
  if (!colorInput) {
    return Response.json({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
        flags: 64, // Ephemeral
      },
    });
  }

  // Resolve the color input
  // Note: harmony uses all dyes including Facewear since core harmony functions handle filtering
  const resolved = resolveColorInput(colorInput, { excludeFacewear: false });
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

  // Defer the response (image generation takes time)
  const deferResponse = deferredResponse();

  // Use translator's resolved locale instead of calling resolveUserLocale again
  const locale = t.getLocale();

  // Build harmony options if color space was specified
  const harmonyOptions: HarmonyOptions | undefined = colorSpace ? { colorSpace } : undefined;

  // Process in background
  ctx.waitUntil(
    processHarmonyCommand(interaction, env, resolved.hex, resolved.name, resolved.id, resolved.itemID ?? undefined, harmonyType, locale, logger, harmonyOptions)
  );

  return deferResponse;
}

/**
 * Background processing for harmony command
 */
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
  harmonyOptions?: HarmonyOptions
): Promise<void> {
  // Create translator for background processing
  const t = createTranslator(locale);

  // Initialize xivdyetools-core localization for dye names
  await initializeLocale(locale);

  try {
    // Get harmony dyes
    const harmonyDyes = getHarmonyDyes(baseHex, harmonyType, harmonyOptions);

    if (harmonyDyes.length === 0) {
      await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('errors.noMatchFound')),
        ],
      });
      return;
    }

    // Convert Dye[] to HarmonyDye[] with localized names
    const dyesForWheel: HarmonyDye[] = harmonyDyes.map((dye) => ({
      id: dye.id,
      name: getLocalizedDyeName(dye.itemID, dye.name, locale),
      hex: dye.hex,
      category: dye.category,
    }));

    // Generate SVG (400x400 matches 1.x style)
    const svg = generateHarmonyWheel({
      baseColor: baseHex,
      baseName: baseName || baseHex.toUpperCase(),
      harmonyType,
      dyes: dyesForWheel,
      width: 600,
      height: 600,
    });

    // Render to PNG
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

    // Build description text with emojis and localized names
    const dyeList = harmonyDyes
      .map((dye, i) => {
        const emoji = getDyeEmoji(dye.id);
        const emojiPrefix = emoji ? `${emoji} ` : '';
        const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
        return `**${i + 1}.** ${emojiPrefix}${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
      })
      .join('\n');

    // Build base color description with emoji if available
    const baseEmoji = baseId ? getDyeEmoji(baseId) : undefined;
    const baseEmojiPrefix = baseEmoji ? `${baseEmoji} ` : '';
    // Localize base name if it's a dye
    const localizedBaseName = baseItemID && baseName
      ? getLocalizedDyeName(baseItemID, baseName, locale)
      : (baseName || baseHex.toUpperCase());
    const baseColorText = `${t.t('harmony.baseColor')}: ${baseEmojiPrefix}**${localizedBaseName}** (\`${baseHex.toUpperCase()}\`)`;

    // Get localized harmony type
    const harmonyTitle = getLocalizedHarmonyType(harmonyType, t);

    // Send follow-up with image
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: t.t('harmony.title', { type: harmonyTitle }),
          description: `${baseColorText}\n\n${dyeList}`,
          color: parseInt(baseHex.replace('#', ''), 16),
          image: { url: 'attachment://image.png' },
          footer: {
            text: t.t('common.footer'),
          },
        },
      ],
      file: {
        name: `harmony-${harmonyType}.png`,
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
  } catch (error) {
    if (logger) {
      logger.error('Harmony command error', error instanceof Error ? error : undefined);
    }

    // Send error response
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        errorEmbed(
          t.t('common.error'),
          t.t('errors.generationFailed')
        ),
      ],
    });
  }
}

/**
 * Formats harmony type for display (English only - used for autocomplete)
 */
function formatHarmonyType(type: string): string {
  const formats: Record<string, string> = {
    complementary: 'Complementary',
    analogous: 'Analogous',
    triadic: 'Triadic',
    'split-complementary': 'Split-Complementary',
    tetradic: 'Tetradic',
    square: 'Square',
    monochromatic: 'Monochromatic',
  };
  return formats[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Gets localized harmony type name
 */
function getLocalizedHarmonyType(type: string, t: Translator): string {
  const keyMap: Record<string, string> = {
    complementary: 'harmony.complementary',
    analogous: 'harmony.analogous',
    triadic: 'harmony.triadic',
    'split-complementary': 'harmony.splitComplementary',
    tetradic: 'harmony.tetradic',
    square: 'harmony.square',
    monochromatic: 'harmony.monochromatic',
  };
  const key = keyMap[type];
  return key ? t.t(key) : formatHarmonyType(type);
}

/**
 * Returns autocomplete choices for harmony types
 */
export function getHarmonyTypeChoices(): Array<{ name: string; value: string }> {
  return HARMONY_TYPES.map((type) => ({
    name: formatHarmonyType(type),
    value: type,
  }));
}
