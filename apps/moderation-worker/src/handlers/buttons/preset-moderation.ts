/**
 * Preset Moderation Button Handlers
 *
 * Handles approve/reject/revert buttons on moderation messages.
 *
 * Button custom_id patterns:
 * - preset_approve_{presetId} - Approve a pending preset
 * - preset_reject_{presetId} - Opens rejection reason modal
 * - preset_revert_{presetId} - Opens revert reason modal
 */

import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { ephemeralResponse, isValidUuid, sanitizeErrorMessage } from '../../utils/response.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { editMessage, sendMessage } from '../../utils/discord-api.js';
import * as presetApi from '../../services/preset-api.js';
import { STATUS_DISPLAY } from '../../types/preset.js';

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
// Handlers
// ============================================================================

/**
 * Handle the Approve button click
 */
export async function handlePresetApproveButton(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';
  const presetId = customId.replace('preset_approve_', '');
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const userName = interaction.member?.user?.username ?? interaction.user?.username ?? 'Moderator';

  if (!presetId || !userId) {
    return ephemeralResponse('Invalid button interaction.');
  }

  if (!isValidUuid(presetId)) {
    return ephemeralResponse('Invalid preset ID format.');
  }

  if (!presetApi.isModerator(env, userId)) {
    return ephemeralResponse('You do not have permission to approve presets.');
  }

  ctx.waitUntil(processApproval(interaction, env, presetId, userId, userName, logger));

  return Response.json({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });
}

async function processApproval(
  interaction: ButtonInteraction,
  env: Env,
  presetId: string,
  userId: string,
  userName: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const preset = await presetApi.approvePreset(env, presetId, userId);

    if (interaction.channel_id && interaction.message?.id) {
      const originalEmbed = interaction.message.embeds?.[0] || {};

      await editMessage(env.DISCORD_TOKEN, interaction.channel_id, interaction.message.id, {
        embeds: [
          {
            title: `\u2705 Preset Approved`,
            description: originalEmbed.description,
            color: STATUS_DISPLAY.approved.color,
            fields: [
              ...(originalEmbed.fields || []),
              { name: 'Action', value: `Approved by ${userName}`, inline: false },
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
            title: `\u2705 ${preset.name} - Approved`,
            description: `Preset approved by ${userName}`,
            color: STATUS_DISPLAY.approved.color,
            footer: { text: `ID: ${preset.id}` },
          },
        ],
      });
    }
  } catch (error) {
    if (logger) {
      logger.error('Failed to approve preset', error instanceof Error ? error : undefined);
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
}

/**
 * Handle the Reject button click - shows modal for reason
 */
export async function handlePresetRejectButton(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';
  const presetId = customId.replace('preset_reject_', '');
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  if (!presetId || !userId) {
    return ephemeralResponse('Invalid button interaction.');
  }

  if (!isValidUuid(presetId)) {
    return ephemeralResponse('Invalid preset ID format.');
  }

  if (!presetApi.isModerator(env, userId)) {
    return ephemeralResponse('You do not have permission to reject presets.');
  }

  return Response.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `preset_reject_modal_${presetId}`,
      title: 'Reject Preset',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'rejection_reason',
              label: 'Reason for rejection',
              style: 2,
              min_length: 10,
              max_length: 500,
              required: true,
              placeholder: 'Please provide a clear reason for rejecting this preset...',
            },
          ],
        },
      ],
    },
  });
}

/**
 * Handle the Revert button click - shows modal for reason
 */
export async function handlePresetRevertButton(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';
  const presetId = customId.replace('preset_revert_', '');
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  if (!presetId || !userId) {
    return ephemeralResponse('Invalid button interaction.');
  }

  if (!isValidUuid(presetId)) {
    return ephemeralResponse('Invalid preset ID format.');
  }

  if (!presetApi.isModerator(env, userId)) {
    return ephemeralResponse('You do not have permission to revert presets.');
  }

  return Response.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `preset_revert_modal_${presetId}`,
      title: 'Revert Preset Edit',
      components: [
        {
          type: 1,
          components: [
            {
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
 * Check if a custom_id is a preset moderation button
 */
export function isPresetModerationButton(customId: string): boolean {
  return (
    customId.startsWith('preset_approve_') ||
    customId.startsWith('preset_reject_') ||
    customId.startsWith('preset_revert_')
  );
}
