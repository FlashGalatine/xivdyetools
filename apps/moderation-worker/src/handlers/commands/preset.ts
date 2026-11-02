/**
 * Preset Moderation Command Handlers
 *
 * Handles /preset subcommands for the moderation bot:
 * - /preset moderate - Moderation actions (pending, approve, reject, stats)
 * - /preset ban_user - Ban a user from Preset Palettes
 * - /preset unban_user - Unban a user from Preset Palettes
 *
 * @module handlers/commands/preset
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { parseModeratorIds, sanitizeEmbedText } from '@xivdyetools/bot-logic';
import type { Env, DiscordInteraction } from '../../types/env.js';
import type { Translator } from '../../services/bot-i18n.js';
import {
  deferredResponse,
  ephemeralResponse,
  messageResponse,
  errorEmbed,
  successEmbed,
  isValidUuid,
  isBanTargetId,
  sanitizeErrorMessage,
} from '../../utils/response.js';
import { sanitizeName, sanitizeUserName } from '../../utils/embed-text.js';
import { safeEditOriginalResponse } from '../../utils/discord-api.js';
import * as presetApi from '../../services/preset-api.js';
import * as banService from '../../services/ban-service.js';
import {
  createBanReview,
  reviewMessage,
  isExpectedBanRefusal,
  BAN_SCOPE_OVERFLOW,
  INACTIVE_BANS,
  REVIEW_UNAVAILABLE,
} from '../../services/ban-confirmation-service.js';
import { linkedBansEnabled } from '../../services/identity-lookup.js';
import { buildReviewButtons, buildReviewEmbed, safeReviewActions } from '../review-message.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum rejection reason, shared by the modal and the slash command.
 *
 * moderation-worker-06: the modal has always demanded ten characters; the
 * slash command accepted one, and presets-api validates the reason on
 * `/revert` only — so `reason:x` was stored as the `moderation_log.reason` for
 * a rejection. Keep this the single definition for both entry points.
 */
export const MIN_REJECTION_REASON_LENGTH = 10;

// ============================================================================
// Main Handler
// ============================================================================

/**
 * Handle /preset command (routes to subcommand handlers)
 */
export async function handlePresetCommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  logger?: ExtendedLogger
): Promise<Response> {
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  if (!userId) {
    return ephemeralResponse(t.t('errors.userNotFound'));
  }

  // Get subcommand and options
  const subcommandOption = interaction.data?.options?.[0];
  const subcommand = subcommandOption?.name;
  const options = subcommandOption?.options;

  if (!subcommand) {
    return ephemeralResponse(t.t('errors.missingSubcommand'));
  }

  switch (subcommand) {
    case 'moderate':
      return handleModerateSubcommand(interaction, env, ctx, t, userId, options, logger);

    case 'ban_user':
      return handleBanUserSubcommand(interaction, env, ctx, t, userId, options, logger);

    case 'unban_user':
      return handleUnbanUserSubcommand(interaction, env, ctx, t, userId, options, logger);

    default:
      return ephemeralResponse(t.t('errors.unknownSubcommand', { name: subcommand }));
  }
}

// ============================================================================
// Helpers
// ============================================================================

function isInModerationChannel(interaction: DiscordInteraction, env: Env): boolean {
  if (!env.MODERATION_CHANNEL_ID) {
    return false;
  }
  return interaction.channel_id === env.MODERATION_CHANNEL_ID;
}

// ============================================================================
// /preset moderate
// ============================================================================

/**
 * MOD-REF-001 FIX: Context object for moderation action handlers
 * Reduces parameter passing and improves testability
 */
interface ModerationContext {
  interaction: DiscordInteraction;
  env: Env;
  t: Translator;
  userId: string;
  logger?: ExtendedLogger;
}

/**
 * MOD-REF-001 FIX: Send standardized response via webhook
 */
async function sendModerationResponse(
  ctx: ModerationContext,
  options: Parameters<typeof safeEditOriginalResponse>[2]
): Promise<void> {
  await safeEditOriginalResponse(ctx.env.DISCORD_CLIENT_ID, ctx.interaction.token, options);
}

/**
 * MOD-REF-001 FIX: Validate preset ID and send error response if invalid
 * @returns true if validation failed (error was sent), false if valid
 */
async function validatePresetIdOrSendError(
  ctx: ModerationContext,
  presetId: string | undefined
): Promise<boolean> {
  if (!presetId) {
    await sendModerationResponse(ctx, {
      embeds: [errorEmbed(ctx.t.t('common.error'), ctx.t.t('preset.moderation.missingId'))],
    });
    return true;
  }

  if (!isValidUuid(presetId)) {
    await sendModerationResponse(ctx, {
      embeds: [errorEmbed(ctx.t.t('common.error'), 'Invalid preset ID format.')],
    });
    return true;
  }

  return false;
}

// ============================================================================
// Moderation Action Handlers (MOD-REF-001 FIX)
// ============================================================================

/**
 * Handle 'pending' action - list presets awaiting moderation
 *
 * FINDING-001 (2026-08-11 fix wave): the queue mixes two different reasons a
 * preset needs a moderator \u2014 its own text is pending, or (since the queue
 * widened) an already-approved preset's NEW picture is pending. Only the
 * first kind is safe to approve/reject from this command: approving an
 * image-only entry is a `WHERE status = 'approved'` no-op that leaves it
 * stuck in the queue forever, and rejecting one takes a live, approved
 * palette out of the gallery over a disliked picture \u2014 exactly backwards
 * from "a bad picture is not a bad palette". `status === 'approved'` is the
 * unambiguous signal for "image-only" (its text needs nothing); image review
 * itself happens on the moderation embed discord-worker posts (see
 * apps/discord-worker/src/handlers/buttons/preview-image.ts), not here.
 */
async function handlePendingAction(ctx: ModerationContext): Promise<void> {
  const presets = await presetApi.getPendingPresets(ctx.env, ctx.userId);

  if (presets.length === 0) {
    await sendModerationResponse(ctx, {
      embeds: [
        successEmbed(
          ctx.t.t('preset.moderation.pendingQueue'),
          ctx.t.t('preset.moderation.noPending')
        ),
      ],
    });
    return;
  }

  const visiblePresets = presets.slice(0, 10);
  const hasImageOnlyEntries = visiblePresets.some((preset) => preset.status === 'approved');

  const presetLines = visiblePresets.map((preset, i) => {
    // FINDING-019: author-controlled name / author_name are sanitised
    const name = sanitizeName(preset.name);
    const author = sanitizeUserName(preset.author_name || 'Unknown');
    const base = `**${i + 1}.** ${name} by ${author}\n   ID: \`${preset.id}\``;

    // Text-pending entries keep today's rendering untouched.
    if (preset.status !== 'approved') {
      return base;
    }

    const imageNote = preset.pending_preview_image_url
      ? ctx.t.t('preset.moderation.imageOnlyNote', { url: preset.pending_preview_image_url })
      : ctx.t.t('preset.moderation.imageOnlyNoteNoUrl');

    return `\uD83D\uDDBC ${base}\n   ${imageNote}`;
  });

  const footerText = hasImageOnlyEntries
    ? ctx.t.t('preset.moderation.footerMixedQueue')
    : ctx.t.t('preset.moderation.footerTextOnly');

  await sendModerationResponse(ctx, {
    embeds: [
      {
        title: `\uD83D\uDCCB ${ctx.t.t('preset.moderation.pendingQueue')}`,
        description: [
          ctx.t.t('preset.moderation.pendingCount', { count: presets.length }),
          '',
          presetLines.join('\n\n'),
        ].join('\n'),
        color: 0xfee75c,
        footer: { text: footerText },
      },
    ],
  });
}

/**
 * FINDING-017: a typed preset id has no reviewed revision, so `approve` and
 * `reject` do not act. They fetch the CURRENT preset and answer with its text
 * and one confirm button bound to the revision and status just fetched. The
 * confirm click is an ordinary revision-bound button: approve acts through
 * `processApproval`, and reject opens the reason modal bound to the same
 * revision (the reason is asked there, so the command takes none).
 */
async function sendConfirmation(
  ctx: ModerationContext,
  presetId: string,
  action: 'approve' | 'reject'
): Promise<void> {
  const current = await presetApi.getModerationPreset(ctx.env, presetId, ctx.userId);
  if (!current) {
    await sendModerationResponse(ctx, {
      embeds: [errorEmbed(ctx.t.t('common.error'), 'Preset not found.')],
    });
    return;
  }

  const { preset, revision } = current;
  // An unreviewable link withholds Approve, so the notice must not ask for a missing button.
  const offered = safeReviewActions(preset, revision, [action]).length ? action : 'reject';
  const notice =
    offered === action
      ? `Review this text, then click ${action === 'approve' ? 'Approve' : 'Reject'} to confirm. ` +
        'The decision applies to this exact version.'
      : 'Approval is unavailable until the author shortens or fixes the link. ' +
        'Review this text, then click Reject to reject this exact version.';
  await sendModerationResponse(ctx, {
    embeds: [buildReviewEmbed(preset, revision, notice)],
    components: buildReviewButtons(presetId, { revision, status: preset.status }, [offered]),
  });
}

/**
 * Handle 'approve' action - show the preset for confirmation, then approve on the confirm click
 */
async function handleApproveAction(
  ctx: ModerationContext,
  presetId: string | undefined
): Promise<void> {
  // Validate preset ID (shared validation)
  if (await validatePresetIdOrSendError(ctx, presetId)) {
    return;
  }

  // MOD-4 (FINDING-034, 2026-08-21 audit): a ban hides only the author's
  // approved presets and presets-api's requireNotBanned guards submission /
  // edit / vote — so without this check a banned author's pending or flagged
  // entries could still be approved straight from the queue.
  if (await banService.isPresetAuthorBanned(ctx.env.DB, presetId!)) {
    await sendModerationResponse(ctx, {
      embeds: [errorEmbed(ctx.t.t('common.error'), AUTHOR_BANNED_MESSAGE)],
    });
    return;
  }

  await sendConfirmation(ctx, presetId!, 'approve');
}

/**
 * Handle 'reject' action - show the preset for confirmation; the confirm click
 * opens the reason modal
 *
 * moderation-worker-06: the ten-character reason floor still holds on this
 * entry point - the rejection modal the confirm click opens enforces it, and
 * is now the only place the reason is typed (FINDING-017).
 */
async function handleRejectAction(
  ctx: ModerationContext,
  presetId: string | undefined
): Promise<void> {
  // Validate preset ID (shared validation)
  if (await validatePresetIdOrSendError(ctx, presetId)) {
    return;
  }

  await sendConfirmation(ctx, presetId!, 'reject');
}

/**
 * Handle 'stats' action - show moderation statistics
 */
async function handleStatsAction(ctx: ModerationContext): Promise<void> {
  const stats = await presetApi.getModerationStats(ctx.env, ctx.userId);

  await sendModerationResponse(ctx, {
    embeds: [
      {
        title: `\uD83D\uDCCA ${ctx.t.t('preset.moderation.stats')}`,
        color: 0x5865f2,
        fields: [
          // BUG-010: these read `stats.pending_count` and friends. No such key
          // is in the response \u2014 presets-api aliases the counts `pending` /
          // `approved` / `rejected` / `flagged` \u2014 so every field rendered
          // `String(undefined)` and the queue's only summary view showed a
          // moderator "undefined" four times. `actions_last_week` is surfaced
          // too: the query already computes it and nothing was reading it.
          { name: '\uD83D\uDFE1 Pending', value: String(stats.pending), inline: true },
          { name: '\uD83D\uDFE2 Approved', value: String(stats.approved), inline: true },
          { name: '\uD83D\uDD34 Rejected', value: String(stats.rejected), inline: true },
          { name: '\uD83D\uDFE0 Flagged', value: String(stats.flagged), inline: true },
          {
            name: '\uD83D\uDCC5 Actions (7d)',
            value: String(stats.actions_last_week),
            inline: true,
          },
        ],
      },
    ],
  });
}

// ============================================================================
// Subcommand Entry Points
// ============================================================================

// eslint-disable-next-line @typescript-eslint/require-await
async function handleModerateSubcommand(
  interaction: DiscordInteraction,
  env: Env,
  ctx: ExecutionContext,
  t: Translator,
  userId: string,
  options?: Array<{ name: string; value?: string | number | boolean }>,
  logger?: ExtendedLogger
): Promise<Response> {
  // Check channel restriction FIRST (before moderator check)
  if (!isInModerationChannel(interaction, env)) {
    return ephemeralResponse('This command must be used in the moderation channel.');
  }

  // Check moderator status
  if (!presetApi.isModerator(env, userId)) {
    return messageResponse({
      embeds: [errorEmbed(t.t('common.error'), t.t('preset.moderation.accessDenied'))],
      flags: 64,
    });
  }

  const action = options?.find((opt) => opt.name === 'action')?.value as string;
  const presetId = options?.find((opt) => opt.name === 'preset_id')?.value as string | undefined;
  // The `reason` option is no longer read: approve and reject show the preset
  // for confirmation, and a rejection reason is typed in the modal that
  // confirmation opens (FINDING-017).

  if (!action) {
    return ephemeralResponse('Missing action');
  }

  // FINDING-017: approve / reject answer with the preset's text and a confirm
  // button — the message is private to the moderator, and the confirm click
  // edits it through the interaction webhook (see editReviewMessage).
  const deferResponse = deferredResponse(action === 'approve' || action === 'reject');

  ctx.waitUntil(
    processModerateCommand(interaction, env, t, userId, action, presetId, logger).catch(
      (err) => {
        logger?.error(
          'Unhandled error in processModerateCommand',
          err instanceof Error ? err : undefined
        );
      }
    )
  );

  return deferResponse;
}

/**
 * Process moderation command - dispatches to action handlers
 * MOD-REF-001 FIX: Refactored from 162-line switch to thin dispatcher
 */
async function processModerateCommand(
  interaction: DiscordInteraction,
  env: Env,
  t: Translator,
  userId: string,
  action: string,
  presetId?: string,
  logger?: ExtendedLogger
): Promise<void> {
  // Build context object for handlers
  const ctx: ModerationContext = { interaction, env, t, userId, logger };

  try {
    switch (action) {
      case 'pending':
        await handlePendingAction(ctx);
        break;

      case 'approve':
        await handleApproveAction(ctx, presetId);
        break;

      case 'reject':
        await handleRejectAction(ctx, presetId);
        break;

      case 'stats':
        await handleStatsAction(ctx);
        break;

      default:
        await sendModerationResponse(ctx, {
          // FINDING-019: the option value is client-supplied text
          embeds: [errorEmbed(t.t('common.error'), `Unknown action: ${sanitizeEmbedText(action, 64)}`)],
        });
    }
  } catch (error) {
    if (logger) {
      logger.error('Moderate error', error instanceof Error ? error : undefined);
    }
    // MOD-8 (FINDING-034): 4xx API messages are actionable and pass through;
    // 5xx bodies, D1 and other internals fall back to the generic text.
    await sendModerationResponse(ctx, {
      embeds: [errorEmbed(t.t('common.error'), sanitizeErrorMessage(error, 'Moderation action failed.'))],
    });
  }
}

/** MOD-4: shown when an approve action targets a banned author's preset. */
const AUTHOR_BANNED_MESSAGE =
  'Cannot approve: the author is currently banned from Preset Palettes. Reject the preset or lift the ban first.';

/**
 * FINDING-020: ban / unban targets must be a Discord snowflake OR an XIVAuth
 * UUID before they reach D1 or a custom_id (BUG-001 path (a), 2026-09-16
 * deep-dive — see `isBanTargetId`).
 */
const INVALID_USER_ID_MESSAGE = 'Invalid user ID. Pick a user from the suggestions.';

// ============================================================================
// /preset ban_user
// ============================================================================

async function handleBanUserSubcommand(
  interaction: DiscordInteraction, env: Env, _ctx: ExecutionContext, t: Translator,
  userId: string, options?: Array<{name:string;value?:string|number|boolean}>,
  logger?: ExtendedLogger
): Promise<Response> {
  return accountReview(interaction,env,t,userId,'ban',options,logger);
}

async function handleUnbanUserSubcommand(
  interaction: DiscordInteraction, env: Env, _ctx: ExecutionContext, t: Translator,
  userId: string, options?: Array<{name:string;value?:string|number|boolean}>,
  logger?: ExtendedLogger
): Promise<Response> {
  return accountReview(interaction,env,t,userId,'unban',options,logger);
}

async function accountReview(
  interaction: DiscordInteraction, env: Env, t: Translator, actorId: string,
  action: 'ban'|'unban', options?: Array<{name:string;value?:string|number|boolean}>,
  logger?: ExtendedLogger
): Promise<Response> {
  if (!linkedBansEnabled(env)) return ephemeralResponse(INACTIVE_BANS);
  if (!isInModerationChannel(interaction,env)) return ephemeralResponse(t.t('ban.channelRestricted'));
  if (!parseModeratorIds(env.MODERATOR_IDS).has(actorId)) return ephemeralResponse(t.t('ban.permissionDenied'));
  const target = options?.find(option => option.name === 'user')?.value;
  const additional = options?.find(option => option.name === 'additional_user')?.value;
  if (typeof target !== 'string' || !isBanTargetId(target) ||
      (additional !== undefined && (action !== 'ban' || typeof additional !== 'string' || !isBanTargetId(additional)))) {
    return ephemeralResponse(INVALID_USER_ID_MESSAGE);
  }
  try {
    const review = await createBanReview(env,actorId,action,[target,...(typeof additional === 'string'?[additional]:[])]);
    return Response.json({type:4,data:reviewMessage(review)});
  } catch (error) {
    if (error instanceof Error && error.message === BAN_SCOPE_OVERFLOW) {
      return ephemeralResponse(BAN_SCOPE_OVERFLOW);
    }
    if (!isExpectedBanRefusal(error)) {
      logger?.error(
        'Account ban review could not be created',
        error instanceof Error ? error : undefined,
      );
    }
    return ephemeralResponse(REVIEW_UNAVAILABLE);
  }
}
