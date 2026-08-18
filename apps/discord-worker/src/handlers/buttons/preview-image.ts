/**
 * Preview-Image Moderation Button Handlers
 *
 * Approve/reject buttons on the "preview image awaiting review" notification
 * (apps/discord-worker/src/index.ts, the preview_image branch of
 * /webhooks/preset-submission). This is the ONLY app that can handle these
 * clicks: Discord routes a component interaction to the application whose
 * bot posted the message, and that message is posted with discord-worker's
 * own token — not moderation-worker's.
 *
 * Button custom_id patterns:
 * - previewimg_approve_{presetId} - Approve the pending preview image
 * - previewimg_reject_{presetId} - Reject (delete) the pending preview image
 *
 * The `previewimg_` prefix is deliberate: moderation-worker already owns
 * `preset_approve_` / `preset_reject_` / `preset_revert_` for preset
 * submissions, and colliding with those would route a click to the wrong
 * app's handler (or none at all).
 *
 * Rejecting only clears the image (preview_image_status -> 'none'); it does
 * NOT change the preset's own status — a bad picture is not a bad palette.
 */

import type { Env } from '../../types/env.js';
import { InteractionResponseType } from '../../types/env.js';
import { ephemeralResponse } from '../../utils/response.js';
import { editMessage, sendFollowUp } from '../../utils/discord-api.js';
import * as presetApi from '../../services/preset-api.js';
import { createTranslator } from '../../services/bot-i18n.js';
import { STATE } from '../../utils/brand.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

// ============================================================================
// Types
// ============================================================================

/** Subset of an embed this handler reads/edits — matches the other button handlers' local shape */
interface PreviewImageEmbed {
  title?: string;
  description?: string;
  color?: number;
  image?: { url: string };
  footer?: { text?: string };
}

interface ButtonInteraction {
  id: string;
  token: string;
  application_id: string;
  channel_id?: string;
  message?: {
    id: string;
    embeds?: PreviewImageEmbed[];
  };
  member?: {
    user: {
      id: string;
      username?: string;
    };
  };
  user?: {
    id: string;
    username?: string;
  };
  data?: {
    custom_id?: string;
    component_type?: number;
  };
}

type PreviewImageAction = 'approve' | 'reject';

const APPROVE_PREFIX = 'previewimg_approve_';
const REJECT_PREFIX = 'previewimg_reject_';

// ============================================================================
// Routing helpers
// ============================================================================

/** Check if a custom_id is a preview-image moderation button */
export function isPreviewImageButton(customId: string): boolean {
  return customId.startsWith(APPROVE_PREFIX) || customId.startsWith(REJECT_PREFIX);
}

function parseCustomId(customId: string): { action: PreviewImageAction; presetId: string } | null {
  if (customId.startsWith(APPROVE_PREFIX)) {
    return { action: 'approve', presetId: customId.slice(APPROVE_PREFIX.length) };
  }
  if (customId.startsWith(REJECT_PREFIX)) {
    return { action: 'reject', presetId: customId.slice(REJECT_PREFIX.length) };
  }
  return null;
}

// ============================================================================
// Handler
// ============================================================================

/**
 * Handle a previewimg_approve_/previewimg_reject_ button click.
 *
 * Flow:
 * 1. Identify the clicking user and the requested action/preset.
 * 2. Refuse (ephemeral, no API call) if the clicking user is not a
 *    moderator — this is the Discord-side authorisation boundary;
 *    presets-api enforces it again server-side.
 * 3. ACK immediately with DEFERRED_UPDATE_MESSAGE (component interactions
 *    must be acknowledged within 3s) and do the API call + message edit in
 *    the background via ctx.waitUntil.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- all async work happens in the backgrounded processor
export async function handlePreviewImageButton(
  interaction: ButtonInteraction,
  env: Env,
  ctx: ExecutionContext,
  logger?: ExtendedLogger,
): Promise<Response> {
  const customId = interaction.data?.custom_id || '';
  const parsed = parseCustomId(customId);
  const userId = interaction.member?.user?.id ?? interaction.user?.id;
  const userName = interaction.member?.user?.username ?? interaction.user?.username;

  const adminT = createTranslator('en');

  if (!parsed || !parsed.presetId || !userId) {
    return ephemeralResponse(adminT.t('previewImage.invalidButton'));
  }

  // Discord-side authorisation boundary: a non-moderator gets a refusal and
  // NOTHING else happens — presets-api is never called.
  if (!presetApi.isModerator(env, userId)) {
    return ephemeralResponse(adminT.t('previewImage.notPermitted'));
  }

  ctx.waitUntil(
    processPreviewImageAction(
      interaction,
      env,
      parsed.action,
      parsed.presetId,
      userId,
      userName,
      logger,
    ),
  );

  return Response.json({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
}

async function processPreviewImageAction(
  interaction: ButtonInteraction,
  env: Env,
  action: PreviewImageAction,
  presetId: string,
  moderatorId: string,
  moderatorName: string | undefined,
  logger?: ExtendedLogger,
): Promise<void> {
  const adminT = createTranslator('en');
  const displayName = moderatorName ? `<@${moderatorId}>` : moderatorId;

  try {
    await presetApi.setPreviewImageStatus(env, presetId, action, moderatorId, moderatorName);

    if (interaction.channel_id && interaction.message?.id) {
      const originalEmbed = interaction.message.embeds?.[0] || {};
      const footerText =
        action === 'approve'
          ? adminT.t('previewImage.approvedFooter', { moderator: displayName })
          : adminT.t('previewImage.rejectedFooter', { moderator: displayName });

      // On success the outcome is visible and the buttons cannot be clicked
      // twice: the embed is edited (colour + footer) and components dropped.
      const res = await editMessage(
        env.DISCORD_TOKEN,
        interaction.channel_id,
        interaction.message.id,
        {
          embeds: [
            {
              ...originalEmbed,
              color: action === 'approve' ? STATE.success : STATE.error,
              footer: { text: footerText },
            },
          ],
          components: [],
        },
      );

      if (!res.ok) {
        logger?.error('Failed to update preview-image message after moderation action', undefined, {
          presetId,
          action,
          status: res.status,
        });
      }
    }
  } catch (error) {
    logger?.error(
      'Preview-image moderation action failed',
      error instanceof Error ? error : undefined,
      { presetId, action },
    );

    // On failure, leave the original message (and its buttons) untouched so
    // the moderator can retry — only notify them ephemerally.
    await sendFollowUp(env.DISCORD_CLIENT_ID, interaction.token, {
      content: adminT.t('previewImage.actionFailed'),
      ephemeral: true,
    });
  }
}
