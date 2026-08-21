/**
 * Embed-text budgets for user-sourced strings
 *
 * FINDING-019 (2026-08-21 security audit): everything a Discord user or a
 * preset author typed that this bot renders inside an embed or message goes
 * through `@xivdyetools/bot-logic`'s shared sanitiser — control / zero-width
 * stripping, @everyone / <@…> defusing, markdown + masked-link escaping, and a
 * length cap. These wrappers only pin the per-field budgets (so one value can
 * never blow a Discord limit) and keep multi-line moderator reasons readable.
 *
 * @module utils/embed-text
 */

import { sanitizeEmbedText } from '@xivdyetools/bot-logic';

/** Preset names: presets-api caps them at 50 chars; escaping can double that. */
export const NAME_MAX = 100;
/** Discord display names / usernames: 32 code points before escaping. */
export const USER_MAX = 64;
/** Embed field value limit. */
export const REASON_MAX = 1024;

/** A preset name (author-controlled). */
export function sanitizeName(text: unknown): string {
  return sanitizeEmbedText(text, NAME_MAX);
}

/** A Discord username / display name / preset author name. */
export function sanitizeUserName(text: unknown): string {
  return sanitizeEmbedText(text, USER_MAX);
}

/**
 * Moderator-typed free text from a paragraph modal or command option. Each
 * line goes through the shared sanitiser separately (it would otherwise
 * collapse the line breaks), then the whole value is capped to the embed
 * field limit with an ellipsis.
 */
export function sanitizeReason(text: unknown): string {
  if (typeof text !== 'string') return '';
  const joined = text
    .split(/\r?\n/)
    .map((line) => sanitizeEmbedText(line, REASON_MAX))
    .join('\n');
  const chars = [...joined];
  if (chars.length <= REASON_MAX) return joined;
  let cut = chars.slice(0, REASON_MAX - 1).join('');
  // Do not end on a dangling backslash that would escape the ellipsis
  if (cut.endsWith('\\')) cut = cut.slice(0, -1);
  return `${cut}…`;
}
