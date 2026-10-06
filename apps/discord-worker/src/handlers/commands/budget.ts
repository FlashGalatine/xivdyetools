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
import type { Dye } from '@xivdyetools/types';
import {
  deferredResponse,
  errorEmbed,
  ephemeralResponse,
  type DiscordEmbed,
} from '../../utils/response.js';
import {
  safeDeleteOriginalResponse,
  safeEditOriginalResponse,
  safeSendFollowUp,
} from '../../utils/discord-api.js';
import { renderSvgToPng } from '../../services/svg/renderer.js';
import {
  generateBudgetLedger,
  grp,
  num,
  type BudgetLedgerGroup,
} from '@xivdyetools/svg';
import { getLocalizedAcquisition, sanitizeEmbedText } from '@xivdyetools/bot-logic';
import { BAND_METHOD_DP, CONSOLIDATED_DYES, classifyBandTier, type MatchingMethod } from '@xivdyetools/core';
import { createUserTranslatorWithPrefs, type Translator } from '../../services/bot-i18n.js';
import { initializeLocale, getLocalizedDyeName, type LocaleCode } from '../../services/i18n.js';
import { setPreference } from '../../services/preferences.js';
import { MATCHING_METHODS, isValidMatchingMethod, type UserPreferences } from '../../types/preferences.js';
import {
  findBudgetLedger,
  resolveTargetDye,
  getDyeByName,
  getDyeAutocomplete,
  isUniversalisEnabled,
  validateWorld,
  getWorldAutocomplete,
  getQuickPickById,
} from '../../services/budget/index.js';
import type { LedgerSearchOptions } from '../../types/budget.js';
import { UniversalisError } from '../../types/budget.js';
import { markCommandOutcome, classifyError } from '../../services/command-trace.js';
import type { Env, DiscordInteraction } from '../../types/env.js';
import { getDyeEmoji } from '../../services/emoji.js';

// ============================================================================
// Method display (identifiers — never localise)
// ============================================================================

/** ΔE column header per method (short tags — the 34/42 px column). */
const DE_LABEL: Record<MatchingMethod, string> = {
  ciede2000: 'ΔE',
  oklab: 'ΔEOK2',
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
      return handleSetWorldSubcommand(interaction, env, ctx, subcommand.options || [], t, userId, logger);

    case 'quick':
      return handleQuickSubcommand(interaction, env, ctx, subcommand.options || [], t, prefs, logger);

    default:
      return ephemeralResponse(t.t('common.error'));
  }
}

// ============================================================================
// World resolution
// ============================================================================

/**
 * The world a ledger should be priced on, AS TYPED: the `world:` override,
 * else the stored preference; `undefined` when neither is set. Checking that
 * it exists is {@link resolveNamedWorld}'s job, after the ack.
 */
function namedWorld(worldOverride: string | undefined, prefs: UserPreferences): string | undefined {
  return worldOverride || prefs.world || undefined;
}

/**
 * Validate the named world, or answer the deferred interaction with why not.
 *
 * FINDING-033 (2026-08-21 security audit): a `world:` override used to be
 * forwarded verbatim (`worldOverride ?? prefs.world`) — only `set_world`
 * validated. Now every override goes through `validateWorld()` (cached for
 * an hour) and the CANONICAL name is what reaches the Universalis proxy and
 * the price-cache key.
 *
 * FINDING-019 (2026-08-29 audit) closed the other half: the STORED
 * preference skipped validation too, so anything `/preferences set world:`
 * had written — it accepted any non-empty string — reached the proxy and the
 * shared cache key on every `/budget` call. Both sources now take the same
 * lookup (one cached call per command), and a preference that no longer
 * resolves is answered rather than priced.
 *
 * BUG-031: the "unknown world" and "the proxy is down" cases used to arrive
 * here as the same `null`, so an outage told the user their own valid world
 * did not exist. They are now distinct.
 *
 * BUG-002 (2026-10-04 deep dive): on a cold isolate the lookup is up to two
 * sequential service-binding fetches with a 10 s timeout each, and it used to
 * be awaited BEFORE the defer — a slow Universalis became Discord's "The
 * application did not respond". It now runs after the ack.
 *
 * Its refusals stay PRIVATE, as they were when they were answered in the ack
 * itself: the defer is public (the ledger is for the channel), and a refusal
 * edited over it would leave a red embed — echoing the typed world, or the
 * user's STORED one — in the channel for good. See {@link refusePrivately}.
 *
 * @returns the canonical world name, or `null` once the refusal is sent
 */
async function resolveNamedWorld(
  interaction: DiscordInteraction,
  env: Env,
  named: string,
  t: Translator,
  logger?: ExtendedLogger
): Promise<string | null> {
  const world = await validateWorld(env, named, logger);
  if (world.ok) return world.name;

  let message: string;
  if (world.reason === 'upstream') {
    // BUG-031: the world is probably fine — Universalis is not. Saying
    // "could not find <their world>" during an outage sends the user off to
    // check a spelling that was never wrong.
    markCommandOutcome(interaction, 'upstream_universalis');
    message = t.t('budget.errors.apiError');
  } else {
    // FINDING-019: typed / stored value echoed back — sanitise it
    message = t.t('budget.errors.worldNotFound', { world: sanitizeEmbedText(named, 64) });
  }
  await refusePrivately(
    interaction,
    env,
    { embeds: [errorEmbed(t.t('common.error'), message)] },
    logger
  );
  return null;
}

/**
 * Answer a PUBLICLY deferred interaction privately: delete the public
 * "thinking…", then send the reply as an ephemeral follow-up.
 *
 * The order matters — a follow-up sent while the deferred original is still
 * pending takes its place, and with it the defer's public visibility. When
 * the delete fails the original is still there, so the reply is edited over
 * it instead: a public refusal beats a "thinking…" that never resolves.
 */
async function refusePrivately(
  interaction: DiscordInteraction,
  env: Env,
  reply: { embeds: DiscordEmbed[] },
  logger?: ExtendedLogger
): Promise<void> {
  const deleted = await safeDeleteOriginalResponse(
    env.DISCORD_CLIENT_ID,
    interaction.token,
    logger
  );
  if (!deleted) {
    await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, reply, logger);
    return;
  }
  await safeSendFollowUp(
    env.DISCORD_CLIENT_ID,
    interaction.token,
    { ...reply, ephemeral: true },
    logger
  );
}

// ============================================================================
// Find Subcommand
// ============================================================================

/**
 * Resolve the typed `target_dye` — an id or a name.
 *
 * BUG-032 (2026-07-18 audit): the input is an id only when it is entirely
 * numeric — parseInt('255 Brown') would otherwise parse as 255.
 *
 * BUG-034 (2026-10-04 audit): and only when it is 1–5 digits — the rule
 * `@xivdyetools/bot-logic`'s `parseDyeIdInput` applies for every other
 * command. Every real id fits in five digits, so six bare digits are a hex
 * colour there ('013114' is #013114, not zero-padded Pure White). /budget
 * prices dyes, not colours, so six or more bare digits name no dye here:
 * the user is told no such dye was found, as its autocomplete already
 * offered none.
 */
function resolveTargetDyeInput(input: string, locale: LocaleCode): Dye | null {
  if (!/^\s*\d+\s*$/.test(input)) return getDyeByName(input, locale);
  const digits = input.trim();
  return digits.length <= 5 ? resolveTargetDye(Number(digits)) : null;
}

/**
 * Handles /budget find <target_dye>
 */
function handleFindSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  prefs: UserPreferences,
  logger?: ExtendedLogger
): Response {
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

  const targetDye = resolveTargetDyeInput(targetDyeInput, t.getLocale());

  if (!targetDye || targetDye.itemID <= 0) {
    // FINDING-019: typed option value echoed back — sanitise it
    return ephemeralResponse(
      t.t('budget.errors.dyeNotFound', { name: sanitizeEmbedText(targetDyeInput, 100) })
    );
  }

  // World: explicit option > stored preference. FINDING-033 / FINDING-019:
  // both are validated like `set_world` — only a known world or data centre
  // (canonical name) reaches the Universalis proxy and the shared
  // price-cache key. BUG-002: that lookup runs after the defer (in
  // processFindCommand); only "nothing set" needs no I/O and is answered here.
  const world = namedWorld(worldOverride, prefs);
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
 * Background processing: validate the world, build the ledger, draw 13G,
 * send the one-line embed.
 *
 * @param named - the world as typed or stored; validated here, after the ack
 *                (BUG-002), and only its canonical name is priced
 */
async function processFindCommand(
  interaction: DiscordInteraction,
  env: Env,
  targetDyeId: number,
  named: string,
  searchOptions: LedgerSearchOptions,
  t: Translator,
  theme?: 'dark' | 'light',
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const world = await resolveNamedWorld(interaction, env, named, t, logger);
    if (world === null) return;

    // FINDING-011: a player's home world is mildly identifying — the log
    // needs only to say that one was resolved, never which.
    if (logger) logger.info('Budget: building ledger', { hasWorld: Boolean(world) });
    const result = await findBudgetLedger(env, targetDyeId, world, searchOptions, logger);

    const locale = t.getLocale();
    await initializeLocale(locale);

    const method = result.method;
    const localizedTargetName = getLocalizedDyeName(
      result.targetDye.itemID,
      result.targetDye.name,
      locale
    );
    const emoji = getDyeEmoji(result.targetDye.stainID ?? 0, env.DISCORD_CLIENT_ID);
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
      // Consolidated groups are headed by the market item name in the user's
      // locale (F-10); acquisition groups by the localized acquisition.
      tier: g.acquisition
        ? getLocalizedAcquisition(g.acquisition, locale)
        : g.type
          ? (CONSOLIDATED_DYES[g.type].names[locale] ?? CONSOLIDATED_DYES[g.type].names.en)
          : g.label,
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
        perDeLabel: t.t('card.perDe'),
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
    markCommandOutcome(interaction, classifyError(error));
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
 *
 * BUG-002 (2026-10-04 deep dive): the Universalis lookup and the KV write
 * used to be awaited before any reply — no defer at all — so a cold-cache
 * lookup could outlast Discord's 3-second ack window. It now acks
 * ephemerally first and answers in the deferred edit.
 */
function handleSetWorldSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  userId: string,
  logger?: ExtendedLogger
): Response {
  const worldInput = options.find((opt) => opt.name === 'world')?.value as string | undefined;

  if (!worldInput) {
    return ephemeralResponse(t.t('budget.errors.missingWorld'));
  }

  ctx.waitUntil(processSetWorld(interaction, env, worldInput, t, userId, logger));
  return deferredResponse(true);
}

/**
 * Background half of /budget set_world: validate, save, edit the ack.
 */
async function processSetWorld(
  interaction: DiscordInteraction,
  env: Env,
  worldInput: string,
  t: Translator,
  userId: string,
  logger?: ExtendedLogger
): Promise<void> {
  let content: string;
  try {
    // Validate world exists
    const validated = await validateWorld(env, worldInput, logger);

    if (!validated.ok) {
      // BUG-031: refusing to save a valid world because the proxy is down is
      // worth its own sentence — the user has nothing to correct.
      if (validated.reason === 'upstream') markCommandOutcome(interaction, 'upstream_universalis');
      content =
        validated.reason === 'upstream'
          ? t.t('budget.errors.apiError')
          : t.t('budget.errors.worldNotFound', { world: sanitizeEmbedText(worldInput, 64) });
    } else {
      // Save preference via unified preferences system
      const result = await setPreference(env.KV, userId, 'world', validated.name, logger);
      content = result.success
        ? t.t('budget.worldSet', { world: validated.name })
        : t.t('budget.errors.saveFailed');
    }
  } catch (error) {
    // The ack is already sent: answer it rather than leave "thinking…"
    markCommandOutcome(interaction, classifyError(error));
    if (logger) logger.error('Budget set_world error', error instanceof Error ? error : undefined);
    content = t.t('budget.errors.saveFailed');
  }

  await safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, { content });
}

// ============================================================================
// Quick Subcommand
// ============================================================================

/**
 * Handles /budget quick <preset>
 */
function handleQuickSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  options: Array<{ name: string; value?: string | number | boolean }>,
  t: Translator,
  prefs: UserPreferences,
  logger?: ExtendedLogger
): Response {
  const presetId = options.find((opt) => opt.name === 'preset')?.value as string | undefined;
  const worldOverride = options.find((opt) => opt.name === 'world')?.value as string | undefined;

  if (!presetId) {
    return ephemeralResponse(t.t('budget.errors.missingPreset'));
  }

  // Get preset
  const preset = getQuickPickById(presetId);
  if (!preset) {
    return ephemeralResponse(
      t.t('budget.errors.presetNotFound', { id: sanitizeEmbedText(presetId, 64) })
    );
  }

  // FINDING-033 / FINDING-019: same world validation as find / set_world —
  // after the defer (BUG-002), inside processFindCommand.
  const world = namedWorld(worldOverride, prefs);
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
  locale: LocaleCode,
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
      choices = getDyeAutocomplete(query, 25, locale);
      break;

    case 'world':
      choices = await getWorldAutocomplete(env, query, logger, locale);
      break;

    default:
      break;
  }

  return Response.json({
    type: 8, // APPLICATION_COMMAND_AUTOCOMPLETE_RESULT
    data: { choices },
  });
}
