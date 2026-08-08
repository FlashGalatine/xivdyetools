/**
 * /budget Command Handler — the 13G Ledger (5.0).
 *
 * Tier groups carry the single price; rows underneath are priceless. The
 * gil/ΔE ratio is PINNED to ΔE2000 whatever the `matching` option says; a
 * missing price blanks its column rather than inventing a number, and a
 * target nothing undercuts gets a sentence instead of an empty frame.
 *
 * Subcommands:
 * - /budget find <target_dye> — the ledger
 * - /budget set_world <world> — save preferred world/datacenter
 * - /budget quick <preset> — the ledger for a popular expensive dye
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { deferredResponse, errorEmbed, ephemeralResponse } from '../../utils/response.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import {
  generateBudgetLedger,
  grp,
  num,
  type BudgetLedgerGroup,
} from '@xivdyetools/svg';
import { getLocalizedAcquisition } from '@xivdyetools/bot-logic';
import { BAND_METHOD_DP, classifyBandTier, type MatchingMethod } from '@xivdyetools/core';
import { createUserTranslatorWithPrefs, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName } from '../../services/i18n.js';
import { setPreference } from '../../services/preferences.js';
import { MATCHING_METHODS, isValidMatchingMethod, type UserPreferences } from '../../types/preferences.js';
import {
  findBudgetLedger,
  getDyeById,
  getDyeByName,
  getDyeAutocomplete,
  isUniversalisEnabled,
  validateWorld,
  getWorldAutocomplete,
  getQuickPickById,
} from '../../services/budget/index.js';
import type { LedgerSearchOptions } from '../../types/budget.js';
import { UniversalisError } from '../../types/budget.js';
import type { Env, DiscordInteraction } from '../../types/env.js';
import { getDyeEmoji } from '../../services/emoji.js';

// ============================================================================
// Method display (identifiers — never localise)
// ============================================================================

/** ΔE column header per method (short tags — the 34/42 px column). */
const DE_LABEL: Record<MatchingMethod, string> = {
  ciede2000: 'ΔE',
  oklab: 'ΔEOK',
  cie76: 'ΔE76',
  redmean: 'RM',
  rgb: 'RGB',
  distinguish: 'D%',
};

/** 3-digit methods widen the ΔE column 34 → 42 px. */
const WIDE_DE = new Set<MatchingMethod>(['redmean', 'rgb', 'distinguish']);

function methodTag(method: MatchingMethod): string {
  return MATCHING_METHODS.find((m) => m.value === method)?.name ?? method;
}

/** gil-per-ΔE display: 13.6k over 1000, grouped integer below. */
function fmtPerDe(v: number, lang: string): string {
  if (v >= 1000) return `${num(v / 1000, lang, 1)}k`;
  return grp(Math.round(v), lang);
}

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

  const options = interaction.data?.options || [];
  const subcommand = options[0];

  if (!subcommand || !subcommand.name) {
    return ephemeralResponse(t.t('common.error'));
  }

  switch (subcommand.name) {
    case 'find':
      return handleFindSubcommand(interaction, env, ctx, subcommand.options || [], t, prefs, logger);

    case 'set_world':
      return handleSetWorldSubcommand(env, subcommand.options || [], t, userId, logger);

    case 'quick':
      return handleQuickSubcommand(interaction, env, ctx, subcommand.options || [], t, prefs, logger);

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
  prefs: UserPreferences,
  logger?: ExtendedLogger
): Promise<Response> {
  // Check if Universalis is configured
  if (!isUniversalisEnabled(env)) {
    return ephemeralResponse(t.t('budget.errors.notConfigured'));
  }

  // Extract options
  const targetDyeInput = options.find((opt) => opt.name === 'target_dye')?.value as string | undefined;
  const worldOverride = options.find((opt) => opt.name === 'world')?.value as string | undefined;
  const matchingRaw = options.find((opt) => opt.name === 'matching')?.value as string | undefined;
  const matchLineRaw = options.find((opt) => opt.name === 'max_distance')?.value as number | undefined;
  const excludeCoffers = options.find((opt) => opt.name === 'exclude_coffers')?.value === true;
  const excludeWideSpectrum =
    options.find((opt) => opt.name === 'exclude_wide_spectrum')?.value === true;

  // Method: explicit option > user preference > suite default
  const method: MatchingMethod =
    matchingRaw && isValidMatchingMethod(matchingRaw)
      ? matchingRaw
      : (prefs.matching ?? 'ciede2000');

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

  if (!targetDye || targetDye.itemID <= 0) {
    return ephemeralResponse(t.t('budget.errors.dyeNotFound', { name: targetDyeInput }));
  }

  // Get world preference from unified preferences system
  const world = worldOverride ?? prefs.world;
  if (!world) {
    return ephemeralResponse(
      `**${t.t('budget.noWorldSet.title')}**\n\n${t.t('budget.noWorldSet.description')}`
    );
  }

  const deferResponse = deferredResponse();
  ctx.waitUntil(
    processFindCommand(
      interaction,
      env,
      targetDye.itemID,
      world,
      { method, matchLine: matchLineRaw, excludeCoffers, excludeWideSpectrum },
      t,
      prefs.theme,
      logger
    )
  );
  return deferResponse;
}

// ============================================================================
// Ledger rendering
// ============================================================================

/**
 * Background processing: build the ledger, draw 13G, send the one-line embed.
 */
async function processFindCommand(
  interaction: DiscordInteraction,
  env: Env,
  targetDyeId: number,
  world: string,
  searchOptions: LedgerSearchOptions,
  t: Translator,
  theme?: 'dark' | 'light',
  logger?: ExtendedLogger
): Promise<void> {
  try {
    if (logger) logger.info('Budget: building ledger', { targetDyeId, world });
    const result = await findBudgetLedger(env, targetDyeId, world, searchOptions, logger);

    const locale = t.getLocale();
    await initializeLocale(locale);

    const method = result.method;
    const localizedTargetName = getLocalizedDyeName(
      result.targetDye.itemID,
      result.targetDye.name,
      locale
    );
    const emoji = getDyeEmoji(result.targetDye.stainID ?? 0);
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const title = `${emojiPrefix}${t.t('budget.findTitle', { dyeName: localizedTargetName })}`;
    const embedColor = parseInt(result.targetDye.hex.replace('#', ''), 16);
    const shareUrl =
      result.targetDye.stainID != null
        ? `https://xivdyetools.app/budget?dye=${result.targetDye.stainID}`
        : 'https://xivdyetools.app/budget';

    const priceStr = (v: number): string => `${grp(v, locale)} GIL`;

    // The honest sentences that replace a frame
    if (result.alreadyFloor) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          {
            title,
            description: `${t.t('card.budgetFloor', { price: priceStr(result.targetPrice ?? 0) })}\n${shareUrl}`,
            color: embedColor,
          },
        ],
      });
      return;
    }
    if (result.groups.length === 0) {
      await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [
          {
            title,
            description: `${t.t('budget.noAlternatives')}\n${shareUrl}`,
            color: embedColor,
          },
        ],
      });
      return;
    }

    // Format the ledger for the frame
    const dp = BAND_METHOD_DP[method];
    const groups: BudgetLedgerGroup[] = result.groups.map((g) => ({
      tier: g.acquisition ? getLocalizedAcquisition(g.acquisition, locale) : g.label,
      price: g.price !== null ? priceStr(g.price) : null,
      flag: g.vendorCheaper ? t.t('card.vendorCheaper') : null,
      rows: g.rows.map((r) => ({
        hex: r.dye.hex,
        name: getLocalizedDyeName(r.dye.itemID, r.dye.name, locale),
        de: num(r.de, locale, dp),
        tier: classifyBandTier(r.de, method, 'match'),
        tie: r.tie,
        perDe: r.perDe !== null ? fmtPerDe(r.perDe, locale) : null,
      })),
    }));

    const keyLines = [t.t('card.budgetKey')];
    if (method !== 'ciede2000') {
      keyLines.push(t.t('card.budgetKeyMethod', { tag: methodTag(method) }));
    }

    const svg = generateBudgetLedger({
      target: {
        hex: result.targetDye.hex,
        name: localizedTargetName,
        price: result.targetPrice !== null ? priceStr(result.targetPrice) : null,
        subLabel:
          result.targetPriceSource === 'vendor'
            ? t.t('card.lVendor')
            : result.targetPriceSource === 'board'
              ? t.t('card.lBoardOnly')
              : t.t('card.lNoPrice'),
      },
      groups,
      labels: {
        lTarget: t.t('card.lTarget'),
        lCandidate: t.t('card.lCandidate'),
        deLabel: DE_LABEL[method],
        perDeLabel: 'GIL/ΔE',
        keyLines,
      },
      lang: locale,
      theme,
      wideDe: WIDE_DE.has(method),
    });

    const pngBuffer = await renderSvgToPng(svg, { scale: 2 }, logger);

    // One line: the picture is self-contained; the verdict earns the embed
    let description =
      result.targetPrice !== null
        ? t.t('card.budgetBest', {
            name: groups[0].rows[0].name,
            de: num(result.groups[0].rows[0].de2000, locale, 1),
            price: groups[0].price ?? '—',
          })
        : t.t('card.budgetNoTarget', { world: result.world });
    if (result.omitted.length > 0) {
      const names = result.omitted
        .map((o) => getLocalizedDyeName(o.itemID, o.name, locale))
        .join(' · ');
      description += `\n${t.t('card.nearestMore', { n: result.omitted.length })} — ${names}`;
    }
    description += `\n${shareUrl}`;

    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [
        {
          title,
          description,
          color: embedColor,
          image: { url: 'attachment://budget.png' },
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
    if (logger) {
      logger.error('Budget find error', error instanceof Error ? error : undefined);
      logger.error(`Budget error details: ${errorMsg}`);
    }

    let errorMessage = t.t('errors.generationFailed');
    if (error instanceof UniversalisError) {
      errorMessage = error.isRateLimited
        ? t.t('budget.errors.rateLimited')
        : t.t('budget.errors.apiError');
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

  const world = worldOverride ?? prefs.world;
  if (!world) {
    return ephemeralResponse(t.t('budget.noWorldSet.description'));
  }

  const deferResponse = deferredResponse();
  ctx.waitUntil(
    processFindCommand(
      interaction,
      env,
      preset.targetDyeId,
      world,
      { method: prefs.matching ?? 'ciede2000' },
      t,
      prefs.theme,
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
