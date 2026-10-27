import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authMiddleware } from '../../src/middleware/auth';
import { requireNotBanned } from '../../src/middleware/ban-check';
import { presetsRouter } from '../../src/handlers/presets';
import { moderationRouter } from '../../src/handlers/moderation';
import { rekeyIdentity } from '../../src/services/identity-rekey-service';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv, createTestJWT } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

const schema = readFileSync(
  fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()),
  'utf8',
);
const U = '0b8a1c52-4d6e-4f43-9a55-1f0f6a7c9e21';
const D = '123456789012345678';
const other = 'unrelated';
const previous = JSON.stringify({
  name: 'Previous',
  description: 'Previous description',
  dyes: [4, 5, 6],
  tags: [],
});

describe('particular-ban membership enforced in every presets write guard', () => {
  let d1: SqliteD1;
  let env: Env;
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  beforeEach(async () => {
    d1 = new SqliteD1(schema);
    env = createMockEnv({ DB: d1 as unknown as D1Database });
    app = new Hono();
    app.use('*', authMiddleware);
    app.post('/guarded', requireNotBanned, (c) => c.json({ ok: true }));
    app.route('/api/v1/presets', presetsRouter);
    app.route('/api/v1/moderation', moderationRouter);
    await d1.batch([
      d1
        .prepare(
          `INSERT INTO presets (id,name,description,category_id,dyes,tags,status,author_discord_id,vote_count,dye_signature,previous_values)
        VALUES ('owner','Edited','Edited description','jobs','[1,2,3]','[]','flagged',?,0,'owner',?)`,
        )
        .bind(U, previous),
      d1.prepare(`INSERT INTO presets (id,name,description,category_id,dyes,tags,status,author_discord_id,vote_count,dye_signature)
        VALUES ('collision','Collision','A description','jobs','[1,2,3]','[]','approved','other',2,'collision'),
        ('unique','Unique','A description','jobs','[1,2,3]','[]','approved','other',1,'unique')`),
      d1
        .prepare(
          "INSERT INTO votes (preset_id,user_discord_id) VALUES ('collision',?),('collision',?),('unique',?)",
        )
        .bind(U, D, U),
      d1
        .prepare("INSERT INTO submission_events (user_discord_id,kind) VALUES (?,'submission')")
        .bind(U),
    ]);
  });
  afterEach(() => d1.close());
  async function membership(identity: string, lifted = false) {
    await d1.batch([
      d1
        .prepare(
          `INSERT INTO banned_users (id,discord_id,username,moderator_discord_id,reason,unbanned_at)
        VALUES ('parent','a-different-legacy-id','User','mod','A sufficient reason',?)`,
        )
        .bind(lifted ? '2026-10-01' : null),
      d1
        .prepare(
          "INSERT INTO ban_identity_memberships (ban_id,identity_id,source) VALUES ('parent',?,'continuity')",
        )
        .bind(identity),
    ]);
  }
  function snapshot() {
    return {
      presets: d1.database.prepare('SELECT * FROM presets ORDER BY id').all(),
      votes: d1.database.prepare('SELECT * FROM votes ORDER BY preset_id,user_discord_id').all(),
      events: d1.database.prepare('SELECT * FROM submission_events ORDER BY id').all(),
      audit: d1.database.prepare('SELECT * FROM moderation_log ORDER BY id').all(),
    };
  }
  async function web(path: string, claims: Record<string, unknown> = {}) {
    const token = await createTestJWT(env.JWT_SECRET!, {
      sub: U,
      username: 'User',
      discord_id: D,
      ...claims,
    } as Parameters<typeof createTestJWT>[1]);
    return app.request(
      path,
      {
        method: path === '/guarded' ? 'POST' : 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      },
      env,
    );
  }
  for (const identity of [U, D]) {
    it(`middleware blocks a member-only ban proved by JWT id ${identity}`, async () => {
      await membership(identity);
      expect((await web('/guarded')).status).toBe(403);
    });
    it(`all five rekey statements preserve their rows for member-only ${identity}`, async () => {
      await membership(identity);
      const before = snapshot();
      expect(await rekeyIdentity(env.DB, U, D)).toBe(false);
      expect(snapshot()).toEqual(before);
    });
    it(`membership committed between route ban read and rekey batch preserves all five effects (${identity})`, async () => {
      const original = d1.batch.bind(d1);
      const before = snapshot();
      let raced = false;
      d1.batch = async (statements) => {
        raced = true;
        d1.batch = original;
        await membership(identity);
        return original(statements);
      };
      const response = await web('/api/v1/presets/refresh-author');
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ rekeyed: false });
      expect(raced).toBe(true);
      expect(snapshot()).toEqual(before);
    });
  }
  it('bot middleware blocks its acting member-only identity', async () => {
    await membership(D);
    expect(
      (
        await app.request(
          '/guarded',
          {
            method: 'POST',
            headers: { Authorization: 'Bearer test-bot-secret', 'X-User-Discord-ID': D },
          },
          env,
        )
      ).status,
    ).toBe(403);
  });
  it.each(['lifted', 'unrelated'] as const)(
    'allows %s membership and preserves deduplication and quota transfer',
    async (kind) => {
      await membership(kind === 'unrelated' ? other : U, kind === 'lifted');
      expect((await web('/guarded')).status).toBe(200);
      expect(await rekeyIdentity(env.DB, U, D)).toBe(true);
      const after = snapshot();
      expect(after.presets.find((row) => row.id === 'owner')).toMatchObject({
        author_discord_id: D,
      });
      expect(after.presets.find((row) => row.id === 'collision')).toMatchObject({ vote_count: 1 });
      expect(after.presets.find((row) => row.id === 'unique')).toMatchObject({ vote_count: 1 });
      expect(after.votes.map((row) => [row.preset_id, row.user_discord_id])).toEqual([
        ['collision', D],
        ['unique', D],
      ]);
      expect(after.events).toHaveLength(1);
      expect(after.events[0]).toMatchObject({ user_discord_id: D });
    },
  );
  it.each(['stale', 'missing', 'pending', 'throw'] as const)(
    'session %s denies the real rekey route before changing any owner/vote/quota',
    async (status) => {
      env.OAUTH_SESSION_CHECK_ENABLED = 'true';
      const calls: unknown[] = [];
      env.OAUTH_IDENTITY = {
        validateSession: async (request) => {
          calls.push(request);
          if (status === 'throw') throw new Error('provider unavailable');
          return { version: 1, status };
        },
      };
      const before = snapshot();
      expect(
        (
          await web('/api/v1/presets/refresh-author', {
            auth_provider: 'discord',
            identity_revision: 3,
          })
        ).status,
      ).toBe(status === 'stale' || status === 'missing' ? 401 : 503);
      expect(calls).toHaveLength(1);
      expect(snapshot()).toEqual(before);
    },
  );
  it('current session permits real rekey only from its signed sub to its signed Discord ID', async () => {
    env.OAUTH_SESSION_CHECK_ENABLED = 'true';
    env.OAUTH_IDENTITY = { validateSession: async () => ({ version: 1, status: 'valid' }) };
    const response = await web('/api/v1/presets/refresh-author', {
      auth_provider: 'discord',
      identity_revision: 3,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ rekeyed: true });
    expect(snapshot().presets.find((row) => row.id === 'owner')).toMatchObject({
      author_discord_id: D,
    });
  });
  it('stale moderator session cannot reach the real moderation write or audit', async () => {
    env.OAUTH_SESSION_CHECK_ENABLED = 'true';
    env.MODERATOR_IDS = D;
    env.OAUTH_IDENTITY = { validateSession: async () => ({ version: 1, status: 'stale' }) };
    const before = snapshot();
    expect(
      (
        await web('/api/v1/moderation/owner/status', {
          auth_provider: 'discord',
          identity_revision: 3,
        })
      ).status,
    ).toBe(401);
    expect(snapshot()).toEqual(before);
    expect(snapshot().audit).toHaveLength(0);
  });
  function moderate(action: 'status' | 'revert', revision = 0, status = 'flagged') {
    return app.request(
      `/api/v1/moderation/owner/${action}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-bot-secret',
          'X-User-Discord-ID': '123456789',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'approved',
          reason: 'A sufficient moderation reason',
          expected_revision: revision,
          expected_status: status,
        }),
      },
      env,
    );
  }
  async function liftedOwnerAndSeparateActiveParent() {
    await membership(U, true);
    await d1.batch([
      d1.prepare(`INSERT INTO banned_users (id,discord_id,username,moderator_discord_id,reason)
        VALUES ('independent','independent-legacy-id','User','mod','A sufficient reason')`),
      d1.prepare(
        "INSERT INTO ban_identity_memberships (ban_id,identity_id,source) VALUES ('independent','unrelated','confirmed')",
      ),
    ]);
  }
  it('middleware and rekey do not borrow lifted memberships from a different active parent', async () => {
    await liftedOwnerAndSeparateActiveParent();
    expect((await web('/guarded')).status).toBe(200);
    expect(await rekeyIdentity(env.DB, U, D)).toBe(true);
  });
  for (const action of ['status', 'revert'] as const) {
    it(`${action} does not borrow lifted memberships from a different active parent`, async () => {
      await liftedOwnerAndSeparateActiveParent();
      expect((await moderate(action)).status).toBe(200);
      expect(snapshot().audit).toHaveLength(1);
    });
    it(`${action} refuses member-only author with no source or audit change`, async () => {
      await membership(U);
      const before = snapshot();
      const response = await moderate(action);
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'STALE_REVIEW' });
      expect(snapshot()).toEqual(before);
    });
    it(`${action} sees member-only ban committed between read and atomic update`, async () => {
      const original = d1.batch.bind(d1);
      const before = snapshot();
      d1.batch = async (statements) => {
        d1.batch = original;
        await membership(U);
        return original(statements);
      };
      expect((await moderate(action)).status).toBe(409);
      expect(snapshot()).toEqual(before);
      expect(snapshot().audit).toHaveLength(0);
    });
    it.each(['lifted', 'unrelated'] as const)(
      `${action} allows %s membership with exactly one audit`,
      async (kind) => {
        await membership(kind === 'unrelated' ? other : U, kind === 'lifted');
        expect((await moderate(action)).status).toBe(200);
        expect(snapshot().presets.find((row) => row.id === 'owner')).toMatchObject({
          status: 'approved',
          content_revision: 1,
        });
        expect(snapshot().audit).toHaveLength(1);
      },
    );
    it.each(['revision', 'status'] as const)(
      `${action} preserves the existing %s review guard`,
      async (guard) => {
        const before = snapshot();
        expect(
          (
            await moderate(
              action,
              guard === 'revision' ? 1 : 0,
              guard === 'status' ? 'pending' : 'flagged',
            )
          ).status,
        ).toBe(409);
        expect(snapshot()).toEqual(before);
      },
    );
  }
});
