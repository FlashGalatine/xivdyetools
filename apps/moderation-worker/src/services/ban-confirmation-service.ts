import type { Env } from '../types/env.js';
import { parseModeratorIds } from '@xivdyetools/bot-logic';
import { isValidUuid, isXivAuthUuid } from '../utils/response.js';
import {
  linkedBansEnabled,
  parseStoredIdentity,
  resolveIdentities,
  snapshotIds,
  validIdentityId,
  type IdentitySnapshot,
} from './identity-lookup.js';

type Action = 'ban' | 'unban';
type Mode = 'new' | 'expand' | 'unban';
export interface BanProposal {
  v: 1;
  action: Action;
  mode: Mode;
  banId: string | null;
  inputs: string[];
  snapshots: IdentitySnapshot[];
  ids: string[];
  parentIds: string[];
  candidates: string[];
  scope: string[];
  presetPreview: { hide: number; restore: number; stillHidden: number } | null;
}
export interface BanReview {
  nonce: string;
  actorId: string;
  phase: 'select' | 'review';
  proposal: BanProposal;
  hash: string;
  createdAt: number;
  expiresAt: number;
}
interface ReviewRow {
  nonce: string;
  actor_id: string;
  action: Action;
  mode: Mode;
  phase: 'select' | 'review';
  ban_id: string | null;
  proposal_json: string;
  proposal_hash: string;
  created_at: number;
  expires_at: number;
  consumed_at: number | null;
  outcome: string | null;
}
export const REVIEW_UNAVAILABLE =
  'This review is unavailable or changed. Run the command again and review the current scope.';
export const INACTIVE_BANS = 'Account ban confirmations are not active. No action was taken.';
const sorted = (values: string[]): string[] => [...new Set(values)].sort();
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const unavailable = (): never => {
  throw new Error(REVIEW_UNAVAILABLE);
};

/** Membership authorizes sanctions only; it never participates in account/moderator authority. */
export function activeBanMatch(alias: string, id: string): string {
  return `(${alias}.discord_id = ${id} OR ${alias}.xivauth_id = ${id} OR EXISTS (SELECT 1 FROM ban_identity_memberships bm WHERE bm.ban_id = ${alias}.id AND bm.identity_id = ${id}))`;
}
function scopeSql(parent: string): string {
  return `SELECT discord_id AS identity_id FROM banned_users WHERE id = ${parent} AND discord_id IS NOT NULL
    UNION SELECT xivauth_id FROM banned_users WHERE id = ${parent} AND xivauth_id IS NOT NULL
    UNION SELECT identity_id FROM ban_identity_memberships WHERE ban_id = ${parent}`;
}
function matchingSql(ids: string): string {
  return `SELECT b.id FROM banned_users b WHERE b.unbanned_at IS NULL AND EXISTS (SELECT 1 FROM json_each(${ids}) j WHERE ${activeBanMatch('b', 'j.value')})`;
}
function setEquals(actual: string, expected: string): string {
  return `NOT EXISTS (SELECT * FROM (${actual}) EXCEPT SELECT value FROM json_each(${expected}))
    AND NOT EXISTS (SELECT value FROM json_each(${expected}) EXCEPT SELECT * FROM (${actual}))`;
}
async function hashProposal(json: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json)),
  );
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}
function authorize(env: Env, actorId: string): void {
  if (!linkedBansEnabled(env)) throw new Error(INACTIVE_BANS);
  if (!parseModeratorIds(env.MODERATOR_IDS).has(actorId)) unavailable();
}
function parseProposal(json: string): BanProposal {
  if (json.length > 24000) unavailable();
  const p: unknown = JSON.parse(json);
  if (!p || typeof p !== 'object' || Array.isArray(p)) unavailable();
  const row = p as BanProposal;
  if (
    Object.keys(row).sort().join(',') !==
      'action,banId,candidates,ids,inputs,mode,parentIds,presetPreview,scope,snapshots,v' ||
    row.v !== 1 ||
    !['ban', 'unban'].includes(row.action) ||
    !['new', 'expand', 'unban'].includes(row.mode) ||
    (row.action === 'unban') !== (row.mode === 'unban') ||
    !(row.banId === null || (typeof row.banId === 'string' && isValidUuid(row.banId))) ||
    !Array.isArray(row.inputs) ||
    row.inputs.length < 1 ||
    row.inputs.length > 2 ||
    row.inputs.some((id) => !validIdentityId(id)) ||
    !Array.isArray(row.snapshots) ||
    row.snapshots.length > 2
  )
    unavailable();
  for (const key of ['ids', 'parentIds', 'candidates', 'scope'] as const) {
    const ids = row[key];
    const maximum = key === 'scope' ? 64 : key === 'ids' ? 4 : 16;
    if (
      !Array.isArray(ids) ||
      ids.length > maximum ||
      ids.some(
        (id) =>
          typeof id !== 'string' ||
          (key === 'scope' || key === 'ids' ? !validIdentityId(id) : !isValidUuid(id)),
      ) ||
      !same(ids, sorted(ids))
    )
      unavailable();
  }
  if (
    row.presetPreview !== null &&
    (typeof row.presetPreview !== 'object' ||
      Array.isArray(row.presetPreview) ||
      Object.keys(row.presetPreview).sort().join(',') !== 'hide,restore,stillHidden' ||
      Object.values(row.presetPreview).some(
        (value) => !Number.isSafeInteger(value) || value < 0 || value > 1001,
      ))
  )
    unavailable();
  if (row.ids.length < 1 || row.candidates.some((id) => !row.parentIds.includes(id))) unavailable();
  if (row.action === 'ban') {
    if (row.snapshots.length !== row.inputs.length) unavailable();
    row.snapshots.forEach((snapshot, index) => {
      if (
        !snapshot ||
        Object.keys(snapshot).sort().join(',') !== 'input,result' ||
        snapshot.input !== row.inputs[index]
      )
        unavailable();
      snapshot.result = parseStoredIdentity(snapshot.result, snapshot.input);
    });
    if (!same(row.ids, snapshotIds(row.snapshots))) unavailable();
  } else if (row.snapshots.length !== 0 || row.inputs.length !== 1 || !same(row.ids, row.inputs))
    unavailable();
  if (
    row.mode === 'new'
      ? row.parentIds.length !== 0 || row.scope.length !== 0 || row.candidates.length !== 0
      : row.parentIds.length === 0
  )
    unavailable();
  return row;
}
async function rowReview(row: ReviewRow): Promise<BanReview> {
  const proposal = parseProposal(row.proposal_json);
  if (
    !isValidUuid(row.nonce) ||
    !/^[a-f0-9]{64}$/.test(row.proposal_hash) ||
    (await hashProposal(row.proposal_json)) !== row.proposal_hash ||
    row.action !== proposal.action ||
    row.mode !== proposal.mode ||
    row.ban_id !== proposal.banId ||
    !['select', 'review'].includes(row.phase) ||
    (row.phase === 'select'
      ? proposal.banId !== null || proposal.candidates.length < 2 || proposal.presetPreview !== null
      : proposal.banId === null ||
        proposal.presetPreview === null ||
        (proposal.mode !== 'new' && !proposal.candidates.includes(proposal.banId))) ||
    !Number.isSafeInteger(row.created_at) ||
    !Number.isSafeInteger(row.expires_at) ||
    row.expires_at <= row.created_at ||
    row.expires_at > row.created_at + 900
  )
    unavailable();
  return {
    nonce: row.nonce,
    actorId: row.actor_id,
    phase: row.phase,
    proposal,
    hash: row.proposal_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}
export async function loadBanReview(
  env: Env,
  nonce: string,
  actorId: string,
  phase?: 'select' | 'review',
): Promise<BanReview> {
  authorize(env, actorId);
  if (!isValidUuid(nonce)) unavailable();
  const row = await env.DB.prepare(
    `SELECT * FROM moderation_ban_confirmations WHERE nonce = ? AND actor_id = ?
    AND consumed_at IS NULL AND outcome IS NULL AND expires_at > unixepoch()`,
  )
    .bind(nonce, actorId)
    .first<ReviewRow>();
  if (!row || (phase && row.phase !== phase)) unavailable();
  return rowReview(row!);
}
async function parentIds(db: D1Database, ids: string[]): Promise<string[]> {
  const rows = await db
    .prepare(`${matchingSql('?')} ORDER BY b.id LIMIT 17`)
    .bind(JSON.stringify(ids))
    .all<{ id: string }>();
  if ((rows.results?.length ?? 0) > 16)
    throw new Error('Too many active bans match. Manual review is required.');
  return (rows.results ?? []).map((row) => row.id);
}
async function parentScope(db: D1Database, id: string): Promise<string[]> {
  const rows = await db
    .prepare(`SELECT identity_id FROM (${scopeSql('?')}) ORDER BY identity_id LIMIT 65`)
    .bind(id, id, id)
    .all<{ identity_id: string }>();
  const ids = (rows.results ?? []).map((row) => row.identity_id);
  if (ids.length > 64 || ids.some((value) => !validIdentityId(value))) unavailable();
  return ids;
}
function validState(p: BanProposal): string {
  // Constants here refer to the immutable row c; no JavaScript read decides the final claim.
  const parentMatch = setEquals(
    matchingSql(
      p.action === 'unban'
        ? "json_extract(c.proposal_json,'$.scope')"
        : "json_extract(c.proposal_json,'$.ids')",
    ),
    "json_extract(c.proposal_json,'$.parentIds')",
  );
  if (p.mode === 'new') return parentMatch;
  return `${parentMatch} AND EXISTS (SELECT 1 FROM banned_users b WHERE b.id = c.ban_id AND b.unbanned_at IS NULL)
    AND ${setEquals(scopeSql('c.ban_id'), "json_extract(c.proposal_json,'$.scope')")}
    AND (SELECT COUNT(*) FROM (${scopeSql('c.ban_id')} UNION SELECT value FROM json_each(c.proposal_json,'$.ids'))) <= 64`;
}
/** The same eligibility predicate drives previews, restore audits and actual restoration. */
function restorePredicate(): string {
  const eligible = (
    alias: string,
  ): string => `${alias}.status = 'hidden' AND ${alias}.author_discord_id IN (SELECT value FROM json_each(?))
    AND NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.id <> ? AND b.unbanned_at IS NULL AND ${activeBanMatch('b', `${alias}.author_discord_id`)})
    AND NOT EXISTS (SELECT 1 FROM presets o WHERE o.dye_signature = ${alias}.dye_signature AND o.id <> ${alias}.id AND o.status IN ('approved','pending'))`;
  return `${eligible('p')} AND NOT EXISTS (SELECT 1 FROM presets h WHERE ${eligible('h')}
    AND h.dye_signature = p.dye_signature AND h.id < p.id)`;
}
async function boundedPresetCount(
  db: D1Database,
  predicate: string,
  values: unknown[],
): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM (SELECT 1 FROM presets p WHERE ${predicate} LIMIT 1001)`)
    .bind(...values)
    .first<{ n: number }>();
  if (!row || !Number.isSafeInteger(row.n) || row.n < 0 || row.n > 1001) unavailable();
  return row!.n;
}
async function presetPreview(
  db: D1Database,
  p: BanProposal,
): Promise<NonNullable<BanProposal['presetPreview']>> {
  if (p.action === 'ban') {
    const additional = p.ids.filter((id) => !p.scope.includes(id));
    return {
      hide: await boundedPresetCount(
        db,
        "p.status = 'approved' AND p.author_discord_id IN (SELECT value FROM json_each(?))",
        [JSON.stringify(additional)],
      ),
      restore: 0,
      stillHidden: 0,
    };
  }
  const values = [JSON.stringify(p.scope), p.banId, JSON.stringify(p.scope), p.banId];
  const predicate = restorePredicate();
  return {
    hide: 0,
    restore: await boundedPresetCount(db, predicate, values),
    stillHidden: await boundedPresetCount(
      db,
      `p.status = 'hidden' AND p.author_discord_id IN (SELECT value FROM json_each(?)) AND NOT (${predicate})`,
      [JSON.stringify(p.scope), ...values],
    ),
  };
}
function identityGuard(): string {
  return `nonce = ? AND actor_id = ? AND action = ? AND mode = ? AND proposal_hash = ?`;
}
function guardValues(review: BanReview): unknown[] {
  return [review.nonce, review.actorId, review.proposal.action, review.proposal.mode, review.hash];
}
function applyingGuard(): string {
  return `EXISTS (SELECT 1 FROM moderation_ban_confirmations c WHERE ${identityGuard()} AND phase = 'review' AND outcome = 'applying' AND consumed_at IS NOT NULL)`;
}
async function makeReview(
  actorId: string,
  proposal: BanProposal,
  phase: 'select' | 'review',
  expiresAt?: number,
): Promise<BanReview> {
  const createdAt = Math.floor(Date.now() / 1000);
  const json = JSON.stringify(proposal);
  parseProposal(json);
  return {
    nonce: crypto.randomUUID(),
    actorId,
    proposal,
    phase,
    createdAt,
    expiresAt: expiresAt ?? createdAt + 600,
    hash: await hashProposal(json),
  };
}
function insertReview(
  db: D1Database,
  r: BanReview,
  condition = '1',
  conditionValues: unknown[] = [],
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO moderation_ban_confirmations(nonce,actor_id,action,mode,phase,ban_id,proposal_json,proposal_hash,created_at,expires_at)
    SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${condition}`,
    )
    .bind(
      r.nonce,
      r.actorId,
      r.proposal.action,
      r.proposal.mode,
      r.phase,
      r.proposal.banId,
      JSON.stringify(r.proposal),
      r.hash,
      r.createdAt,
      r.expiresAt,
      ...conditionValues,
    );
}

export async function createBanReview(
  env: Env,
  actorId: string,
  action: Action,
  inputs: string[],
): Promise<BanReview> {
  authorize(env, actorId);
  if (
    !['ban', 'unban'].includes(action) ||
    !Array.isArray(inputs) ||
    inputs.length < 1 ||
    inputs.length > (action === 'ban' ? 2 : 1) ||
    inputs.some((id) => !validIdentityId(id))
  )
    unavailable();
  const snapshots = action === 'ban' ? await resolveIdentities(env, inputs) : [];
  authorize(env, actorId);
  const ids = action === 'ban' ? snapshotIds(snapshots) : inputs;
  const matches = await parentIds(env.DB, ids);
  if (action === 'unban' && matches.length === 0)
    throw new Error('No active ban matches this account.');
  const primary = matches.length
    ? await parentIds(env.DB, action === 'ban' ? snapshotIds([snapshots[0]]) : inputs)
    : [];
  const candidates = primary.length ? primary : matches;
  const phase = candidates.length > 1 ? 'select' : 'review';
  const banId = phase === 'select' ? null : (candidates[0] ?? crypto.randomUUID());
  const scope = banId && matches.length ? await parentScope(env.DB, banId) : [];
  if (sorted([...scope, ...ids]).length > 64) unavailable();
  const proposal: BanProposal = {
    v: 1,
    action,
    mode: action === 'unban' ? 'unban' : matches.length ? 'expand' : 'new',
    banId,
    inputs,
    snapshots,
    ids,
    parentIds: action === 'unban' && phase === 'review' ? await parentIds(env.DB, scope) : matches,
    candidates,
    scope,
    presetPreview: null,
  };
  if (phase === 'review') proposal.presetPreview = await presetPreview(env.DB, proposal);
  const review = await makeReview(actorId, proposal, phase);
  await insertReview(env.DB, review).run();
  return review;
}

export async function selectBanParent(
  env: Env,
  actorId: string,
  nonce: string,
  selected: string,
): Promise<BanReview> {
  const previous = await loadBanReview(env, nonce, actorId, 'select');
  if (!previous.proposal.candidates.includes(selected)) unavailable();
  const proposal = {
    ...previous.proposal,
    banId: selected,
    scope: await parentScope(env.DB, selected),
  };
  if (sorted([...proposal.scope, ...proposal.ids]).length > 64) unavailable();
  if (proposal.action === 'unban') proposal.parentIds = await parentIds(env.DB, proposal.scope);
  proposal.presetPreview = await presetPreview(env.DB, proposal);
  const next = await makeReview(actorId, proposal, 'review', previous.expiresAt);
  authorize(env, actorId);
  // Selection freezes a NEW payload; old select nonce is consumed and cannot mint another review.
  const selectionState = `${setEquals(matchingSql("json_extract(c.proposal_json,'$.ids')"), "json_extract(c.proposal_json,'$.parentIds')")}
    AND EXISTS (SELECT 1 FROM banned_users WHERE id = ? AND unbanned_at IS NULL)
    AND ${setEquals(scopeSql('?'), '?')}${proposal.action === 'unban' ? ` AND ${setEquals(matchingSql('?'), '?')}` : ''}`;
  const result = await env.DB.batch([
    env.DB.prepare(
      `UPDATE moderation_ban_confirmations AS c SET consumed_at = unixepoch(), outcome = 'applying'
      WHERE ${identityGuard()} AND phase = 'select' AND consumed_at IS NULL AND outcome IS NULL AND expires_at > unixepoch() AND ${selectionState}`,
    ).bind(
      ...guardValues(previous),
      selected,
      selected,
      selected,
      selected,
      JSON.stringify(proposal.scope),
      JSON.stringify(proposal.scope),
      selected,
      selected,
      selected,
      ...(proposal.action === 'unban'
        ? [
            JSON.stringify(proposal.scope),
            JSON.stringify(proposal.parentIds),
            JSON.stringify(proposal.parentIds),
            JSON.stringify(proposal.scope),
          ]
        : []),
    ),
    insertReview(
      env.DB,
      next,
      `EXISTS (SELECT 1 FROM moderation_ban_confirmations WHERE ${identityGuard()} AND phase = 'select' AND outcome = 'applying')`,
      guardValues(previous),
    ),
    env.DB.prepare(
      `UPDATE moderation_ban_confirmations SET outcome = 'applied' WHERE ${identityGuard()} AND phase = 'select' AND outcome = 'applying'`,
    ).bind(...guardValues(previous)),
  ]);
  if (
    result[0]?.meta.changes !== 1 ||
    result[1]?.meta.changes !== 1 ||
    result[2]?.meta.changes !== 1
  )
    unavailable();
  return next;
}

export interface ConfirmationResult {
  success: boolean;
  presetsHidden: number;
  presetsRestored: number;
  presetsStillHidden: number;
  error?: string;
}
const UUID_SQL =
  "lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-8' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))";

export async function applyBanReview(
  env: Env,
  nonce: string,
  actorId: string,
  action: Action,
  reason?: string,
  username = '',
): Promise<ConfirmationResult> {
  const failed = (error: string): ConfirmationResult => ({
    success: false,
    presetsHidden: 0,
    presetsRestored: 0,
    presetsStillHidden: 0,
    error,
  });
  try {
    const review = await loadBanReview(env, nonce, actorId, 'review');
    const p = review.proposal;
    if (p.action !== action) unavailable();
    const trimmedReason = reason?.trim();
    if (
      action === 'ban' &&
      (!trimmedReason || trimmedReason.length < 10 || trimmedReason.length > 500)
    )
      throw new Error('Please provide a valid ban reason (10 to 500 characters).');
    if (action === 'ban' && !same(p.snapshots, await resolveIdentities(env, p.inputs)))
      unavailable();
    authorize(env, actorId);
    const scope = action === 'unban' ? p.scope : sorted([...p.scope, ...p.ids]);
    const additional = p.ids.filter((id) => !p.scope.includes(id));
    // An already-covered proposal is a reviewed no-op. It does not claim new hides/audits.
    const noop = p.mode === 'expand' && additional.length === 0;
    const vals = guardValues(review);
    const guarded = applyingGuard();
    const db = env.DB;
    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [
      db
        .prepare(
          `UPDATE moderation_ban_confirmations AS c SET consumed_at = unixepoch(), outcome = 'applying'
      WHERE ${identityGuard()} AND phase = 'review' AND ban_id = ? AND consumed_at IS NULL AND outcome IS NULL AND expires_at > unixepoch()
      AND ${validState(p)}`,
        )
        .bind(...vals, p.banId),
    ];
    let mutationIndex = -1;
    if (p.mode === 'new') {
      const target = p.inputs[0];
      statements.push(
        db
          .prepare(
            `INSERT INTO banned_users(id,discord_id,xivauth_id,username,moderator_discord_id,reason,banned_at)
        SELECT ?,?,?,?,?,?,? WHERE ${guarded}`,
          )
          .bind(
            p.banId,
            target,
            isXivAuthUuid(target) ? target : null,
            username || target,
            actorId,
            trimmedReason!,
            now,
            ...vals,
          ),
      );
    }
    if (action === 'ban' && !noop) {
      statements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO ban_identity_memberships(ban_id,identity_id,source)
        SELECT ?,value,'confirmed' FROM json_each(?) WHERE ${guarded}`,
          )
          .bind(p.banId, JSON.stringify(p.ids), ...vals),
      );
      statements.push(
        db
          .prepare(
            `INSERT INTO moderation_log(id,preset_id,moderator_discord_id,action,reason,target_discord_id,created_at)
        SELECT ${UUID_SQL},NULL,?,'ban',?,identity_id,? FROM (SELECT DISTINCT value AS identity_id FROM json_each(?)) WHERE ${guarded}`,
          )
          .bind(actorId, trimmedReason!, now, JSON.stringify(additional), ...vals),
      );
      const predicate = `p.status = 'approved' AND p.author_discord_id IN (SELECT value FROM json_each(?)) AND ${guarded}`;
      statements.push(
        db
          .prepare(
            `INSERT INTO moderation_log(id,preset_id,moderator_discord_id,action,reason,target_discord_id,created_at)
        SELECT ${UUID_SQL},p.id,?,'hide',?,p.author_discord_id,? FROM presets p WHERE ${predicate}`,
          )
          .bind(actorId, trimmedReason!, now, JSON.stringify(additional), ...vals),
      );
      mutationIndex = statements.length - 1;
      statements.push(
        db
          .prepare(`UPDATE presets AS p SET status = 'hidden',updated_at = ? WHERE ${predicate}`)
          .bind(now, JSON.stringify(additional), ...vals),
      );
    } else if (action === 'unban') {
      // Close precisely the reviewed parent. Memberships stay until parent retention cascades.
      statements.push(
        db
          .prepare(
            `UPDATE banned_users SET unbanned_at = ?,unban_moderator_discord_id = ?,username = '',reason = '' WHERE id = ? AND unbanned_at IS NULL AND ${guarded}`,
          )
          .bind(now, actorId, p.banId, ...vals),
      );
      statements.push(
        db
          .prepare(
            `INSERT INTO moderation_log(id,preset_id,moderator_discord_id,action,reason,target_discord_id,created_at)
        SELECT ${UUID_SQL},NULL,?,'unban',NULL,identity_id,? FROM (SELECT DISTINCT value AS identity_id FROM json_each(?)) WHERE ${guarded}`,
          )
          .bind(actorId, now, JSON.stringify(p.scope), ...vals),
      );
      const predicate = `${restorePredicate()} AND ${guarded}`;
      const restoreValues = [
        JSON.stringify(scope),
        p.banId,
        JSON.stringify(scope),
        p.banId,
        ...vals,
      ];
      statements.push(
        db
          .prepare(
            `INSERT INTO moderation_log(id,preset_id,moderator_discord_id,action,reason,target_discord_id,created_at)
        SELECT ${UUID_SQL},p.id,?,'restore',NULL,p.author_discord_id,? FROM presets p WHERE ${predicate}`,
          )
          .bind(actorId, now, ...restoreValues),
      );
      mutationIndex = statements.length - 1;
      statements.push(
        db
          .prepare(`UPDATE presets AS p SET status = 'approved',updated_at = ? WHERE ${predicate}`)
          .bind(now, ...restoreValues),
      );
    }
    const hiddenCountIndex = statements.length;
    // Counts are returned by a read INSIDE the committed transaction, never a later racing query.
    statements.push(
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM presets WHERE status = 'hidden' AND author_discord_id IN (SELECT value FROM json_each(?)) AND ${guarded}`,
        )
        .bind(JSON.stringify(scope), ...vals),
    );
    statements.push(
      db
        .prepare(
          `UPDATE moderation_ban_confirmations SET outcome = 'applied' WHERE ${identityGuard()} AND phase = 'review' AND outcome = 'applying' AND consumed_at IS NOT NULL`,
        )
        .bind(...vals),
    );
    const results = await db.batch(statements);
    if (results[0]?.meta.changes !== 1) return failed(REVIEW_UNAVAILABLE);
    if (results.at(-1)?.meta.changes !== 1) throw new Error('Confirmation finalization failed.');
    // Audit INSERTs count exactly affected presets; D1 UPDATE metadata also includes revision-trigger writes.
    const changed = mutationIndex < 0 ? 0 : (results[mutationIndex]?.meta.changes ?? 0);
    const stillHidden = Number(
      (results[hiddenCountIndex]?.results[0] as { n?: number } | undefined)?.n ?? 0,
    );
    return {
      success: true,
      presetsHidden: action === 'ban' ? changed : 0,
      presetsRestored: action === 'unban' ? changed : 0,
      presetsStillHidden: stillHidden,
    };
  } catch {
    return failed(REVIEW_UNAVAILABLE);
  }
}

/** Only ephemeral callers may render this full scope. IDs never enter custom IDs. */
export function reviewMessage(review: BanReview): Record<string, unknown> {
  const p = review.proposal;
  if (review.phase === 'select')
    return {
      content: 'Choose one active ban record to review. Other matching bans remain independent.',
      flags: 64,
      allowed_mentions: { parse: [] },
      components: [
        {
          type: 1,
          components: [
            {
              type: 3,
              custom_id: `ban_choose_${review.nonce}`,
              min_values: 1,
              max_values: 1,
              options: p.candidates.map((id) => ({ label: `Ban ${id}`, value: id })),
            },
          ],
        },
      ],
    };
  const complete = p.action === 'unban' ? p.scope : sorted([...p.scope, ...p.ids]);
  const additions = p.ids.filter((id) => !p.scope.includes(id));
  const lines = [
    `Ban record: ${p.banId}`,
    `Action: ${p.mode}`,
    'Stored association only; this is not fresh upstream verification.',
    ...(p.presetPreview
      ? [
          `Informational preset preview (may change before execution): ${p.action === 'ban' ? `Hide: ${p.presetPreview.hide > 1000 ? '1000+' : p.presetPreview.hide}` : `Restore: ${p.presetPreview.restore > 1000 ? '1000+' : p.presetPreview.restore}; Still hidden: ${p.presetPreview.stillHidden > 1000 ? '1000+' : p.presetPreview.stillHidden}`}. Final transaction counts are authoritative.`,
        ]
      : []),
    `Currently covered IDs:\n${p.scope.join('\n') || '(none)'}`,
    `Additional reviewed IDs:\n${p.action === 'unban' ? '(none)' : additions.join('\n') || '(none)'}`,
    `Complete reviewed scope:\n${complete.join('\n')}`,
    ...p.snapshots.map(
      ({ input, result }) =>
        `${input}: ${result.status === 'missing' ? 'authoritative missing; explicit ID only' : `stored revision ${result.identityRevision}`}`,
    ),
  ];
  // At most64 IDs per parent, at most4 proposal IDs: split content into bounded embeds.
  const text = lines.join('\n\n');
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += 3800)
    chunks.push(text.slice(start, start + 3800));
  return {
    flags: 64,
    allowed_mentions: { parse: [] },
    embeds: chunks.map((description, index) => ({
      title: index
        ? 'Reviewed scope (continued)'
        : p.action === 'unban'
          ? 'Confirm recorded-scope unban'
          : 'Confirm account ban scope',
      description,
      color: 0xed4245,
    })),
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 4,
            label: p.action === 'unban' ? 'Confirm unban' : 'Continue to reason',
            custom_id: `ban_confirm_${review.nonce}`,
          },
          { type: 2, style: 2, label: 'Cancel', custom_id: `ban_cancel_${review.nonce}` },
        ],
      },
    ],
  };
}
