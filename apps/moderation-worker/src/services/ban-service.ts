/**
 * Ban Service
 *
 * Functional module for managing user bans in the Preset Palettes feature.
 * Provides functions for checking ban status, searching users, and managing bans.
 *
 * Read helpers use D1; mutations require an enabled, actor-bound server review.
 *
 * @module services/ban-service
 */

import { validateAndEscapeQuery } from '../utils/sql-helpers.js';
import { activeBanMatch, applyBanReview } from './ban-confirmation-service.js';
import type { Env } from '../types/env.js';
import type {
  UserSearchResult,
  BannedUserSearchResult,
  BanResult,
  UnbanResult,
} from '../types/ban.js';

// ============================================================================
// Ban Status Checks
// ============================================================================

/**
 * MOD-4 (FINDING-034, 2026-08-21 audit): approval must refuse a preset whose
 * author currently holds an active ban — presets-api's `requireNotBanned`
 * guards submission / edit / vote only, and a ban hides just the `approved`
 * presets, so the author's pending / flagged entries stay approvable
 * otherwise. One indexed lookup on the shared D1.
 */
export async function isPresetAuthorBanned(db: D1Database, presetId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `
      SELECT 1
      FROM presets p
      JOIN banned_users b
        ON ${activeBanMatch('b', 'p.author_discord_id')}
        AND b.unbanned_at IS NULL
      WHERE p.id = ?
      LIMIT 1
      `,
    )
    .bind(presetId)
    .first();
  return row !== null;
}

// ============================================================================
// User Search (for Autocomplete)
// ============================================================================

/**
 * Search for users who have submitted presets (for ban_user autocomplete)
 */
export async function searchPresetAuthors(
  db: D1Database,
  query: string,
  limit: number = 25,
): Promise<UserSearchResult[]> {
  // Validate and escape user input for SQL LIKE query
  // moderation-worker-08: `minLength: 1` used to be here, and Discord sends an
  // autocomplete interaction with `value: ''` the moment the option is
  // focused — so both pickers showed NOTHING until the moderator typed. For
  // `unban_user` that was the whole feature: a moderator who does not remember
  // a banned user's stored display name had no way to list who is banned. An
  // empty query is a legitimate "show me the top of the list"; `LIMIT ?` (25)
  // already bounds it, and the escaping below is unaffected.
  const validation = validateAndEscapeQuery(query, { maxLength: 100, minLength: 0 });
  if (!validation.valid) {
    return []; // Return empty results for invalid queries
  }
  const escapedQuery = validation.sanitized;

  try {
    const results = await db
      .prepare(
        `
        SELECT
          p.author_discord_id as discord_id,
          p.author_name as username,
          COUNT(*) as preset_count
        FROM presets p
        WHERE p.author_discord_id IS NOT NULL
          AND p.author_name LIKE ? ESCAPE '\\'
        GROUP BY p.author_discord_id
        ORDER BY preset_count DESC, p.author_name ASC
        LIMIT ?
        `,
      )
      .bind(`%${escapedQuery}%`, Math.min(25, Math.max(1, limit)))
      .all<{ discord_id: string; username: string; preset_count: number }>();

    return (results.results || []).map((row) => ({
      discordId: row.discord_id,
      username: row.username,
      presetCount: row.preset_count,
    }));
  } catch {
    // Fallback: Query without banned_users filter
    const results = await db
      .prepare(
        `
        SELECT
          author_discord_id as discord_id,
          author_name as username,
          COUNT(*) as preset_count
        FROM presets
        WHERE author_discord_id IS NOT NULL
          AND author_name LIKE ? ESCAPE '\\'
        GROUP BY author_discord_id
        ORDER BY preset_count DESC, author_name ASC
        LIMIT ?
        `,
      )
      .bind(`%${escapedQuery}%`, Math.min(25, Math.max(1, limit)))
      .all<{ discord_id: string; username: string; preset_count: number }>();

    return (results.results || []).map((row) => ({
      discordId: row.discord_id,
      username: row.username,
      presetCount: row.preset_count,
    }));
  }
}

/**
 * Search for currently banned users (for unban_user autocomplete)
 */
export async function searchBannedUsers(
  db: D1Database,
  query: string,
  limit: number = 25,
): Promise<BannedUserSearchResult[]> {
  // Validate and escape user input for SQL LIKE query
  // moderation-worker-08: `minLength: 1` used to be here, and Discord sends an
  // autocomplete interaction with `value: ''` the moment the option is
  // focused — so both pickers showed NOTHING until the moderator typed. For
  // `unban_user` that was the whole feature: a moderator who does not remember
  // a banned user's stored display name had no way to list who is banned. An
  // empty query is a legitimate "show me the top of the list"; `LIMIT ?` (25)
  // already bounds it, and the escaping below is unaffected.
  const validation = validateAndEscapeQuery(query, { maxLength: 100, minLength: 0 });
  if (!validation.valid) {
    return []; // Return empty results for invalid queries
  }
  const escapedQuery = validation.sanitized;

  try {
    const results = await db
      .prepare(
        `
        SELECT
          discord_id,
          xivauth_id,
          username,
          banned_at
        FROM banned_users
        WHERE unbanned_at IS NULL
          AND (
            username LIKE ? ESCAPE '\\'
            OR discord_id LIKE ? ESCAPE '\\'
            OR xivauth_id LIKE ? ESCAPE '\\'
            OR EXISTS (SELECT 1 FROM ban_identity_memberships bm WHERE bm.ban_id = banned_users.id AND bm.identity_id LIKE ? ESCAPE '\\')
          )
        ORDER BY username ASC
        LIMIT ?
        `,
      )
      .bind(
        `%${escapedQuery}%`,
        `%${escapedQuery}%`,
        `%${escapedQuery}%`,
        `%${escapedQuery}%`,
        Math.min(25, Math.max(1, limit)),
      )
      .all<{
        discord_id: string | null;
        xivauth_id: string | null;
        username: string;
        banned_at: string;
      }>();

    return (results.results || []).map((row) => ({
      discordId: row.discord_id,
      xivAuthId: row.xivauth_id,
      username: row.username,
      bannedAt: row.banned_at,
    }));
  } catch {
    return [];
  }
}

export async function getPresetAuthorName(
  db: D1Database,
  discordId: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      `
      SELECT author_name
      FROM presets
      WHERE author_discord_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
    )
    .bind(discordId)
    .first<{ author_name: string | null }>();

  return row?.author_name ?? null;
}

/** A target-only ID never authorizes a ban. All writes require a live reviewed nonce. */
export async function banUser(
  env: Env,
  nonce: string,
  actorId: string,
  reason: string,
  username: string,
): Promise<BanResult> {
  return applyBanReview(env, nonce, actorId, 'ban', reason, username);
}
export async function unbanUser(env: Env, nonce: string, actorId: string): Promise<UnbanResult> {
  return applyBanReview(env, nonce, actorId, 'unban');
}
