/**
 * /budget Command Handler
 *
 * Helps users find affordable alternatives to expensive dyes.
 * Integrates with Universalis API for market board prices.
 *
 * Subcommands:
 * - /budget find <target_dye> - Find cheaper alternatives
 * - /budget set_world <world> - Set preferred world/datacenter
 * - /budget quick <preset> - Quick picks for popular expensive dyes
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed, ephemeralResponse } from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import { generateBudgetComparison, type BudgetSvgLabels } from '@xivdyetools/svg';
import { createUserTranslatorWithPrefs, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, getLocalizedCategory } from '../../services/i18n.js';
import { setPreference } from '../../services/preferences.js';
import type { UserPreferences } from '../../types/preferences.js';
import {
  findCheaperAlternatives,
  getDyeById,
  getDyeByName,
  getDyeAutocomplete,
  isUniversalisEnabled,
  validateWorld,
  getWorldAutocomplete,
  getQuickPickById,
} from '../../services/budget/index.js';
import type { BudgetSearchOptions, BudgetSortOption } from '../../types/budget.js';
import { UniversalisError, formatGil } from '../../types/budget.js';
import type { Env, DiscordInteraction } from '../../types/env.js';
import { getDyeEmoji } from '../../services/emoji.js';

// ============================================================================
// Constants
// ============================================================================

/** Default width for generated images */
const IMAGE_WIDTH = 800;

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handles the /budget command and subcommands
 */
export async function handleBudgetCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  // OPT-026 (2026-07-18 audit): one KV read yields both translator and prefs
  const { t, prefs } = await createUserTranslatorWithPrefs(env.KV, userId, interaction.locale, logger);

  // Get subcommand
  const options = interaction.data?.options || [];
  const subcommand = options[0];

  if (!subcommand || !subcommand.name) {
    return ephemeralResponse(t.t('common.error'));
  }

  switch (subcommand.name) {
    case 'find':
      return handleFindSubcommand(interaction, env, ctx, subcommand.options || [], t, userId, prefs, logger);

    case 'set_world':
      return handleSetWorldSubcommand(env, subcommand.options || [], t, userId, logger);

    case 'quick':
      return handleQuickSubcommand(interaction, env, ctx, subcommand.options || [], t, userId, prefs, logger);

    default:
      return ephemeralResponse(t.t('common.error'));
  }
}

// ============================================================================
// Find Subcommand
// ============================================================================

/**
 * Handles /budget find <target_dye>
 */
// eslint-disable-next-line @typescript-eslint/require-await -- handler interface requires async
async function handleFindSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  _userId: string,
  prefs: UserPreferences,
  logger?: ExtendedLogger
): Promise<Response> {
  // Check if Universalis is configured
  if (!isUniversalisEnabled(env)) {
    return ephemeralResponse(t.t('budget.errors.notConfigured'));
  }

  // Extract options
  const targetDyeInput = options.find((opt) => opt.name === 'target_dye')?.value as string | undefined;
  const maxPrice = options.find((opt) => opt.name === 'max_price')?.value as number | undefined;
  const maxDistance = options.find((opt) => opt.name === 'max_distance')?.value as number | undefined;
  const sortBy = (options.find((opt) => opt.name === 'sort_by')?.value as BudgetSortOption) || 'value_score';
  const worldOverride = options.find((opt) => opt.name === 'world')?.value as string | undefined;
  const maxResultsRaw = options.find((opt) => opt.name === 'max_results')?.value as number | undefined;
  // Web app caps at 20; default of 5 preserves prior bot behavior.
  const maxResults = typeof maxResultsRaw === 'number'
    ? Math.max(1, Math.min(20, Math.floor(maxResultsRaw)))
    : 5;

  // Validate target dye
  if (!targetDyeInput) {
    return ephemeralResponse(t.t('budget.errors.missingDye'));
  }

  // Resolve target dye (could be ID or name).
  // BUG-032 (2026-07-18 audit): only treat the input as an ID when it's
  // entirely numeric — parseInt('255 Brown') would otherwise parse as 255.
  const isNumericInput = /^\s*\d+\s*$/.test(targetDyeInput);
  const targetDye = isNumericInput
    ? getDyeById(parseInt(targetDyeInput, 10))
    : getDyeByName(targetDyeInput);

  // BUG-032 (2026-07-18 audit): reject Facewear entries (synthetic negative
  // itemIDs) — they aren't market-tradeable, and seeding their ID into the
  // Universalis fetch would fail the whole price batch. target_dye is
  // free-text, so this can arrive despite the filtered autocomplete.
  if (!targetDye || targetDye.itemID <= 0) {
    return ephemeralResponse(t.t('budget.errors.dyeNotFound', { name: targetDyeInput }));
  }

  // Get world preference from unified preferences system
  let world = worldOverride;
  if (!world) {
    // OPT-026: prefs already read once in handleBudgetCommand
    world = prefs.world;
  }

  if (!world) {
    return ephemeralResponse(
      `**${t.t('budget.noWorldSet.title')}**\n\n${t.t('budget.noWorldSet.description')}`
    );
  }

  // Defer response (price fetching takes time)
  const deferResponse = deferredResponse();

  // Process in background
  ctx.waitUntil(
    processFindCommand(
      interaction,
      env,
      targetDye.itemID,
      world,
      { maxPrice, maxDistance, sortBy, limit: maxResults },
      t,
      logger
    )
  );

  return deferResponse;
}

/**
 * Background processing for find command
 */
async function processFindCommand(
  interaction: DiscordInteraction,
  env: Env,
  targetDyeId: number,
  world: string,
  searchOptions: BudgetSearchOptions,
  t: Translator,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    // Find alternatives
    if (logger) logger.info('Budget: fetching alternatives', { targetDyeId, world });
    const result = await findCheaperAlternatives(env, targetDyeId, world, searchOptions, logger);
    if (logger) logger.info('Budget: found alternatives', { count: result.alternatives.length, hasTargetPrice: !!result.targetPrice });

    // Initialize core library localization for dye names
    const locale = t.getLocale();
    await initializeLocale(locale);

    // Build localized dye name and category maps
    const dyeNames: Record<number, string> = {};
    const categoryNames: Record<string, string> = {};
    dyeNames[result.targetDye.itemID] = getLocalizedDyeName(result.targetDye.itemID, result.targetDye.name, locale);
    categoryNames[result.targetDye.category] = getLocalizedCategory(result.targetDye.category, locale);
    for (const alt of result.alternatives) {
      dyeNames[alt.dye.itemID] = getLocalizedDyeName(alt.dye.itemID, alt.dye.name, locale);
    }

    // Build translated SVG labels
    const sortBy = searchOptions.sortBy || 'value_score';
    const svgLabels: BudgetSvgLabels = {
      headerLabel: t.t('budget.headerLabel'),
      targetPriceLabel: t.t('budget.targetPrice'),
      noListings: t.t('budget.noListings'),
      noAlternatives: t.t('budget.noAlternativesShort'),
      sortedBy: t.t('budget.sortedBy', { method: t.t(`budget.sortMethods.${sortBy}`) }),
      onWorld: t.t('budget.onWorld', { world: result.world }),
      gilAmountTemplate: t.t('budget.gilAmount'),
      saveAmountTemplate: t.t('budget.saveAmount'),
      listingCountTemplate: t.t('budget.listingCount'),
      distanceQuality: {
        perfect: t.t('budget.distanceQuality.perfect'),
        excellent: t.t('budget.distanceQuality.excellent'),
        good: t.t('budget.distanceQuality.good'),
        fair: t.t('budget.distanceQuality.fair'),
        approximate: t.t('budget.distanceQuality.approximate'),
      },
      dyeNames,
      categoryNames,
    };

    // Generate SVG
    const svg = generateBudgetComparison({
      targetDye: result.targetDye,
      targetPrice: result.targetPrice,
      alternatives: result.alternatives,
      world: result.world,
      sortBy,
      labels: svgLabels,
      width: IMAGE_WIDTH,
    });
    if (logger) logger.info('Budget: SVG generated', { svgLength: svg.length });

    // Render to PNG
    const pngBuffer = await renderSvgToPng(svg, { scale: 2 }, logger);
    if (logger) logger.info('Budget: PNG rendered', { pngSize: pngBuffer.length });

    // Build description
    let description = '';

    if (result.targetPrice) {
      description += `**${t.t('budget.targetPrice')}:** ${formatGil(result.targetPrice.currentMinPrice)} Gil\n`;
    } else {
      description += `**${t.t('budget.targetPrice')}:** ${t.t('budget.noListings')}\n`;
    }

    description += `${t.t('budget.worldUsed', { world: result.world })}\n`;
    description += `${t.t('budget.sortedBy', { method: t.t(`budget.sortMethods.${sortBy}`) })}\n\n`;

    if (result.alternatives.length > 0) {
      description += `${t.t('budget.foundAlternatives', { count: result.alternatives.length })}`;
    } else {
      description += t.t('budget.noAlternatives');
    }

    // Get dye emoji and localized name for target
    const localizedTargetName = dyeNames[result.targetDye.itemID] ?? result.targetDye.name;
    const emoji = getDyeEmoji(result.targetDye.itemID);
    const emojiPrefix = emoji ? `${emoji} ` : '';

    // Send response
    if (logger) logger.info('Budget: sending Discord response');
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title: `${emojiPrefix}${t.t('budget.findTitle', { dyeName: localizedTargetName })}`,
          description,
          color: parseInt(result.targetDye.hex.replace('#', ''), 16),
          image: { url: 'attachment://budget.png' },
          footer: { text: t.t('common.footer') },
        },
      ],
      file: {
        name: 'budget.png',
        data: pngBuffer,
        contentType: 'image/png',
      },
    });
    if (logger) logger.info('Budget: response sent successfully');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    if (logger) {
      logger.error('Budget find error', error instanceof Error ? error : undefined);
      logger.error(`Budget error details: ${errorMsg}`, errorStack ? { stack: errorStack } : undefined);
    }

    // Handle specific errors
    let errorMessage = t.t('errors.generationFailed');

    if (error instanceof UniversalisError) {
      if (error.isRateLimited) {
        errorMessage = t.t('budget.errors.rateLimited');
      } else {
        errorMessage = t.t('budget.errors.apiError');
      }
    }

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [errorEmbed(t.t('common.error'), errorMessage)],
    });
  }
}

// ============================================================================
// Set World Subcommand
// ============================================================================

/**
 * Handles /budget set_world <world>
 */
async function handleSetWorldSubcommand(
  env: Env,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  userId: string,
  logger?: ExtendedLogger
): Promise<Response> {
  const worldInput = options.find((opt) => opt.name === 'world')?.value as string | undefined;

  if (!worldInput) {
    return ephemeralResponse(t.t('budget.errors.missingWorld'));
  }

  // Validate world exists
  const validatedWorld = await validateWorld(env, worldInput, logger);

  if (!validatedWorld) {
    return ephemeralResponse(t.t('budget.errors.worldNotFound', { name: worldInput }));
  }

  // Save preference via unified preferences system
  const result = await setPreference(env.KV, userId, 'world', validatedWorld, logger);

  if (!result.success) {
    return ephemeralResponse(t.t('budget.errors.saveFailed'));
  }

  return ephemeralResponse(t.t('budget.worldSet', { world: validatedWorld }));
}

// ============================================================================
// Quick Subcommand
// ============================================================================

/**
 * Handles /budget quick <preset>
 */
// eslint-disable-next-line @typescript-eslint/require-await -- handler interface requires async
async function handleQuickSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  _userId: string,
  prefs: UserPreferences,
  logger?: ExtendedLogger
): Promise<Response> {
  const presetId = options.find((opt) => opt.name === 'preset')?.value as string | undefined;
  const worldOverride = options.find((opt) => opt.name === 'world')?.value as string | undefined;

  if (!presetId) {
    return ephemeralResponse(t.t('budget.errors.missingPreset'));
  }

  // Get preset
  const preset = getQuickPickById(presetId);
  if (!preset) {
    return ephemeralResponse(t.t('budget.errors.presetNotFound'));
  }

  // Get world preference from unified preferences system
  let world = worldOverride;
  if (!world) {
    // OPT-026: prefs already read once in handleBudgetCommand
    world = prefs.world;
  }

  if (!world) {
    return ephemeralResponse(t.t('budget.noWorldSet.description'));
  }

  // Defer response
  const deferResponse = deferredResponse();

  // Process in background
  ctx.waitUntil(
    processFindCommand(
      interaction,
      env,
      preset.targetDyeId,
      world,
      { sortBy: 'value_score', limit: 5 },
      t,
      logger
    )
  );

  return deferResponse;
}

// ============================================================================
// Autocomplete Handler
// ============================================================================

/**
 * Handles autocomplete for the /budget command
 */
export async function handleBudgetAutocomplete(
  interaction: DiscordInteraction,
  env: Env,
  logger?: ExtendedLogger
): Promise<Response> {
  const options = interaction.data?.options || [];
  const subcommand = options[0];

  if (!subcommand || !subcommand.options) {
    return Response.json({ type: 8, data: { choices: [] } });
  }

  // Find the focused option
  const focusedOption = subcommand.options.find(
    (opt) => opt.focused === true
  ) as { name: string; value?: string } | undefined;

  if (!focusedOption) {
    return Response.json({ type: 8, data: { choices: [] } });
  }

  const query = String(focusedOption.value || '');
  let choices: Array<{ name: string; value: string }> = [];

  switch (focusedOption.name) {
    case 'target_dye':
      choices = getDyeAutocomplete(query, 25);
      break;

    case 'world':
      choices = await getWorldAutocomplete(env, query, logger);
      break;

    default:
      break;
  }

  return Response.json({
    type: 8, // APPLICATION_COMMAND_AUTOCOMPLETE_RESULT
    data: { choices },
  });
}
