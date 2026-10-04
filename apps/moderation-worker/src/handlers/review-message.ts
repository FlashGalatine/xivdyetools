/**
 * Review messages: the shared pieces behind FINDING-017's "review, then click
 * again" recovery.
 *
 * A moderator click is only honoured when it names the revision and status the
 * moderator reviewed (see `utils/review-custom-id.ts`). Anything that cannot
 * name them — a button on a message posted before the change, a modal opened
 * from one, a 409 from presets-api, a typed `/preset moderate approve <id>` —
 * lands here instead of acting: the current preset is fetched, the message is
 * edited to show its CURRENT text with new revision-bound buttons, and the
 * moderator is told to review it and click again.
 *
 * Every edit built here carries `components` (an empty list when nothing is
 * actionable). An edit without them leaves the old live buttons in place — the
 * bug this fixes.
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { isValidSnowflake } from '@xivdyetools/types';
import type { Env } from '../types/env.js';
import { STATUS_DISPLAY } from '../types/preset.js';
import type { ModerationPresetView } from '../types/preset.js';
import type { DiscordActionRow, DiscordButton, DiscordEmbed } from '../utils/response.js';
import { MessageFlags } from '../utils/response.js';
import {
  safeEditMessage,
  safeEditOriginalResponse,
  safeSendFollowUp,
} from '../utils/discord-api.js';
import type { SendMessageOptions } from '../utils/discord-api.js';
import { sanitizeDescription, sanitizeName, sanitizeUserName } from '../utils/embed-text.js';
import { buildReviewCustomId } from '../utils/review-custom-id.js';
import type { ReviewBinding } from '../utils/review-custom-id.js';
import * as presetApi from '../services/preset-api.js';

/**
 * The part of a button or modal interaction this module reads. Structural, so
 * both interaction shapes satisfy it.
 */
export interface ReviewInteraction {
  token: string;
  channel_id?: string;
  message?: {
    id: string;
    /** Discord message flags — 64 marks an ephemeral message. */
    flags?: number;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{ name: string; value: string; inline?: boolean }>;
      footer?: { text?: string };
      timestamp?: string;
    }>;
  };
}

type ReviewAction = 'approve' | 'reject' | 'revert';

/**
 * Edit the message a component or modal came from.
 *
 * A normal moderation message is edited with the bot token. An ephemeral one —
 * the `/preset moderate` confirmation — cannot be edited that way (the channel
 * endpoint answers 404), so it goes through the interaction webhook instead.
 *
 * @returns true when Discord accepted the edit
 */
export async function editReviewMessage(
  env: Env,
  interaction: ReviewInteraction,
  options: SendMessageOptions,
): Promise<boolean> {
  const messageId = interaction.message?.id;
  if (!interaction.channel_id || !messageId) return false;

  if ((interaction.message?.flags ?? 0) & MessageFlags.EPHEMERAL) {
    return safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, options);
  }
  return safeEditMessage(env.DISCORD_TOKEN, interaction.channel_id, messageId, options);
}

/** The current text of a preset, sanitised like every other embed this worker posts. */
export function buildReviewEmbed(
  preset: ModerationPresetView,
  revision: number,
  notice?: string,
): DiscordEmbed {
  const display = STATUS_DISPLAY[preset.status];
  // The author mention only for a real snowflake — an XIVAuth-only author's id is a UUID
  const authorId = preset.author_discord_id;
  const mention = authorId && isValidSnowflake(authorId) ? ` (<@${authorId}>)` : '';
  // Tags are author-controlled; cap them so the description stays well under Discord's limit
  const tags = (preset.tags ?? []).map((tag) => sanitizeName(tag)).join(', ').slice(0, 300);

  return {
    title: `${display.icon} Preset Review`,
    description: [
      `**Name:** ${sanitizeName(preset.name)}`,
      `**Description:** ${sanitizeDescription(preset.description)}`,
      `**Author:** ${sanitizeUserName(preset.author_name || 'Unknown')}${mention}`,
      `**Status:** ${preset.status}`,
      `**Category:** ${sanitizeName(preset.category_id)}`,
      ...(tags ? [`**Tags:** ${tags}`] : []),
      `**Dyes:** ${preset.dyes.length} colors`,
      ...(preset.previous_values
        ? ['**Edit:** this preset has a previous version (Revert restores it)']
        : []),
    ].join('\n'),
    color: display.color,
    ...(notice ? { fields: [{ name: 'Review', value: notice, inline: false }] } : {}),
    footer: { text: `ID: ${preset.id} • Revision ${revision}` },
  };
}

const BUTTONS: Record<ReviewAction, Pick<DiscordButton, 'style' | 'label' | 'emoji'>> = {
  approve: { style: 3, label: 'Approve', emoji: { name: '✅' } },
  reject: { style: 4, label: 'Reject', emoji: { name: '❌' } },
  revert: { style: 4, label: 'Revert', emoji: { name: '↩️' } },
};

/** One action row of revision-bound buttons; an empty list when there is nothing to offer. */
export function buildReviewButtons(
  presetId: string,
  binding: ReviewBinding,
  actions: ReviewAction[],
): DiscordActionRow[] {
  if (actions.length === 0) return [];
  return [
    {
      type: 1,
      components: actions.map((action) => ({
        type: 2 as const,
        ...BUTTONS[action],
        custom_id: buildReviewCustomId(action, presetId, binding),
      })),
    },
  ];
}

/**
 * What a refreshed embed offers. Mirrors the original moderation embed
 * (discord-worker `preset-notifications.ts`): only a PENDING preset is posted
 * with Approve and Reject, and Revert only joins them for an edit that has a
 * previous version to restore. Any other status has nothing left to decide.
 */
function actionsFor(preset: ModerationPresetView): ReviewAction[] {
  if (preset.status !== 'pending') return [];
  return preset.previous_values ? ['approve', 'reject', 'revert'] : ['approve', 'reject'];
}

/**
 * Show the moderator the CURRENT preset in place of a message they can no
 * longer act on, with fresh revision-bound buttons, and tell them to review it
 * and click again. Never acts, never throws.
 */
export async function refreshReview(
  interaction: ReviewInteraction,
  env: Env,
  presetId: string,
  moderatorId: string,
  logger?: ExtendedLogger,
): Promise<void> {
  const tell = (content: string): Promise<boolean> =>
    safeSendFollowUp(env.DISCORD_CLIENT_ID, interaction.token, { content, ephemeral: true });

  try {
    const current = await presetApi.getModerationPreset(env, presetId, moderatorId);

    let notice: string;
    let edit: SendMessageOptions;
    if (!current) {
      notice = 'That preset no longer exists.';
      const original = interaction.message?.embeds?.[0] ?? {};
      edit = {
        embeds: [
          {
            title: original.title,
            description: original.description,
            color: original.color,
            fields: original.fields,
            timestamp: original.timestamp,
            footer: { text: notice },
          },
        ],
        components: [],
      };
    } else {
      const actions = actionsFor(current.preset);
      notice =
        actions.length > 0
          ? 'This preset changed, or the button you clicked is out of date. Review the refreshed message, then click again.'
          : `This preset is now ${current.preset.status}, so there is nothing left to review.`;
      edit = {
        embeds: [buildReviewEmbed(current.preset, current.revision, notice)],
        components: buildReviewButtons(
          presetId,
          { revision: current.revision, status: current.preset.status },
          actions,
        ),
      };
    }

    if (!(await editReviewMessage(env, interaction, edit))) {
      logger?.warn('Review refresh could not edit the moderation message', { presetId });
      await tell(
        'Could not update the moderation message. Nothing was changed — use /preset moderate to review this preset.',
      );
      return;
    }
    await tell(notice);
  } catch (error) {
    logger?.error('Failed to refresh review', error instanceof Error ? error : undefined, {
      presetId,
    });
    await tell(
      'Could not load the preset to refresh this review. Nothing was changed — try again, or use /preset moderate.',
    );
  }
}
