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
import type { ChangelogEntry } from './changelog-parser.js';

/**
 * Discord's embed description ceiling is 4096; we stop well short so the
 * "…and more" line always has room.
 */
const DESCRIPTION_BUDGET = 3900;

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
  let body = description;
  if (description.length > DESCRIPTION_BUDGET) {
    const cut = description.slice(0, DESCRIPTION_BUDGET);
    const lastBreak = cut.lastIndexOf('\n');
    const fullNotesUrl = `${repoUrl}/blob/main/CHANGELOG-laymans.md`;
    body = `${(lastBreak > 0 ? cut.slice(0, lastBreak) : cut).trimEnd()}\n\n*Summary shown — [full release notes](${fullNotesUrl})*`;
  }

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
): Promise<void> {
  const embed = formatAnnouncementEmbed(entry, repoUrl);

  await sendMessage(botToken, channelId, {
    embeds: [embed],
  });
}
