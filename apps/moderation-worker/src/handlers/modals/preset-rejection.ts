/**
 * Preset Rejection Modal Handler
 *
 * Handles the modal submission when a moderator provides a rejection or revert reason.
 *
 * Modal custom_id patterns:
 * - preset_reject_modal_{presetId}
 * - preset_revert_modal_{presetId}
 */

import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import {
  errorEmbed,
  ephemeralResponse,
  isValidUuid,
  sanitizeErrorMessage,
} from '../../utils/response.js';
import { sanitizeName, sanitizeUserName, sanitizeReason } from '../../utils/embed-text.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { safeEditMessage, safeSendMessage } from '../../utils/discord-api.js';
import * as presetApi from '../../services/preset-api.js';
import { STATUS_DISPLAY } from '../../types/preset.js';
// MOD-REF-002 FIX: Use shared modal types and helpers
import type { ModalInteraction } from '../../types/modal.js';
import { extractTextInputValue, getModalUserId, getModalUsername } from '../../types/modal.js';

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
  const customId = interaction.data?.custom_id || '';
  const presetId = customId.replace('preset_reject_modal_', '');
  const userId = getModalUserId(interaction);
  const userName = getModalUsername(interaction);

  if (!presetId || !userId) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Invalid modal submission.')] });
  }

  // MOD-5 / FINDING-020 (2026-08-21 audit): same UUID gate as the button and
  // slash paths — the id goes into a presets-api path segment
  if (!isValidUuid(presetId)) {
    logger?.warn('Rejection modal with a malformed preset id', { customId });
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Invalid preset ID format.')] });
  }

  if (!presetApi.isModerator(env, userId)) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'You do not have permission to reject presets.')] });
  }

  const reason = extractTextInputValue(interaction.data?.components, 'rejection_reason');

  if (!reason || reason.length < 10) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Please provide a valid rejection reason (at least 10 characters).')] });
  }

  ctx.waitUntil(processRejection(interaction, env, presetId, userId, userName, reason, logger));

  return Response.json({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });
}

async function processRejection(
  interaction: ModalInteraction,
  env: Env,
  presetId: string,
  userId: string,
  userName: string,
  reason: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const preset = await presetApi.rejectPreset(env, presetId, userId, reason);
    // FINDING-019: moderator name (Discord-controlled), reason (typed) and
    // preset name (author-controlled) are all rendered — sanitise each
    const safeModerator = sanitizeUserName(userName);
    const safeReason = sanitizeReason(reason);
    const safeName = sanitizeName(preset.name);

    if (interaction.channel_id && interaction.message?.id) {
      const originalEmbed = interaction.message.embeds?.[0] || {};

      await safeEditMessage(env.DISCORD_TOKEN, interaction.channel_id, interaction.message.id, {
        embeds: [
          {
            title: `\u274C Preset Rejected`,
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
    }

    if (env.SUBMISSION_LOG_CHANNEL_ID) {
      await safeSendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
        embeds: [
          {
            title: `\u274C ${safeName} - Rejected`,
            description: `Preset rejected by ${safeModerator}`,
            color: STATUS_DISPLAY.rejected.color,
            fields: [{ name: 'Reason', value: safeReason }],
            footer: { text: `ID: ${preset.id}` },
          },
        ],
      });
    }
  } catch (error) {
    if (logger) {
      logger.error('Failed to reject preset', error instanceof Error ? error : undefined);
    }

    if (interaction.channel_id && interaction.message?.id) {
      const originalEmbed = interaction.message.embeds?.[0] || {};

      await safeEditMessage(env.DISCORD_TOKEN, interaction.channel_id, interaction.message.id, {
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
  const customId = interaction.data?.custom_id || '';
  const presetId = customId.replace('preset_revert_modal_', '');
  const userId = getModalUserId(interaction);
  const userName = getModalUsername(interaction);

  if (!presetId || !userId) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Invalid modal submission.')] });
  }

  // MOD-5 / FINDING-020: UUID gate, same as the button and slash paths
  if (!isValidUuid(presetId)) {
    logger?.warn('Revert modal with a malformed preset id', { customId });
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Invalid preset ID format.')] });
  }

  if (!presetApi.isModerator(env, userId)) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'You do not have permission to revert presets.')] });
  }

  const reason = extractTextInputValue(interaction.data?.components, 'revert_reason');

  if (!reason || reason.length < 10) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Please provide a valid revert reason (at least 10 characters).')] });
  }

  ctx.waitUntil(processRevert(interaction, env, presetId, userId, userName, reason, logger));

  return Response.json({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });
}

async function processRevert(
  interaction: ModalInteraction,
  env: Env,
  presetId: string,
  userId: string,
  userName: string,
  reason: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const preset = await presetApi.revertPreset(env, presetId, reason, userId);
    // FINDING-019
    const safeModerator = sanitizeUserName(userName);
    const safeReason = sanitizeReason(reason);
    const safeName = sanitizeName(preset.name);

    if (interaction.channel_id && interaction.message?.id) {
      await safeEditMessage(env.DISCORD_TOKEN, interaction.channel_id, interaction.message.id, {
        embeds: [
          {
            title: `\u21A9\uFE0F Preset Edit Reverted`,
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
    }

    if (env.SUBMISSION_LOG_CHANNEL_ID) {
      await safeSendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
        embeds: [
          {
            title: `\u21A9\uFE0F ${safeName} - Edit Reverted`,
            description: `Preset edit reverted by ${safeModerator}`,
            color: 0x5865f2,
            fields: [{ name: 'Reason', value: safeReason }],
            footer: { text: `ID: ${preset.id}` },
          },
        ],
      });
    }
  } catch (error) {
    if (logger) {
      logger.error('Failed to revert preset', error instanceof Error ? error : undefined);
    }

    if (interaction.channel_id && interaction.message?.id) {
      const originalEmbed = interaction.message.embeds?.[0] || {};

      await safeEditMessage(env.DISCORD_TOKEN, interaction.channel_id, interaction.message.id, {
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
