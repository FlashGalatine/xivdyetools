/**
 * User Service
 * Manages user creation, lookup, and account linking for multi-provider auth
 */

import type { AuthProvider, UserRow, XIVAuthCharacter } from '../types.js';

/**
 * Parameters for creating or updating a user
 */
export interface CreateUserParams {
  discord_id?: string | null;
  xivauth_id?: string | null;
  username: string;
  avatar_url?: string | null;
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
  const { discord_id, xivauth_id, username, avatar_url, auth_provider } = params;

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
        `INSERT INTO users (id, discord_id, xivauth_id, auth_provider, username, avatar_url)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(newId, discord_id || null, xivauth_id || null, auth_provider, username, avatar_url || null)
      .run();

    return {
      id: newId,
      discord_id: discord_id || null,
      xivauth_id: xivauth_id || null,
      auth_provider,
      username,
      avatar_url: avatar_url || null,
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
  const { discord_id, xivauth_id, username, avatar_url, auth_provider } = params;

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
    avatar_url,
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
  if (updates.avatar_url !== undefined) {
    fields.push('avatar_url = ?');
    values.push(updates.avatar_url || null);
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
 * Store XIVAuth characters for a user (replaces existing characters)
 */
export async function storeCharacters(
  db: D1Database,
  userId: string,
  characters: XIVAuthCharacter[]
): Promise<void> {
  // OPT-003 (2026-07-18 audit): one atomic batch instead of 1 + N sequential
  // round trips on the login critical path — also closes the partial-write
  // window the non-atomic delete-then-insert loop left open
  await db.batch([
    db.prepare('DELETE FROM xivauth_characters WHERE user_id = ?').bind(userId),
    ...characters.map((char) =>
      db
        .prepare(
          `INSERT INTO xivauth_characters (user_id, lodestone_id, name, server, verified)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(userId, char.id, char.name, char.home_world, char.verified ? 1 : 0)
    ),
  ]);
}

/**
 * Get characters for a user
 */
export async function getCharacters(
  db: D1Database,
  userId: string
): Promise<XIVAuthCharacter[]> {
  const result = await db
    .prepare('SELECT lodestone_id, name, server, verified FROM xivauth_characters WHERE user_id = ?')
    .bind(userId)
    .all<{ lodestone_id: number; name: string; server: string; verified: number }>();

  return result.results.map((row) => ({
    id: row.lodestone_id,
    name: row.name,
    home_world: row.server,
    verified: row.verified === 1,
  }));
}
