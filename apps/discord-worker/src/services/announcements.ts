/**
 * Changelog Announcement Service
 *
 * Formats parsed changelog entries as rich Discord embeds and
 * sends them to the configured announcement channel.
 *
 * @module services/announcements
 */

import { sendMessage } from '../utils/discord-api.js';
import { BRAND_ACCENT } from '../utils/brand.js';
import { cutOnLineBoundary } from '../utils/text.js';
import type { ChangelogEntry } from './changelog-parser.js';

/**
 * Discord's embed description ceiling is 4096; we stop short of it, and the
 * summary line (GitHub link included) is budgeted inside this figure.
 */
const DESCRIPTION_BUDGET = 4000;

/**
 * Formats a changelog entry as a Discord embed object.
 *
 * @param entry - Parsed changelog entry
 * @param repoUrl - Repository URL for the footer link
 */
export function formatAnnouncementEmbed(
  entry: ChangelogEntry,
  repoUrl: string
): {
  title: string;
  description: string;
  color: number;
  footer: { text: string };
  timestamp: string;
} {
  // Build description from sections
  const descriptionParts: string[] = [];

  for (const section of entry.sections) {
    descriptionParts.push(`### ${section.title}`);
    for (const item of section.items) {
      descriptionParts.push(`• ${item}`);
    }
    descriptionParts.push('');
  }

  const description = descriptionParts.join('\n').trim();

  // A large release used to lose its tail silently, mid-bullet, behind a
  // bare "...". The announcement can afford to be a summary that links out —
  // but it has to SAY it is one, and it has to cut on a line boundary rather
  // than through a word. It links to the product-level notes on GitHub, not
  // to /changelog: that command shows the bot's OWN notes (its bundled
  // apps/discord-worker/CHANGELOG-laymans.md), which would not contain the
  // web-app and link-preview bullets cut here.
  const fullNotesUrl = `${repoUrl}/blob/main/CHANGELOG-laymans.md`;
  const body = cutOnLineBoundary(
    description,
    DESCRIPTION_BUDGET,
    `\n\n*Summary shown — [full release notes](${fullNotesUrl})*`
  );

  return {
    title: `🆕 XIV Dye Tools v${entry.version}`,
    description: body,
    color: BRAND_ACCENT,
    footer: {
      text: `Released ${entry.date} • Full changelog: ${repoUrl}`,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sends a changelog announcement embed to a Discord channel.
 *
 * @param botToken - Discord bot token
 * @param channelId - Target channel ID
 * @param entry - Parsed changelog entry
 * @param repoUrl - Repository URL for the footer
 */
export async function sendAnnouncement(
  botToken: string,
  channelId: string,
  entry: ChangelogEntry,
  repoUrl: string
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const embed = formatAnnouncementEmbed(entry, repoUrl);

  const res = await sendMessage(botToken, channelId, {
    embeds: [embed],
  });

  // BUG-026: this awaited `sendMessage` and threw the Response away, so a
  // Discord 403 (no SEND_MESSAGES in the announcement channel) or 400
  // (rejected embed) resolved as success. The caller then wrote the
  // `announced:v:<version>` memo, every later Redeliver short-circuited on it,
  // and that release could never be announced again — the exact opposite of
  // the invariant the caller documents. Only a network error or the 5 s
  // AbortSignal used to surface at all.
  if (res.ok) return { ok: true };

  return {
    ok: false,
    status: res.status,
    body: (await res.text().catch(() => '')).slice(0, 300),
  };
}
