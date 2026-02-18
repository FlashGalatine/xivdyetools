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
import { errorEmbed, sanitizeErrorMessage } from '../../utils/response.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { editMessage, sendMessage } from '../../utils/discord-api.js';
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
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'Invalid modal submission.')],
        flags: 64,
      },
    });
  }

  if (!presetApi.isModerator(env, userId)) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'You do not have permission to reject presets.')],
        flags: 64,
      },
    });
  }

  const reason = extractTextInputValue(interaction.data?.components, 'rejection_reason');

  if (!reason || reason.length < 10) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'Please provide a valid rejection reason (at least 10 characters).')],
        flags: 64,
      },
    });
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

    if (interaction.channel_id && interaction.message?.id) {
      const originalEmbed = interaction.message.embeds?.[0] || {};

      await editMessage(env.DISCORD_TOKEN, interaction.channel_id, interaction.message.id, {
        embeds: [
          {
            title: `\u274C Preset Rejected`,
            description: originalEmbed.description,
            color: STATUS_DISPLAY.rejected.color,
            fields: [
              ...(originalEmbed.fields || []),
              { name: 'Action', value: `Rejected by ${userName}`, inline: true },
              { name: 'Reason', value: reason, inline: false },
            ],
            footer: originalEmbed.footer?.text ? { text: originalEmbed.footer.text } : undefined,
            timestamp: originalEmbed.timestamp,
          },
        ],
        components: [],
      });
    }

    if (env.SUBMISSION_LOG_CHANNEL_ID) {
      await sendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
        embeds: [
          {
            title: `\u274C ${preset.name} - Rejected`,
            description: `Preset rejected by ${userName}`,
            color: STATUS_DISPLAY.rejected.color,
            fields: [{ name: 'Reason', value: reason }],
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

      await editMessage(env.DISCORD_TOKEN, interaction.channel_id, interaction.message.id, {
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
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'Invalid modal submission.')],
        flags: 64,
      },
    });
  }

  if (!presetApi.isModerator(env, userId)) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'You do not have permission to revert presets.')],
        flags: 64,
      },
    });
  }

  const reason = extractTextInputValue(interaction.data?.components, 'revert_reason');

  if (!reason || reason.length < 10) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'Please provide a valid revert reason (at least 10 characters).')],
        flags: 64,
      },
    });
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

    if (interaction.channel_id && interaction.message?.id) {
      await editMessage(env.DISCORD_TOKEN, interaction.channel_id, interaction.message.id, {
        embeds: [
          {
            title: `\u21A9\uFE0F Preset Edit Reverted`,
            description: `The preset has been restored to its previous state.`,
            color: 0x5865f2,
            fields: [
              { name: 'Preset', value: preset.name, inline: true },
              { name: 'Action', value: `Reverted by ${userName}`, inline: true },
              { name: 'Reason', value: reason, inline: false },
            ],
            footer: { text: `ID: ${preset.id}` },
            timestamp: new Date().toISOString(),
          },
        ],
        components: [],
      });
    }

    if (env.SUBMISSION_LOG_CHANNEL_ID) {
      await sendMessage(env.DISCORD_TOKEN, env.SUBMISSION_LOG_CHANNEL_ID, {
        embeds: [
          {
            title: `\u21A9\uFE0F ${preset.name} - Edit Reverted`,
            description: `Preset edit reverted by ${userName}`,
            color: 0x5865f2,
            fields: [{ name: 'Reason', value: reason }],
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

      await editMessage(env.DISCORD_TOKEN, interaction.channel_id, interaction.message.id, {
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
