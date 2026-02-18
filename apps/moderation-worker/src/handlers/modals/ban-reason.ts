/**
 * Ban Reason Modal Handler
 *
 * Handles the modal submission when a moderator provides a ban reason.
 *
 * Modal custom_id pattern: ban_reason_modal_{discordId}_{username}
 */

import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { errorEmbed, decodeBase64Url, sanitizeErrorMessage } from '../../utils/response.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { sendMessage } from '../../utils/discord-api.js';
import * as presetApi from '../../services/preset-api.js';
import * as banService from '../../services/ban-service.js';
// MOD-REF-002 FIX: Use shared modal types and helpers
import type { ModalInteraction } from '../../types/modal.js';
import { extractTextInputValue, getModalUserId, getModalUsername } from '../../types/modal.js';

// ============================================================================
// Handlers
// ============================================================================

/**
 * Handle the ban reason modal submission
 */
export async function handleBanReasonModal(
  interaction: ModalInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';
  const moderatorId = getModalUserId(interaction);
  const moderatorName = getModalUsername(interaction);

  if (!moderatorId) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'Invalid modal submission.')],
        flags: 64,
      },
    });
  }

  if (!presetApi.isModerator(env, moderatorId)) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'You do not have permission to ban users.')],
        flags: 64,
      },
    });
  }

  // Parse custom_id: ban_reason_modal_{discordId}_{base64username}
  const idPart = customId.replace('ban_reason_modal_', '');
  const underscoreIndex = idPart.indexOf('_');

  if (underscoreIndex === -1) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'Invalid modal data.')],
        flags: 64,
      },
    });
  }

  const targetUserId = idPart.substring(0, underscoreIndex);
  const encodedUsername = idPart.substring(underscoreIndex + 1);

  let targetUsername: string;
  try {
    targetUsername = decodeBase64Url(encodedUsername);
  } catch (error) {
    logger?.error(
      'Failed to decode username from modal custom_id',
      error instanceof Error ? error : undefined
    );
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'Invalid modal data.')],
        flags: 64,
      },
    });
  }

  if (!targetUserId) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'Invalid target user.')],
        flags: 64,
      },
    });
  }

  const reason = extractTextInputValue(interaction.data?.components, 'ban_reason');

  if (!reason || reason.length < 10) {
    return Response.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [errorEmbed('Error', 'Please provide a valid ban reason (at least 10 characters).')],
        flags: 64,
      },
    });
  }

  ctx.waitUntil(
    processBan(interaction, env, targetUserId, targetUsername, moderatorId, moderatorName, reason, logger)
  );

  return Response.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [
        {
          title: '\u23F3 Processing Ban...',
          description: `Banning **${targetUsername}** and hiding their presets...`,
          color: 0xfee75c,
        },
      ],
      components: [],
    },
  });
}

async function processBan(
  interaction: ModalInteraction,
  env: Env,
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorName: string,
  reason: string,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const result = await banService.banUser(env.DB, targetUserId, targetUsername, moderatorId, reason);

    if (!result.success) {
      if (env.MODERATION_CHANNEL_ID) {
        await sendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, {
          embeds: [
            errorEmbed('Ban Failed', result.error || 'Unknown error occurred.'),
          ],
        });
      }
      return;
    }

    if (env.MODERATION_CHANNEL_ID) {
      await sendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, {
        embeds: [
          {
            title: '\uD83D\uDD28 User Banned',
            description: `**${targetUsername}** has been banned from Preset Palettes.`,
            color: 0xed4245,
            fields: [
              { name: 'User ID', value: targetUserId, inline: true },
              { name: 'Presets Hidden', value: String(result.presetsHidden), inline: true },
              { name: 'Banned By', value: moderatorName, inline: true },
              { name: 'Reason', value: reason, inline: false },
            ],
            footer: { text: 'Use /preset unban_user to restore access' },
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }

    if (logger) {
      logger.info('User banned', {
        targetUserId,
        targetUsername,
        moderatorId,
        presetsHidden: result.presetsHidden,
        reason,
      });
    }
  } catch (error) {
    if (logger) {
      logger.error('Failed to ban user', error instanceof Error ? error : undefined);
    }

    if (env.MODERATION_CHANNEL_ID) {
      await sendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, {
        embeds: [
          errorEmbed(
            'Ban Failed',
            `Failed to ban **${targetUsername}**: ${sanitizeErrorMessage(error, 'An unexpected error occurred while processing the ban.')}`
          ),
        ],
      });
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a custom_id is a ban reason modal
 */
export function isBanReasonModal(customId: string): boolean {
  return customId.startsWith('ban_reason_modal_');
}
