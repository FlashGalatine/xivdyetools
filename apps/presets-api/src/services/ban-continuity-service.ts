import {
  ContinuityError,
  validateContinuityRequest,
  validateOperationKey,
  type Receipt,
} from './ban-continuity-contract.js';
import { pruneContinuityRecords } from './ban-continuity-retention.js';

interface OperationRow {
  id: string;
  payload_hash: string;
  state: 'applying' | 'applied' | 'refused';
  refusal_reason: 'review_required' | 'overflow' | null;
  matched_bans: number | null;
  acknowledged_at: number | null;
  acknowledged_outcome: 'complete' | 'aborted' | null;
}
type Missing = { v: 1; operationId: string; payloadHash: string; status: 'missing' };
const rowSql = 'SELECT * FROM ban_continuity_operations WHERE id = ?';
function receipt(row: OperationRow, hash: string): Receipt {
  if (row.payload_hash !== hash) throw new ContinuityError('conflict');
  if (row.state === 'applied' && row.matched_bans !== null)
    return {
      v: 1,
      operationId: row.id,
      payloadHash: hash,
      status: 'applied',
      matchedBanCount: row.matched_bans,
    };
  if (row.state === 'refused' && row.refusal_reason)
    return {
      v: 1,
      operationId: row.id,
      payloadHash: hash,
      status: 'refused',
      reason: row.refusal_reason,
    };
  throw new ContinuityError('unavailable');
}
// Each statement sees the same D1 batch transaction. Memberships are scoped to
// their particular active parent, never to an account-wide equivalence class.
const scopeSql = `WITH sources(identity_id) AS (SELECT value FROM json_each(?1)),
  destinations(identity_id) AS (SELECT value FROM json_each(?2)),
  effective(ban_id,identity_id) AS (
    SELECT id,discord_id FROM banned_users WHERE unbanned_at IS NULL AND discord_id IS NOT NULL
    UNION SELECT id,xivauth_id FROM banned_users WHERE unbanned_at IS NULL AND xivauth_id IS NOT NULL
    UNION SELECT m.ban_id,m.identity_id FROM ban_identity_memberships m
      JOIN banned_users b ON b.id=m.ban_id WHERE b.unbanned_at IS NULL
  ), matched(id) AS (
    SELECT DISTINCT e.ban_id FROM effective e JOIN sources s ON s.identity_id=e.identity_id
  )`;

export async function applyContinuity(db: D1Database, input: unknown): Promise<Receipt> {
  // Own the canonical arrays before any await; request objects can be mutable callers.
  const r = await validateContinuityRequest(input);
  const source = JSON.stringify(r.sourceIds),
    destination = JSON.stringify(r.destinationIds);
  try {
    const results = await db.batch<OperationRow>([
      db
        .prepare(
          `${scopeSql}, decision AS (
        SELECT (SELECT COUNT(*) FROM matched) AS n,
          ((SELECT COUNT(*) FROM matched)>16 OR EXISTS (
            SELECT 1 FROM matched m WHERE (SELECT COUNT(*) FROM (
              SELECT identity_id FROM effective WHERE ban_id=m.id
              UNION SELECT identity_id FROM destinations
            ))>64)) AS overflow,
          (?3='attach' AND EXISTS (SELECT 1 FROM matched m CROSS JOIN destinations d
            WHERE NOT EXISTS (SELECT 1 FROM effective e WHERE e.ban_id=m.id AND e.identity_id=d.identity_id))) AS review
      ) INSERT INTO ban_continuity_operations
        (id,payload_hash,state,refusal_reason,matched_bans,expires_at,applied_at)
        SELECT ?4,?5,CASE WHEN overflow OR review THEN 'refused' ELSE 'applying' END,
          CASE WHEN overflow THEN 'overflow' WHEN review THEN 'review_required' ELSE NULL END,
          CASE WHEN overflow THEN NULL ELSE n END,?7,
          CASE WHEN overflow OR review THEN unixepoch() ELSE NULL END
        FROM decision WHERE ?6<=unixepoch() AND ?7>unixepoch()
          AND ?6>=0 AND ?7>?6 AND ?7<=?6+900
        ON CONFLICT(id) DO NOTHING`,
        )
        .bind(source, destination, r.kind, r.operationId, r.payloadHash, r.createdAt, r.expiresAt),
      db
        .prepare(
          `${scopeSql} INSERT INTO ban_identity_memberships(ban_id,identity_id,source)
        SELECT m.id,d.identity_id,'continuity' FROM matched m CROSS JOIN destinations d
        WHERE ?3='detach' AND EXISTS (SELECT 1 FROM ban_continuity_operations
          WHERE id=?4 AND payload_hash=?5 AND state='applying')
        ON CONFLICT(ban_id,identity_id) DO NOTHING`,
        )
        .bind(source, destination, r.kind, r.operationId, r.payloadHash),
      db
        .prepare(
          `UPDATE ban_continuity_operations SET state='applied',applied_at=unixepoch()
        WHERE id=? AND payload_hash=? AND state='applying'`,
        )
        .bind(r.operationId, r.payloadHash),
      db.prepare(rowSql).bind(r.operationId),
    ]);
    const row = results[3].results[0];
    if (!row)
      throw new ContinuityError(
        r.createdAt > Math.floor(Date.now() / 1000) ? 'malformed' : 'expired',
      );
    const answer = receipt(row, r.payloadHash);
    await pruneContinuityRecords(db);
    return answer;
  } catch (error) {
    if (error instanceof ContinuityError) throw error;
    throw new ContinuityError('unavailable');
  }
}

export async function getContinuityOperation(
  db: D1Database,
  input: unknown,
): Promise<Receipt | Missing> {
  const r = validateOperationKey(input);
  try {
    const row = await db.prepare(rowSql).bind(r.operationId).first<OperationRow>();
    return row ? receipt(row, r.payloadHash) : { v: 1, ...r, status: 'missing' };
  } catch (error) {
    if (error instanceof ContinuityError) throw error;
    throw new ContinuityError('unavailable');
  }
}

export async function acknowledgeContinuity(
  db: D1Database,
  input: unknown,
): Promise<
  | {
      v: 1;
      operationId: string;
      payloadHash: string;
      status: 'missing';
      outcome: 'complete' | 'aborted';
    }
  | {
      v: 1;
      operationId: string;
      payloadHash: string;
      status: 'acknowledged';
      outcome: 'complete' | 'aborted';
      acknowledgedAt: number;
    }
> {
  const r = validateOperationKey(input, true);
  try {
    const results = await db.batch<OperationRow>([
      db
        .prepare(
          `UPDATE ban_continuity_operations
        SET acknowledged_at=COALESCE(acknowledged_at,unixepoch()),acknowledged_outcome=?3
        WHERE id=?1 AND payload_hash=?2
          AND ((state='applied' AND ?3='complete') OR (state='refused' AND ?3='aborted'))
          AND (acknowledged_outcome IS NULL OR acknowledged_outcome=?3)`,
        )
        .bind(r.operationId, r.payloadHash, r.outcome),
      db.prepare(rowSql).bind(r.operationId),
    ]);
    const row = results[1].results[0];
    if (!row) return { v: 1, ...r, status: 'missing' as const };
    receipt(row, r.payloadHash);
    if (row.acknowledged_at === null || row.acknowledged_outcome !== r.outcome)
      throw new ContinuityError('conflict');
    const answer = {
      v: 1 as const,
      ...r,
      status: 'acknowledged' as const,
      acknowledgedAt: row.acknowledged_at,
    };
    await pruneContinuityRecords(db);
    return answer;
  } catch (error) {
    if (error instanceof ContinuityError) throw error;
    throw new ContinuityError('unavailable');
  }
}
