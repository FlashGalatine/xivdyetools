import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

const schema = readFileSync(
  fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()),
  'utf8',
);
const owner = 'f46d94d5-b206-4010-b45f-4c0806639145';
const snapshot = JSON.stringify({
  name: 'Original',
  description: 'Original description',
  dyes: [4, 5, 6],
  tags: ['original'],
});

describe('moderation author ban at the database write', () => {
  let d1: SqliteD1;
  let env: Env;
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  beforeEach(async () => {
    d1 = new SqliteD1(schema);
    env = createMockEnv({ DB: d1 as unknown as D1Database });
    app = new Hono();
    app.use('*', authMiddleware);
    app.route('/api/v1/moderation', moderationRouter);
    await d1
      .prepare(
        `INSERT INTO presets (id,name,description,category_id,dyes,tags,status,author_discord_id,previous_values)
      VALUES ('p','Edited','Edited description','jobs','[1,2,3]','[]','flagged',?,?)`,
      )
      .bind(owner, snapshot)
      .run();
  });
  afterEach(() => d1.close());
  async function ban(
    column: 'discord_id' | 'xivauth_id',
    identity = owner,
    lifted: string | null = null,
  ) {
    await d1
      .prepare(
        `INSERT INTO banned_users (id,${column},username,moderator_discord_id,reason,unbanned_at)
      VALUES ('ban',?,'Owner','123456789','Ban reason',?)`,
      )
      .bind(identity, lifted)
      .run();
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
  async function stored() {
    return d1
      .prepare("SELECT name,status,previous_values,content_revision FROM presets WHERE id='p'")
      .first();
  }
  async function auditCount() {
    return (await d1.prepare('SELECT COUNT(*) AS n FROM moderation_log').first<{ n: number }>())!.n;
  }
  for (const action of ['status', 'revert'] as const) {
    it(`${action} also blocks an active Discord snowflake author`, async () => {
      await d1.prepare("UPDATE presets SET author_discord_id = '246813579' WHERE id='p'").run();
      await ban('discord_id', '246813579');
      const before = await stored();
      expect((await request(action, 'approved', 1)).status).toBe(409);
      expect(await stored()).toEqual(before);
      expect(await auditCount()).toBe(0);
    });
    it.each(['discord_id', 'xivauth_id'] as const)(
      `${action} blocks active %s ban with no update or audit`,
      async (column) => {
        await ban(column);
        const before = await stored();
        const response = await request(action);
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ code: 'STALE_REVIEW' });
        expect(await stored()).toEqual(before);
        expect(await auditCount()).toBe(0);
      },
    );
    it.each(['lifted', 'unrelated'])(`${action} allows %s ban`, async (kind) => {
      await ban(
        'discord_id',
        kind === 'unrelated' ? 'someone-else' : owner,
        kind === 'lifted' ? '2026-10-26' : null,
      );
      expect((await request(action)).status).toBe(200);
      expect(await stored()).toMatchObject({ status: 'approved' });
      expect(await auditCount()).toBe(1);
    });
    it(`${action} sees a ban committed after the initial read before the atomic batch`, async () => {
      const original = d1.batch.bind(d1);
      d1.batch = async (statements) => {
        await ban('xivauth_id');
        d1.batch = original;
        return original(statements);
      };
      expect((await request(action)).status).toBe(409);
      expect(await stored()).toMatchObject({
        status: 'flagged',
        previous_values: snapshot,
        content_revision: 0,
      });
      expect(await auditCount()).toBe(0);
    });
    it(`${action} rolls back its update when audit insertion fails`, async () => {
      d1.database.exec(
        "CREATE TRIGGER fail_audit BEFORE INSERT ON moderation_log BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END;",
      );
      const before = await stored();
      expect((await request(action)).status).toBe(500);
      expect(await stored()).toEqual(before);
      expect(await auditCount()).toBe(0);
    });
  }
  it.each(['rejected', 'flagged', 'pending'])(
    'allows %s action on actively banned author',
    async (status) => {
      await ban('discord_id');
      expect((await request('status', status)).status).toBe(200);
      expect(await stored()).toMatchObject({ status });
      expect(await auditCount()).toBe(1);
    },
  );
});
