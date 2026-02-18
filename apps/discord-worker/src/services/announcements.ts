/**
 * Changelog Announcement Service
 *
 * Formats parsed changelog entries as rich Discord embeds and
 * sends them to the configured announcement channel.
 *
 * @module services/announcements
 */

import { sendMessage } from '../utils/discord-api.js';
import type { ChangelogEntry } from './changelog-parser.js';

/** Discord blurple color */
const BLURPLE = 0x5865f2;

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

  // Truncate if over Discord's 4096 char embed description limit
  const truncated =
    description.length > 4000
      ? description.slice(0, 3997) + '...'
      : description;

  return {
    title: `🆕 XIV Dye Tools v${entry.version}`,
    description: truncated,
    color: BLURPLE,
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
