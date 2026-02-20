/**
 * /gradient Command Handler (V4)
 *
 * Generates a color gradient between two colors and finds the closest
 * FFXIV dyes for each step in the gradient.
 *
 * Accepts colors as hex codes or dye names, with configurable step count.
 *
 * Replaces: /mixer (v2.x) - the old mixer command becomes /gradient
 * Note: A new /mixer command will be added for dye blending (Phase 3)
 *
 * @module handlers/commands/gradient
 */

import { ColorService, type Dye, type MatchingMethod } from '@xivdyetools/core';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed, hexToDiscordColor } from '../../utils/response.js';
import { resolveColorInput, dyeService } from '../../utils/color.js';
import { editOriginalResponse } from '../../utils/discord-api.js';
import {
  generateGradientBar,
  type GradientStep,
} from '@xivdyetools/svg';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { getDyeEmoji } from '../../services/emoji.js';
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
import type { Env, DiscordInteraction } from '../../types/env.js';

/**
 * Supported color space interpolation modes
 */
type InterpolationMode = 'rgb' | 'hsv' | 'lab' | 'oklch' | 'lch';

/**
 * Gets match quality description based on color distance
 */
function getMatchQuality(distance: number, t: Translator): string {
  if (distance === 0) return t.t('quality.perfect');
  if (distance < 10) return t.t('quality.excellent');
  if (distance < 25) return t.t('quality.good');
  if (distance < 50) return t.t('quality.fair');
  return t.t('quality.approximate');
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
 * Generates an array of interpolated colors between start and end using the specified color space.
 *
 * Interpolation modes:
 * - RGB: Linear RGB interpolation (gray midpoints for complementary colors)
 * - HSV: Hue-based interpolation with wraparound (vibrant, takes shorter hue path)
 * - LAB: Perceptually uniform (good for natural transitions)
 * - OKLCH: Modern perceptual with hue (best for gradients, fixes LAB's blue distortion)
 * - LCH: Cylindrical LAB with hue (good balance of perceptual uniformity)
 *
 * @param startColor - Starting hex color
 * @param endColor - Ending hex color
 * @param stepCount - Number of steps (including start and end)
 * @param mode - Color space interpolation mode
 */
function generateGradientColorsMultiSpace(
  startColor: string,
  endColor: string,
  stepCount: number,
  mode: InterpolationMode
): string[] {
  const colors: string[] = [];

  for (let i = 0; i < stepCount; i++) {
    const t = stepCount === 1 ? 0 : i / (stepCount - 1);
    let interpolatedColor: string;

    switch (mode) {
      case 'rgb': {
        // RGB interpolation (linear)
        const startRgb = ColorService.hexToRgb(startColor);
        const endRgb = ColorService.hexToRgb(endColor);
        const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * t);
        const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * t);
        const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * t);
        interpolatedColor = ColorService.rgbToHex(r, g, b);
        break;
      }

      case 'hsv': {
        // HSV interpolation (with hue wraparound)
        const startHsv = ColorService.hexToHsv(startColor);
        const endHsv = ColorService.hexToHsv(endColor);
        // Handle hue wraparound (take shorter path)
        let hueDiff = endHsv.h - startHsv.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const h = (startHsv.h + hueDiff * t + 360) % 360;
        const s = startHsv.s + (endHsv.s - startHsv.s) * t;
        const v = startHsv.v + (endHsv.v - startHsv.v) * t;
        interpolatedColor = ColorService.hsvToHex(h, s, v);
        break;
      }

      case 'lab': {
        // LAB interpolation (perceptually uniform)
        const startLab = ColorService.hexToLab(startColor);
        const endLab = ColorService.hexToLab(endColor);
        const L = startLab.L + (endLab.L - startLab.L) * t;
        const a = startLab.a + (endLab.a - startLab.a) * t;
        const b = startLab.b + (endLab.b - startLab.b) * t;
        interpolatedColor = ColorService.labToHex(L, a, b);
        break;
      }

      case 'oklch': {
        // OKLCH interpolation (modern perceptual with hue)
        const startOklch = ColorService.hexToOklch(startColor);
        const endOklch = ColorService.hexToOklch(endColor);
        // Handle hue wraparound (take shorter path)
        let hueDiff = endOklch.h - startOklch.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const L = startOklch.L + (endOklch.L - startOklch.L) * t;
        const C = startOklch.C + (endOklch.C - startOklch.C) * t;
        const h = (startOklch.h + hueDiff * t + 360) % 360;
        interpolatedColor = ColorService.oklchToHex(L, C, h);
        break;
      }

      case 'lch': {
        // LCH interpolation (cylindrical LAB with hue)
        const startLch = ColorService.hexToLch(startColor);
        const endLch = ColorService.hexToLch(endColor);
        // Handle hue wraparound (take shorter path)
        let hueDiff = endLch.h - startLch.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const L = startLch.L + (endLch.L - startLch.L) * t;
        const C = startLch.C + (endLch.C - startLch.C) * t;
        const h = (startLch.h + hueDiff * t + 360) % 360;
        interpolatedColor = ColorService.lchToHex(L, C, h);
        break;
      }

      default:
        // Default to HSV for backward compatibility
        const startHsv = ColorService.hexToHsv(startColor);
        const endHsv = ColorService.hexToHsv(endColor);
        let hueDiff = endHsv.h - startHsv.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const h = (startHsv.h + hueDiff * t + 360) % 360;
        const s = startHsv.s + (endHsv.s - startHsv.s) * t;
        const v = startHsv.v + (endHsv.v - startHsv.v) * t;
        interpolatedColor = ColorService.hsvToHex(h, s, v);
    }

    colors.push(interpolatedColor);
  }

  return colors;
}

/**
 * Handles the /gradient command
 */
export async function handleGradientCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  // Extract options
  const options = interaction.data?.options || [];
  const startOption = options.find((opt) => opt.name === 'start_color');
  const endOption = options.find((opt) => opt.name === 'end_color');
  const stepsOption = options.find((opt) => opt.name === 'steps');
  const colorSpaceOption = options.find((opt) => opt.name === 'color_space');
  const matchingOption = options.find((opt) => opt.name === 'matching');

  const startInput = startOption?.value as string | undefined;
  const endInput = endOption?.value as string | undefined;
  const stepCount = (stepsOption?.value as number) || 6;
  const colorSpace = (colorSpaceOption?.value as InterpolationMode) || 'hsv';
  const matchingMethod = (matchingOption?.value as MatchingMethod) || 'oklab';

  // Get translator for validation errors (before deferring)
  const t = userId
    ? await createUserTranslator(env.KV, userId, interaction.locale)
    : createTranslator(discordLocaleToLocaleCode(interaction.locale ?? 'en') ?? 'en');

  // Validate required inputs
  if (!startInput || !endInput) {
    return Response.json({
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))],
        flags: 64, // Ephemeral
      },
    });
  }

  // Resolve the start color
  const startResolved = resolveColorInput(startInput);
  if (!startResolved) {
    return Response.json({
      type: 4,
      data: {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: startInput })),
        ],
        flags: 64,
      },
    });
  }

  // Resolve the end color
  const endResolved = resolveColorInput(endInput);
  if (!endResolved) {
    return Response.json({
      type: 4,
      data: {
        embeds: [
          errorEmbed(t.t('common.error'), t.t('errors.invalidColor', { input: endInput })),
        ],
        flags: 64,
      },
    });
  }

  // Resolve locale for background processing
  const locale = t.getLocale();

  // Defer the response (image generation takes time)
  const deferResponse = deferredResponse();

  // Process in background
  ctx.waitUntil(
    processGradientCommand(
      interaction,
      env,
      startResolved,
      endResolved,
      stepCount,
      colorSpace,
      matchingMethod,
      locale,
      logger
    )
  );

  return deferResponse;
}

interface ResolvedColor {
  hex: string;
  name?: string;
  id?: number;
  itemID?: number | null;
}

/**
 * Background processing for gradient command
 */
async function processGradientCommand(
  interaction: DiscordInteraction,
  env: Env,
  startColor: ResolvedColor,
  endColor: ResolvedColor,
  stepCount: number,
  colorSpace: InterpolationMode,
  matchingMethod: MatchingMethod,
  locale: LocaleCode,
  logger?: ExtendedLogger
): Promise<void> {
  const t = createTranslator(locale);

  // Initialize localization for dye names
  await initializeLocale(locale);

  try {
    // Generate gradient colors using the specified color space
    const gradientHexColors = generateGradientColorsMultiSpace(
      startColor.hex,
      endColor.hex,
      stepCount,
      colorSpace
    );

    // Find closest dye for each color (excluding Facewear)
    const gradientSteps: Array<GradientStep & { dye?: Dye; distance: number }> = [];

    for (const hex of gradientHexColors) {
      // Find closest dye using the specified matching method, iterating until we find a non-Facewear dye
      let closestDye: Dye | null = null;
      const excludeIds: number[] = [];

      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = dyeService.findClosestDye(hex, {
          excludeIds,
          matchingMethod,
        });
        if (!candidate) break;

        if (candidate.category !== 'Facewear') {
          closestDye = candidate;
          break;
        }
        excludeIds.push(candidate.id);
      }

      const distance = closestDye ? getColorDistance(hex, closestDye.hex) : 999;

      // Get localized name if dye exists
      const localizedDyeName = closestDye
        ? getLocalizedDyeName(closestDye.itemID, closestDye.name, locale)
        : undefined;

      gradientSteps.push({
        hex,
        dyeName: localizedDyeName,
        dyeId: closestDye?.id,
        dye: closestDye ?? undefined,
        distance,
      });
    }

    // Generate SVG (800x200) with localized labels
    const svg = generateGradientBar({
      steps: gradientSteps,
      width: 800,
      height: 200,
      startLabel: t.t('gradient.start') || 'START',
      endLabel: t.t('gradient.end') || 'END',
    });

    // Render to PNG
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 });

    // Build description with matched dyes and quality
    const dyeLines = gradientSteps.map((step, i) => {
      const emoji = step.dyeId ? getDyeEmoji(step.dyeId) : undefined;
      const emojiPrefix = emoji ? `${emoji} ` : '';
      const quality = getMatchQuality(step.distance, t);
      const dyeText = step.dyeName
        ? `${emojiPrefix}**${step.dyeName}**`
        : `_${t.t('errors.noMatchFound')}_`;

      // Label start/end
      let label = '';
      if (i === 0) label = ` (${t.t('gradient.startColor')})`;
      else if (i === gradientSteps.length - 1) label = ` (${t.t('gradient.endColor')})`;

      return `**${i + 1}.** ${dyeText} • \`${step.hex.toUpperCase()}\` • ${quality}${label}`;
    }).join('\n');

    // Build start/end labels with localized names
    const startEmoji = startColor.id ? getDyeEmoji(startColor.id) : undefined;
    const endEmoji = endColor.id ? getDyeEmoji(endColor.id) : undefined;
    const startEmojiPrefix = startEmoji ? `${startEmoji} ` : '';
    const endEmojiPrefix = endEmoji ? `${endEmoji} ` : '';
    const localizedStartName = startColor.itemID && startColor.name
      ? getLocalizedDyeName(startColor.itemID, startColor.name, locale)
      : startColor.name;
    const localizedEndName = endColor.itemID && endColor.name
      ? getLocalizedDyeName(endColor.itemID, endColor.name, locale)
      : endColor.name;
    const startText = localizedStartName
      ? `${startEmojiPrefix}**${localizedStartName}** (\`${startColor.hex.toUpperCase()}\`)`
      : `\`${startColor.hex.toUpperCase()}\``;
    const endText = localizedEndName
      ? `${endEmojiPrefix}**${localizedEndName}** (\`${endColor.hex.toUpperCase()}\`)`
      : `\`${endColor.hex.toUpperCase()}\``;

    // Build color space label (uppercase for display)
    const colorSpaceLabel = colorSpace.toUpperCase();
    const matchingLabel = matchingMethod === 'ciede2000' ? 'CIEDE2000' :
      matchingMethod === 'cie76' ? 'CIE76' :
      matchingMethod.toUpperCase();

    // Send follow-up with image
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: `${t.t('gradient.title')} • ${t.t('gradient.steps', { count: stepCount })}`,
          description: [
            `**${t.t('gradient.startColor')}:** ${startText}`,
            `**${t.t('gradient.endColor')}:** ${endText}`,
            `**${t.t('gradient.colorSpace') || 'Color Space'}:** ${colorSpaceLabel} • **${t.t('gradient.matching') || 'Matching'}:** ${matchingLabel}`,
            '',
            `**${t.t('extractor.topMatches', { count: stepCount })}:**`,
            dyeLines,
          ].join('\n'),
          color: hexToDiscordColor(startColor.hex),
          image: { url: 'attachment://image.png' },
          footer: {
            text: `${t.t('common.footer')} • ${t.t('extractor.useInfoNameHint')}`,
          },
        },
      ],
      file: {
        name: `gradient-${stepCount}-steps.png`,
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
  } catch (error) {
    if (logger) {
      logger.error('Gradient command error', error instanceof Error ? error : undefined);
    }

    // Send error response
    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        errorEmbed(t.t('common.error'), t.t('errors.generationFailed')),
      ],
    });
  }
}
