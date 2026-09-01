/**
 * User Service
 * Manages user creation, lookup, and account linking for multi-provider auth
 */

import type { AuthProvider, UserRow } from '../types.js';

/**
 * Parameters for creating or updating a user.
 *
 * FINDING-002 (2026-08-29 security audit): no `avatar_url`. The column was
 * written on every Discord sign-in and never read back — `/auth/me`, both
 * callbacks and the web app all recompute the CDN URL from the Discord id and
 * the `avatar` hash (`getAvatarUrl`).
 */
export interface CreateUserParams {
  discord_id?: string | null;
  xivauth_id?: string | null;
  username: string;
  auth_provider: AuthProvider;
}

/**
 * Minimal structured-logger surface used for account-link audit events.
 * The request-scoped `ExtendedLogger` from @xivdyetools/worker-kit satisfies
 * it; callers without a request context may omit it.
 *
 * FINDING-013 / OAUTH-7: events are logged WITHOUT identifiers — the request
 * ID the logger already carries is the correlation handle.
 */
export interface UserServiceLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}

/**
 * Find existing user or create new one.
 * Handles account linking when the same Discord ID is seen from different providers.
 *
 * Linking logic:
 * 1. If logging in via XIVAuth, first try to find by xivauth_id
 * 2. If not found and Discord ID is available (from XIVAuth social link), try to find by discord_id
 * 3. If found, attach the identities this login asserts (see attachIdentities)
 * 4. If still not found, create a new user
 *
 * Race condition handling:
 * Uses INSERT with ON CONFLICT to handle concurrent requests for the same user.
 * If a duplicate key error occurs during insert, retry the lookup.
 */
export async function findOrCreateUser(
  db: D1Database,
  params: CreateUserParams,
  logger?: UserServiceLogger
): Promise<UserRow> {
  const { discord_id, xivauth_id, username, auth_provider } = params;

  // 1. Try to find by provider-specific ID first
  let existingUser: UserRow | null = null;

  if (xivauth_id) {
    existingUser = await db
      .prepare('SELECT * FROM users WHERE xivauth_id = ?')
      .bind(xivauth_id)
      .first<UserRow>();
  }

  // 2. If not found by xivauth_id, try by discord_id
  if (!existingUser && discord_id) {
    existingUser = await db
      .prepare('SELECT * FROM users WHERE discord_id = ?')
      .bind(discord_id)
      .first<UserRow>();
  }

  if (existingUser) {
    return attachIdentities(db, existingUser, params, logger);
  }

  // 3. No existing user - create new one with conflict handling
  const newId = crypto.randomUUID();

  try {
    await db
      .prepare(
        `INSERT INTO users (id, discord_id, xivauth_id, auth_provider, username)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(newId, discord_id || null, xivauth_id || null, auth_provider, username)
      .run();

    return {
      id: newId,
      discord_id: discord_id || null,
      xivauth_id: xivauth_id || null,
      auth_provider,
      username,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch (error) {
    // Race condition: another request created the user while we were processing
    // Retry the lookup and update instead
    const isConstraintError =
      error instanceof Error && (error.message.includes('UNIQUE constraint') || error.message.includes('UNIQUE_VIOLATION'));

    if (isConstraintError) {
      // Re-lookup the user that was just created by another request
      let raceUser: UserRow | null = null;

      if (xivauth_id) {
        raceUser = await db.prepare('SELECT * FROM users WHERE xivauth_id = ?').bind(xivauth_id).first<UserRow>();
      }
      if (!raceUser && discord_id) {
        raceUser = await db.prepare('SELECT * FROM users WHERE discord_id = ?').bind(discord_id).first<UserRow>();
      }

      if (raceUser) {
        // Update the existing user with our data
        return attachIdentities(db, raceUser, params, logger);
      }
    }

    // Not a constraint error or couldn't find user - rethrow
    throw error;
  }
}

/**
 * Update an existing row with the identities this login asserts.
 *
 * FINDING-013 / OAUTH-9 (2026-08-21 security audit): the previous merge was
 * driven solely by the Discord link XIVAuth asserts — when the XIVAuth user's
 * row lacked a Discord ID but another local row already owned it, the other
 * row was deleted and its Discord ID (the presets-api identity and moderator
 * key) claimed by this one, and a re-linked account kept a stale xivauth_id.
 *
 * Now:
 * - A Discord ID that another local account already owns is NOT claimed and
 *   nothing is deleted — linking two existing local accounts needs an explicit,
 *   signed-in confirmation step, which does not exist yet, so it simply does
 *   not happen. The event is audit-logged (no identifiers).
 * - A Discord ID nobody owns is linked (the XIVAuth social link is
 *   OAuth-verified upstream; there is no competing local identity).
 * - An existing Discord link is never overwritten from an XIVAuth assertion.
 * - The XIVAuth ID of the account that is actually logging in wins over a
 *   stale one left by an earlier link (the Discord account is the anchor).
 */
async function attachIdentities(
  db: D1Database,
  existing: UserRow,
  params: CreateUserParams,
  logger?: UserServiceLogger
): Promise<UserRow> {
  const { discord_id, xivauth_id, username, auth_provider } = params;

  let discordId = existing.discord_id;
  if (!existing.discord_id && discord_id) {
    // BUG-004 (2026-07-18 audit): stamping a Discord ID another row already
    // owns would hit the partial UNIQUE(discord_id) index and 500 every login.
    const owner = await db
      .prepare('SELECT id FROM users WHERE discord_id = ? AND id != ?')
      .bind(discord_id, existing.id)
      .first<{ id: string }>();

    if (owner) {
      logger?.warn(
        'Discord identity is already linked to another account; not linked (explicit account linking required)',
        { provider: auth_provider }
      );
    } else {
      discordId = discord_id;
      logger?.info('Linked Discord identity to existing account', { provider: auth_provider });
    }
  }

  let xivauthId = existing.xivauth_id;
  if (xivauth_id && xivauth_id !== existing.xivauth_id) {
    if (existing.xivauth_id) {
      logger?.info('Replaced stale XIVAuth link on account', { provider: auth_provider });
    }
    xivauthId = xivauth_id;
  }

  return updateUser(db, existing.id, {
    discord_id: discordId,
    xivauth_id: xivauthId,
    username,
    auth_provider,
  });
}

/**
 * Update an existing user's information
 */
async function updateUser(
  db: D1Database,
  userId: string,
  updates: Partial<CreateUserParams>
): Promise<UserRow> {
  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.discord_id !== undefined) {
    fields.push('discord_id = ?');
    values.push(updates.discord_id || null);
  }
  if (updates.xivauth_id !== undefined) {
    fields.push('xivauth_id = ?');
    values.push(updates.xivauth_id || null);
  }
  if (updates.username) {
    fields.push('username = ?');
    values.push(updates.username);
  }
  if (updates.auth_provider) {
    fields.push('auth_provider = ?');
    values.push(updates.auth_provider);
  }

  fields.push("updated_at = datetime('now')");

  await db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values, userId).run();

  const updated = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();

  if (!updated) {
    throw new Error(`User ${userId} not found after update`);
  }

  return updated;
}

/**
 * Find user by internal ID
 */
export async function findUserById(db: D1Database, userId: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<UserRow>();
}

/**
 * Find user by Discord ID
 */
export async function findUserByDiscordId(db: D1Database, discordId: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE discord_id = ?').bind(discordId).first<UserRow>();
}

/**
 * Find user by XIVAuth ID
 */
export async function findUserByXIVAuthId(db: D1Database, xivauthId: string): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE xivauth_id = ?').bind(xivauthId).first<UserRow>();
}

/**
 * FINDING-001 (2026-08-29 security audit): `storeCharacters` / `getCharacters`
 * and the `xivauth_characters` table are gone. Every XIVAuth sign-in used to
 * persist the caller's whole FFXIV roster — Lodestone id, character name and
 * home world, unverified registrations included — "for future features" that
 * never arrived: nothing read the table, there was no retention or purge, and
 * the web privacy guide never disclosed it. The handler still reads the roster
 * in memory to pick the verified character that becomes the display name; it
 * writes none of it. If a feature ever needs the roster, collect it then,
 * minimally, and disclose it first.
 */
