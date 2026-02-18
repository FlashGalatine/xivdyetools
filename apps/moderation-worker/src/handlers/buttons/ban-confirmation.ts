/**
 * Ban Confirmation Button Handlers
 *
 * Handles Yes/No buttons on the ban confirmation message.
 *
 * Button custom_id patterns:
 * - ban_confirm_{discordId}_{username} - Confirm ban (opens reason modal)
 * - ban_cancel_{discordId} - Cancel ban
 */

import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { ephemeralResponse, decodeBase64Url, encodeBase64Url } from '../../utils/response.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import * as presetApi from '../../services/preset-api.js';

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
 * Handle the ban confirm button click
 */
export async function handleBanConfirmButton(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  if (!userId) {
    return ephemeralResponse('Invalid button interaction.');
  }

  if (!presetApi.isModerator(env, userId)) {
    return ephemeralResponse('You do not have permission to ban users.');
  }

  // Parse custom_id: ban_confirm_{discordId}_{base64username}
  const idPart = customId.replace('ban_confirm_', '');
  const underscoreIndex = idPart.indexOf('_');

  if (underscoreIndex === -1) {
    return ephemeralResponse('Invalid button data.');
  }

  const targetUserId = idPart.substring(0, underscoreIndex);
  const encodedUsername = idPart.substring(underscoreIndex + 1);

  let targetUsername: string;
  try {
    targetUsername = decodeBase64Url(encodedUsername);
  } catch (error) {
    logger?.error(
      'Failed to decode username from button custom_id',
      error instanceof Error ? error : undefined
    );
    return ephemeralResponse('Invalid button data.');
  }

  if (!targetUserId) {
    return ephemeralResponse('Invalid target user.');
  }

  return Response.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `ban_reason_modal_${targetUserId}_${encodeBase64Url(targetUsername)}`,
      title: 'Ban Reason',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'ban_reason',
              label: 'Reason for banning this user',
              style: 2,
              min_length: 10,
              max_length: 500,
              required: true,
              placeholder: 'Explain why this user is being banned from Preset Palettes...',
            },
          ],
        },
      ],
    },
  });
}

/**
 * Handle the ban cancel button click
 */
export async function handleBanCancelButton(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger
): Promise<Response> {
  return Response.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [
        {
          title: '\u274C Ban Cancelled',
          description: 'The ban action was cancelled.',
          color: 0x5865f2,
        },
      ],
      components: [],
    },
  });
}

/**
 * Check if a custom_id is a ban confirmation button
 */
export function isBanConfirmButton(customId: string): boolean {
  return customId.startsWith('ban_confirm_');
}

/**
 * Check if a custom_id is a ban cancel button
 */
export function isBanCancelButton(customId: string): boolean {
  return customId.startsWith('ban_cancel_');
}
