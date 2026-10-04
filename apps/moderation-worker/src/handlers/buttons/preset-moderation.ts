/**
 * Preset Moderation Button Handlers
 *
 * Handles approve/reject/revert buttons on moderation messages.
 *
 * Button custom_id patterns (FINDING-017 — full grammar in
 * `utils/review-custom-id.ts`):
 * - preset_approve_{presetId}:{revision}:{status} - Approve the reviewed revision
 * - preset_reject_{presetId}:{revision}:{status}  - Opens the rejection reason modal
 * - preset_revert_{presetId}:{revision}:{status}  - Opens the revert reason modal
 *
 * The same three without `:{revision}:{status}` are LEGACY ids, on messages
 * posted before revision binding. A legacy click never acts and never opens a
 * modal: it refreshes the message to the preset's current text with new
 * revision-bound buttons and asks the moderator to review and click again.
 */

import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { ephemeralResponse, sanitizeErrorMessage } from '../../utils/response.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { safeSendMessage } from '../../utils/discord-api.js';
import * as presetApi from '../../services/preset-api.js';
import * as banService from '../../services/ban-service.js';
import { STATUS_DISPLAY, PresetReviewConflictError } from '../../types/preset.js';
import { sanitizeName, sanitizeUserName } from '../../utils/embed-text.js';
import { buildReviewCustomId, parseReviewCustomId } from '../../utils/review-custom-id.js';
import type { ParsedReviewId, ReviewBinding, ReviewKind } from '../../utils/review-custom-id.js';
import { editReviewMessage, refreshReview } from '../review-message.js';

/** MOD-4: shown when the approve button targets a banned author's preset. */
const AUTHOR_BANNED_MESSAGE =
  'the author is currently banned from Preset Palettes — reject the preset or lift the ban first.';

/** A legacy click that has no message to refresh (it should always have one). */
const NO_MESSAGE_TO_REFRESH =
  'This button is out of date. Use /preset moderate to review the preset.';

// ============================================================================
// Types
// ============================================================================

interface ButtonInteraction {
  id: string;
  token: string;
  application_id: string;
  channel_id?: string;
  message?: {
    id: string;
    /** Discord message flags — 64 marks an ephemeral message (the /preset moderate confirmation) */
    flags?: number;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: { text?: string };
      timestamp?: string;
    }>;
  };
  member?: {
    user: {
      id: string;
      username: string;
    };
  };
  user?: {
    id: string;
    username: string;
  };
  data?: {
    custom_id?: string;
    component_type?: number;
  };
}

// ============================================================================
// Shared click preamble
// ============================================================================

const PREFIXES = {
  approve: 'preset_approve_',
  reject: 'preset_reject_',
  revert: 'preset_revert_',
} as const;

type ClickKind = keyof typeof PREFIXES;

type Click =
  | { response: Response }
  | { parsed: ParsedReviewId; userId: string; userName: string };

/**
 * Identify the click, validate its custom_id and check the moderator. Anything
 * that fails answers ephemerally and nothing else happens.
 */
function resolveClick(interaction: ButtonInteraction, env: Env, kind: ClickKind): Click {
  const customId = interaction.data?.custom_id || '';
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const userName = interaction.member?.user?.username ?? interaction.user?.username ?? 'Moderator';
  const rest = customId.slice(PREFIXES[kind].length);

  if (!rest || !userId) {
    return { response: ephemeralResponse('Invalid button interaction.') };
  }

  // FINDING-017: strict parse — uuid, integer revision, known status, <= 100 chars
  const parsed = parseReviewCustomId(customId);
  if (!parsed || parsed.kind !== kind) {
    return { response: ephemeralResponse('Invalid preset ID format.') };
  }

  if (!presetApi.isModerator(env, userId)) {
    return { response: ephemeralResponse(`You do not have permission to ${kind} presets.`) };
  }

  return { parsed, userId, userName };
}

/**
 * A legacy (revision-less) click: refresh the message, act on nothing.
 * Answered with a deferred update; the refresh runs in the background.
 */
function refreshInstead(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  presetId: string,
  userId: string,
  logger?: ExtendedLogger
): Response {
  if (!interaction.channel_id || !interaction.message?.id) {
    return ephemeralResponse(NO_MESSAGE_TO_REFRESH);
  }
  ctx.waitUntil(refreshReview(interaction, env, presetId, userId, logger));
  return Response.json({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Handle the Approve button click
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handlePresetApproveButton(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const click = resolveClick(interaction, env, 'approve');
  if ('response' in click) return click.response;
  const { parsed, userId, userName } = click;

  if (!parsed.binding) {
    return refreshInstead(interaction, env, ctx, parsed.presetId, userId, logger);
  }

  ctx.waitUntil(
    processApproval(interaction, env, parsed.presetId, parsed.binding, userId, userName, logger)
  );

  return Response.json({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });
}

async function processApproval(
  interaction: ButtonInteraction,
  env: Env,
  presetId: string,
  binding: ReviewBinding,
  userId: string,
  userName: string,
  logger?: ExtendedLogger
): Promise<void> {
  // FINDING-019: the moderator's Discord name is user-controlled text
  const safeModerator = sanitizeUserName(userName);

  try {
    // MOD-4 (FINDING-034, 2026-08-21 audit): a ban hides only the author's
    // approved presets, so their pending / flagged entries would otherwise
    // still be approvable from the moderation embed
    if (await banService.isPresetAuthorBanned(env.DB, presetId)) {
      const originalEmbed = interaction.message?.embeds?.[0] || {};
      await editReviewMessage(env, interaction, {
        embeds: [
          {
            title: originalEmbed.title,
            description: originalEmbed.description,
            color: originalEmbed.color,
            fields: [
              ...(originalEmbed.fields || []),
              { name: 'Error', value: `Not approved: ${AUTHOR_BANNED_MESSAGE}`, inline: false },
            ],
            footer: originalEmbed.footer?.text ? { text: originalEmbed.footer.text } : undefined,
            timestamp: originalEmbed.timestamp,
          },
        ],
      });
      return;
    }

    const preset = await presetApi.approvePreset(env, presetId, userId, binding);
    const safeName = sanitizeName(preset.name); // FINDING-019 (author-controlled)

    const originalEmbed = interaction.message?.embeds?.[0] || {};
    await editReviewMessage(env, interaction, {
      embeds: [
        {
          title: `✅ Preset Approved`,
          description: originalEmbed.description,
          color: STATUS_DISPLAY.approved.color,
          fields: [
            ...(originalEmbed.fields || []),
            { name: 'Action', value: `Approved by ${safeModerator}`, inline: false },
          ],
          footer: originalEmbed.footer?.text ? { text: originalEmbed.footer.text } : undefined,
          timestamp: originalEmbed.timestamp,
        },
      ],
      components: [],
    });

    if (env.SUBMISSION_LOG_CHANNEL_ID) {
      await safeSendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
        embeds: [
          {
            title: `✅ ${safeName} - Approved`,
            description: `Preset approved by ${safeModerator}`,
            color: STATUS_DISPLAY.approved.color,
            footer: { text: `ID: ${preset.id}` },
          },
        ],
      });
    }
  } catch (error) {
    // FINDING-017: the preset changed since this was reviewed — nothing was
    // approved; show the current text with fresh buttons
    if (error instanceof PresetReviewConflictError) {
      logger?.warn('Approve refused: stale review', { presetId, code: error.code });
      await refreshReview(interaction, env, presetId, userId, logger);
      return;
    }

    if (logger) {
      logger.error('Failed to approve preset', error instanceof Error ? error : undefined);
    }

    const originalEmbed = interaction.message?.embeds?.[0] || {};
    await editReviewMessage(env, interaction, {
      embeds: [
        {
          title: originalEmbed.title,
          description: originalEmbed.description,
          color: originalEmbed.color,
          fields: [
            ...(originalEmbed.fields || []),
            {
              name: 'Error',
              value: `Failed to approve: ${sanitizeErrorMessage(error, 'Unable to approve preset.')}`,
              inline: false,
            },
          ],
          footer: originalEmbed.footer?.text ? { text: originalEmbed.footer.text } : undefined,
          timestamp: originalEmbed.timestamp,
        },
      ],
    });
  }
}

/**
 * The reason modal a revision-bound Reject / Revert click opens. The modal's
 * custom_id repeats the revision and status, so the submit is bound to the
 * same review as the click.
 */
function reasonModal(
  kind: Extract<ReviewKind, 'reject_modal' | 'revert_modal'>,
  presetId: string,
  binding: ReviewBinding
): Response {
  const isReject = kind === 'reject_modal';
  return Response.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: buildReviewCustomId(kind, presetId, binding),
      title: isReject ? 'Reject Preset' : 'Revert Preset Edit',
      components: [
        {
          type: 1,
          components: [
            isReject
              ? {
                  type: 4,
                  custom_id: 'rejection_reason',
                  label: 'Reason for rejection',
                  style: 2,
                  min_length: 10,
                  max_length: 500,
                  required: true,
                  placeholder: 'Please provide a clear reason for rejecting this preset...',
                }
              : {
                  type: 4,
                  custom_id: 'revert_reason',
                  label: 'Reason for reverting',
                  style: 2,
                  min_length: 10,
                  max_length: 200,
                  required: true,
                  placeholder: 'Explain why the edit is being reverted...',
                },
          ],
        },
      ],
    },
  });
}

/**
 * Handle the Reject button click - shows modal for reason
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handlePresetRejectButton(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const click = resolveClick(interaction, env, 'reject');
  if ('response' in click) return click.response;
  const { parsed, userId } = click;

  // A legacy button opens no modal — the reason would be bound to nothing
  if (!parsed.binding) {
    return refreshInstead(interaction, env, ctx, parsed.presetId, userId, logger);
  }

  return reasonModal('reject_modal', parsed.presetId, parsed.binding);
}

/**
 * Handle the Revert button click - shows modal for reason
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handlePresetRevertButton(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const click = resolveClick(interaction, env, 'revert');
  if ('response' in click) return click.response;
  const { parsed, userId } = click;

  if (!parsed.binding) {
    return refreshInstead(interaction, env, ctx, parsed.presetId, userId, logger);
  }

  return reasonModal('revert_modal', parsed.presetId, parsed.binding);
}
