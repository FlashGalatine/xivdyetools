/**
 * Preset moderation-channel notifications — single shared builder.
 *
 * REFACTOR-025 (2026-07-18 audit): the "pending preset" moderation embed
 * previously existed in three divergent copies (webhook path in index.ts,
 * notifyModerationChannel and notifyEditModerationChannel in preset.ts) with
 * inconsistent sanitization (BUG-072) and triplicated button rows (BUG-009).
 * This module is now the only place that builds and posts them.
 *
 * BUG-004 (2026-10-04 deep-dive): its only caller is the presets-api webhook
 * (`/webhooks/preset-submission` in index.ts). `/preset submit` and `edit`
 * used to post here too, duplicating the webhook's post for every bot
 * submission; they now only answer the user. BUG-003: the webhook posts an
 * owner edit as kind 'edit' and decides whether Revert is safe to offer.
 *
 * BUG-009 (2026-07-18 audit): Discord routes component interactions to the
 * application that OWNS the message. The approve/reject handlers live in
 * moderation-worker — a separate Discord application — so buttons on
 * messages posted with the main bot's token are dead ("This button is not
 * recognized"). Resolution:
 *   - When `MODERATION_BOT_TOKEN` (the moderation application's bot token)
 *     is configured, post via that token so the buttons route to
 *     moderation-worker's interaction endpoint and work.
 *   - Otherwise post via the main bot token WITHOUT buttons, adding a
 *     "/preset moderate" hint instead of advertising a dead affordance.
 *
 * BUG-072: sanitization is applied unconditionally inside the builder.
 */

import type { Env } from '../../types/env.js';
import { STATE } from '../../utils/brand.js';
import type { DiscordEmbed, DiscordActionRow } from '../../utils/response.js';
import { sendMessage } from '../../utils/discord-api.js';
import { sanitizePresetName, sanitizePresetDescription } from '../../utils/sanitize.js';
import { createTranslator } from '../../services/bot-i18n.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { PresetPreviousValues } from '@xivdyetools/types';

/** Subset of preset fields the notifications need (CommunityPreset satisfies it) */
export interface ModerationPresetInfo {
  id: string;
  name: string;
  description: string;
  category_id: string;
  dyes: number[];
  tags?: string[];
  author_name?: string | null;
  /** The status the moderator will see; part of the revision-bound button ids (FINDING-017). */
  status?: string;
}

export interface ModerationNotificationOptions {
  kind: 'new' | 'edit';
  preset: ModerationPresetInfo;
  /**
   * The preset's `content_revision` from presets-api (FINDING-017). When it is
   * a valid non-negative integer, the buttons carry it (with `preset.status`) so
   * moderation-worker can refuse a click on text that has since changed. When
   * absent (a presets-api older than 2.4.0) the legacy ids are emitted, which
   * moderation-worker turns into a refresh instead of acting.
   */
  contentRevision?: number | null;
  /**
   * For kind 'edit': the text the diff is measured against — presets-api's
   * `edited_from`, the text this edit replaced. Without it the embed shows the
   * whole preset under the edit title.
   */
  original?: ModerationPresetInfo;
  /**
   * `original` is the Revert snapshot rather than the text this edit replaced:
   * the fallback for a presets-api that sends no `edited_from`. The snapshot is
   * write-once and can be older than that text, so the diff is headed as
   * changes since the snapshot, and nothing claims Revert just undoes the edit.
   */
  originalIsRevertSnapshot?: boolean;
  /**
   * BUG-003: add the Revert button (kind 'edit' only), which restores this
   * text — `preset.previous_values` — AND approves the preset, so the caller
   * passes it only when the snapshot is text that was live, never because the
   * post is an edit. The embed names it: the snapshot is write-once, so it can
   * be older than the text this edit replaced (approved A → flagged edit B
   * snapshots A → B approved → a flagged edit C still reverts to A).
   */
  revertTo?: PresetPreviousValues;
  /** Optional display name for the category (falls back to category_id) */
  categoryName?: string;
  /** Extra fields appended to the embed (e.g. the webhook path's source field) */
  extraFields?: Array<{ name: string; value: string; inline?: boolean }>;
}

/**
 * The token that owns moderation-channel messages. Buttons only work when
 * this is the moderation application's token (BUG-009).
 */
function moderationToken(env: Env): { token: string; buttonsRoutable: boolean } {
  if (env.MODERATION_BOT_TOKEN) {
    return { token: env.MODERATION_BOT_TOKEN, buttonsRoutable: true };
  }
  return { token: env.DISCORD_TOKEN, buttonsRoutable: false };
}

const CUSTOM_ID_MAX = 100;

// Copied from moderation-worker's review-custom-id.ts (parseReviewCustomId):
// the revision is a non-negative decimal integer with no leading zeros, and the
// status is one of the full words below. Keep in step with that parser.
const REVISION_RE = /^(0|[1-9][0-9]*)$/;
const REVIEW_STATUSES: ReadonlySet<string> = new Set([
  'pending',
  'approved',
  'rejected',
  'flagged',
  'hidden',
]);

/**
 * FINDING-017: `preset_<kind>_<uuid>:<revision>:<status>` when both a valid
 * revision and status are known, otherwise the legacy `preset_<kind>_<uuid>`.
 */
function reviewCustomId(
  kind: 'approve' | 'reject' | 'revert',
  presetId: string,
  revision: number | null | undefined,
  status: string | undefined
): string {
  const legacy = `preset_${kind}_${presetId}`;
  if (
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    !REVISION_RE.test(String(revision)) ||
    typeof status !== 'string' ||
    !REVIEW_STATUSES.has(status)
  ) {
    return legacy;
  }
  const bound = `${legacy}:${revision}:${status}`;
  return bound.length <= CUSTOM_ID_MAX ? bound : legacy;
}

/** The four text fields an edit's diff and a Revert snapshot cover. */
type PresetText = Pick<ModerationPresetInfo, 'name' | 'description' | 'dyes' | 'tags'>;

/** Which of the four text fields differ between `a` and `b`, in display order. */
function differingFields(a: PresetText, b: PresetText): string[] {
  const fields: string[] = [];
  if (a.name !== b.name) fields.push('name');
  if (a.description !== b.description) fields.push('description');
  if (JSON.stringify(a.tags ?? []) !== JSON.stringify(b.tags ?? [])) fields.push('tags');
  if (JSON.stringify(a.dyes) !== JSON.stringify(b.dyes)) fields.push('dyes');
  return fields;
}

/**
 * Sprint 9: what Revert does, in words. Revert restores the write-once
 * snapshot and approves it; it undoes exactly this edit only when the snapshot
 * IS the text this edit replaced, which needs a real diff base to tell.
 */
function revertLine(
  revertTo: PresetPreviousValues,
  original: ModerationPresetInfo | undefined,
  originalIsRevertSnapshot: boolean
): string {
  const safeName = sanitizePresetName(revertTo.name);
  if (!original || originalIsRevertSnapshot) {
    return `**Revert:** restores the saved approved version "${safeName}" and approves it. It may be older than the text this edit replaced.`;
  }
  const differing = differingFields(revertTo, original);
  if (differing.length === 0) {
    return `**Revert:** restores "${safeName}", the text this edit replaced, and approves it.`;
  }
  return `**Revert:** restores the saved approved version "${safeName}" and approves it. It is older than the text this edit replaced (they differ in: ${differing.join(', ')}), so Revert does not just undo this edit.`;
}

/**
 * Build the moderation embed + components for a pending preset (new or edit).
 */
export function buildModerationNotification(
  env: Env,
  opts: ModerationNotificationOptions
): { embeds: DiscordEmbed[]; components?: DiscordActionRow[] } {
  const adminT = createTranslator('en');
  const { preset, original } = opts;

  // BUG-072: sanitize unconditionally — all three former copies now share this
  const safeName = sanitizePresetName(preset.name);
  const safeDescription = sanitizePresetDescription(preset.description);
  const safeAuthor = sanitizePresetName(preset.author_name || 'Unknown');
  const { buttonsRoutable } = moderationToken(env);
  // BUG-003: Revert is an explicit opt-in on an edit — being an edit alone
  // never shows it — and it is described whenever it is offered.
  const revertTo = opts.kind === 'edit' ? opts.revertTo : undefined;

  const lines: string[] = [];
  if (opts.kind === 'edit' && original) {
    const changes: string[] = [];
    if (preset.name !== original.name) {
      changes.push(`**Name:** "${sanitizePresetName(original.name)}" → "${safeName}"`);
    }
    if (preset.description !== original.description) {
      changes.push('**Description:** Changed');
    }
    if (JSON.stringify(preset.dyes) !== JSON.stringify(original.dyes)) {
      changes.push(
        `**${adminT.t('webhook.fields.dyes')}:** ${original.dyes.length} → ${preset.dyes.length} colors`
      );
    }
    if (JSON.stringify(preset.tags ?? []) !== JSON.stringify(original.tags ?? [])) {
      changes.push(`**${adminT.t('webhook.fields.tags')}:** Updated`);
    }

    lines.push(
      `**Preset:** ${safeName}`,
      // FINDING-008: the sanitized name only — a <@id> mention pings/resolves the author
      `**${adminT.t('webhook.fields.author')}:** ${safeAuthor}`,
      `**${adminT.t('webhook.fields.category')}:** ${opts.categoryName || preset.category_id}`,
      '',
      opts.originalIsRevertSnapshot === true ? '**Changes since the Revert snapshot:**' : '**Changes:**',
      changes.join('\n') || 'No visible changes',
      '',
      `**New Description:** ${safeDescription}`
    );
  } else {
    lines.push(
      `**Name:** ${safeName}`,
      `**Description:** ${safeDescription}`,
      `**Author:** ${safeAuthor}`,
      `**${adminT.t('webhook.fields.category')}:** ${opts.categoryName || preset.category_id}`,
      `**${adminT.t('webhook.fields.dyes')}:** ${preset.dyes.length} colors`
    );
  }

  if (revertTo && buttonsRoutable) {
    lines.push('', revertLine(revertTo, original, opts.originalIsRevertSnapshot === true));
  }

  if (!buttonsRoutable) {
    // BUG-009: no routable buttons — tell moderators what to do instead
    lines.push('', `Use \`/preset moderate\` on the moderation bot to review this preset.`);
  }

  const embed: DiscordEmbed = {
    title:
      opts.kind === 'edit'
        ? `✏️ ${adminT.t('webhook.editPending')}`
        : `🟡 ${adminT.t('webhook.newPresetPending')}`,
    description: lines.join('\n'),
    ...(opts.extraFields ? { fields: opts.extraFields } : {}),
    // Our accent (#EA4133) and Discord's fixed danger red (#DA373C) are
    // four hex points apart, so an accent bar above a Reject button reads
    // as one colour carrying two meanings. Button styles are fixed on this
    // platform, so the fix moves to the bar: amber whenever a destructive
    // action is on screen.
    color: buttonsRoutable ? STATE.confirm : STATE.warning,
    footer: { text: `ID: ${preset.id}` },
    timestamp: new Date().toISOString(),
  };

  if (!buttonsRoutable) {
    return { embeds: [embed] };
  }

  const buttons: DiscordActionRow = {
    type: 1, // Action Row
    components: [
      {
        type: 2, // Button
        style: 3, // Success (green)
        label: adminT.t('webhook.buttons.approve'),
        custom_id: reviewCustomId('approve', preset.id, opts.contentRevision, preset.status),
        emoji: { name: '✅' },
      },
      {
        type: 2, // Button
        style: 4, // Danger (red)
        label: adminT.t('webhook.buttons.reject'),
        custom_id: reviewCustomId('reject', preset.id, opts.contentRevision, preset.status),
        emoji: { name: '❌' },
      },
      // BUG-003: an explicit opt-in, so being an edit alone never shows Revert
      ...(revertTo
        ? [
            {
              type: 2 as const, // Button
              style: 4 as const, // Danger (red)
              label: adminT.t('webhook.buttons.revert'),
              custom_id: reviewCustomId('revert', preset.id, opts.contentRevision, preset.status),
              emoji: { name: '↩️' },
            },
          ]
        : []),
    ],
  };

  return { embeds: [embed], components: [buttons] };
}

/**
 * Post a moderation notification to the moderation channel.
 * BUG-074: the Discord API outcome is checked and logged.
 *
 * @returns true when the message was accepted by Discord
 */
export async function sendModerationNotification(
  env: Env,
  opts: ModerationNotificationOptions,
  logger?: ExtendedLogger
): Promise<boolean> {
  if (!env.MODERATION_CHANNEL_ID) return false;

  const { token } = moderationToken(env);
  const message = buildModerationNotification(env, opts);

  try {
    const res = await sendMessage(token, env.MODERATION_CHANNEL_ID, message);
    if (!res.ok) {
      logger?.error('Moderation notification rejected by Discord', undefined, {
        status: res.status,
        body: await res.text().catch(() => ''),
        presetId: opts.preset.id,
      });
      return false;
    }
    return true;
  } catch (error) {
    logger?.error(
      'Failed to send moderation notification',
      error instanceof Error ? error : undefined,
      { presetId: opts.preset.id }
    );
    return false;
  }
}
