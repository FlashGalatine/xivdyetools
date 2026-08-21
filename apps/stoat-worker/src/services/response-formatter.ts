/**
 * Response formatting utilities for Stoat bot messages.
 *
 * Stoat (Revolt) has simpler embeds than Discord:
 * - No fields array → format as Markdown in description
 * - No footer → append to description
 * - No author → use icon_url + title
 * - media field renders images inline in embed
 */

import { sanitizeEmbedText } from '@xivdyetools/bot-logic';

/** Stoat SendableEmbed structure */
export interface StoatEmbed {
  title?: string;
  description?: string;
  url?: string;
  icon_url?: string;
  colour?: string;
  media?: string;
}

/** Stoat message send options */
export interface StoatMessage {
  content?: string;
  embeds?: StoatEmbed[];
  attachments?: string[];
  replies?: Array<{ id: string; mention: boolean }>;
  masquerade?: {
    name?: string;
    avatar?: string;
    colour?: string;
  };
  interactions?: {
    reactions?: string[];
    restrict_reactions?: boolean;
  };
}

/**
 * Standard preset reactions for dye info responses.
 */
export const DYE_INFO_REACTIONS = [
  encodeURIComponent('🎨'), // Show HEX
  encodeURIComponent('🔢'), // Show RGB
  encodeURIComponent('📊'), // Show HSV
  encodeURIComponent('❓'), // Help
];

/**
 * Format an error response as a simple reply.
 */
export function formatErrorReply(
  messageId: string,
  errorText: string,
  usage?: string,
): StoatMessage {
  let content = errorText;
  if (usage) {
    content += `\nUsage: \`${usage}\``;
  }
  return {
    content,
    replies: [{ id: messageId, mention: false }],
  };
}

/** Revolt user mentions are `<@ULID>` (Crockford Base32, 26 chars). */
const REVOLT_MENTION = /<@([0-9A-HJKMNP-TV-Z]{26})>/g;

/**
 * Make user-supplied text safe to echo inside a bot-authored message:
 * defuse Revolt mentions, then apply the shared Discord-style sanitiser
 * (control / zero-width stripping, `@everyone`, markdown escaping, length cap).
 *
 * FINDING-019 / STOAT-4 (2026-08-21 security audit).
 */
export function sanitizeEcho(text: string, maxLength = 64): string {
  return sanitizeEmbedText(text.replace(REVOLT_MENTION, '@$1'), maxLength);
}

/**
 * Format a disambiguation list when too many dyes match a query.
 */
export function formatDisambiguationList(
  messageId: string,
  query: string,
  dyes: Array<{ name: string; itemID: number | null }>,
  total: number,
): StoatMessage {
  const lines = dyes.map(
    (dye, i) => `  ${i + 1}. ${dye.name}${dye.itemID && dye.itemID > 0 ? ` (${dye.itemID})` : ''}`,
  );

  let content = `Found ${total} dyes matching "${sanitizeEcho(query, 64)}":\n${lines.join('\n')}`;
  if (total > dyes.length) {
    content += `\n  ... and ${total - dyes.length} more`;
  }
  content += '\n\nUse the full name or ItemID for an exact match.';
  content += '\nExample: `!xd info Snow White`  or  `!xd info 5729`';

  return {
    content,
    replies: [{ id: messageId, mention: false }],
  };
}

/**
 * Format a "no match found" response with suggestions.
 */
export function formatNoMatchReply(
  messageId: string,
  query: string,
  suggestions: string[],
): StoatMessage {
  let content = `No dye found matching "${sanitizeEcho(query, 64)}".`;
  if (suggestions.length > 0) {
    content += `\nDid you mean: ${suggestions.join(', ')}?`;
  }
  content += '\n\nTip: You can also use an ItemID (e.g. `!xd info 5743`).';

  return {
    content,
    replies: [{ id: messageId, mention: false }],
  };
}

/**
 * Convert a numeric color to a CSS hex string for Stoat embed colour field.
 * @param color - Decimal color value (e.g., 0xECECEC)
 */
export function colorToHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
