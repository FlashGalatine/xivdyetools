import type { Env } from '../types/env.js';
import { isBanTargetId, isXivAuthUuid } from '../utils/response.js';

export interface IdentityLookupBinding {
  lookupStoredIdentity(input: { kind: 'internal' | 'discord'; id: string }): Promise<unknown>;
}

export type StoredIdentity =
  | { version: 1; status: 'missing' }
  | {
      version: 1;
      status: 'found';
      internalId: string;
      discordId: string | null;
      identityRevision: number;
    };
export interface IdentitySnapshot {
  input: string;
  result: StoredIdentity;
}

export const linkedBansEnabled = (env: Env): boolean =>
  env.LINKED_BAN_CONFIRMATION_ENABLED === 'true';

export function validIdentityId(id: unknown): id is string {
  return typeof id === 'string' && isBanTargetId(id) && id === id.toLowerCase();
}

/** Strict local copy of the private provider DTO. Extra data is never retained. */
export function parseStoredIdentity(value: unknown, input: string): StoredIdentity {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Identity lookup unavailable.');
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row).sort().join(',');
  if (row.version !== 1) throw new Error('Identity lookup unavailable.');
  if (row.status === 'missing' && keys === 'status,version')
    return { version: 1, status: 'missing' };
  if (
    row.status !== 'found' ||
    keys !== 'discordId,identityRevision,internalId,status,version' ||
    !validIdentityId(row.internalId) ||
    !isXivAuthUuid(row.internalId) ||
    !(
      row.discordId === null ||
      (validIdentityId(row.discordId) && !isXivAuthUuid(row.discordId))
    ) ||
    !Number.isSafeInteger(row.identityRevision) ||
    (row.identityRevision as number) < 0 ||
    (isXivAuthUuid(input) ? row.internalId !== input : row.discordId !== input)
  ) {
    throw new Error('Identity lookup unavailable.');
  }
  return {
    version: 1,
    status: 'found',
    internalId: row.internalId,
    discordId: row.discordId,
    identityRevision: row.identityRevision as number,
  };
}

export async function resolveIdentities(
  env: Env,
  inputs: string[],
  deadlineMs = 1200,
): Promise<IdentitySnapshot[]> {
  if (
    !linkedBansEnabled(env) ||
    !Array.isArray(inputs) ||
    inputs.length < 1 ||
    inputs.length > 2 ||
    inputs.some((id) => !validIdentityId(id)) ||
    typeof env.OAUTH_IDENTITY?.lookupStoredIdentity !== 'function'
  ) {
    throw new Error('Identity lookup unavailable.');
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // No continuation is given a write capability: late RPC completion can only produce DTOs.
    return await Promise.race([
      Promise.all(
        inputs.map(async (input) => ({
          input,
          result: parseStoredIdentity(
            await env.OAUTH_IDENTITY!.lookupStoredIdentity({
              kind: isXivAuthUuid(input) ? 'internal' : 'discord',
              id: input,
            }),
            input,
          ),
        })),
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Identity lookup unavailable.')), deadlineMs);
      }),
    ]);
  } catch {
    throw new Error('Identity lookup unavailable.');
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function snapshotIds(snapshots: IdentitySnapshot[]): string[] {
  return [
    ...new Set(
      snapshots.flatMap(({ input, result }) =>
        result.status === 'missing'
          ? [input]
          : [result.internalId, ...(result.discordId ? [result.discordId] : [])],
      ),
    ),
  ].sort();
}
