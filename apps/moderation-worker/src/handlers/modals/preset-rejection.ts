/**
 * Preset Rejection Modal Handler
 *
 * Handles the modal submission when a moderator provides a rejection or revert reason.
 *
 * Modal custom_id patterns (FINDING-017 — full grammar in `utils/review-custom-id.ts`):
 * - preset_reject_modal_{presetId}:{revision}:{status}
 * - preset_revert_modal_{presetId}:{revision}:{status}
 *
 * The same two without `:{revision}:{status}` are LEGACY ids — a modal opened
 * from a button posted before revision binding and submitted after the deploy.
 * A legacy submit never acts: the message is refreshed to the preset's current
 * text with new revision-bound buttons and the moderator is asked to review and
 * click again.
 */

import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { errorEmbed, ephemeralResponse, sanitizeErrorMessage } from '../../utils/response.js';
import { sanitizeName, sanitizeUserName, sanitizeReason } from '../../utils/embed-text.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { safeSendMessage } from '../../utils/discord-api.js';
import * as presetApi from '../../services/preset-api.js';
import * as banService from '../../services/ban-service.js';
import { STATUS_DISPLAY, PresetReviewConflictError } from '../../types/preset.js';
import { MIN_REJECTION_REASON_LENGTH } from '../commands/preset.js';
import { parseReviewCustomId } from '../../utils/review-custom-id.js';
import type { ParsedReviewId, ReviewBinding } from '../../utils/review-custom-id.js';
import { editReviewMessage, refreshReview } from '../review-message.js';
// MOD-REF-002 FIX: Use shared modal types and helpers
import type { ModalInteraction } from '../../types/modal.js';
import { extractTextInputValue, getModalUserId, getModalUsername } from '../../types/modal.js';

// ============================================================================
// Shared submit preamble
// ============================================================================

const MODAL_PREFIXES = {
  reject_modal: 'preset_reject_modal_',
  revert_modal: 'preset_revert_modal_',
} as const;

type ModalKind = keyof typeof MODAL_PREFIXES;

type Submit =
  | { response: Response }
  | { parsed: ParsedReviewId; userId: string; userName: string };

/**
 * Identify the submitter, validate the modal's custom_id and check the
 * moderator. Anything that fails answers ephemerally and nothing else happens.
 */
function resolveSubmit(
  interaction: ModalInteraction,
  env: Env,
  kind: ModalKind,
  logger?: ExtendedLogger
): Submit {
  const customId = interaction.data?.custom_id || '';
  const userId = getModalUserId(interaction);
  const rest = customId.slice(MODAL_PREFIXES[kind].length);

  if (!rest || !userId) {
    return {
      response: ephemeralResponse({ embeds: [errorEmbed('Error', 'Invalid modal submission.')] }),
    };
  }

  // MOD-5 / FINDING-020 (2026-08-21 audit): same strict gate as the button and
  // slash paths — the id goes into a presets-api path segment. FINDING-017
  // extends it to the revision and status riding behind the id.
  const parsed = parseReviewCustomId(customId);
  if (!parsed || parsed.kind !== kind) {
    logger?.warn('Review modal with a malformed custom_id', { customId });
    return {
      response: ephemeralResponse({ embeds: [errorEmbed('Error', 'Invalid preset ID format.')] }),
    };
  }

  if (!presetApi.isModerator(env, userId)) {
    const verb = kind === 'reject_modal' ? 'reject' : 'revert';
    return {
      response: ephemeralResponse({
        embeds: [errorEmbed('Error', `You do not have permission to ${verb} presets.`)],
      }),
    };
  }

  return { parsed, userId, userName: getModalUsername(interaction) };
}

const DEFERRED_UPDATE = (): Response =>
  Response.json({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });

// ============================================================================
// Handlers
// ============================================================================

/**
 * Handle the rejection reason modal submission
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handlePresetRejectionModal(
  interaction: ModalInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const submit = resolveSubmit(interaction, env, 'reject_modal', logger);
  if ('response' in submit) return submit.response;
  const { parsed, userId, userName } = submit;

  // FINDING-017: a legacy modal names no reviewed revision — refresh, never act
  if (!parsed.binding) {
    ctx.waitUntil(refreshReview(interaction, env, parsed.presetId, userId, logger));
    return DEFERRED_UPDATE();
  }

  const reason = extractTextInputValue(interaction.data?.components, 'rejection_reason');

  if (!reason || reason.trim().length < MIN_REJECTION_REASON_LENGTH) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Please provide a valid rejection reason (at least 10 characters).')] });
  }

  ctx.waitUntil(
    processRejection(interaction, env, parsed.presetId, parsed.binding, userId, userName, reason, logger)
  );

  return DEFERRED_UPDATE();
}

async function processRejection(
  interaction: ModalInteraction,
  env: Env,
  presetId: string,
  binding: ReviewBinding,
  userId: string,
  userName: string,
  reason: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const preset = await presetApi.rejectPreset(env, presetId, userId, reason, binding);
    // FINDING-019: moderator name (Discord-controlled), reason (typed) and
    // preset name (author-controlled) are all rendered — sanitise each
    const safeModerator = sanitizeUserName(userName);
    const safeReason = sanitizeReason(reason);
    const safeName = sanitizeName(preset.name);

    const originalEmbed = interaction.message?.embeds?.[0] || {};
    await editReviewMessage(env, interaction, {
      embeds: [
        {
          title: `❌ Preset Rejected`,
          description: originalEmbed.description,
          color: STATUS_DISPLAY.rejected.color,
          fields: [
            ...(originalEmbed.fields || []),
            { name: 'Action', value: `Rejected by ${safeModerator}`, inline: true },
            { name: 'Reason', value: safeReason, inline: false },
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
            title: `❌ ${safeName} - Rejected`,
            description: `Preset rejected by ${safeModerator}`,
            color: STATUS_DISPLAY.rejected.color,
            fields: [{ name: 'Reason', value: safeReason }],
            footer: { text: `ID: ${preset.id}` },
          },
        ],
      });
    }
  } catch (error) {
    // FINDING-017: the preset changed since this was reviewed — nothing was
    // rejected; show the current text with fresh buttons
    if (error instanceof PresetReviewConflictError) {
      logger?.warn('Reject refused: stale review', { presetId, code: error.code });
      await refreshReview(interaction, env, presetId, userId, logger);
      return;
    }

    if (logger) {
      logger.error('Failed to reject preset', error instanceof Error ? error : undefined);
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
              value: `Failed to reject: ${sanitizeErrorMessage(error, 'Unable to reject preset.')}`,
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
 * Handle the revert reason modal submission
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handlePresetRevertModal(
  interaction: ModalInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const submit = resolveSubmit(interaction, env, 'revert_modal', logger);
  if ('response' in submit) return submit.response;
  const { parsed, userId, userName } = submit;

  // FINDING-017: a legacy modal names no reviewed revision — refresh, never act
  if (!parsed.binding) {
    ctx.waitUntil(refreshReview(interaction, env, parsed.presetId, userId, logger));
    return DEFERRED_UPDATE();
  }

  const reason = extractTextInputValue(interaction.data?.components, 'revert_reason');

  if (!reason || reason.trim().length < MIN_REJECTION_REASON_LENGTH) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Please provide a valid revert reason (at least 10 characters).')] });
  }

  ctx.waitUntil(
    processRevert(interaction, env, parsed.presetId, parsed.binding, userId, userName, reason, logger)
  );

  return DEFERRED_UPDATE();
}

async function processRevert(
  interaction: ModalInteraction,
  env: Env,
  presetId: string,
  binding: ReviewBinding,
  userId: string,
  userName: string,
  reason: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    // A revert sets the preset back to approved (publishes it), so a banned
    // author's pending edit must not be revertable any more than approvable
    if (await banService.isPresetAuthorBanned(env.DB, presetId)) {
      const original = interaction.message?.embeds?.[0] || {};
      await editReviewMessage(env, interaction, {
        embeds: [
          {
            title: original.title,
            description: original.description,
            color: original.color,
            fields: [
              ...(original.fields || []),
              {
                name: 'Error',
                value:
                  'Not reverted: the author is currently banned. Unban them first, or reject the edit instead.',
                inline: false,
              },
            ],
            footer: original.footer?.text ? { text: original.footer.text } : undefined,
            timestamp: original.timestamp,
          },
        ],
      });
      return;
    }

    const preset = await presetApi.revertPreset(env, presetId, reason, userId, binding);
    // FINDING-019
    const safeModerator = sanitizeUserName(userName);
    const safeReason = sanitizeReason(reason);
    const safeName = sanitizeName(preset.name);

    await editReviewMessage(env, interaction, {
      embeds: [
        {
          title: `↩️ Preset Edit Reverted`,
          description: `The preset has been restored to its previous state.`,
          color: 0x5865f2,
          fields: [
            { name: 'Preset', value: safeName, inline: true },
            { name: 'Action', value: `Reverted by ${safeModerator}`, inline: true },
            { name: 'Reason', value: safeReason, inline: false },
          ],
          footer: { text: `ID: ${preset.id}` },
          timestamp: new Date().toISOString(),
        },
      ],
      components: [],
    });

    if (env.SUBMISSION_LOG_CHANNEL_ID) {
      await safeSendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
        embeds: [
          {
            title: `↩️ ${safeName} - Edit Reverted`,
            description: `Preset edit reverted by ${safeModerator}`,
            color: 0x5865f2,
            fields: [{ name: 'Reason', value: safeReason }],
            footer: { text: `ID: ${preset.id}` },
          },
        ],
      });
    }
  } catch (error) {
    // FINDING-017: the preset changed since this was reviewed — nothing was
    // reverted; show the current text with fresh buttons
    if (error instanceof PresetReviewConflictError) {
      logger?.warn('Revert refused: stale review', { presetId, code: error.code });
      await refreshReview(interaction, env, presetId, userId, logger);
      return;
    }

    if (logger) {
      logger.error('Failed to revert preset', error instanceof Error ? error : undefined);
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
              value: `Failed to revert: ${sanitizeErrorMessage(error, 'Unable to revert preset.')}`,
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a custom_id is a preset rejection modal
 */
export function isPresetRejectionModal(customId: string): boolean {
  return customId.startsWith('preset_reject_modal_');
}

/**
 * Check if a custom_id is a preset revert modal
 */
export function isPresetRevertModal(customId: string): boolean {
  return customId.startsWith('preset_revert_modal_');
}
