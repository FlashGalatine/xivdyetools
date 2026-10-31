/** App-local private RPC protocol; association data never crosses this boundary. */
export class IdentityError extends Error {
  constructor(
    readonly code: 'malformed' | 'conflict' | 'expired' | 'overflow' | 'unavailable' | 'retry',
  ) {
    super(code === 'retry' ? 'Sign in again' : 'Identity service temporarily unavailable');
    this.name = 'IdentityError';
  }
}

export interface ContinuityRequest {
  v: 1;
  operationId: string;
  kind: 'detach' | 'attach';
  sourceIds: string[];
  destinationIds: string[];
  createdAt: number;
  expiresAt: number;
  payloadHash: string;
}
export interface AppliedReceipt {
  v: 1;
  operationId: string;
  payloadHash: string;
  status: 'applied';
  matchedBanCount: number;
}
export interface RefusedReceipt {
  v: 1;
  operationId: string;
  payloadHash: string;
  status: 'refused';
  reason: 'review_required' | 'overflow';
}
export interface BanContinuity {
  apply(request: ContinuityRequest): Promise<unknown>;
  getOperation(request: { operationId: string; payloadHash: string }): Promise<unknown>;
  acknowledge(request: {
    operationId: string;
    payloadHash: string;
    outcome: 'complete' | 'aborted';
  }): Promise<unknown>;
}
export type LookupResult =
  | {
      version: 1;
      status: 'found';
      internalId: string;
      discordId: string | null;
      identityRevision: number;
    }
  | { version: 1; status: 'missing' | 'pending' };
export type SessionResult = { version: 1; status: 'valid' | 'stale' | 'pending' | 'missing' };
export interface SessionRequest {
  sub: string;
  identityRevision?: number;
  authProvider: 'discord' | 'xivauth';
  discordId?: string | null;
}

export function isUUID(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  );
}
export function isSnowflake(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]{16,19}$/.test(value) &&
    BigInt(value) <= 18446744073709551615n
  );
}
export function exactObject(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
function canonicalIds(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 2 ||
    !value.every((id) => isUUID(id) || isSnowflake(id))
  )
    throw new IdentityError('malformed');
  return [...new Set(value)].sort();
}
export async function continuityHash(
  request: Omit<ContinuityRequest, 'payloadHash'>,
): Promise<string> {
  const body = {
    v: request.v,
    operationId: request.operationId,
    kind: request.kind,
    sourceIds: canonicalIds(request.sourceIds),
    destinationIds: canonicalIds(request.destinationIds),
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
  };
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(body)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
/** Recovery validates immutable expiry but permits looking up an expired receipt. */
export async function validateContinuityRequest(
  value: unknown,
  now: number,
  recovery = false,
): Promise<ContinuityRequest> {
  if (
    !exactObject(value, [
      'v',
      'operationId',
      'kind',
      'sourceIds',
      'destinationIds',
      'createdAt',
      'expiresAt',
      'payloadHash',
    ]) ||
    value.v !== 1 ||
    !isUUID(value.operationId) ||
    !['detach', 'attach'].includes(value.kind as string) ||
    !Number.isSafeInteger(value.createdAt) ||
    !Number.isSafeInteger(value.expiresAt) ||
    typeof value.payloadHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.payloadHash)
  )
    throw new IdentityError('malformed');
  const sourceIds = canonicalIds(value.sourceIds);
  const destinationIds = canonicalIds(value.destinationIds);
  const request = { ...value, sourceIds, destinationIds } as unknown as ContinuityRequest;
  if (
    new Set([...sourceIds, ...destinationIds]).size > 3 ||
    request.createdAt < 0 ||
    request.expiresAt <= request.createdAt ||
    request.expiresAt > request.createdAt + 900 ||
    request.createdAt > now
  )
    throw new IdentityError('malformed');
  if (
    sourceIds.length !== 2 ||
    sourceIds.filter(isUUID).length !== 1 ||
    sourceIds.filter(isSnowflake).length !== 1 ||
    (request.kind === 'detach'
      ? destinationIds.length !== 1 ||
        !isUUID(destinationIds[0]) ||
        sourceIds.includes(destinationIds[0])
      : JSON.stringify(sourceIds) !== JSON.stringify(destinationIds))
  )
    throw new IdentityError('malformed');
  if ((await continuityHash(request)) !== request.payloadHash) throw new IdentityError('conflict');
  if (!recovery && request.expiresAt <= now) throw new IdentityError('expired');
  return request;
}
export function continuityBinding(value: unknown): value is BanContinuity {
  return (
    typeof value === 'object' &&
    value !== null &&
    ['apply', 'getOperation', 'acknowledge'].every(
      (key) => typeof (value as Record<string, unknown>)[key] === 'function',
    )
  );
}
export function validateReceipt(
  value: unknown,
  request: ContinuityRequest,
): AppliedReceipt | RefusedReceipt | 'missing' {
  if (
    !exactObject(value, [
      'v',
      'operationId',
      'payloadHash',
      'status',
      'matchedBanCount',
      'reason',
    ]) ||
    value.v !== 1 ||
    value.operationId !== request.operationId ||
    value.payloadHash !== request.payloadHash
  )
    throw new IdentityError('unavailable');
  if (value.status === 'missing' && Object.keys(value).length === 4) return 'missing';
  if (
    value.status === 'refused' &&
    exactObject(value, ['v', 'operationId', 'payloadHash', 'status', 'reason']) &&
    ['review_required', 'overflow'].includes(value.reason as string)
  )
    return value as unknown as RefusedReceipt;
  if (
    ['malformed', 'conflict', 'expired', 'overflow', 'unavailable'].includes(
      value.status as string,
    ) &&
    Object.keys(value).length === 4
  )
    throw new IdentityError(value.status as 'conflict');
  if ('reason' in value) throw new IdentityError('unavailable');
  if (
    value.status !== 'applied' ||
    !Number.isSafeInteger(value.matchedBanCount) ||
    (value.matchedBanCount as number) < 0 ||
    (value.matchedBanCount as number) > 16
  )
    throw new IdentityError('unavailable');
  return value as unknown as AppliedReceipt;
}
