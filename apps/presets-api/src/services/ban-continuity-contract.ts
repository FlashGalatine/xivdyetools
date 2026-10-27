/** App-local protocol, kept structurally compatible with the OAuth provider. */
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
export type Receipt =
  | { v: 1; operationId: string; payloadHash: string; status: 'applied'; matchedBanCount: number }
  | {
      v: 1;
      operationId: string;
      payloadHash: string;
      status: 'refused';
      reason: 'review_required' | 'overflow';
    };
export class ContinuityError extends Error {
  constructor(readonly code: 'malformed' | 'conflict' | 'expired' | 'unavailable') {
    super('Continuity service unavailable');
    this.name = 'ContinuityError';
  }
}
export function isUUID(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  );
}
function isSnowflake(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[1-9][0-9]{16,19}$/.test(value) &&
    BigInt(value) <= 18446744073709551615n
  );
}
function object(value: unknown, keys: string[]): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
function ids(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 2 ||
    !value.every((id) => isUUID(id) || isSnowflake(id))
  )
    throw new ContinuityError('malformed');
  return [...new Set(value)].sort();
}
export async function continuityHash(
  request: Omit<ContinuityRequest, 'payloadHash'>,
): Promise<string> {
  const canonical = {
    v: request.v,
    operationId: request.operationId,
    kind: request.kind,
    sourceIds: ids(request.sourceIds),
    destinationIds: ids(request.destinationIds),
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
  };
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(canonical)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
/** Expiry for a NEW receipt is checked by SQLite, allowing immutable expired replays. */
export async function validateContinuityRequest(value: unknown): Promise<ContinuityRequest> {
  if (
    !object(value, [
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
    throw new ContinuityError('malformed');
  const sourceIds = ids(value.sourceIds);
  const destinationIds = ids(value.destinationIds);
  const request = { ...value, sourceIds, destinationIds } as unknown as ContinuityRequest;
  if (
    request.createdAt < 0 ||
    request.expiresAt <= request.createdAt ||
    request.expiresAt > request.createdAt + 900 ||
    sourceIds.length !== 2 ||
    sourceIds.filter(isUUID).length !== 1 ||
    sourceIds.filter(isSnowflake).length !== 1 ||
    new Set([...sourceIds, ...destinationIds]).size > 3 ||
    (request.kind === 'detach'
      ? destinationIds.length !== 1 ||
        !isUUID(destinationIds[0]) ||
        sourceIds.includes(destinationIds[0])
      : JSON.stringify(sourceIds) !== JSON.stringify(destinationIds))
  )
    throw new ContinuityError('malformed');
  if ((await continuityHash(request)) !== request.payloadHash)
    throw new ContinuityError('conflict');
  return request;
}
export function validateOperationKey(
  value: unknown,
  ack: true,
): { operationId: string; payloadHash: string; outcome: 'complete' | 'aborted' };
export function validateOperationKey(
  value: unknown,
  ack?: false,
): { operationId: string; payloadHash: string };
export function validateOperationKey(
  value: unknown,
  ack = false,
): { operationId: string; payloadHash: string; outcome?: 'complete' | 'aborted' } {
  if (
    !object(
      value,
      ack ? ['operationId', 'payloadHash', 'outcome'] : ['operationId', 'payloadHash'],
    ) ||
    !isUUID(value.operationId) ||
    typeof value.payloadHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(value.payloadHash) ||
    (ack && value.outcome !== 'complete' && value.outcome !== 'aborted')
  )
    throw new ContinuityError('malformed');
  return value as { operationId: string; payloadHash: string; outcome?: 'complete' | 'aborted' };
}
