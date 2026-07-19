/**
 * Preset moderation-channel notifications — single shared builder.
 *
 * REFACTOR-025 (2026-07-18 audit): the "pending preset" moderation embed
 * previously existed in three divergent copies (webhook path in index.ts,
 * notifyModerationChannel and notifyEditModerationChannel in preset.ts) with
 * inconsistent sanitization (BUG-072) and triplicated button rows (BUG-009).
 * This module is now the only place that builds and posts them.
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
import type { DiscordEmbed, DiscordActionRow } from '../../utils/response.js';
import { sendMessage } from '../../utils/discord-api.js';
import { sanitizePresetName, sanitizePresetDescription } from '../../utils/sanitize.js';
import { createTranslator } from '../../services/bot-i18n.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

/** Subset of preset fields the notifications need (CommunityPreset satisfies it) */
export interface ModerationPresetInfo {
  id: string;
  name: string;
  description: string;
  category_id: string;
  dyes: number[];
  tags?: string[];
  author_name?: string | null;
  author_discord_id?: string | null;
}

export interface ModerationNotificationOptions {
  kind: 'new' | 'edit';
  preset: ModerationPresetInfo;
  /** For kind 'edit': the pre-edit preset used to build the diff summary */
  original?: ModerationPresetInfo;
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
      `**${adminT.t('webhook.fields.author')}:** ${safeAuthor}${preset.author_discord_id ? ` (<@${preset.author_discord_id}>)` : ''}`,
      `**${adminT.t('webhook.fields.category')}:** ${opts.categoryName || preset.category_id}`,
      '',
      '**Changes:**',
      changes.join('\n') || 'No visible changes',
      '',
      `**New Description:** ${safeDescription}`
    );
  } else {
    lines.push(
      `**Name:** ${safeName}`,
      `**Description:** ${safeDescription}`,
      `**Author:** ${safeAuthor}${preset.author_discord_id ? ` (<@${preset.author_discord_id}>)` : ''}`,
      `**${adminT.t('webhook.fields.category')}:** ${opts.categoryName || preset.category_id}`,
      `**${adminT.t('webhook.fields.dyes')}:** ${preset.dyes.length} colors`
    );
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
    color: 0xfee75c,
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
        custom_id: `preset_approve_${preset.id}`,
        emoji: { name: '✅' },
      },
      {
        type: 2, // Button
        style: 4, // Danger (red)
        label: adminT.t('webhook.buttons.reject'),
        custom_id: `preset_reject_${preset.id}`,
        emoji: { name: '❌' },
      },
      ...(opts.kind === 'edit'
        ? [
            {
              type: 2 as const, // Button
              style: 4 as const, // Danger (red)
              label: adminT.t('webhook.buttons.revert'),
              custom_id: `preset_revert_${preset.id}`,
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
