import type { Env, UserRow } from '../types.js';
import {
  continuityBinding,
  continuityHash,
  exactObject,
  IdentityError,
  isUUID,
  validateContinuityRequest,
  validateReceipt,
  type BanContinuity,
  type ContinuityRequest,
} from './identity-contract.js';
import { identityResources } from './identity-service.js';

interface ExpectedRow {
  id: string;
  revision: number;
  discordId: string | null;
  xivauthId: string | null;
}
interface FrozenPayload {
  request: ContinuityRequest;
  expected: ExpectedRow[];
  absent: string[];
  destinationId: string | null;
  attach: { discordId: string; xivauthId: string } | null;
  locks: string[];
}
interface OperationRow {
  id: string;
  payload_json: string;
  payload_hash: string;
  state: 'pending' | 'complete' | 'aborted';
  created_at: number;
  expires_at: number;
  finished_at: number | null;
  acknowledged_at: number | null;
  resolution: 'applied' | 'refused' | 'missing' | null;
}
export interface FreshAssertion {
  xivauthId: string;
  discordId: string | null;
}
// Only remote waits are raced. D1 transactions keep their existing atomic guards.
const CONTINUITY_TIMEOUT_MS = 5000;
const ACKNOWLEDGEMENT_TIMEOUT_MS = 1000;
const CLEANUP_BATCH_SIZE = 8;
// Best-effort scheduling within this isolate/D1 handle, never an authorization decision.
const cleanupCursors = new WeakMap<D1Database, string>();
async function remoteBefore<T>(deadline: number, call: () => Promise<T>): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new IdentityError('unavailable');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve()
        .then(call)
        .then((result) => {
          // A delayed timer callback must not let an expired reply reach a local mutation.
          if (Date.now() >= deadline) throw new IdentityError('unavailable');
          return result;
        }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new IdentityError('unavailable')), remaining);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const epoch = (): number => Math.floor(Date.now() / 1000);
const placeholders = (items: unknown[]): string => items.map(() => '?').join(',');

/** A failing statement rolls the entire D1 batch back, including earlier mutations. */
function sqlGuard(
  db: D1Database,
  predicate: string,
  values: (string | number | null)[],
): D1PreparedStatement {
  return db
    .prepare(`SELECT CASE WHEN (${predicate}) THEN 1 ELSE json('identity_conflict') END`)
    .bind(...values);
}
function expectedGuard(
  db: D1Database,
  payload: FrozenPayload,
  prepared: boolean,
): D1PreparedStatement {
  const predicates: string[] = [];
  const values: (string | number | null)[] = [];
  for (const row of payload.expected) {
    predicates.push(
      'EXISTS (SELECT 1 FROM users WHERE id=? AND identity_revision=? AND discord_id IS ? AND xivauth_id IS ?)',
    );
    values.push(row.id, row.revision + (prepared ? 1 : 0), row.discordId, row.xivauthId);
  }
  for (const resource of payload.absent) {
    const [kind, ...id] = resource.split(':');
    const column = kind === 'user' ? 'id' : kind === 'discord' ? 'discord_id' : 'xivauth_id';
    predicates.push(`NOT EXISTS (SELECT 1 FROM users WHERE ${column}=?)`);
    values.push(id.join(':'));
  }
  return sqlGuard(db, predicates.join(' AND '), values);
}
async function decodeOperation(row: OperationRow): Promise<FrozenPayload> {
  try {
    const value: unknown = JSON.parse(row.payload_json);
    if (
      !exactObject(value, ['request', 'expected', 'absent', 'destinationId', 'attach', 'locks']) ||
      !Array.isArray(value.expected) ||
      value.expected.length !== 1 ||
      !Array.isArray(value.absent) ||
      !value.absent.every(
        (key) => typeof key === 'string' && /^(user|discord|xivauth):.+$/.test(key),
      ) ||
      !Array.isArray(value.locks) ||
      !value.locks.every((key) => typeof key === 'string') ||
      !(value.destinationId === null || isUUID(value.destinationId))
    )
      throw new IdentityError('unavailable');
    const payload = value as unknown as FrozenPayload;
    const request = await validateContinuityRequest(payload.request, epoch(), true);
    if (
      request.operationId !== row.id ||
      request.payloadHash !== row.payload_hash ||
      request.createdAt !== row.created_at ||
      request.expiresAt !== row.expires_at
    )
      throw new IdentityError('unavailable');
    const old = payload.expected[0];
    if (
      !old ||
      !isUUID(old.id) ||
      !Number.isSafeInteger(old.revision) ||
      old.revision < 0 ||
      !(old.discordId === null || typeof old.discordId === 'string') ||
      !(old.xivauthId === null || typeof old.xivauthId === 'string')
    )
      throw new IdentityError('unavailable');
    const required = [
      ...identityResources({ id: old.id, discord_id: old.discordId, xivauth_id: old.xivauthId }),
      ...payload.absent,
    ].sort();
    if (JSON.stringify([...new Set(required)]) !== JSON.stringify(payload.locks))
      throw new IdentityError('unavailable');
    const sources = [old.id, old.discordId].filter((id): id is string => !!id).sort();
    if (request.kind === 'detach') {
      if (
        !old.discordId ||
        !old.xivauthId ||
        !payload.destinationId ||
        payload.attach !== null ||
        !payload.absent.includes(`user:${payload.destinationId}`) ||
        JSON.stringify(request.sourceIds) !== JSON.stringify(sources) ||
        JSON.stringify(request.destinationIds) !== JSON.stringify([payload.destinationId])
      )
        throw new IdentityError('unavailable');
    } else {
      if (
        !exactObject(payload.attach, ['discordId', 'xivauthId']) ||
        typeof payload.attach.discordId !== 'string' ||
        typeof payload.attach.xivauthId !== 'string' ||
        payload.destinationId !== null
      )
        throw new IdentityError('unavailable');
      const edge = [old.id, payload.attach.discordId].sort();
      if (
        JSON.stringify(request.sourceIds) !== JSON.stringify(edge) ||
        JSON.stringify(request.destinationIds) !== JSON.stringify(edge)
      )
        throw new IdentityError('unavailable');
    }
    return payload;
  } catch {
    throw new IdentityError('unavailable');
  }
}
async function prepareOperation(db: D1Database, payload: FrozenPayload): Promise<OperationRow> {
  const request = payload.request;
  const json = JSON.stringify(payload);
  try {
    await db.batch([
      expectedGuard(db, payload, false),
      sqlGuard(
        db,
        `NOT EXISTS (SELECT 1 FROM identity_operation_locks WHERE resource_key IN (${placeholders(payload.locks)}))`,
        payload.locks,
      ),
      db
        .prepare(
          "INSERT INTO identity_operations (id,payload_json,payload_hash,state,created_at,expires_at) VALUES (?,?,?,'pending',?,?)",
        )
        .bind(request.operationId, json, request.payloadHash, request.createdAt, request.expiresAt),
      ...payload.locks.map((key) =>
        db
          .prepare('INSERT INTO identity_operation_locks (resource_key,operation_id) VALUES (?,?)')
          .bind(key, request.operationId),
      ),
      ...payload.expected.map((row) =>
        db
          .prepare('UPDATE users SET identity_revision=identity_revision+1 WHERE id=?')
          .bind(row.id),
      ),
    ]);
  } catch {
    throw new IdentityError('unavailable');
  }
  return {
    id: request.operationId,
    payload_json: json,
    payload_hash: request.payloadHash,
    state: 'pending',
    created_at: request.createdAt,
    expires_at: request.expiresAt,
    finished_at: null,
    acknowledged_at: null,
    resolution: null,
  };
}
function freshMatches(payload: FrozenPayload, fresh: FreshAssertion): boolean {
  return payload.request.kind === 'detach'
    ? payload.expected[0].xivauthId === fresh.xivauthId
    : payload.attach?.xivauthId === fresh.xivauthId && payload.attach.discordId === fresh.discordId;
}
async function acknowledge(
  db: D1Database,
  remote: BanContinuity,
  payload: FrozenPayload,
  outcome: 'complete' | 'aborted',
  deadline = Date.now() + ACKNOWLEDGEMENT_TIMEOUT_MS,
): Promise<void> {
  const request = payload.request;
  try {
    const ack = await remoteBefore(deadline, () =>
      remote.acknowledge({
        operationId: request.operationId,
        payloadHash: request.payloadHash,
        outcome,
      }),
    );
    if (
      !exactObject(ack, [
        'v',
        'operationId',
        'payloadHash',
        'status',
        'outcome',
        'acknowledgedAt',
      ]) ||
      ack.v !== 1 ||
      ack.operationId !== request.operationId ||
      ack.payloadHash !== request.payloadHash ||
      ack.status !== 'acknowledged' ||
      ack.outcome !== outcome ||
      !Number.isSafeInteger(ack.acknowledgedAt) ||
      (ack.acknowledgedAt as number) < request.createdAt ||
      (ack.acknowledgedAt as number) > epoch()
    )
      return;
    await db
      .prepare(
        'UPDATE identity_operations SET acknowledged_at=COALESCE(acknowledged_at,?) WHERE id=? AND payload_hash=? AND state=? AND resolution=?',
      )
      .bind(
        ack.acknowledgedAt,
        request.operationId,
        request.payloadHash,
        outcome,
        outcome === 'complete' ? 'applied' : 'refused',
      )
      .run();
  } catch {
    /* Confirmed identity state survives unavailable housekeeping. */
  }
}
async function abortOperation(
  db: D1Database,
  row: OperationRow,
  payload: FrozenPayload,
  resolution: 'refused' | 'missing',
): Promise<void> {
  try {
    await db.batch([
      sqlGuard(
        db,
        "EXISTS (SELECT 1 FROM identity_operations WHERE id=? AND payload_hash=? AND payload_json=? AND state='pending') AND (SELECT COUNT(*) FROM identity_operation_locks WHERE operation_id=?)=? AND (SELECT COUNT(*) FROM identity_operation_locks WHERE operation_id=? AND resource_key IN (" +
          placeholders(payload.locks) +
          '))=?',
        [
          row.id,
          row.payload_hash,
          row.payload_json,
          row.id,
          payload.locks.length,
          row.id,
          ...payload.locks,
          payload.locks.length,
        ],
      ),
      expectedGuard(db, payload, true),
      db
        .prepare(
          "UPDATE identity_operations SET state='aborted',resolution=?,finished_at=? WHERE id=? AND state='pending'",
        )
        .bind(resolution, epoch(), row.id),
      db.prepare('DELETE FROM identity_operation_locks WHERE operation_id=?').bind(row.id),
    ]);
  } catch {
    throw new IdentityError('unavailable');
  }
}
async function finishOperation(
  db: D1Database,
  remote: BanContinuity,
  row: OperationRow,
  fresh: FreshAssertion,
): Promise<UserRow> {
  const payload = await decodeOperation(row);
  const request = payload.request;
  if (!freshMatches(payload, fresh)) throw new IdentityError('retry');
  let receipt;
  const deadline = Date.now() + CONTINUITY_TIMEOUT_MS;
  try {
    receipt = validateReceipt(
      await remoteBefore(deadline, () =>
        remote.getOperation({ operationId: row.id, payloadHash: row.payload_hash }),
      ),
      request,
    );
    if (receipt === 'missing' && request.expiresAt > epoch()) {
      const validated = await validateContinuityRequest(request, epoch());
      receipt = validateReceipt(
        await remoteBefore(deadline, () => remote.apply(validated)),
        request,
      );
    }
  } catch (error) {
    throw error instanceof IdentityError ? error : new IdentityError('unavailable');
  }
  if (receipt === 'missing') {
    if (request.expiresAt <= epoch()) {
      await abortOperation(db, row, payload, 'missing');
    }
    throw new IdentityError('retry');
  }
  if (receipt.status === 'refused') {
    await abortOperation(db, row, payload, 'refused');
    await acknowledge(db, remote, payload, 'aborted');
    throw new IdentityError('retry');
  }
  const old = payload.expected[0];
  const operationGuard = sqlGuard(
    db,
    "EXISTS (SELECT 1 FROM identity_operations WHERE id=? AND payload_hash=? AND payload_json=? AND state='pending') AND (SELECT COUNT(*) FROM identity_operation_locks WHERE operation_id=?)=? AND (SELECT COUNT(*) FROM identity_operation_locks WHERE resource_key IN (" +
      placeholders(payload.locks) +
      ') AND operation_id=?)=?',
    [
      row.id,
      row.payload_hash,
      row.payload_json,
      row.id,
      payload.locks.length,
      ...payload.locks,
      row.id,
      payload.locks.length,
    ],
  );
  const mutations =
    request.kind === 'detach'
      ? [
          db
            .prepare(
              "UPDATE users SET xivauth_id=NULL,identity_revision=identity_revision+1,updated_at=datetime('now') WHERE id=?",
            )
            .bind(old.id),
          db
            .prepare(
              "INSERT INTO users (id,discord_id,xivauth_id,auth_provider,username,identity_revision) SELECT ?,NULL,?,'xivauth',username,1 FROM users WHERE id=?",
            )
            .bind(payload.destinationId, old.xivauthId, old.id),
        ]
      : [
          db
            .prepare(
              "UPDATE users SET discord_id=?,xivauth_id=?,identity_revision=identity_revision+1,updated_at=datetime('now') WHERE id=?",
            )
            .bind(payload.attach!.discordId, payload.attach!.xivauthId, old.id),
        ];
  try {
    await db.batch([
      operationGuard,
      expectedGuard(db, payload, true),
      ...mutations,
      db
        .prepare(
          "UPDATE identity_operations SET state='complete',resolution='applied',finished_at=? WHERE id=?",
        )
        .bind(epoch(), row.id),
      db.prepare('DELETE FROM identity_operation_locks WHERE operation_id=?').bind(row.id),
    ]);
  } catch {
    throw new IdentityError('unavailable');
  }
  await acknowledge(db, remote, payload, 'complete');
  const result = await db
    .prepare('SELECT * FROM users WHERE id=?')
    .bind(payload.destinationId ?? old.id)
    .first<UserRow>();
  if (!result) throw new IdentityError('unavailable');
  return result;
}
/** Best-effort, request-triggered housekeeping; unresolved operations are never purged. */
export async function cleanupIdentityOperations(
  db: D1Database,
  remote?: BanContinuity,
): Promise<void> {
  try {
    if (remote) {
      const deadline = Date.now() + ACKNOWLEDGEMENT_TIMEOUT_MS;
      const cursor = cleanupCursors.get(db) ?? '';
      const select = (comparison: '>' | '<=', limit: number): Promise<D1Result<OperationRow>> =>
        db
          .prepare(
            `SELECT * FROM identity_operations WHERE id${comparison}? AND state!='pending' AND resolution IN ('applied','refused') AND acknowledged_at IS NULL ORDER BY id LIMIT ?`,
          )
          .bind(cursor, limit)
          .all<OperationRow>();
      const rows = (await select('>', CLEANUP_BATCH_SIZE)).results;
      if (cursor && rows.length < CLEANUP_BATCH_SIZE)
        rows.push(...(await select('<=', CLEANUP_BATCH_SIZE - rows.length)).results);
      if (rows.length) cleanupCursors.set(db, rows[rows.length - 1].id);
      await Promise.all(
        rows.map(async (row) => {
          try {
            await acknowledge(
              db,
              remote,
              await decodeOperation(row),
              row.state === 'complete' ? 'complete' : 'aborted',
              deadline,
            );
          } catch {
            /* One malformed journal must not suppress another terminal acknowledgement. */
          }
        }),
      );
    }
    await db
      .prepare(
        "DELETE FROM identity_operations WHERE id IN (SELECT id FROM identity_operations WHERE state!='pending' AND ((resolution IN ('applied','refused') AND acknowledged_at IS NOT NULL AND MAX(expires_at,acknowledged_at)+86400<=?) OR (state='aborted' AND resolution='missing' AND MAX(expires_at,finished_at)+86400<=?)) LIMIT ?)",
      )
      .bind(epoch(), epoch(), CLEANUP_BATCH_SIZE)
      .run();
  } catch {
    /* A cleanup failure must not weaken session or association guards. */
  }
}
function enabledRemote(
  env?: Pick<Env, 'IDENTITY_SPLIT_ENABLED' | 'BAN_CONTINUITY'>,
): BanContinuity {
  if (env?.IDENTITY_SPLIT_ENABLED !== 'true' || !continuityBinding(env.BAN_CONTINUITY))
    throw new IdentityError('unavailable');
  return env.BAN_CONTINUITY;
}
export async function resumeIdentityOperation(
  db: D1Database,
  resource: string,
  fresh: FreshAssertion,
  env?: Pick<Env, 'IDENTITY_SPLIT_ENABLED' | 'BAN_CONTINUITY'>,
): Promise<UserRow | null> {
  const row = await db
    .prepare(
      'SELECT o.* FROM identity_operations o JOIN identity_operation_locks l ON l.operation_id=o.id WHERE l.resource_key=?',
    )
    .bind(resource)
    .first<OperationRow>();
  if (!row) return null;
  return finishOperation(db, enabledRemote(env), row, fresh);
}
export async function transitionIdentity(
  db: D1Database,
  row: UserRow,
  kind: 'detach' | 'attach',
  fresh: FreshAssertion,
  env?: Pick<Env, 'IDENTITY_SPLIT_ENABLED' | 'BAN_CONTINUITY'>,
): Promise<UserRow> {
  const remote = enabledRemote(env);
  const now = epoch();
  const destinationId = kind === 'detach' ? crypto.randomUUID() : null;
  const discordId = kind === 'detach' ? row.discord_id : fresh.discordId;
  if (!discordId || (kind === 'detach' && !row.xivauth_id)) throw new IdentityError('unavailable');
  const edge = [row.id, discordId].sort();
  const base = {
    v: 1 as const,
    operationId: crypto.randomUUID(),
    kind,
    sourceIds: edge,
    destinationIds: destinationId ? [destinationId] : edge,
    createdAt: now,
    expiresAt: now + 900,
  };
  const request = await validateContinuityRequest(
    { ...base, payloadHash: await continuityHash(base) },
    now,
  );
  const absent = destinationId
    ? [`user:${destinationId}`]
    : [
        ...(!row.discord_id ? [`discord:${discordId}`] : []),
        ...(!row.xivauth_id ? [`xivauth:${fresh.xivauthId}`] : []),
      ];
  const payload: FrozenPayload = {
    request,
    expected: [
      {
        id: row.id,
        revision: row.identity_revision ?? 0,
        discordId: row.discord_id,
        xivauthId: row.xivauth_id,
      },
    ],
    absent,
    destinationId,
    attach: kind === 'attach' ? { discordId, xivauthId: fresh.xivauthId } : null,
    locks: [...new Set([...identityResources(row), ...absent])].sort(),
  };
  const operation = await prepareOperation(db, payload);
  // A displaced account's reducing DETACH uses its own X, never the incoming X.
  return finishOperation(
    db,
    remote,
    operation,
    kind === 'detach' ? { xivauthId: row.xivauth_id!, discordId: null } : fresh,
  );
}
