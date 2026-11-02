/** Provider assertions are fresh only for this invocation; journals contain no profiles or tokens. */
import type { AuthProvider, Env, UserRow } from '../types.js';
import { IdentityError, continuityBinding } from './identity-contract.js';
import { hasIdentityLock, identityResources } from './identity-service.js';
import {
  cleanupIdentityOperations,
  resumeIdentityOperation,
  transitionIdentity,
} from './identity-transition-service.js';

export interface CreateUserParams {
  discord_id?: string | null;
  xivauth_id?: string | null;
  username: string;
  auth_provider: AuthProvider;
}
export interface UserServiceLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
}
type TransitionEnv = Pick<Env, 'IDENTITY_SPLIT_ENABLED' | 'BAN_CONTINUITY'>;

export async function findOrCreateUser(
  db: D1Database,
  params: CreateUserParams,
  logger?: UserServiceLogger,
  env?: TransitionEnv,
): Promise<UserRow> {
  try {
    return await resolveUser(db, params, logger, env);
  } catch (error) {
    if (error instanceof IdentityError) throw error;
    throw new IdentityError('unavailable');
  }
}
async function resolveUser(
  db: D1Database,
  params: CreateUserParams,
  logger?: UserServiceLogger,
  env?: TransitionEnv,
): Promise<UserRow> {
  const discordId = params.discord_id || null;
  const xivauthId = params.auth_provider === 'xivauth' ? params.xivauth_id || null : null;
  if (params.auth_provider === 'xivauth' ? !xivauthId : !discordId)
    throw new IdentityError('unavailable');
  await cleanupIdentityOperations(
    db,
    continuityBinding(env?.BAN_CONTINUITY) ? env.BAN_CONTINUITY : undefined,
  );
  const fresh = { xivauthId: xivauthId ?? '', discordId };
  let resumed: UserRow | null = null;
  if (xivauthId) resumed = await resumeIdentityOperation(db, `xivauth:${xivauthId}`, fresh, env);
  if (resumed && discordId && !resumed.discord_id) throw new IdentityError('retry');
  const xUser = xivauthId
    ? (resumed ??
      (await db.prepare('SELECT * FROM users WHERE xivauth_id=?').bind(xivauthId).first<UserRow>()))
    : null;
  const dUser = discordId
    ? await db.prepare('SELECT * FROM users WHERE discord_id=?').bind(discordId).first<UserRow>()
    : null;
  let existing = xUser ?? dUser;
  if (existing && (await hasIdentityLock(db, identityResources(existing))))
    throw new IdentityError('unavailable');
  if (xUser && xUser.discord_id !== discordId) {
    if (xUser.discord_id) {
      existing = await transitionIdentity(db, xUser, 'detach', fresh, env);
      if (discordId) throw new IdentityError('retry');
    } else if (discordId) {
      if (dUser) {
        logger?.warn('Existing identities require explicit review');
        throw new IdentityError('unavailable');
      }
      existing = await transitionIdentity(db, xUser, 'attach', fresh, env);
    }
  } else if (!xUser && dUser && xivauthId && dUser.xivauth_id !== xivauthId) {
    if (dUser.xivauth_id) {
      await transitionIdentity(db, dUser, 'detach', fresh, env);
      throw new IdentityError('retry');
    }
    existing = await transitionIdentity(db, dUser, 'attach', fresh, env);
  }
  if (existing) {
    const resources = identityResources(existing);
    const updated = await db
      .prepare(
        `UPDATE users SET username=?,auth_provider=?,updated_at=datetime('now') WHERE id=? AND identity_revision=? AND discord_id IS ? AND xivauth_id IS ? AND NOT EXISTS (SELECT 1 FROM identity_operation_locks WHERE resource_key IN (${resources.map(() => '?').join(',')})) RETURNING *`,
      )
      .bind(
        params.username,
        params.auth_provider,
        existing.id,
        existing.identity_revision ?? 0,
        existing.discord_id,
        existing.xivauth_id,
        ...resources,
      )
      .first<UserRow>();
    if (!updated) throw new IdentityError('unavailable');
    return updated;
  }
  const id = crypto.randomUUID();
  const resources = identityResources({ id, discord_id: discordId, xivauth_id: xivauthId });
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const created = await db
    .prepare(
      `INSERT INTO users (id,discord_id,xivauth_id,auth_provider,username,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM identity_operation_locks WHERE resource_key IN (${resources.map(() => '?').join(',')})) ON CONFLICT DO NOTHING RETURNING *`,
    )
    .bind(id, discordId, xivauthId, params.auth_provider, params.username, now, now, ...resources)
    .first<UserRow>();
  if (created) return created;
  // A concurrent callback may have created a matching row. Never replay a link assertion.
  const winner = await db
    .prepare('SELECT * FROM users WHERE discord_id IS ? AND xivauth_id IS ?')
    .bind(discordId, xivauthId)
    .first<UserRow>();
  if (!winner || (await hasIdentityLock(db, identityResources(winner))))
    throw new IdentityError('unavailable');
  return winner;
}
