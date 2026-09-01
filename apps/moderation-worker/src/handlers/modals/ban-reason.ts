/**
 * Ban Reason Modal Handler
 *
 * Handles the modal submission when a moderator provides a ban reason.
 *
 * Modal custom_id pattern: ban_reason_modal_{discordId}_{username}
 */

import type { Env } from '../../types/env.js';
import {
  errorEmbed,
  ephemeralResponse,
  updateMessageResponse,
  decodeBase64Url,
  sanitizeErrorMessage,
} from '../../utils/response.js';
import { sanitizeUserName, sanitizeReason } from '../../utils/embed-text.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { safeSendMessage } from '../../utils/discord-api.js';
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
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Invalid modal submission.')] });
  }

  if (!presetApi.isModerator(env, moderatorId)) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'You do not have permission to ban users.')] });
  }

  // Parse custom_id: ban_reason_modal_{discordId}
  // FINDING-007 (2026-08-21 audit): the id is all the modal carries; the
  // username is resolved from D1 here. Older modals
  // (ban_reason_modal_{discordId}_{base64username}) still work — their
  // suffix is used only as a fallback when D1 has no name.
  const idPart = customId.replace('ban_reason_modal_', '');
  const separator = idPart.indexOf('_');
  const targetUserId = separator === -1 ? idPart : idPart.substring(0, separator);
  const legacyEncodedUsername = separator === -1 ? '' : idPart.substring(separator + 1);

  if (!targetUserId) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Invalid target user.')] });
  }
  // MOD-5: the id must be a Discord snowflake before it reaches D1 or the API
  if (!/^\d{17,20}$/.test(targetUserId)) {
    logger?.warn('Ban reason modal with a malformed target id', { customId });
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Invalid modal data.')] });
  }

  let targetUsername: string | null = null;
  try {
    targetUsername = await banService.getPresetAuthorName(env.DB, targetUserId);
  } catch (error) {
    logger?.error('Failed to resolve target username', error instanceof Error ? error : undefined);
  }
  if (!targetUsername && legacyEncodedUsername) {
    try {
      targetUsername = decodeBase64Url(legacyEncodedUsername);
    } catch {
      // ignore — fall through to the id
    }
  }
  if (!targetUsername) {
    targetUsername = targetUserId;
  }

  const reason = extractTextInputValue(interaction.data?.components, 'ban_reason');

  if (!reason || reason.length < 10) {
    return ephemeralResponse({ embeds: [errorEmbed('Error', 'Please provide a valid ban reason (at least 10 characters).')] });
  }

  ctx.waitUntil(
    processBan(interaction, env, targetUserId, targetUsername, moderatorId, moderatorName, reason, logger)
  );

  return updateMessageResponse({
    embeds: [
      {
        title: '\u23F3 Processing Ban...',
        // FINDING-019: the username comes from D1 (author-controlled)
        description: `Banning **${sanitizeUserName(targetUsername)}** and hiding their presets...`,
        color: 0xfee75c,
      },
    ],
    components: [],
  });
}

async function processBan(
  _interaction: ModalInteraction,
  env: Env,
  targetUserId: string,
  targetUsername: string,
  moderatorId: string,
  moderatorName: string,
  reason: string,
  logger?: ExtendedLogger
): Promise<void> {
  // FINDING-019: everything rendered below is user-sourced — D1 username,
  // the moderator's Discord name, the typed reason
  const safeTarget = sanitizeUserName(targetUsername);
  const safeModerator = sanitizeUserName(moderatorName);
  const safeReason = sanitizeReason(reason);

  try {
    const result = await banService.banUser(env.DB, targetUserId, targetUsername, moderatorId, reason);

    if (!result.success) {
      // MOD-8 (FINDING-034): `result.error` is channel-safe by contract; the
      // raw D1 error (if any) goes to the structured log only
      if (result.cause !== undefined) {
        logger?.error(
          `Ban failed for ${targetUserId}`,
          result.cause instanceof Error ? result.cause : undefined
        );
      }
      if (env.MODERATION_CHANNEL_ID) {
        await safeSendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, {
          embeds: [
            errorEmbed('Ban Failed', result.error || 'Unknown error occurred.'),
          ],
        });
      }
      return;
    }

    if (env.MODERATION_CHANNEL_ID) {
      await safeSendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, {
        embeds: [
          {
            title: '\uD83D\uDD28 User Banned',
            description: `**${safeTarget}** has been banned from Preset Palettes.`,
            color: 0xed4245,
            fields: [
              { name: 'User ID', value: targetUserId, inline: true },
              { name: 'Presets Hidden', value: String(result.presetsHidden), inline: true },
              { name: 'Banned By', value: safeModerator, inline: true },
              { name: 'Reason', value: safeReason, inline: false },
            ],
            footer: { text: 'Use /preset unban_user to restore access' },
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }

    if (logger) {
      // FINDING-011 (2026-08-29 security audit): ids, counts and lengths only.
      // This line used to carry the banned user's Discord display name and the
      // moderator's free-text reason — commentary about a person, in a log
      // nobody promised to retain or protect. The accountability copy lives in
      // `moderation_log` (FINDING-018) and the moderation channel post, both of
      // which are the record of record; the log line only needs to say that a
      // ban happened and how big it was.
      logger.info('User banned', {
        targetUserId,
        moderatorId,
        presetsHidden: result.presetsHidden,
        reasonLength: reason.length,
      });
    }
  } catch (error) {
    if (logger) {
      logger.error('Failed to ban user', error instanceof Error ? error : undefined);
    }

    if (env.MODERATION_CHANNEL_ID) {
      await safeSendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, {
        embeds: [
          errorEmbed(
            'Ban Failed',
            `Failed to ban **${safeTarget}**: ${sanitizeErrorMessage(error, 'An unexpected error occurred while processing the ban.')}`
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
