import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Env } from '../types/env.js';
import {
  createBanReview,
  loadBanReview,
  selectBanParent,
  applyBanReview,
  reviewMessage,
} from './ban-confirmation-service.js';
import { handlePresetApproveButton } from '../handlers/buttons/preset-moderation.js';
import { handlePresetRevertModal } from '../handlers/modals/preset-rejection.js';
import { isPresetAuthorBanned } from './ban-service.js';

const D = '123456789012345678',
  D2 = '223456789012345678',
  D3 = '323456789012345678';
const U = 'a0000000-0000-4000-8000-000000000001',
  U2 = 'a0000000-0000-4000-8000-000000000002';
const P = 'b0000000-0000-4000-8000-000000000001',
  P2 = 'b0000000-0000-4000-8000-000000000002';
const MOD = '999999999999999999',
  MOD2 = '899999999999999999';
function adapter(raw: DatabaseSync, beforeBatch?: () => void): D1Database {
  const prepare = (sql: string, values: unknown[] = []): unknown => ({
    bind: (...args: unknown[]) => prepare(sql, args),
    first: async () => raw.prepare(sql).get(...(values as never[])) ?? null,
    all: async () => ({
      success: true,
      results: raw.prepare(sql).all(...(values as never[])),
      meta: {},
    }),
    run: async () => {
      const stmt = raw.prepare(sql);
      if (/^\s*SELECT/.test(sql))
        return { success: true, results: stmt.all(...(values as never[])), meta: { changes: 0 } };
      const before = Number((raw.prepare('SELECT total_changes() n').get() as { n: number }).n);
      stmt.run(...(values as never[]));
      const after = Number((raw.prepare('SELECT total_changes() n').get() as { n: number }).n);
      return { success: true, results: [], meta: { changes: after - before } };
    },
  });
  return {
    prepare,
    batch: async (statements: { run: () => Promise<unknown> }[]) => {
      beforeBatch?.();
      raw.exec('BEGIN');
      try {
        const results = [];
        for (const s of statements) results.push(await s.run());
        raw.exec('COMMIT');
        return results;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as D1Database;
}

describe('immutable moderation confirmation transactions on shipped SQLite schema', () => {
  let raw: DatabaseSync, env: Env;
  let lookup: ReturnType<typeof vi.fn>;
  const row = (sql: string, ...values: string[]) =>
    raw.prepare(sql).get(...values) as Record<string, unknown>;
  const count = (table: string) => Number(row(`SELECT COUNT(*) n FROM ${table}`).n);
  const preset = (id: string, author: string, status = 'approved', signature: string | null = id) =>
    raw
      .prepare(
        "INSERT INTO presets(id,name,description,category_id,dyes,tags,author_discord_id,author_name,status,dye_signature) VALUES (?,?,'Description','jobs','[]','[]',?,'Target',?,?)",
      )
      .run(id, id, author, status, signature);
  const ban = (id = P, target = D) =>
    raw
      .prepare(
        "INSERT INTO banned_users(id,discord_id,username,moderator_discord_id,reason) VALUES (?,?,'Target',?,'Original reason')",
      )
      .run(id, target, MOD);
  const member = (id: string, author: string) =>
    raw
      .prepare(
        "INSERT INTO ban_identity_memberships(ban_id,identity_id,source) VALUES (?,?,'confirmed')",
      )
      .run(id, author);
  const found = (id = U, discord: string | null = D, revision = 1) => ({
    version: 1,
    status: 'found',
    internalId: id,
    discordId: discord,
    identityRevision: revision,
  });
  const status = (id: string) => row('SELECT status FROM presets WHERE id=?', id).status;
  const logs = () =>
    raw.prepare('SELECT action,preset_id FROM moderation_log ORDER BY rowid').all();
  const apply = async (nonce: string, action: 'ban' | 'unban' = 'ban', actor = MOD) =>
    applyBanReview(env, nonce, actor, action, 'Repeated abuse reason', 'Target');
  beforeEach(() => {
    raw = new DatabaseSync(':memory:');
    raw.exec(readFileSync(resolve(import.meta.dirname, '../../../presets-api/schema.sql'), 'utf8'));
    lookup = vi.fn(async () => found());
    env = {
      DB: adapter(raw),
      MODERATOR_IDS: `${MOD},${MOD2}`,
      LINKED_BAN_CONFIRMATION_ENABLED: 'true',
      OAUTH_IDENTITY: { lookupStoredIdentity: lookup },
    } as unknown as Env;
  });
  afterEach(() => {
    raw.close();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it.each(['new', 'expand'] as const)(
    'fix-wave attributable per-identity %s audits include linked partner with zero presets',
    async (mode) => {
      if (mode === 'expand') ban();
      const review = await createBanReview(env, MOD, 'ban', [D]);
      expect(await apply(review.nonce)).toMatchObject({ success: true, presetsHidden: 0 });
      const audited = raw
        .prepare(
          "SELECT target_discord_id,moderator_discord_id,reason FROM moderation_log WHERE action='ban' ORDER BY target_discord_id",
        )
        .all();
      expect(audited).toEqual(
        (mode === 'new' ? [D, U].sort() : [U]).map((id) => ({
          target_discord_id: id,
          moderator_discord_id: MOD,
          reason: 'Repeated abuse reason',
        })),
      );
      const noop = await createBanReview(env, MOD, 'ban', [D]);
      expect(await apply(noop.nonce)).toMatchObject({ success: true, presetsHidden: 0 });
      expect(
        raw
          .prepare(
            "SELECT target_discord_id,moderator_discord_id,reason FROM moderation_log WHERE action='ban' ORDER BY target_discord_id",
          )
          .all(),
      ).toEqual(audited);
    },
  );
  it('fix-wave recorded unban audits every distinct identity with moderator attribution', async () => {
    ban();
    member(P, D);
    member(P, U);
    member(P, D3);
    const review = await createBanReview(env, MOD, 'unban', [D]);
    expect((await apply(review.nonce, 'unban')).success).toBe(true);
    expect(
      raw
        .prepare(
          "SELECT target_discord_id,moderator_discord_id,reason FROM moderation_log WHERE action='unban' ORDER BY target_discord_id",
        )
        .all(),
    ).toEqual(
      [D, U, D3]
        .sort()
        .map((id) => ({ target_discord_id: id, moderator_discord_id: MOD, reason: null })),
    );
    expect(lookup).not.toHaveBeenCalled();
  });
  it('fix-wave unban snapshots all matching parents across full recorded scope', async () => {
    ban();
    member(P, U);
    ban(P2, D2);
    member(P2, U);
    const review = await createBanReview(env, MOD, 'unban', [D]);
    expect(review.proposal.candidates).toEqual([P]);
    expect(review.proposal.parentIds).toEqual([P, P2]);
    expect(lookup).not.toHaveBeenCalled();
  });
  it.each(['appears', 'disappears'] as const)(
    'fix-wave non-input recorded-member parent %s before unban claim stales without effects',
    async (race) => {
      ban();
      member(P, U);
      preset('d', D, 'hidden');
      preset('u', U, 'hidden');
      if (race === 'disappears') {
        ban(P2, D2);
        member(P2, U);
      }
      const review = await createBanReview(env, MOD, 'unban', [D]);
      env.DB = adapter(raw, () => {
        if (race === 'appears') {
          ban(P2, D2);
          member(P2, U);
        } else
          raw.prepare("UPDATE banned_users SET unbanned_at=datetime('now') WHERE id=?").run(P2);
      });
      expect((await apply(review.nonce, 'unban')).success).toBe(false);
      expect(row('SELECT unbanned_at FROM banned_users WHERE id=?', P).unbanned_at).toBeNull();
      expect([status('d'), status('u')]).toEqual(['hidden', 'hidden']);
      expect(count('moderation_log')).toBe(0);
      expect(
        row(
          'SELECT consumed_at,outcome FROM moderation_ban_confirmations WHERE nonce=?',
          review.nonce,
        ),
      ).toMatchObject({ consumed_at: null, outcome: null });
      expect(lookup).not.toHaveBeenCalled();
    },
  );
  it.each(['new', 'expand', 'unban'] as const)(
    'fix-wave immutable informational preset preview exists for %s and stays private',
    async (mode) => {
      if (mode !== 'new') {
        ban();
        member(P, D3);
      }
      if (mode === 'unban') {
        member(P, U);
        preset('d', D, 'hidden', 'occupied');
        preset('active', D2, 'pending', 'occupied');
        preset('u', U, 'hidden', 'unique');
      } else {
        preset('d', D);
        preset('u', U);
      }
      const review = await createBanReview(env, MOD, mode === 'unban' ? 'unban' : 'ban', [D]);
      const before = row(
        'SELECT proposal_json,proposal_hash FROM moderation_ban_confirmations WHERE nonce=?',
        review.nonce,
      );
      const message = reviewMessage(review);
      const text = JSON.stringify(message);
      expect(message.flags).toBe(64);
      expect(text).toContain('Informational preset preview');
      expect(text).toContain(
        mode === 'unban' ? 'Restore: 1; Still hidden: 1' : mode === 'new' ? 'Hide: 2' : 'Hide: 1',
      );
      expect(
        row(
          'SELECT proposal_json,proposal_hash FROM moderation_ban_confirmations WHERE nonce=?',
          review.nonce,
        ),
      ).toEqual(before);
    },
  );
  it('fix-wave unban chooser keeps input candidates but snapshots full selected scope into fresh review', async () => {
    const third = 'b0000000-0000-4000-8000-000000000003';
    ban();
    member(P, U);
    ban(P2, D2);
    member(P2, D);
    ban(third, D3);
    member(third, U);
    const chooser = await createBanReview(env, MOD, 'unban', [D]);
    expect(chooser.phase).toBe('select');
    expect(chooser.proposal.candidates).toEqual([P, P2]);
    const review = await selectBanParent(env, MOD, chooser.nonce, P);
    expect(review.proposal.candidates).toEqual([P, P2]);
    expect(review.proposal.parentIds).toEqual([P, P2, third]);
    expect((await apply(review.nonce, 'unban')).success).toBe(true);
    expect(row('SELECT unbanned_at FROM banned_users WHERE id=?', P2).unbanned_at).toBeNull();
    expect(row('SELECT unbanned_at FROM banned_users WHERE id=?', third).unbanned_at).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
  it('fix-wave selector transaction rejects a newly appearing full-scope-only parent without minting review', async () => {
    const third = 'b0000000-0000-4000-8000-000000000003';
    ban();
    member(P, U);
    ban(P2, D2);
    member(P2, D);
    const chooser = await createBanReview(env, MOD, 'unban', [D]);
    env.DB = adapter(raw, () => {
      ban(third, D3);
      member(third, U);
    });
    await expect(selectBanParent(env, MOD, chooser.nonce, P)).rejects.toThrow();
    expect(count('moderation_ban_confirmations')).toBe(1);
    expect(count('moderation_log')).toBe(0);
    expect(
      row(
        'SELECT consumed_at,outcome FROM moderation_ban_confirmations WHERE nonce=?',
        chooser.nonce,
      ),
    ).toMatchObject({ consumed_at: null, outcome: null });
  });
  it('fix-wave full recorded scope over16 matching parents refuses before confirmation storage', async () => {
    ban();
    member(P, U);
    for (let i = 0; i < 16; i++) {
      const id = crypto.randomUUID();
      ban(id, String(400000000000000000n + BigInt(i)));
      member(id, U);
    }
    await expect(createBanReview(env, MOD, 'unban', [D])).rejects.toThrow(
      'Manual review is required',
    );
    expect(count('moderation_ban_confirmations')).toBe(0);
    expect(count('moderation_log')).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
  });
  it('fix-wave preset preview caps at1000+ while final transaction reports the exact actual preset count', async () => {
    raw.exec(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1005) INSERT INTO presets(id,name,description,category_id,dyes,tags,author_discord_id,status) SELECT 'bulk-'||x,'Bulk','Description','jobs','[]','[]','123456789012345678','approved' FROM n",
    );
    const review = await createBanReview(env, MOD, 'ban', [D]);
    expect(review.proposal).toHaveProperty('presetPreview', {
      hide: 1001,
      restore: 0,
      stillHidden: 0,
    });
    expect(JSON.stringify(reviewMessage(review))).toContain('Hide: 1000+');
    expect(await apply(review.nonce)).toMatchObject({ success: true, presetsHidden: 1005 });
    expect(row("SELECT COUNT(*) n FROM moderation_log WHERE action='hide'").n).toBe(1005);
    expect(row("SELECT COUNT(*) n FROM moderation_log WHERE action='ban'").n).toBe(2);
  });
  it.each(['approve', 'revert'] as const)(
    'real frozen %s handler refuses a membership-only pending author before publishing',
    async (action) => {
      ban();
      member(P, U);
      preset(P2, U, 'pending');
      const request = vi.fn(async () => Response.json({ id: 'message' }));
      vi.stubGlobal('fetch', request);
      env.DISCORD_TOKEN = 'fake-token';
      env.DISCORD_CLIENT_ID = 'fake-app';
      const pending: Promise<unknown>[] = [];
      const ctx = {
        waitUntil: (promise: Promise<unknown>) => {
          pending.push(promise);
        },
      } as ExecutionContext;
      const interaction = {
        id: 'i',
        token: 'interaction-token',
        application_id: 'app',
        channel_id: 'moderation',
        member: { user: { id: MOD, username: 'Actor' } },
        message: { id: 'message' },
        data: {
          custom_id:
            action === 'approve'
              ? `preset_approve_${P2}:0:pending`
              : `preset_revert_modal_${P2}:0:pending`,
          components: [
            {
              type: 1,
              components: [{ type: 4, custom_id: 'revert_reason', value: 'Repeated abuse reason' }],
            },
          ],
        },
      };
      if (action === 'approve') await handlePresetApproveButton(interaction, env, ctx);
      else await handlePresetRevertModal(interaction, env, ctx);
      await Promise.all(pending);
      expect(status(P2)).toBe('pending');
      expect(request).toHaveBeenCalledTimes(1);
      const call = request.mock.calls[0] as unknown as [string, RequestInit];
      expect(call[0]).toContain('discord.com/api');
      expect(call[1].body).toEqual(expect.stringContaining('currently banned'));
      expect(count('moderation_log')).toBe(0);
    },
  );
  it.each([D, U])(
    'bans either reviewed input %s and hides both author scopes with exact audits',
    async (input) => {
      preset('d', D);
      preset('u', U);
      preset('u-pending', U, 'pending');
      preset('other', D3);
      const review = await createBanReview(env, MOD, 'ban', [input]);
      expect(review.proposal.ids).toEqual([D, U].sort());
      const result = await apply(review.nonce);
      expect(result).toMatchObject({ success: true, presetsHidden: 2 });
      expect([status('d'), status('u'), status('u-pending'), status('other')]).toEqual([
        'hidden',
        'hidden',
        'pending',
        'approved',
      ]);
      expect(logs()).toHaveLength(4);
      expect(await isPresetAuthorBanned(env.DB, 'u-pending')).toBe(true);
      expect(
        row('SELECT outcome FROM moderation_ban_confirmations WHERE nonce=?', review.nonce).outcome,
      ).toBe('applied');
      expect(lookup).toHaveBeenCalledTimes(2);
    },
  );
  it('no-preset vote-only account with authoritative missing can be banned explicitly', async () => {
    lookup.mockResolvedValue({ version: 1, status: 'missing' });
    const review = await createBanReview(env, MOD, 'ban', [D]);
    expect(review.proposal.ids).toEqual([D]);
    expect((await apply(review.nonce)).success).toBe(true);
    expect(count('banned_users')).toBe(1);
    expect(count('moderation_log')).toBe(1);
  });
  it('partial existing legacy ban offers explicit expansion and private covered/additional IDs and revisions', async () => {
    ban();
    preset('u', U);
    preset('d', D, 'hidden');
    const review = await createBanReview(env, MOD, 'ban', [D]);
    expect(review.proposal).toMatchObject({ mode: 'expand', banId: P, scope: [D] });
    const display = JSON.stringify(reviewMessage(review));
    for (const value of [P, D, U, 'stored revision 1', 'Currently covered', 'Additional reviewed'])
      expect(display).toContain(value);
    expect(reviewMessage(review).flags).toBe(64);
    expect(await apply(review.nonce)).toMatchObject({ success: true, presetsHidden: 1 });
    expect(count('banned_users')).toBe(1);
    expect(status('u')).toBe('hidden');
    const next = await createBanReview(env, MOD, 'ban', [D]);
    expect(await apply(next.nonce)).toMatchObject({ success: true, presetsHidden: 0 });
    expect(count('moderation_log')).toBe(2);
  });
  it('captures secondary-only matching parent but expands only selected primary, without merge', async () => {
    ban(P, D);
    ban(P2, D2);
    lookup.mockImplementation(async (input: { id: string }) =>
      input.id === D ? found() : found(U2, D2),
    );
    const review = await createBanReview(env, MOD, 'ban', [D, D2]);
    expect(review.phase).toBe('review');
    expect(review.proposal.parentIds).toEqual([P, P2]);
    expect((await apply(review.nonce)).success).toBe(true);
    expect(count('banned_users')).toBe(2);
    expect(row('SELECT unbanned_at FROM banned_users WHERE id=?', P2).unbanned_at).toBeNull();
    expect(row('SELECT COUNT(*) n FROM ban_identity_memberships WHERE ban_id=?', P2).n).toBe(0);
  });
  it('ambiguous parents require explicit choice; selector concurrent replay mints just one fresh review', async () => {
    ban();
    ban(P2, D2);
    member(P2, D);
    const select = await createBanReview(env, MOD, 'ban', [D]);
    expect(select.phase).toBe('select');
    expect(select.proposal.banId).toBeNull();
    expect(reviewMessage(select)).toHaveProperty('components');
    const results = await Promise.allSettled([
      selectBanParent(env, MOD, select.nonce, P),
      selectBanParent(env, MOD, select.nonce, P),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const next = results.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<
      Awaited<ReturnType<typeof createBanReview>>
    >;
    expect(next.value.nonce).not.toBe(select.nonce);
    expect(next.value.proposal.banId).toBe(P);
    expect(count('moderation_ban_confirmations')).toBe(2);
    await expect(loadBanReview(env, select.nonce, MOD)).rejects.toThrow();
    expect((await apply(next.value.nonce)).success).toBe(true);
  });
  it('cannot choose an unlisted record or use another actor or revoked moderator at selection', async () => {
    ban();
    ban(P2, D2);
    member(P2, D);
    const review = await createBanReview(env, MOD, 'ban', [D]);
    await expect(selectBanParent(env, MOD, review.nonce, crypto.randomUUID())).rejects.toThrow();
    await expect(selectBanParent(env, MOD2, review.nonce, P)).rejects.toThrow();
    env.MODERATOR_IDS = MOD2;
    await expect(selectBanParent(env, MOD, review.nonce, P)).rejects.toThrow();
    expect(count('moderation_ban_confirmations')).toBe(1);
  });
  it.each([
    'replace-scope',
    'grow-scope',
    'shrink-scope',
    'secondary-parent',
    'remove-parent',
    'sql-expiry',
  ])('failed claim %s performs zero writes and leaves nonce unconsumed', async (race) => {
    ban();
    member(P, D3);
    preset('u', U);
    lookup.mockImplementation(async (input: { id: string }) =>
      input.id === D ? found() : { version: 1, status: 'missing' },
    );
    const review = await createBanReview(env, MOD, 'ban', [D, D2]);
    env.DB = adapter(raw, () => {
      if (race === 'replace-scope') {
        raw.prepare('DELETE FROM ban_identity_memberships WHERE ban_id=?').run(P);
        member(P, U2);
      }
      if (race === 'grow-scope') member(P, U2);
      if (race === 'shrink-scope')
        raw.prepare('DELETE FROM ban_identity_memberships WHERE ban_id=?').run(P);
      if (race === 'secondary-parent') ban(P2, D2);
      if (race === 'remove-parent')
        raw.prepare("UPDATE banned_users SET unbanned_at=datetime('now') WHERE id=?").run(P);
      if (race === 'sql-expiry')
        raw
          .prepare(
            'UPDATE moderation_ban_confirmations SET created_at=unixepoch()-601,expires_at=unixepoch()-1 WHERE nonce=?',
          )
          .run(review.nonce);
    });
    const result = await apply(review.nonce);
    expect(result.success).toBe(false);
    expect(status('u')).toBe('approved');
    expect(count('moderation_log')).toBe(0);
    expect(
      row(
        'SELECT outcome,consumed_at FROM moderation_ban_confirmations WHERE nonce=?',
        review.nonce,
      ),
    ).toMatchObject({ outcome: null, consumed_at: null });
    expect(
      row('SELECT COUNT(*) n FROM ban_identity_memberships WHERE ban_id=? AND identity_id=?', P, U)
        .n,
    ).toBe(0);
  });
  it.each(['revision', 'mapping', 'missing', 'pending', 'error'])(
    'changed or unavailable lookup %s refuses with no mutation',
    async (change) => {
      const review = await createBanReview(env, MOD, 'ban', [D]);
      if (change === 'revision') lookup.mockResolvedValue(found(U, D, 2));
      if (change === 'mapping') lookup.mockResolvedValue(found(U2, D));
      if (change === 'missing') lookup.mockResolvedValue({ version: 1, status: 'missing' });
      if (change === 'pending') lookup.mockResolvedValue({ version: 1, status: 'pending' });
      if (change === 'error') lookup.mockRejectedValue(new Error('private upstream error'));
      expect((await apply(review.nonce)).success).toBe(false);
      expect(count('banned_users')).toBe(0);
      expect(count('moderation_log')).toBe(0);
    },
  );
  it('a new parent appearing after review invalidates new mode inside the claim', async () => {
    const review = await createBanReview(env, MOD, 'ban', [D]);
    env.DB = adapter(raw, () => ban(P2, D));
    expect((await apply(review.nonce)).success).toBe(false);
    expect(count('banned_users')).toBe(1);
    expect(count('moderation_log')).toBe(0);
    expect(
      row('SELECT consumed_at FROM moderation_ban_confirmations WHERE nonce=?', review.nonce)
        .consumed_at,
    ).toBeNull();
  });
  it('two simultaneous executions of one nonce commit exactly one action and audit', async () => {
    const review = await createBanReview(env, MOD, 'ban', [D]);
    const results = await Promise.all([apply(review.nonce), apply(review.nonce)]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(count('banned_users')).toBe(1);
    expect(count('moderation_log')).toBe(2);
  });
  it.each(['short', ' '.repeat(20), 'x'.repeat(501)])(
    'execution itself enforces trimmed reason10..500 (%#)',
    async (reason) => {
      const review = await createBanReview(env, MOD, 'ban', [D]);
      expect((await applyBanReview(env, review.nonce, MOD, 'ban', reason)).success).toBe(false);
      expect(count('banned_users')).toBe(0);
      expect(count('moderation_log')).toBe(0);
    },
  );
  it('missing-to-found change requires a new review', async () => {
    lookup.mockResolvedValueOnce({ version: 1, status: 'missing' });
    const review = await createBanReview(env, MOD, 'ban', [D]);
    expect((await apply(review.nonce)).success).toBe(false);
    expect(count('banned_users')).toBe(0);
  });
  it('forged UUID/target UUID, wrong actor/current moderator and replay never authorize', async () => {
    expect((await apply(U)).success).toBe(false);
    const review = await createBanReview(env, MOD, 'ban', [D]);
    expect((await apply(review.nonce, 'ban', MOD2)).success).toBe(false);
    env.MODERATOR_IDS = MOD2;
    expect((await apply(review.nonce)).success).toBe(false);
    env.MODERATOR_IDS = MOD;
    expect((await apply(review.nonce)).success).toBe(true);
    expect((await apply(review.nonce)).success).toBe(false);
    expect(count('moderation_log')).toBe(2);
  });
  it.each([
    ['extra field', { extra: 'private' }],
    ['wrong version', { v: 2 }],
    ['wrong action', { action: 'approve' }],
    ['wrong mode', { mode: 'merge' }],
    ['mismatched action/mode', { action: 'unban' }],
    ['invalid parent', { banId: 'not-uuid' }],
    ['no inputs', { inputs: [] }],
    ['invalid input', { inputs: ['bad'] }],
    ['too many inputs', { inputs: [D, D2, D3] }],
    ['missing snapshots', { snapshots: [] }],
    ['too many snapshots', { snapshots: [{}, {}, {}] }],
    ['malformed snapshot', { snapshots: [null] }],
    [
      'wrong snapshot input',
      { snapshots: [{ input: U, result: { version: 1, status: 'missing' } }] },
    ],
    [
      'extra snapshot field',
      { snapshots: [{ input: D, result: { version: 1, status: 'missing' }, extra: true }] },
    ],
    ['pending snapshot', { snapshots: [{ input: D, result: { version: 1, status: 'pending' } }] }],
    ['different derived IDs', { ids: [D] }],
    ['no IDs', { ids: [] }],
    ['duplicate IDs', { ids: [D, D] }],
    ['invalid scoped ID', { scope: ['invalid'] }],
    ['oversized scope', { scope: Array(65).fill(D) }],
    ['invalid matched parent', { parentIds: ['invalid'] }],
    ['unlisted candidate', { candidates: [P] }],
    ['new mode cannot capture existing scope', { scope: [D] }],
    ['new mode cannot capture a parent', { parentIds: [P] }],
    ['missing selected parent', { banId: null }],
    ['oversized payload', { extra: 'x'.repeat(24000) }],
  ] as Array<[string, Record<string, unknown>]>)(
    'strict stored proposal rejects %s with zero effects',
    async (_name, patch) => {
      const review = await createBanReview(env, MOD, 'ban', [D]);
      const json = JSON.stringify({ ...review.proposal, ...patch });
      const hash = [
        ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))),
      ]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
      raw
        .prepare(
          'UPDATE moderation_ban_confirmations SET proposal_json=?,proposal_hash=? WHERE nonce=?',
        )
        .run(json, hash, review.nonce);
      expect((await apply(review.nonce)).success).toBe(false);
      expect(count('banned_users')).toBe(0);
      expect(count('moderation_log')).toBe(0);
    },
  );
  it('tampered payload/hash fails closed', async () => {
    const review = await createBanReview(env, MOD, 'ban', [D]);
    raw
      .prepare('UPDATE moderation_ban_confirmations SET proposal_hash=? WHERE nonce=?')
      .run('f'.repeat(64), review.nonce);
    expect((await apply(review.nonce)).success).toBe(false);
    expect(count('banned_users')).toBe(0);
  });
  it('SQL cap refuses scope growth after review and captured 65-ID proposal is never truncated', async () => {
    ban();
    for (let i = 0; i < 63; i++) member(P, String(400000000000000000n + BigInt(i)));
    await expect(createBanReview(env, MOD, 'ban', [D])).rejects.toThrow();
    expect(count('moderation_ban_confirmations')).toBe(0);
  });
  it('over16 active matched parents refuses rather than truncates or exceeds native choices', async () => {
    for (let i = 0; i < 17; i++) {
      const id = crypto.randomUUID();
      ban(id, String(400000000000000000n + BigInt(i)));
      member(id, D);
    }
    await expect(createBanReview(env, MOD, 'ban', [D])).rejects.toThrow();
    expect(count('moderation_ban_confirmations')).toBe(0);
  });
  it.each(['ban', 'unban'] as const)(
    'audit failure rolls entire %s claim and dependent writes back',
    async (action) => {
      if (action === 'unban') {
        ban();
        member(P, U);
        preset('u', U, 'hidden');
      } else preset('u', U);
      const review = await createBanReview(env, MOD, action, [D]);
      raw.exec(
        "CREATE TRIGGER fail_audit BEFORE INSERT ON moderation_log BEGIN SELECT RAISE(ABORT,'private audit failure'); END;",
      );
      const result = await apply(review.nonce, action);
      expect(result.success).toBe(false);
      expect(count('moderation_log')).toBe(0);
      expect(status('u')).toBe(action === 'ban' ? 'approved' : 'hidden');
      expect(
        row(
          'SELECT consumed_at,outcome FROM moderation_ban_confirmations WHERE nonce=?',
          review.nonce,
        ),
      ).toMatchObject({ consumed_at: null, outcome: null });
      expect(count('banned_users')).toBe(action === 'ban' ? 0 : 1);
      if (action === 'unban')
        expect(row('SELECT unbanned_at FROM banned_users WHERE id=?', P).unbanned_at).toBeNull();
    },
  );
  it('unban uses recorded scope without OAuth, scrubs only selected parent and retains memberships', async () => {
    ban();
    member(P, U);
    ban(P2, D2);
    member(P2, U);
    preset('d', D, 'hidden');
    preset('u', U, 'hidden');
    lookup.mockRejectedValue(new Error('must not call'));
    const review = await createBanReview(env, MOD, 'unban', [D]);
    expect(await apply(review.nonce, 'unban')).toMatchObject({
      success: true,
      presetsRestored: 1,
      presetsStillHidden: 1,
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(status('d')).toBe('approved');
    expect(status('u')).toBe('hidden');
    expect(row('SELECT username,reason FROM banned_users WHERE id=?', P)).toMatchObject({
      username: '',
      reason: '',
    });
    expect(row('SELECT unbanned_at FROM banned_users WHERE id=?', P2).unbanned_at).toBeNull();
    expect(count('ban_identity_memberships')).toBe(2);
  });
  it('restores lowest eligible cross-author twin; lower still-banned and outside-scope twins cannot block', async () => {
    ban();
    member(P, U);
    member(P, D3);
    ban(P2, D2);
    member(P2, D);
    preset('a-ineligible', D, 'hidden', 'same');
    preset('b-outside', D2, 'hidden', 'same');
    preset('c-winner', U, 'hidden', 'same');
    preset('d-loser', D3, 'hidden', 'same');
    const review = await createBanReview(env, MOD, 'unban', [U]);
    const result = await apply(review.nonce, 'unban');
    expect(result).toMatchObject({ success: true, presetsRestored: 1, presetsStillHidden: 2 });
    expect([
      status('a-ineligible'),
      status('b-outside'),
      status('c-winner'),
      status('d-loser'),
    ]).toEqual(['hidden', 'hidden', 'approved', 'hidden']);
    expect(
      raw.prepare("SELECT preset_id FROM moderation_log WHERE action='restore'").all(),
    ).toEqual([{ preset_id: 'c-winner' }]);
  });
  it('approved and pending signature collisions stay hidden and null signatures can both restore', async () => {
    ban();
    member(P, U);
    preset('old', D, 'hidden', 'occupied');
    preset('active', D2, 'pending', 'occupied');
    preset('null-d', D, 'hidden', null);
    preset('null-u', U, 'hidden', null);
    const review = await createBanReview(env, MOD, 'unban', [D]);
    expect(await apply(review.nonce, 'unban')).toMatchObject({
      success: true,
      presetsRestored: 2,
      presetsStillHidden: 1,
    });
    expect(status('old')).toBe('hidden');
  });
  it('inactive creation/load/execution/selection do no OAuth or storage access', async () => {
    env.LINKED_BAN_CONFIRMATION_ENABLED = 'false';
    env.DB = {
      prepare: vi.fn(() => {
        throw new Error('storage touched');
      }),
    } as unknown as D1Database;
    await expect(createBanReview(env, MOD, 'ban', [D])).rejects.toThrow();
    await expect(createBanReview(env, MOD, 'unban', [D])).rejects.toThrow();
    await expect(selectBanParent(env, MOD, U, P)).rejects.toThrow();
    expect((await apply(U)).success).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
    expect(env.DB.prepare).not.toHaveBeenCalled();
  });
});
