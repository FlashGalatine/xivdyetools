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
 * bug this fixes. The converse holds for a channel message whose preset is no
 * longer pending: that edit carries no `embeds`, so the embed a winning click
 * wrote (BUG-052) stays as it is, and states the new status in `content`.
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
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

/** The click came from an ephemeral message: the `/preset moderate` confirmation. */
function isEphemeral(interaction: ReviewInteraction): boolean {
  return ((interaction.message?.flags ?? 0) & MessageFlags.EPHEMERAL) !== 0;
}

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

  if (isEphemeral(interaction)) {
    return safeEditOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, options);
  }
  return safeEditMessage(env.DISCORD_TOKEN, interaction.channel_id, messageId, options);
}

/**
 * What Revert does, in words. Modelled on discord-worker's `revertLine`
 * (`preset-notifications.ts`) for a post with no diff base, but more neutral:
 * a refresh has neither `edited_from` nor `edited_from_status`, so it cannot
 * tell whether the snapshot is the text the latest edit replaced, nor whether
 * a moderator ever approved it (see `actionsFor`). It calls the snapshot "the
 * saved version" and says it may be older.
 */
function revertLine(previous: NonNullable<ModerationPresetView['previous_values']>): string {
  // A malformed legacy snapshot may lack a name; describe Revert without one
  const name = sanitizeName(previous.name);
  const version = name ? `the saved version "${name}"` : 'the saved version';
  return `**Revert:** restores ${version} and approves it. It may be older than the text the latest edit replaced.`;
}

/**
 * A pending preset with a snapshot, on a message that offers no Revert (the
 * `/preset moderate` confirmation): the text is an edit with an earlier
 * version to go back to, and the moderation message is where that happens.
 */
const SAVED_VERSION_LINE =
  '**Edit:** a saved earlier version exists (Revert is on the moderation message)';

/** One embed field, as Discord delivers it with a click. */
type EmbedField = { name: string; value: string; inline?: boolean };

/**
 * BUG-050 (2026-10-04 deep-dive) and its class: the message's fields minus the
 * two that only mean something while the preset is still undecided — an
 * 'Error' a failed attempt left behind, and the 'Review' instruction
 * `buildReviewEmbed` adds ("…click Approve to confirm"). A success or a
 * "no longer exists" edit drops both. A failure keeps the buttons live, so it
 * passes `keepReview`: the retry still shows the instruction, and its own
 * Error replaces the old one rather than stacking under it.
 */
export function withoutTransientFields(
  fields: EmbedField[] | undefined,
  { keepReview = false }: { keepReview?: boolean } = {},
): EmbedField[] {
  return (fields ?? []).filter(
    (field) => field.name !== 'Error' && (keepReview || field.name !== 'Review'),
  );
}

/** What the embed says about a snapshot (see `buildReviewEmbed`'s `revertOffered`). */
function savedVersionLines(preset: ModerationPresetView, revertOffered: boolean): string[] {
  if (!preset.previous_values) return [];
  if (revertOffered) return [revertLine(preset.previous_values)];
  return preset.status === 'pending' ? [SAVED_VERSION_LINE] : [];
}

/**
 * The current text of a preset, sanitised like every other embed this worker posts.
 *
 * @param revertOffered - the message carries a Revert button: say what it
 *   restores. Off for a message without one (the `/preset moderate`
 *   confirmation), which would otherwise describe a button it does not show;
 *   a PENDING preset with a snapshot still notes that a saved version exists.
 *   Revert is only ever offered on a pending preset, so a decided one gets
 *   neither line.
 */
export function buildReviewEmbed(
  preset: ModerationPresetView,
  revision: number,
  notice?: string,
  revertOffered = false,
): DiscordEmbed {
  const display = STATUS_DISPLAY[preset.status];
  // No author mention (2026-10-03 FINDING-008): the moderation posts carry the
  // author name only — the bot privacy policy promises they show no Discord
  // User ID, and no moderation control needs it (bans search by username).
  // Tags are author-controlled; cap them so the description stays well under Discord's limit
  const tags = (preset.tags ?? []).map((tag) => sanitizeName(tag)).join(', ').slice(0, 300);

  return {
    title: `${display.icon} Preset Review`,
    description: [
      `**Name:** ${sanitizeName(preset.name)}`,
      `**Description:** ${sanitizeDescription(preset.description)}`,
      `**Author:** ${sanitizeUserName(preset.author_name || 'Unknown')}`,
      `**Status:** ${preset.status}`,
      `**Category:** ${sanitizeName(preset.category_id)}`,
      ...(tags ? [`**Tags:** ${tags}`] : []),
      `**Dyes:** ${preset.dyes.length} colors`,
      ...savedVersionLines(preset, revertOffered),
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
 * What a refreshed embed offers. Only a PENDING preset has anything left to
 * decide: Approve and Reject, plus Revert whenever it has a snapshot
 * (`previous_values`) to restore. Any other status offers nothing.
 *
 * Revert restores the snapshot AND approves the preset, so it is only safe when
 * the snapshot is text a moderator once approved. A refresh cannot check that
 * (GET /moderation/:id carries no `edited_from_status`), so offering it rests
 * on a premise. On presets-api >= 2.5.0 (Sprint 8) an owner's edit snapshots
 * `previous_values` only from an APPROVED preset, so every snapshot taken after
 * that deploy holds approved text. A row snapshotted before it may hold text
 * no moderator approved. Those rows are a hand-run deploy step, not something
 * this code can see: AFTER presets-api 2.5.0 is deployed (it stops new ones)
 * and BEFORE this worker deploys, the maintainer reviews the rows the
 * read-only query in `apps/presets-api/CLAUDE.md` lists and clears any
 * snapshot of unapproved text through `wrangler d1 execute --file`. Because
 * the refresh cannot verify the outcome either way, the embed words Revert
 * neutrally (see `revertLine`).
 *
 * discord-worker's webhook embed needs a three-part rule instead (an edit, a
 * snapshot, and `edited_from_status === 'approved'`) because it has the
 * status to check and does not rely on that premise.
 */
function actionsFor(preset: ModerationPresetView): ReviewAction[] {
  if (preset.status !== 'pending') return [];
  return preset.previous_values ? ['approve', 'reject', 'revert'] : ['approve', 'reject'];
}

/**
 * Show the moderator the CURRENT preset in place of a message they can no
 * longer act on, with fresh revision-bound buttons, and tell them to review it
 * and click again. A preset with nothing left to decide loses its buttons and
 * the message states its status: a channel message keeps its embed (BUG-052)
 * and says so in its content, a private `/preset moderate` confirmation is
 * rebuilt. A preset that cannot be loaded leaves the message and its buttons
 * alone. Never acts, never throws.
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
            // a stale 'Error' or the confirmation's 'Review' instruction would
            // outlive the buttons on this final message
            fields: withoutTransientFields(original.fields),
            timestamp: original.timestamp,
            footer: { text: notice },
          },
        ],
        components: [],
      };
    } else {
      const actions = actionsFor(current.preset);
      if (actions.length === 0) {
        const { status } = current.preset;
        notice = `This preset is now ${status}, so there is nothing left to review.`;
        if (isEphemeral(interaction)) {
          // The /preset moderate confirmation is private to the moderator who
          // asked for it, so no other moderator's decision can have landed on
          // it: rebuild it from the current preset so it stops asking for a
          // confirm click.
          edit = {
            embeds: [buildReviewEmbed(current.preset, current.revision, notice)],
            components: [],
          };
        } else {
          // BUG-052 (2026-10-04 deep-dive): already decided — most often by
          // the concurrent click that beat this one to a 409, whose edit wrote
          // "Approved by" / "Reason" onto the message. Neither the preset nor
          // this click's copy of the message (taken before that edit) carries
          // them, so rebuilding the embed from either wiped them. Send no
          // embeds: Discord leaves the one it now holds untouched. The status
          // goes in `content`, which discord-worker's moderation post never
          // sets and the winner's edit never sends, so every viewer sees the
          // outcome whichever edit lands last.
          edit = { content: `This preset is now ${status}.`, components: [] };
        }
      } else {
        notice =
          'This preset changed, or the button you clicked is out of date. Review the refreshed message, then click again.';
        edit = {
          embeds: [
            buildReviewEmbed(current.preset, current.revision, notice, actions.includes('revert')),
          ],
          components: buildReviewButtons(
            presetId,
            { revision: current.revision, status: current.preset.status },
            actions,
          ),
        };
      }
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
