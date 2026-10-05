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
import { isXivAuthUuid } from '../utils/response.js';
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
        ON (b.discord_id = p.author_discord_id OR b.xivauth_id = p.author_discord_id)
        AND b.unbanned_at IS NULL
      WHERE p.id = ?
      LIMIT 1
      `
    )
    .bind(presetId)
    .first();
  return row !== null;
}

/**
 * Check if a user is currently banned by their Discord ID.
 *
 * FINDING-014 (2026-10-03 audit): the target is a Discord snowflake or an
 * XIVAuth `sub` UUID, and an active ban matches it in `discord_id` OR
 * `xivauth_id` — rows written before `banUser` filled `xivauth_id` carry the
 * UUID in `discord_id` only, newer ones in both.
 */
export async function isUserBannedByDiscordId(
  db: D1Database,
  discordId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      'SELECT 1 FROM banned_users WHERE (discord_id = ? OR xivauth_id = ?) AND unbanned_at IS NULL LIMIT 1'
    )
    .bind(discordId, discordId)
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
        LEFT JOIN banned_users b
          ON (p.author_discord_id = b.discord_id OR p.author_discord_id = b.xivauth_id)
          AND b.unbanned_at IS NULL
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
          )
        ORDER BY username ASC
        LIMIT ?
        `
      )
      .bind(`%${escapedQuery}%`, `%${escapedQuery}%`, `%${escapedQuery}%`, limit)
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

  // moderation-worker-10: a `null` here used to end the command with "User not
  // found or has no presets", which made a user who has never SUBMITTED a
  // preset unbannable — even though the ban is meaningful for them:
  // presets-api's `requireNotBanned` guards the votes router as well as the
  // presets one (`handlers/votes.ts:30`), so a vote-only abuser is exactly who
  // a moderator would want to ban and exactly who could not be.
  //
  // The modal already falls back to the raw snowflake when D1 has no name
  // (`ban-reason.ts:83-85`), so do the same here and let the confirmation
  // embed say "no presets" rather than refusing.
  if (!userResult) {
    return {
      user: { discordId, username: discordId, presetCount: 0 },
      recentPresets: [],
    };
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

/**
 * FINDING-007 (2026-08-21 audit): the display name a preset author is known
 * by, resolved at click/submit time so it no longer has to ride along inside
 * Discord `custom_id`s (100-char cap — long CJK/emoji names overflowed it and
 * made the user un-bannable). Most recent preset wins when names differ.
 *
 * @returns the author name, or null when the user has no presets
 */
export async function getPresetAuthorName(
  db: D1Database,
  discordId: string
): Promise<string | null> {
  const row = await db
    .prepare(
      `
      SELECT author_name
      FROM presets
      WHERE author_discord_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `
    )
    .bind(discordId)
    .first<{ author_name: string | null }>();

  return row?.author_name ?? null;
}

// ============================================================================
// Moderation Log (FINDING-018)
// ============================================================================

/**
 * FINDING-018 (2026-08-29 audit; the half of FINDING-034 that 1.5.0 deferred):
 * a ban wrote `banned_users` and hid the author's presets without leaving a
 * single `moderation_log` row, so a preset's history could not explain why it
 * had vanished from the gallery and `/moderation/stats` never counted a ban.
 *
 * presets-api owns the table; migration `0013_moderation_log_user_actions.sql`
 * made `preset_id` nullable and added `target_discord_id`. The rows are written
 * here, in the SAME `db.batch()` as the statements they describe, so the trail
 * cannot drift from the effect — and on a database that has not had 0013
 * applied the whole batch fails loudly instead of banning without a record.
 *
 * Rows never carry a username: `moderator_discord_id` is always a Discord
 * snowflake (moderators authenticate through Discord), `target_discord_id`
 * is whatever `isBanTargetId` accepted — a snowflake or, since BUG-001 path
 * (a) (2026-09-16 deep-dive), an XIVAuth `sub` UUID for an XIVAuth-only
 * preset author — and `reason` is the moderator's own typed text.
 */
const MODERATION_LOG_COLUMNS =
  'id, preset_id, moderator_discord_id, action, reason, target_discord_id, created_at';

/**
 * UUID v4 built by SQLite, because the per-preset rows come from one
 * `INSERT … SELECT` and each needs its own id. `hex()` yields uppercase, hence
 * the `lower()`; the `'-4'` and `'89ab'` pieces pin the version and variant
 * nibbles so the ids are indistinguishable from `crypto.randomUUID()`'s.
 */
const SQL_UUID_V4 =
  "lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))";

/**
 * The `ban` row — a user-level action, so `preset_id` is NULL. Unconditional:
 * it is batched with an INSERT that either lands or aborts the whole batch
 * (`idx_banned_users_discord_active` refuses a second active ban), so there is
 * no state in which this row can outlive the ban it describes. The `unban` row
 * has no such guarantee — see `unbanLogStatement`.
 */
function banLogStatement(
  db: D1Database,
  targetDiscordId: string,
  moderatorDiscordId: string,
  reason: string | null,
  now: string
): D1PreparedStatement {
  return db
    .prepare(
      `
      INSERT INTO moderation_log (${MODERATION_LOG_COLUMNS})
      VALUES (?, NULL, ?, ?, ?, ?, ?)
      `
    )
    .bind(crypto.randomUUID(), moderatorDiscordId, 'ban', reason, targetDiscordId, now);
}

/**
 * The `unban` row, conditional on the `banned_users` UPDATE that must precede
 * it in the batch: `changes()` reads that UPDATE inside the batch's own
 * transaction, so when a concurrent moderator has already closed the ban and
 * the UPDATE matches zero rows, no row is written. Without the guard the batch
 * still commits and the audit trail claims an unban that never happened
 * (whole-branch review, 2026-08-30). Same idiom presets-api uses for its own
 * status-change rows (`handlers/moderation.ts`).
 */
function unbanLogStatement(
  db: D1Database,
  targetDiscordId: string,
  moderatorDiscordId: string,
  now: string
): D1PreparedStatement {
  return db
    .prepare(
      `
      INSERT INTO moderation_log (${MODERATION_LOG_COLUMNS})
      SELECT ?, NULL, ?, 'unban', NULL, ?, ? WHERE changes() > 0
      `
    )
    .bind(crypto.randomUUID(), moderatorDiscordId, targetDiscordId, now);
}

/**
 * FINDING-021 (2026-10-03 audit): the extra WHERE terms that keep an unban's
 * restore from tripping `idx_presets_dye_signature` (unique over `approved` +
 * `pending` only, so hidden rows may share a signature while hidden). A hidden
 * preset is skipped — and stays hidden — when
 *   1. another approved or pending preset already holds its signature, or
 *   2. the same author has a lower-id hidden preset with that signature (so at
 *      most one of a set of hidden twins is restored, whatever order SQLite
 *      evaluates the rows in).
 * One shared fragment for the restore UPDATE and its `moderation_log` rows, so
 * the trail lists exactly the presets that flipped. `alias` is the outer
 * table's name or alias in the statement it is spliced into. A NULL signature
 * never collides (NULL = NULL is not true).
 */
function restoreGuard(alias: string): string {
  return `
        AND NOT EXISTS (
          SELECT 1 FROM presets o
          WHERE o.dye_signature = ${alias}.dye_signature
            AND o.id <> ${alias}.id
            AND o.status IN ('approved', 'pending')
        )
        AND NOT EXISTS (
          SELECT 1 FROM presets h
          WHERE h.author_discord_id = ${alias}.author_discord_id
            AND h.status = 'hidden'
            AND h.dye_signature = ${alias}.dye_signature
            AND h.id < ${alias}.id
        )`;
}

/**
 * One row per preset the matching UPDATE is about to flip. `fromStatus` must be
 * the status that UPDATE's WHERE clause selects on (`hideUserPresetsStatement` /
 * `restoreUserPresetsStatement`), and this statement must sit BEFORE it in the
 * batch — afterwards the presets no longer carry that status and it would
 * select, and therefore log, nothing.
 */
function presetActionLogStatement(
  db: D1Database,
  action: 'hide' | 'restore',
  fromStatus: 'approved' | 'hidden',
  targetDiscordId: string,
  moderatorDiscordId: string,
  reason: string | null,
  now: string
): D1PreparedStatement {
  return db
    .prepare(
      `
      INSERT INTO moderation_log (${MODERATION_LOG_COLUMNS})
      SELECT ${SQL_UUID_V4}, p.id, ?, ?, ?, ?, ?
      FROM presets p
      WHERE p.author_discord_id = ? AND p.status = ?${action === 'restore' ? restoreGuard('p') : ''}
      `
    )
    .bind(moderatorDiscordId, action, reason, targetDiscordId, now, targetDiscordId, fromStatus);
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
    // FINDING-014: an XIVAuth-only target (the UUID shape `isBanTargetId`
    // accepts) is ALSO recorded in `xivauth_id`; a snowflake leaves it NULL.
    // `discord_id` keeps taking the raw target as before. Both columns then
    // hold the same UUID, so each partial unique index refuses a second
    // active ban of the same identity.
    const xivAuthId = isXivAuthUuid(discordId) ? discordId : null;

    // MOD-4 (FINDING-034, 2026-08-21 audit): ban row + hide in ONE batch
    // (D1 batches are transactional) — a failed hide can no longer leave a
    // banned_users row next to still-visible presets. FINDING-018 (2026-08-29)
    // puts the audit rows in the same batch: [ban log, hide log, ban row, hide].
    // The hide log must precede the UPDATE it mirrors, and 'approved' must stay
    // in step with `hideUserPresetsStatement`'s WHERE clause.
    const [, , , hideResult] = await db.batch([
      banLogStatement(db, discordId, moderatorDiscordId, reason, now),
      presetActionLogStatement(db, 'hide', 'approved', discordId, moderatorDiscordId, reason, now),
      db
        .prepare(
          `
        INSERT INTO banned_users (id, discord_id, xivauth_id, username, moderator_discord_id, reason, banned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        )
        .bind(id, discordId, xivAuthId, username, moderatorDiscordId, reason, now),
      hideUserPresetsStatement(db, discordId, now),
    ]);

    return {
      success: true,
      presetsHidden: hideResult?.meta?.changes || 0,
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

    // FINDING-018: on a database that has not had presets-api migration 0013
    // applied, the batch's moderation_log write aborts the whole ban with
    // "has no column named target_discord_id". Loud is right, but the generic
    // message left the moderator with nothing to act on. Name the fix, never
    // the schema (MOD-8) — the raw message still reaches the logs via `cause`.
    if (/has no column named|no such column/i.test(errorMessage)) {
      return {
        success: false,
        presetsHidden: 0,
        error: 'Ban system schema is out of date — apply presets-api migration 0013.',
        cause: error,
      };
    }

    // idx_banned_users_discord_active (one active ban per user): two
    // moderators confirming at once — the second insert loses, cleanly.
    if (/UNIQUE constraint failed/i.test(errorMessage)) {
      return {
        success: false,
        presetsHidden: 0,
        error: 'User is already banned.',
      };
    }

    // MOD-8: `error` is channel-facing — never the raw D1 message (table,
    // column and constraint names); the original stays in `cause` for logs.
    return {
      success: false,
      presetsHidden: 0,
      error: 'Failed to ban user.',
      cause: error,
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

    // MOD-4: close the ban row and restore the presets in ONE batch.
    // FINDING-018: [ban-row UPDATE, unban log, restore log, restore] — the
    // unban log comes straight after the UPDATE because it is conditional on
    // it (`changes() > 0`), so a lost race against another moderator's unban
    // commits no row; the restore log still precedes the UPDATE it mirrors.
    // The unban command takes no reason, so the rows carry NULL rather than an
    // invented one.
    //
    // FINDING-005 (2026-10-03 audit): the same UPDATE blanks the ban's
    // `username` copy and free-text `reason` (both NOT NULL, hence '' rather
    // than NULL). They stay readable while the ban is active — ban search
    // selects and sorts on `username` — and are scrubbed the moment it lifts.
    // Pruning the lifted row itself is presets-api's retention rule, not this
    // worker's.
    //
    // FINDING-021: the restore skips hidden presets whose dye_signature now
    // belongs to an approved / pending preset (see `restoreGuard`), so another
    // user's matching preset can no longer abort the whole all-or-nothing
    // batch; they are counted afterwards and reported.
    const [updateResult, , , restoreResult] = await db.batch([
      db
        .prepare(
          `
        UPDATE banned_users
        SET unbanned_at = ?, unban_moderator_discord_id = ?, username = '', reason = ''
        WHERE (discord_id = ? OR xivauth_id = ?) AND unbanned_at IS NULL
        `
        )
        .bind(now, moderatorDiscordId, discordId, discordId),
      unbanLogStatement(db, discordId, moderatorDiscordId, now),
      presetActionLogStatement(db, 'restore', 'hidden', discordId, moderatorDiscordId, null, now),
      restoreUserPresetsStatement(db, discordId, now),
    ]);

    if ((updateResult?.meta?.changes || 0) === 0) {
      return {
        success: false,
        presetsRestored: 0,
        error: 'Failed to update ban record.',
      };
    }

    return {
      success: true,
      presetsRestored: restoreResult?.meta?.changes || 0,
      presetsStillHidden: await countHiddenPresets(db, discordId),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // FINDING-021: a signature collision that slipped past `restoreGuard` (a
    // submission racing the batch) rolled the whole unban back. Say so, in
    // channel-safe words, instead of the generic failure.
    if (/UNIQUE constraint failed:.*dye_signature/i.test(message)) {
      return {
        success: false,
        presetsRestored: 0,
        error:
          'Unban blocked: a restored preset duplicates an existing one. Nothing was changed; try again.',
        cause: error,
      };
    }
    // MOD-8: channel-safe message; raw D1 error kept in `cause` for logging
    return {
      success: false,
      presetsRestored: 0,
      error: 'Failed to unban user.',
      cause: error,
    };
  }
}

// ============================================================================
// Preset Visibility
// ============================================================================

/**
 * FINDING-021: how many of the author's presets are still `hidden` after an
 * unban's restore — i.e. the ones `restoreGuard` held back. The batch has
 * already committed, so a failure here must never turn the unban into an
 * error: it degrades to 0 and the moderator simply sees no "still hidden" line.
 */
async function countHiddenPresets(db: D1Database, discordId: string): Promise<number> {
  try {
    const row = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM presets WHERE author_discord_id = ? AND status = 'hidden'"
      )
      .bind(discordId)
      .first<{ n: number }>();
    const n = Number(row?.n);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Statement form so `banUser` can batch it with the ban insert (MOD-4). */
function hideUserPresetsStatement(
  db: D1Database,
  discordId: string,
  now: string
): D1PreparedStatement {
  return db
    .prepare(
      `
      UPDATE presets
      SET status = 'hidden', updated_at = ?
      WHERE author_discord_id = ? AND status = 'approved'
      `
    )
    .bind(now, discordId);
}

/**
 * Statement form so `unbanUser` can batch it with the ban-row update (MOD-4).
 *
 * moderation-worker-07: both of these set `status` alone, while every writer on
 * the presets-api side bumps `updated_at` alongside it
 * (`prepareStatusUpdate`, the preview-image writes, the vote writes). So a
 * ban left a preset reading `hidden` with an `updated_at` from whenever
 * presets-api last touched it — a public field
 * (`packages/types/src/preset/community.ts`) that was simply wrong. Latent
 * rather than load-bearing today, since nothing sorts or caches on it, but the
 * two writers should not disagree about what a status change means.
 */
function restoreUserPresetsStatement(
  db: D1Database,
  discordId: string,
  now: string
): D1PreparedStatement {
  return db
    .prepare(
      `
      UPDATE presets
      SET status = 'approved', updated_at = ?
      WHERE author_discord_id = ? AND status = 'hidden'${restoreGuard('presets')}
      `
    )
    .bind(now, discordId);
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
      WHERE (discord_id = ? OR xivauth_id = ?) AND unbanned_at IS NULL
      LIMIT 1
      `
    )
    .bind(discordId, discordId)
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
