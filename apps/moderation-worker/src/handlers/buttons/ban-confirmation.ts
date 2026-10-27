import type { Env } from '../../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { ephemeralResponse, updateMessageResponse } from '../../utils/response.js';
import { parseModeratorIds } from '@xivdyetools/bot-logic';
import { unbanUser } from '../../services/ban-service.js';
import { linkedBansEnabled } from '../../services/identity-lookup.js';
import {
  loadBanReview,
  selectBanParent,
  reviewMessage,
  INACTIVE_BANS,
  REVIEW_UNAVAILABLE,
} from '../../services/ban-confirmation-service.js';

interface BanInteraction {
  id: string;
  token: string;
  application_id: string;
  member?: { user: { id: string; username?: string } };
  user?: { id: string; username?: string };
  data?: { custom_id?: string; component_type?: number; values?: string[] };
}
function actor(interaction: BanInteraction, env: Env): string | null {
  const id = interaction.member?.user.id ?? interaction.user?.id;
  return id && parseModeratorIds(env.MODERATOR_IDS).has(id) ? id : null;
}
export async function handleBanConfirmButton(
  interaction: BanInteraction,
  env: Env,
  _ctx: ExecutionContext,
  _logger?: ExtendedLogger,
): Promise<Response> {
  if (!linkedBansEnabled(env)) return ephemeralResponse(INACTIVE_BANS);
  const actorId = actor(interaction, env);
  if (!actorId) return ephemeralResponse('You do not have permission to ban users.');
  const customId = interaction.data?.custom_id ?? '';
  if (!customId.startsWith('ban_confirm_') || customId.length > 100)
    return ephemeralResponse(REVIEW_UNAVAILABLE);
  const nonce = customId.slice('ban_confirm_'.length);
  try {
    const review = await loadBanReview(env, nonce, actorId, 'review');
    if (review.proposal.action === 'unban') {
      const result = await unbanUser(env, nonce, actorId);
      if (!result.success) return ephemeralResponse(REVIEW_UNAVAILABLE);
      return updateMessageResponse({
        embeds: [
          {
            title: 'Account unbanned',
            description: 'The reviewed ban record was closed.',
            color: 0x57f287,
            fields: [
              { name: 'Presets Restored', value: String(result.presetsRestored), inline: true },
              {
                name: 'Presets Still Hidden',
                value: String(result.presetsStillHidden),
                inline: true,
              },
            ],
          },
        ],
        components: [],
      });
    }
    return Response.json({
      type: 9,
      data: {
        custom_id: `ban_reason_modal_${nonce}`,
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
              },
            ],
          },
        ],
      },
    });
  } catch {
    return ephemeralResponse(REVIEW_UNAVAILABLE);
  }
}
export async function handleBanCancelButton(
  interaction: BanInteraction,
  env: Env,
  _ctx: ExecutionContext,
  _logger?: ExtendedLogger,
): Promise<Response> {
  if (!linkedBansEnabled(env)) return ephemeralResponse(INACTIVE_BANS);
  const actorId = actor(interaction, env);
  if (!actorId) return ephemeralResponse('You do not have permission to ban users.');
  const customId = interaction.data?.custom_id ?? '';
  if (!customId.startsWith('ban_cancel_') || customId.length > 100)
    return ephemeralResponse(REVIEW_UNAVAILABLE);
  try {
    const review = await loadBanReview(env, customId.slice('ban_cancel_'.length), actorId);
    const result = await env.DB.prepare(
      "UPDATE moderation_ban_confirmations SET consumed_at=unixepoch(),outcome='applied' WHERE nonce=? AND actor_id=? AND action=? AND mode=? AND proposal_hash=? AND consumed_at IS NULL AND expires_at>unixepoch()",
    )
      .bind(review.nonce, actorId, review.proposal.action, review.proposal.mode, review.hash)
      .run();
    if (result.meta.changes !== 1) return ephemeralResponse(REVIEW_UNAVAILABLE);
    return updateMessageResponse({
      embeds: [
        { title: '❌ Ban Cancelled', description: 'The ban action was canceled.', color: 0x5865f2 },
      ],
      components: [],
    });
  } catch {
    return ephemeralResponse(REVIEW_UNAVAILABLE);
  }
}
export async function handleBanParentSelect(
  interaction: BanInteraction,
  env: Env,
  _ctx: ExecutionContext,
  _logger?: ExtendedLogger,
): Promise<Response> {
  if (!linkedBansEnabled(env)) return ephemeralResponse(INACTIVE_BANS);
  const actorId = actor(interaction, env);
  if (!actorId) return ephemeralResponse('You do not have permission to ban users.');
  const id = interaction.data?.custom_id ?? '';
  const values = interaction.data?.values;
  if (!id.startsWith('ban_choose_') || id.length > 100 || !values || values.length !== 1)
    return ephemeralResponse(REVIEW_UNAVAILABLE);
  try {
    return Response.json({
      type: 7,
      data: reviewMessage(
        await selectBanParent(env, actorId, id.slice('ban_choose_'.length), values[0]),
      ),
    });
  } catch {
    return ephemeralResponse(REVIEW_UNAVAILABLE);
  }
}
export function isBanConfirmButton(customId: string): boolean {
  return customId.startsWith('ban_confirm_');
}
export function isBanCancelButton(customId: string): boolean {
  return customId.startsWith('ban_cancel_');
}
