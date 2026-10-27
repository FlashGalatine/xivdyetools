import type { Env } from '../../types/env.js';
import type { ModalInteraction } from '../../types/modal.js';
import { extractTextInputValue, getModalUserId } from '../../types/modal.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { ephemeralResponse, updateMessageResponse, errorEmbed } from '../../utils/response.js';
import { sanitizeUserName, sanitizeReason } from '../../utils/embed-text.js';
import { safeSendMessage } from '../../utils/discord-api.js';
import { parseModeratorIds } from '@xivdyetools/bot-logic';
import { getPresetAuthorName, banUser } from '../../services/ban-service.js';
import {
  loadBanReview,
  INACTIVE_BANS,
  REVIEW_UNAVAILABLE,
} from '../../services/ban-confirmation-service.js';
import { linkedBansEnabled } from '../../services/identity-lookup.js';

export async function handleBanReasonModal(
  interaction: ModalInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger,
): Promise<Response> {
  if (!linkedBansEnabled(env)) return ephemeralResponse(INACTIVE_BANS);
  const actorId = getModalUserId(interaction);
  if (!actorId || !parseModeratorIds(env.MODERATOR_IDS).has(actorId))
    return ephemeralResponse('You do not have permission to ban users.');
  const reason = extractTextInputValue(interaction.data?.components, 'ban_reason')?.trim();
  if (!reason || reason.length < 10 || reason.length > 500)
    return ephemeralResponse({
      embeds: [
        errorEmbed(
          'Error',
          'Please provide a valid ban reason (at least 10 characters; at most 500).',
        ),
      ],
    });
  const id = interaction.data?.custom_id ?? '';
  if (!id.startsWith('ban_reason_modal_') || id.length > 100)
    return ephemeralResponse(REVIEW_UNAVAILABLE);
  const nonce = id.slice('ban_reason_modal_'.length);
  try {
    const review = await loadBanReview(env, nonce, actorId, 'review');
    if (review.proposal.action !== 'ban') return ephemeralResponse(REVIEW_UNAVAILABLE);
    const target = review.proposal.inputs[0];
    const username = await getPresetAuthorName(env.DB, target);
    const result = await banUser(env, nonce, actorId, reason, username ?? target);
    if (!result.success)
      return ephemeralResponse({
        embeds: [errorEmbed('Ban Failed', result.error ?? REVIEW_UNAVAILABLE)],
      });
    const safeTarget = sanitizeUserName(username ?? 'an account with no author name');
    const embed = {
      title: '🔨 User Banned',
      description: `**${safeTarget}** has been banned from Preset Palettes.`,
      color: 0xed4245,
      fields: [{ name: 'Presets Hidden', value: String(result.presetsHidden), inline: true }],
      footer: { text: 'Use /preset unban_user to restore access' },
    };
    // Only the count, target display name and sanitized reason enter a channel post.
    if (env.MODERATION_CHANNEL_ID)
      ctx.waitUntil(
        safeSendMessage(env.DISCORD_TOKEN, env.MODERATION_CHANNEL_ID, {
          embeds: [
            {
              ...embed,
              fields: [
                ...embed.fields,
                { name: 'Reason', value: sanitizeReason(reason), inline: false },
              ],
            },
          ],
        }),
      );
    logger?.info('Account ban applied', {
      presetsHidden: result.presetsHidden,
      reasonLength: reason.length,
    });
    return updateMessageResponse({ embeds: [embed], components: [] });
  } catch {
    return ephemeralResponse(REVIEW_UNAVAILABLE);
  }
}

export function isBanReasonModal(customId: string): boolean {
  return customId.startsWith('ban_reason_modal_');
}
