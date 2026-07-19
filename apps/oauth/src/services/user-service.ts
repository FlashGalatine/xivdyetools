/**
 * User Service
 * Manages user creation, lookup, and account merging for multi-provider auth
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
 * Find existing user or create new one.
 * Handles account merging when same Discord ID exists from different providers.
 *
 * Merging logic:
 * 1. If logging in via XIVAuth, first try to find by xivauth_id
 * 2. If not found and Discord ID is available (from XIVAuth social link), try to find by discord_id
 * 3. If found by discord_id, update the existing user with the new xivauth_id (merge accounts)
 * 4. If still not found, create a new user
 *
 * Race condition handling:
 * Uses INSERT with ON CONFLICT to handle concurrent requests for the same user.
 * If a duplicate key error occurs during insert, retry the lookup.
 */
export async function findOrCreateUser(
  db: D1Database,
  params: CreateUserParams
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
    // BUG-004 (2026-07-18 audit): if we're about to stamp a Discord ID onto
    // this row but a *different* row already owns it (Discord-first login,
    // then XIVAuth login, then the accounts got linked), the UPDATE would hit
    // the partial UNIQUE(discord_id) index and 500 every subsequent login.
    // Merge explicitly: keep this row (it has the provider ID we looked up
    // by), move the other row's characters over, delete it, then claim the
    // Discord ID — all in one atomic batch.
    if (!existingUser.discord_id && discord_id) {
      const owner = await db
        .prepare('SELECT id FROM users WHERE discord_id = ? AND id != ?')
        .bind(discord_id, existingUser.id)
        .first<{ id: string }>();

      if (owner) {
        await db.batch([
          db
            .prepare('UPDATE xivauth_characters SET user_id = ? WHERE user_id = ?')
            .bind(existingUser.id, owner.id),
          db.prepare('DELETE FROM users WHERE id = ?').bind(owner.id),
          db
            .prepare("UPDATE users SET discord_id = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(discord_id, existingUser.id),
        ]);
      }
    }

    // Update existing user with potentially new info and merge provider IDs
    return await updateUser(db, existingUser.id, {
      // If logging in via XIVAuth and we have a new discord_id from social link, add it
      discord_id: existingUser.discord_id || discord_id,
      // If logging in via Discord and user exists from XIVAuth, preserve xivauth_id
      xivauth_id: existingUser.xivauth_id || xivauth_id,
      username,
      avatar_url,
      auth_provider,
    });
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
        return await updateUser(db, raceUser.id, {
          discord_id: raceUser.discord_id || discord_id,
          xivauth_id: raceUser.xivauth_id || xivauth_id,
          username,
          avatar_url,
          auth_provider,
        });
      }
    }

    // Not a constraint error or couldn't find user - rethrow
    throw error;
  }
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
