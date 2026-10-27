import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { createD1Runtime } from '../d1-runtime';

const snapshot = JSON.stringify({
  name: 'Original',
  description: 'Original description',
  dyes: [4, 5, 6],
  tags: ['original'],
});
const owner = 'f46d94d5-b206-4010-b45f-4c0806639145';

describe('moderation ban and audit on real local D1', () => {
  let runtime: Awaited<ReturnType<typeof createD1Runtime>>;
  let db: D1Database;
  let env: Env;
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  beforeAll(async () => {
    runtime = await createD1Runtime();
    db = runtime.db;
  }, 30000);
  afterAll(async () => {
    await runtime?.dispose();
  });
  beforeEach(async () => {
    await db.batch([
      db.prepare('DELETE FROM moderation_log'),
      db.prepare('DELETE FROM presets'),
      db.prepare('DELETE FROM banned_users'),
    ]);
    env = createMockEnv({ DB: db });
    app = new Hono();
    app.use('*', authMiddleware);
    app.route('/api/v1/moderation', moderationRouter);
    await db
      .prepare(
        `INSERT INTO presets (id,name,description,category_id,dyes,tags,status,author_discord_id,previous_values)
      VALUES ('p','Edited','Edited description','jobs','[1,2,3]','[]','flagged',?,?)`,
      )
      .bind(owner, snapshot)
      .run();
  });
  async function ban(
    column: 'discord_id' | 'xivauth_id',
    identity = owner,
    lifted: string | null = null,
  ) {
    await db
      .prepare(
        `INSERT INTO banned_users (id,${column},username,moderator_discord_id,reason,unbanned_at)
      VALUES ('ban',?,'Owner','123456789','Ban reason',?)`,
      )
      .bind(identity, lifted)
      .run();
  }
  async function state() {
    return {
      row: await db
        .prepare("SELECT name,status,previous_values,content_revision FROM presets WHERE id='p'")
        .first(),
      audit: (await db.prepare('SELECT COUNT(*) AS n FROM moderation_log').first<{ n: number }>())!
        .n,
    };
  }
  function request(action: 'status' | 'revert', status = 'approved', revision = 0) {
    return app.request(
      `/api/v1/moderation/p/${action}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer test-bot-secret',
          'X-User-Discord-ID': '123456789',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          reason: 'A sufficient moderation reason',
          expected_revision: revision,
          expected_status: 'flagged',
        }),
      },
      env,
    );
  }
  for (const action of ['status', 'revert'] as const) {
    it(`${action} blocks an active Discord snowflake author`, async () => {
      await db.prepare("UPDATE presets SET author_discord_id='246813579' WHERE id='p'").run();
      await ban('discord_id', '246813579');
      const before = await state();
      expect((await request(action, 'approved', 1)).status).toBe(409);
      expect(await state()).toEqual(before);
      expect(before.audit).toBe(0);
    });
    it.each(['discord_id', 'xivauth_id'] as const)(
      `${action} blocks active %s with zero audit`,
      async (column) => {
        await ban(column);
        const before = await state();
        expect((await request(action)).status).toBe(409);
        expect(await state()).toEqual(before);
        expect(before.audit).toBe(0);
      },
    );
    it(`${action} refuses a ban committed between initial read and the D1 batch`, async () => {
      const original = db.batch.bind(db);
      env.DB = {
        prepare: db.prepare.bind(db),
        batch: async (statements: D1PreparedStatement[]) => {
          await ban('xivauth_id');
          return original(statements);
        },
      } as D1Database;
      expect((await request(action)).status).toBe(409);
      expect(await state()).toEqual({
        row: { name: 'Edited', status: 'flagged', previous_values: snapshot, content_revision: 0 },
        audit: 0,
      });
    });
    it.each(['lifted', 'unrelated'])(
      `${action} accepts %s ban with one audit in its atomic batch`,
      async (kind) => {
        await ban(
          'discord_id',
          kind === 'unrelated' ? 'someone-else' : owner,
          kind === 'lifted' ? '2026-10-26' : null,
        );
        expect((await request(action)).status).toBe(200);
        expect(await state()).toMatchObject({
          row: { status: 'approved', content_revision: 1 },
          audit: 1,
        });
      },
    );
    it(`${action} rolls back the write if its audit statement fails`, async () => {
      await db
        .prepare(
          "CREATE TRIGGER fail_audit BEFORE INSERT ON moderation_log BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
        )
        .run();
      try {
        const before = await state();
        expect((await request(action)).status).toBe(500);
        expect(await state()).toEqual(before);
      } finally {
        await db.prepare('DROP TRIGGER fail_audit').run();
      }
    });
  }
  it.each(['rejected', 'flagged', 'pending'])(
    'preserves %s action for banned authors',
    async (status) => {
      await ban('discord_id');
      expect((await request('status', status)).status).toBe(200);
      expect(await state()).toMatchObject({ row: { status }, audit: 1 });
    },
  );
});
