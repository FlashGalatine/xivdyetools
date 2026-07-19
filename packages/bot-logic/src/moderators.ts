/**
 * Shared MODERATOR_IDS parsing.
 *
 * BUG-073 / REFACTOR-010 (2026-07-18 audit): the same conceptual secret was
 * parsed with two different grammars — discord-worker split on commas only
 * (a newline-separated list silently failed closed for every moderator)
 * while moderation-worker accepted whitespace/comma separators with
 * snowflake validation. This module is the single grammar both workers use:
 * any mix of whitespace and commas, with non-snowflake tokens dropped.
 */

/** Discord snowflake: 17–20 digit numeric string */
const SNOWFLAKE_RE = /^\d{17,20}$/;

/**
 * Check whether a string is a plausible Discord snowflake ID
 */
export function isValidDiscordSnowflake(id: string): boolean {
  return SNOWFLAKE_RE.test(id);
}

/**
 * Parse a MODERATOR_IDS secret into a set of validated snowflake IDs.
 * Accepts comma-, space-, and newline-separated lists (and mixes).
 */
export function parseModeratorIds(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter((id) => isValidDiscordSnowflake(id))
  );
}

/**
 * Check whether a user is in the moderator list.
 */
export function isModeratorId(moderatorIds: string | undefined, userId: string): boolean {
  if (!moderatorIds) return false;
  if (!isValidDiscordSnowflake(userId)) return false;
  return parseModeratorIds(moderatorIds).has(userId);
}
