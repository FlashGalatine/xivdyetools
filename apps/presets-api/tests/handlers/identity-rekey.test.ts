/**
 * FINDING-014 (2026-10-03 audit): a ban must follow the person across the
 * XIVAuth -> Discord link, and their UUID-keyed rows must follow them too —
 * unless they are banned, in which case nothing moves.
 *
 * Runs against a real SQLite database built from schema.sql, so the votes
 * primary key, the vote_count column and the ban query are exercised for real.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { presetsRouter } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import { requireNotBanned } from '../../src/middleware/ban-check';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv, createTestJWT } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

type Variables = { auth: AuthContext };

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const SECRET = 'test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!';
const UUID = '0b8a1c52-4d6e-4f43-9a55-1f0f6a7c9e21';
const SNOWFLAKE = '123456789012345678';

describe('identity re-key and cross-identity ban (FINDING-014)', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let d1: SqliteD1;
  let env: Env;

  beforeEach(() => {
    d1 = new SqliteD1(schema);
    env = createMockEnv({ DB: d1 as unknown as D1Database });
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.route('/api/v1/presets', presetsRouter);
    app.post('/guarded', requireNotBanned, (c) => c.json({ ok: true }));
  });

  afterEach(() => {
    d1.close();
  });

  async function jwt(claims: Record<string, unknown>): Promise<string> {
    return createTestJWT(
      SECRET,
      { sub: UUID, username: 'tester', global_name: 'Tester', ...claims } as Parameters<typeof createTestJWT>[1]
    );
  }

  async function seedPreset(id: string, author: string, voteCount = 0): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO presets (
          id, name, description, category_id, dyes, tags, author_discord_id, author_name,
          status, dye_signature, vote_count
        ) VALUES (?, 'Name ' || ?, 'A valid description', 'jobs', '[1,2,3]',
          '["tag"]', ?, 'Old Name', 'approved', ?, ?)`
      )
      .bind(id, id, author, id, voteCount)
      .run();
  }

  async function seedVote(presetId: string, userId: string): Promise<void> {
    await d1.prepare('INSERT INTO votes (preset_id, user_discord_id) VALUES (?, ?)').bind(presetId, userId).run();
  }

  async function seedEvent(userId: string): Promise<void> {
    await d1
      .prepare("INSERT INTO submission_events (user_discord_id, kind) VALUES (?, 'submission')")
      .bind(userId)
      .run();
  }

  async function ban(column: 'discord_id' | 'xivauth_id', value: string, unbanned = false): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO banned_users (id, ${column}, username, moderator_discord_id, reason, unbanned_at)
         VALUES (?, ?, 'tester', 'mod-1', 'a reason that is long enough', ?)`
      )
      .bind(`ban-${column}-${value}`, value, unbanned ? '2026-10-01 00:00:00' : null)
      .run();
  }

  async function snapshot() {
    const q = async <T>(sql: string): Promise<T[]> =>
      (await d1.prepare(sql).all<T>()).results;
    return {
      presets: await q<{ id: string; author_discord_id: string; author_name: string; vote_count: number }>(
        'SELECT id, author_discord_id, author_name, vote_count FROM presets ORDER BY id'
      ),
      votes: await q<{ preset_id: string; user_discord_id: string }>(
        'SELECT preset_id, user_discord_id FROM votes ORDER BY preset_id, user_discord_id'
      ),
      events: await q<{ user_discord_id: string }>('SELECT user_discord_id FROM submission_events ORDER BY id'),
    };
  }

  async function refresh(claims: Record<string, unknown>): Promise<Response> {
    return Promise.resolve(
      app.request(
        '/api/v1/presets/refresh-author',
        { method: 'PATCH', headers: { Authorization: `Bearer ${await jwt(claims)}` } },
        env
      )
    );
  }

  async function guarded(claims: Record<string, unknown>): Promise<Response> {
    return Promise.resolve(
      app.request(
        '/guarded',
        { method: 'POST', headers: { Authorization: `Bearer ${await jwt(claims)}` } },
        env
      )
    );
  }

  describe('ban check', () => {
    it('refuses a JWT whose sub was banned before Discord was linked (discord_id column holds the UUID)', async () => {
      await ban('discord_id', UUID);

      const res = await guarded({ discord_id: SNOWFLAKE });

      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe('USER_BANNED');
    });

    it('also matches a ban written into xivauth_id', async () => {
      await ban('xivauth_id', UUID);

      expect((await guarded({ discord_id: SNOWFLAKE })).status).toBe(403);
      expect((await guarded({})).status).toBe(403);
    });

    it('matches a ban on the snowflake for a token that carries both ids', async () => {
      await ban('discord_id', SNOWFLAKE);

      expect((await guarded({ discord_id: SNOWFLAKE })).status).toBe(403);
    });

    it('ignores lifted bans and other people', async () => {
      await ban('discord_id', UUID, true);
      await ban('xivauth_id', 'someone-else');

      expect((await guarded({ discord_id: SNOWFLAKE })).status).toBe(200);
    });
  });

  describe('PATCH /refresh-author re-key', () => {
    it('moves presets, votes and submission_events from the sub to the snowflake', async () => {
      await seedPreset('p1', UUID);
      await seedPreset('p2', 'other', 1);
      await seedVote('p2', UUID);
      await seedEvent(UUID);

      const res = await refresh({ discord_id: SNOWFLAKE });

      expect(res.status).toBe(200);
      expect(((await res.json()) as { rekeyed: boolean }).rekeyed).toBe(true);
      const after = await snapshot();
      expect(after.presets.find((p) => p.id === 'p1')).toMatchObject({
        author_discord_id: SNOWFLAKE,
        author_name: 'Tester',
      });
      expect(after.presets.find((p) => p.id === 'p2')?.vote_count).toBe(1);
      expect(after.votes).toEqual([{ preset_id: 'p2', user_discord_id: SNOWFLAKE }]);
      expect(after.events).toEqual([{ user_discord_id: SNOWFLAKE }]);
    });

    it('keeps one vote and the right vote_count when the preset was voted under both ids', async () => {
      await seedPreset('both', 'other', 2);
      await seedPreset('uuid-only', 'other', 1);
      await seedVote('both', UUID);
      await seedVote('both', SNOWFLAKE);
      await seedVote('uuid-only', UUID);

      await refresh({ discord_id: SNOWFLAKE });

      const after = await snapshot();
      expect(after.votes).toEqual([
        { preset_id: 'both', user_discord_id: SNOWFLAKE },
        { preset_id: 'uuid-only', user_discord_id: SNOWFLAKE },
      ]);
      expect(after.presets.find((p) => p.id === 'both')?.vote_count).toBe(1);
      expect(after.presets.find((p) => p.id === 'uuid-only')?.vote_count).toBe(1);
    });

    it('is a no-op the second time', async () => {
      await seedPreset('p1', UUID);
      await seedPreset('both', 'other', 2);
      await seedVote('both', UUID);
      await seedVote('both', SNOWFLAKE);
      await seedEvent(UUID);

      await refresh({ discord_id: SNOWFLAKE });
      const once = await snapshot();
      const res = await refresh({ discord_id: SNOWFLAKE });

      expect(res.status).toBe(200);
      expect(await snapshot()).toEqual(once);
    });

    it.each([
      ['discord_id', UUID],
      ['xivauth_id', UUID],
      ['discord_id', SNOWFLAKE],
    ] as const)('refuses and re-keys nothing for a banned identity (%s = %s)', async (column, value) => {
      await seedPreset('p1', UUID);
      await seedPreset('p2', 'other', 1);
      await seedVote('p2', UUID);
      await seedEvent(UUID);
      await ban(column, value);
      const before = await snapshot();

      const res = await refresh({ discord_id: SNOWFLAKE });

      expect(res.status).toBe(403);
      expect(await snapshot()).toEqual(before);
    });

    it('moves nothing when a ban lands between the ban check and the re-key batch', async () => {
      await seedPreset('p1', UUID);
      await seedPreset('both', 'other', 2);
      await seedVote('both', UUID);
      await seedVote('both', SNOWFLAKE);
      await seedEvent(UUID);
      // A non-colliding UUID vote: only the votes UPDATE OR IGNORE guard keeps it in place.
      await seedPreset('uuid-only', 'other', 1);
      await seedVote('uuid-only', UUID);
      const before = await snapshot();
      let injected = false;
      d1.setBeforeStatement(({ sql, database }) => {
        if (!injected && sql.includes('UPDATE presets SET author_discord_id')) {
          injected = true;
          database.exec(
            `INSERT INTO banned_users (id, discord_id, username, moderator_discord_id, reason)
             VALUES ('race-ban', '${UUID}', 'tester', 'mod-1', 'a reason that is long enough')`
          );
        }
      });

      const res = await refresh({ discord_id: SNOWFLAKE });

      expect(injected).toBe(true);
      expect(res.status).toBe(200);
      expect(((await res.json()) as { rekeyed: boolean }).rekeyed).toBe(false);
      const after = await snapshot();
      // Every statement is guarded: presets, votes, vote_count and events all untouched
      // (only the unrelated author_name refresh may differ, and it targets the snowflake).
      expect(after.presets.find((p) => p.id === 'p1')?.author_discord_id).toBe(UUID);
      expect(after.presets.find((p) => p.id === 'both')?.vote_count).toBe(
        before.presets.find((p) => p.id === 'both')?.vote_count
      );
      expect(after.votes).toEqual(before.votes);
      expect(after.votes).toContainEqual({ preset_id: 'uuid-only', user_discord_id: UUID });
      expect(after.presets.find((p) => p.id === 'uuid-only')?.vote_count).toBe(1);
      expect(after.events).toEqual(before.events);
    });

    it('unban -> restore finds the UUID-keyed presets, and the next sign-in re-keys them', async () => {
      await seedPreset('p1', UUID, 3);
      await ban('discord_id', UUID);
      // moderation-worker hides by the banned id
      await d1.prepare("UPDATE presets SET status = 'hidden' WHERE author_discord_id = ?").bind(UUID).run();

      const refused = await refresh({ discord_id: SNOWFLAKE });
      expect(refused.status).toBe(403);
      expect((await snapshot()).presets[0].author_discord_id).toBe(UUID);

      // unban + restore by that same id
      await d1
        .prepare("UPDATE banned_users SET unbanned_at = '2026-10-02 00:00:00' WHERE discord_id = ?")
        .bind(UUID)
        .run();
      await d1
        .prepare("UPDATE presets SET status = 'approved' WHERE author_discord_id = ? AND status = 'hidden'")
        .bind(UUID)
        .run();
      const restored = await d1.prepare('SELECT status FROM presets WHERE id = ?').bind('p1').first<{ status: string }>();
      expect(restored?.status).toBe('approved');

      const res = await refresh({ discord_id: SNOWFLAKE });

      expect(res.status).toBe(200);
      expect(((await res.json()) as { rekeyed: boolean }).rekeyed).toBe(true);
      expect((await snapshot()).presets[0]).toMatchObject({ author_discord_id: SNOWFLAKE, vote_count: 3 });
    });

    it('leaves a plain Discord JWT (no split) untouched apart from the name refresh', async () => {
      await seedPreset('mine', SNOWFLAKE);
      await seedPreset('uuid-keyed', UUID);
      await seedVote('mine', UUID);
      await seedEvent(UUID);

      // sub IS the snowflake: nothing to re-key
      const res = await refresh({ sub: SNOWFLAKE, discord_id: SNOWFLAKE });

      expect(res.status).toBe(200);
      expect(((await res.json()) as { rekeyed: boolean }).rekeyed).toBe(false);
      const after = await snapshot();
      expect(after.presets.find((p) => p.id === 'uuid-keyed')?.author_discord_id).toBe(UUID);
      expect(after.presets.find((p) => p.id === 'mine')?.author_name).toBe('Tester');
      expect(after.votes).toEqual([{ preset_id: 'mine', user_discord_id: UUID }]);
      expect(after.events).toEqual([{ user_discord_id: UUID }]);
    });

    it('does not re-key an XIVAuth-only token (no discord_id)', async () => {
      await seedPreset('p1', UUID);

      const res = await refresh({});

      expect(res.status).toBe(200);
      expect(((await res.json()) as { rekeyed: boolean }).rekeyed).toBe(false);
      expect((await snapshot()).presets[0].author_discord_id).toBe(UUID);
    });
  });
});
