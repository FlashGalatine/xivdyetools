import type { AuthProvider, UserRow } from '../types.js';
import {
  exactObject,
  IdentityError,
  isSnowflake,
  isUUID,
  type LookupResult,
  type SessionResult,
  type SessionRequest,
} from './identity-contract.js';

export function identityResources(
  row: Pick<UserRow, 'id' | 'discord_id' | 'xivauth_id'>,
): string[] {
  return [
    `user:${row.id}`,
    ...(row.discord_id ? [`discord:${row.discord_id}`] : []),
    ...(row.xivauth_id ? [`xivauth:${row.xivauth_id}`] : []),
  ];
}
export async function hasIdentityLock(db: D1Database, resources: string[]): Promise<boolean> {
  return !!(await db
    .prepare(
      `SELECT resource_key FROM identity_operation_locks WHERE resource_key IN (${resources.map(() => '?').join(',')}) LIMIT 1`,
    )
    .bind(...resources)
    .first());
}
export async function lookupStoredIdentity(db: D1Database, input: unknown): Promise<LookupResult> {
  if (
    !exactObject(input, ['kind', 'id']) ||
    !(
      (input.kind === 'internal' && isUUID(input.id)) ||
      (input.kind === 'discord' && isSnowflake(input.id))
    )
  )
    throw new IdentityError('malformed');
  try {
    const resource = `${input.kind === 'internal' ? 'user' : 'discord'}:${input.id}`;
    if (await hasIdentityLock(db, [resource])) return { version: 1, status: 'pending' };
    const row = await db
      .prepare(`SELECT * FROM users WHERE ${input.kind === 'internal' ? 'id' : 'discord_id'}=?`)
      .bind(input.id)
      .first<UserRow>();
    if (!row) return { version: 1, status: 'missing' };
    if (await hasIdentityLock(db, identityResources(row))) return { version: 1, status: 'pending' };
    return {
      version: 1,
      status: 'found',
      internalId: row.id,
      discordId: row.discord_id,
      identityRevision: row.identity_revision ?? 0,
    };
  } catch {
    throw new IdentityError('unavailable');
  }
}
export async function validateSession(db: D1Database, input: unknown): Promise<SessionResult> {
  if (
    !exactObject(input, ['sub', 'identityRevision', 'authProvider', 'discordId']) ||
    typeof input.sub !== 'string' ||
    !input.sub ||
    !['discord', 'xivauth'].includes(input.authProvider as string) ||
    (input.identityRevision !== undefined &&
      (!Number.isSafeInteger(input.identityRevision) || (input.identityRevision as number) < 0)) ||
    (input.discordId !== undefined &&
      input.discordId !== null &&
      typeof input.discordId !== 'string')
  )
    return { version: 1, status: 'stale' };
  try {
    if (await hasIdentityLock(db, [`user:${input.sub}`])) return { version: 1, status: 'pending' };
    const row = await db.prepare('SELECT * FROM users WHERE id=?').bind(input.sub).first<UserRow>();
    if (!row) return { version: 1, status: 'missing' };
    if (await hasIdentityLock(db, identityResources(row))) return { version: 1, status: 'pending' };
    const valid =
      (input.identityRevision ?? 0) === (row.identity_revision ?? 0) &&
      (input.discordId ?? null) === row.discord_id &&
      (input.authProvider === 'discord' ? !!row.discord_id : !!row.xivauth_id);
    return { version: 1, status: valid ? 'valid' : 'stale' };
  } catch {
    throw new IdentityError('unavailable');
  }
}
/** Re-read immediately before signing; callers cannot mint from an old snapshot. */
export async function assertMintableUser(
  db: D1Database,
  row: UserRow,
  provider: AuthProvider,
): Promise<void> {
  const request: SessionRequest = {
    sub: row.id,
    identityRevision: row.identity_revision ?? 0,
    authProvider: provider,
    discordId: row.discord_id,
  };
  const state = await validateSession(db, request);
  if (state.status !== 'valid') throw new IdentityError('unavailable');
}
