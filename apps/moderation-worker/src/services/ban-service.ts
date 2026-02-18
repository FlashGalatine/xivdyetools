/**
 * Ban Service
 *
 * Functional module for managing user bans in the Preset Palettes feature.
 * Provides functions for checking ban status, searching users, and managing bans.
 *
 * All functions are stateless and take the D1 database binding as a parameter.
 *
 * @module services/ban-service
 */

import { validateAndEscapeQuery } from '../utils/sql-helpers.js';
import type {
  BannedUserRow,
  BannedUser,
  UserSearchResult,
  BannedUserSearchResult,
  BanConfirmationData,
  BanResult,
  UnbanResult,
} from '../types/ban.js';

// ============================================================================
// Ban Status Checks
// ============================================================================

/**
 * Check if a user is currently banned by their Discord ID
 */
export async function isUserBannedByDiscordId(
  db: D1Database,
  discordId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      'SELECT 1 FROM banned_users WHERE discord_id = ? AND unbanned_at IS NULL LIMIT 1'
    )
    .bind(discordId)
    .first();
  return result !== null;
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
  limit: number = 25
): Promise<UserSearchResult[]> {
  // Validate and escape user input for SQL LIKE query
  const validation = validateAndEscapeQuery(query, { maxLength: 100, minLength: 1 });
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
        LEFT JOIN banned_users b ON p.author_discord_id = b.discord_id AND b.unbanned_at IS NULL
        WHERE p.author_discord_id IS NOT NULL
          AND p.author_name LIKE ? ESCAPE '\\'
          AND b.id IS NULL
        GROUP BY p.author_discord_id
        ORDER BY preset_count DESC, p.author_name ASC
        LIMIT ?
        `
      )
      .bind(`%${escapedQuery}%`, limit)
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
        `
      )
      .bind(`%${escapedQuery}%`, limit)
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
  limit: number = 25
): Promise<BannedUserSearchResult[]> {
  // Validate and escape user input for SQL LIKE query
  const validation = validateAndEscapeQuery(query, { maxLength: 100, minLength: 1 });
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
          AND (username LIKE ? ESCAPE '\\' OR discord_id LIKE ? ESCAPE '\\')
        ORDER BY username ASC
        LIMIT ?
        `
      )
      .bind(`%${escapedQuery}%`, `%${escapedQuery}%`, limit)
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

// ============================================================================
// Ban Confirmation Data
// ============================================================================

/**
 * Get user details and recent presets for the ban confirmation embed
 */
export async function getUserForBanConfirmation(
  db: D1Database,
  discordId: string,
  baseUrl: string
): Promise<BanConfirmationData | null> {
  const userResult = await db
    .prepare(
      `
      SELECT
        author_discord_id as discord_id,
        author_name as username,
        COUNT(*) as preset_count
      FROM presets
      WHERE author_discord_id = ?
      GROUP BY author_discord_id
      `
    )
    .bind(discordId)
    .first<{ discord_id: string; username: string; preset_count: number }>();

  if (!userResult) {
    return null;
  }

  const presetsResult = await db
    .prepare(
      `
      SELECT id, name
      FROM presets
      WHERE author_discord_id = ?
      ORDER BY created_at DESC
      LIMIT 3
      `
    )
    .bind(discordId)
    .all<{ id: string; name: string }>();

  return {
    user: {
      discordId: userResult.discord_id,
      username: userResult.username,
      presetCount: userResult.preset_count,
    },
    recentPresets: (presetsResult.results || []).map((p) => ({
      id: p.id,
      name: p.name,
      shareUrl: `${baseUrl}/presets/${p.id}`,
    })),
  };
}

// ============================================================================
// Ban Operations
// ============================================================================

/**
 * Ban a user from the Preset Palettes feature
 */
export async function banUser(
  db: D1Database,
  discordId: string,
  username: string,
  moderatorDiscordId: string,
  reason: string
): Promise<BanResult> {
  try {
    const existingBan = await isUserBannedByDiscordId(db, discordId);
    if (existingBan) {
      return {
        success: false,
        presetsHidden: 0,
        error: 'User is already banned.',
      };
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(
        `
        INSERT INTO banned_users (id, discord_id, username, moderator_discord_id, reason, banned_at)
        VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .bind(id, discordId, username, moderatorDiscordId, reason, now)
      .run();

    const presetsHidden = await hideUserPresets(db, discordId);

    return {
      success: true,
      presetsHidden,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('no such table: banned_users')) {
      return {
        success: false,
        presetsHidden: 0,
        error: 'Ban system not configured. Please run the database migration first.',
      };
    }

    return {
      success: false,
      presetsHidden: 0,
      error: errorMessage,
    };
  }
}

/**
 * Unban a user from the Preset Palettes feature
 */
export async function unbanUser(
  db: D1Database,
  discordId: string,
  moderatorDiscordId: string
): Promise<UnbanResult> {
  try {
    const isBanned = await isUserBannedByDiscordId(db, discordId);
    if (!isBanned) {
      return {
        success: false,
        presetsRestored: 0,
        error: 'User is not currently banned.',
      };
    }

    const now = new Date().toISOString();

    const updateResult = await db
      .prepare(
        `
        UPDATE banned_users
        SET unbanned_at = ?, unban_moderator_discord_id = ?
        WHERE discord_id = ? AND unbanned_at IS NULL
        `
      )
      .bind(now, moderatorDiscordId, discordId)
      .run();

    if ((updateResult.meta.changes || 0) === 0) {
      return {
        success: false,
        presetsRestored: 0,
        error: 'Failed to update ban record.',
      };
    }

    const presetsRestored = await restoreUserPresets(db, discordId);

    return {
      success: true,
      presetsRestored,
    };
  } catch (error) {
    return {
      success: false,
      presetsRestored: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Preset Visibility
// ============================================================================

/**
 * Hide all presets by a banned user
 */
export async function hideUserPresets(db: D1Database, discordId: string): Promise<number> {
  const result = await db
    .prepare(
      `
      UPDATE presets
      SET status = 'hidden'
      WHERE author_discord_id = ? AND status = 'approved'
      `
    )
    .bind(discordId)
    .run();

  return result.meta.changes || 0;
}

/**
 * Restore presets for an unbanned user
 */
export async function restoreUserPresets(db: D1Database, discordId: string): Promise<number> {
  const result = await db
    .prepare(
      `
      UPDATE presets
      SET status = 'approved'
      WHERE author_discord_id = ? AND status = 'hidden'
      `
    )
    .bind(discordId)
    .run();

  return result.meta.changes || 0;
}

// ============================================================================
// Ban Record Retrieval
// ============================================================================

/**
 * Get the active ban record for a user
 */
export async function getActiveBan(
  db: D1Database,
  discordId: string
): Promise<BannedUser | null> {
  const row = await db
    .prepare(
      `
      SELECT *
      FROM banned_users
      WHERE discord_id = ? AND unbanned_at IS NULL
      LIMIT 1
      `
    )
    .bind(discordId)
    .first<BannedUserRow>();

  if (!row) return null;

  return {
    id: row.id,
    discordId: row.discord_id,
    xivAuthId: row.xivauth_id,
    username: row.username,
    moderatorDiscordId: row.moderator_discord_id,
    reason: row.reason,
    bannedAt: row.banned_at,
    unbannedAt: row.unbanned_at,
    unbanModeratorDiscordId: row.unban_moderator_discord_id,
  };
}
