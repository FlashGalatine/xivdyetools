import { Hono } from 'hono';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import { presetsRouter } from '../../src/handlers/presets';
import { rekeyIdentity } from '../../src/services/identity-rekey-service';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv, createTestJWT } from '../test-utils';

const snapshot = JSON.stringify({
  name: 'Original',
  description: 'Original description',
  dyes: [4, 5, 6],
  tags: ['original'],
});
const owner = 'f46d94d5-b206-4010-b45f-4c0806639145';

describe('moderation ban and audit on real local D1', () => {
  let runtime: Awaited<ReturnType<typeof import('../d1-runtime').createD1Runtime>>;
  const savedEnvironment = new Map<string, string | undefined>();
  let db: D1Database;
  let env: Env;
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  beforeAll(async () => {
    const root = fileURLToPath(
      new URL(
        `../../../../.superpowers/sdd/REMEDIATION_PLAN/stream-2-runtime-${process.pid}`,
        import.meta.url,
      ).toString(),
    );
    mkdirSync(root, { recursive: true });
    for (const [key, value] of Object.entries({
      USERPROFILE: root,
      APPDATA: resolve(root, 'roaming'),
      LOCALAPPDATA: resolve(root, 'local'),
      XDG_CONFIG_HOME: resolve(root, 'config'),
      XDG_CACHE_HOME: resolve(root, 'cache'),
      WRANGLER_LOG_PATH: resolve(root, 'logs'),
      WRANGLER_SEND_METRICS: 'false',
      CLOUDFLARE_API_TOKEN: 'fake-local-test-token',
      CLOUDFLARE_ACCOUNT_ID: '00000000000000000000000000000000',
    })) {
      savedEnvironment.set(key, process.env[key]);
      process.env[key] = value;
    }
    // Import only after local runtime configuration is isolated from the user's profile.
    const { createD1Runtime } = await import('../d1-runtime');
    runtime = await createD1Runtime();
    db = runtime.db;
  }, 30000);
  afterAll(async () => {
    try {
      await runtime?.dispose();
    } finally {
      for (const [key, value] of savedEnvironment) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
  beforeEach(async () => {
    await db.batch([
      db.prepare('DELETE FROM moderation_log'),
      db.prepare('DELETE FROM submission_events'),
      db.prepare('DELETE FROM presets'),
      db.prepare('DELETE FROM banned_users'),
    ]);
    env = createMockEnv({ DB: db });
    app = new Hono();
    app.use('*', authMiddleware);
    app.route('/api/v1/moderation', moderationRouter);
    app.route('/api/v1/presets', presetsRouter);
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
  async function memberBan(identity = owner, lifted = false) {
    await ban('discord_id', 'a-different-legacy-id', lifted ? '2026-10-01' : null);
    await db
      .prepare(
        "INSERT INTO ban_identity_memberships (ban_id,identity_id,source) VALUES ('ban',?,'continuity')",
      )
      .bind(identity)
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
  for (const action of ['status', 'revert'] as const) {
    it(`${action} blocks member-only author with zero audit in local workerd`, async () => {
      await memberBan();
      const before = await state();
      expect((await request(action)).status).toBe(409);
      expect(await state()).toEqual(before);
      expect(before.audit).toBe(0);
    });
    it(`${action} refuses member-only ban committed between read and batch in local workerd`, async () => {
      const original = db.batch.bind(db);
      const before = await state();
      env.DB = {
        prepare: db.prepare.bind(db),
        batch: async (statements: D1PreparedStatement[]) => {
          await memberBan();
          return original(statements);
        },
      } as D1Database;
      expect((await request(action)).status).toBe(409);
      expect(await state()).toEqual(before);
      expect(before.audit).toBe(0);
    });
    it.each(['lifted', 'unrelated'] as const)(
      `${action} permits %s member parent in local workerd`,
      async (kind) => {
        await memberBan(kind === 'unrelated' ? 'someone-else' : owner, kind === 'lifted');
        expect((await request(action)).status).toBe(200);
        expect(await state()).toMatchObject({
          row: { status: 'approved', content_revision: 1 },
          audit: 1,
        });
      },
    );
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

  describe('five-statement rekey guards in local workerd D1', () => {
    const destination = '123456789012345678';
    beforeEach(async () => {
      await db.batch([
        db.prepare("UPDATE presets SET vote_count=2 WHERE id='p'"),
        db.prepare(`INSERT INTO presets (id,name,description,category_id,dyes,tags,status,author_discord_id,vote_count)
          VALUES ('unique','Other','A description','jobs','[1,2,3]','[]','approved','other',1)`),
        db
          .prepare(
            "INSERT INTO votes (preset_id,user_discord_id) VALUES ('p',?),('p',?),('unique',?)",
          )
          .bind(owner, destination, owner),
        db
          .prepare("INSERT INTO submission_events (user_discord_id,kind) VALUES (?,'submission')")
          .bind(owner),
      ]);
    });
    async function allRows() {
      return {
        presets: (await db.prepare('SELECT * FROM presets ORDER BY id').all()).results,
        votes: (await db.prepare('SELECT * FROM votes ORDER BY preset_id,user_discord_id').all())
          .results,
        events: (await db.prepare('SELECT * FROM submission_events ORDER BY id').all()).results,
      };
    }
    for (const identity of [owner, destination]) {
      it(`preserves presets, unique votes, duplicate counts/deletes and quota under member-only ${identity}`, async () => {
        await memberBan(identity);
        const before = await allRows();
        expect(await rekeyIdentity(db, owner, destination)).toBe(false);
        expect(await allRows()).toEqual(before);
      });
      it(`route read-to-batch member-only race on ${identity} preserves all effects`, async () => {
        const original = db.batch.bind(db);
        const before = await allRows();
        env.DB = {
          prepare: db.prepare.bind(db),
          batch: async (statements: D1PreparedStatement[]) => {
            await memberBan(identity);
            return original(statements);
          },
        } as D1Database;
        const token = await createTestJWT(env.JWT_SECRET!, {
          sub: owner,
          username: 'User',
          discord_id: destination,
        } as Parameters<typeof createTestJWT>[1]);
        const response = await app.request(
          '/api/v1/presets/refresh-author',
          { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } },
          env,
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ rekeyed: false });
        expect(await allRows()).toEqual(before);
      });
    }
    it.each(['lifted', 'unrelated'] as const)(
      'allows %s membership with correct dedup/count/quota in local workerd',
      async (kind) => {
        await memberBan(kind === 'unrelated' ? 'someone-else' : owner, kind === 'lifted');
        expect(await rekeyIdentity(db, owner, destination)).toBe(true);
        const after = await allRows();
        expect(after.presets.find((row) => row.id === 'p')).toMatchObject({
          author_discord_id: destination,
          vote_count: 1,
          content_revision: 1,
        });
        expect(after.presets.find((row) => row.id === 'unique')).toMatchObject({ vote_count: 1 });
        expect(after.votes.map((row) => [row.preset_id, row.user_discord_id])).toEqual([
          ['p', destination],
          ['unique', destination],
        ]);
        expect(after.events).toHaveLength(1);
        expect(after.events[0]).toMatchObject({ user_discord_id: destination });
      },
    );
    it('rolls back earlier rekey statements when quota transfer fails', async () => {
      await db
        .prepare(
          "CREATE TRIGGER fail_rekey BEFORE UPDATE ON submission_events BEGIN SELECT RAISE(ABORT, 'quota unavailable'); END",
        )
        .run();
      try {
        const before = await allRows();
        await expect(rekeyIdentity(db, owner, destination)).rejects.toThrow();
        expect(await allRows()).toEqual(before);
      } finally {
        await db.prepare('DROP TRIGGER fail_rekey').run();
      }
    });
  });
});
