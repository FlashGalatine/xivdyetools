/**
 * FINDING-005 (2026-10-03 security audit): retention of banned_users and
 * moderation_log. The privacy policies publish these periods, so the tests pin
 * the exact boundaries:
 *
 *   - a lifted ban is deleted 90 days after unbanned_at (an active ban never);
 *   - ban / unban / hide / restore log rows are deleted 12 months after
 *     created_at;
 *   - every other log row lives as long as its preset, and DELETE
 *     /presets/:id removes them even with foreign keys off.
 *
 * Runs against a real SQLite database built from schema.sql.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moderationRouter } from '../../src/handlers/moderation';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import {
  LIFTED_BAN_RETENTION_DAYS,
  USER_ACTION_LOG_RETENTION_MONTHS,
  pruneModerationRecords,
} from '../../src/services/moderation-retention-service';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

type Variables = { auth: AuthContext };

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const presetId = 'preset-retention';
const ownerId = 'owner-9001';
const moderatorId = '123456789';
const imageKey = `${presetId}/0b8a1c52-4d6e-4f43-9a55-1f0f6a7c9e21.webp`;
const DAY = 24 * 60 * 60 * 1000;

const daysAgo = (now: number, days: number): string => new Date(now - days * DAY).toISOString();
function monthsAgo(now: number, months: number): string {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString();
}

describe('moderation record retention (FINDING-005)', () => {
  let d1: SqliteD1;

  beforeEach(() => {
    d1 = new SqliteD1(schema);
  });

  afterEach(() => {
    d1.close();
  });

  async function seedPreset(status = 'approved', extra = ''): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO presets (
          id, name, description, category_id, dyes, tags, author_discord_id, author_name,
          status, dye_signature, previous_values, preview_image_key, preview_image_status
        ) VALUES (?, 'Retention preset', 'A valid retention description', 'jobs', '[1,2,3]',
          '["tag"]', ?, 'Owner', ?, '[1,2,3]', ${extra || 'NULL'}, ?, ?)`
      )
      .bind(presetId, ownerId, status, extra ? null : imageKey, extra ? 'none' : 'pending')
      .run();
  }

  async function seedBan(id: string, unbannedAt: string | null): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO banned_users (id, discord_id, username, moderator_discord_id, reason, banned_at, unbanned_at)
         VALUES (?, ?, 'someone', ?, 'A sufficiently long reason', '2020-01-01T00:00:00.000Z', ?)`
      )
      .bind(id, `discord-${id}`, moderatorId, unbannedAt)
      .run();
  }

  async function seedLog(
    id: string,
    action: string,
    createdAt: string,
    withPreset = false
  ): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, target_discord_id, created_at)
         VALUES (?, ?, ?, ?, 'a reason', 'target-1', ?)`
      )
      .bind(id, withPreset ? presetId : null, moderatorId, action, createdAt)
      .run();
  }

  async function ids(table: 'banned_users' | 'moderation_log'): Promise<string[]> {
    const { results } = await d1.prepare(`SELECT id FROM ${table} ORDER BY id`).all<{ id: string }>();
    return results.map((row) => row.id);
  }

  describe('published constants', () => {
    it('are the numbers the FINDING-005 policy amendment will publish', () => {
      expect(LIFTED_BAN_RETENTION_DAYS).toBe(90);
      expect(USER_ACTION_LOG_RETENTION_MONTHS).toBe(12);
    });
  });

  describe('pruneModerationRecords', () => {
    const now = Date.parse('2026-10-04T12:00:00.000Z');

    it('deletes a lifted ban 91 days after the unban and keeps it at 89 days', async () => {
      await seedBan('ban-89', daysAgo(now, 89));
      await seedBan('ban-91', daysAgo(now, 91));

      await pruneModerationRecords(d1 as unknown as D1Database, undefined, now);

      expect(await ids('banned_users')).toEqual(['ban-89']);
    });

    it('never deletes an active ban, however old its banned_at', async () => {
      await seedBan('ban-active', null);

      await pruneModerationRecords(d1 as unknown as D1Database, undefined, now);

      expect(await ids('banned_users')).toEqual(['ban-active']);
    });

    it.each(['ban', 'unban', 'hide', 'restore'])(
      'deletes a %s log row 13 months old and keeps it at 11 months',
      async (action) => {
        await seedPreset();
        await seedLog('log-11', action, monthsAgo(now, 11), true);
        await seedLog('log-13', action, monthsAgo(now, 13), true);

        await pruneModerationRecords(d1 as unknown as D1Database, undefined, now);

        expect(await ids('moderation_log')).toEqual(['log-11']);
      }
    );

    it('keys on the action, not the preset_id: hide/restore rows carry a preset and still age out', async () => {
      await seedPreset();
      await seedLog('hide-old', 'hide', monthsAgo(now, 13), true);
      await seedLog('ban-old', 'ban', monthsAgo(now, 13), false);

      await pruneModerationRecords(d1 as unknown as D1Database, undefined, now);

      expect(await ids('moderation_log')).toEqual([]);
    });

    it.each([
      'approve',
      'reject',
      'flag',
      'unflag',
      'requeue',
      'revert',
      'image_approve',
      'image_reject',
    ])('keeps a %s log row however old, because it lives as long as its preset', async (action) => {
      await seedPreset();
      await seedLog('log-ancient', action, '2019-01-01T00:00:00.000Z', true);

      await pruneModerationRecords(d1 as unknown as D1Database, undefined, now);

      expect(await ids('moderation_log')).toEqual(['log-ancient']);
    });

    it('logs only a count, never an id or a reason', async () => {
      await seedBan('ban-secret-id', daysAgo(now, 200));
      const warnings: Array<[string, Record<string, unknown> | undefined]> = [];

      await pruneModerationRecords(
        d1 as unknown as D1Database,
        { warn: (message, context) => warnings.push([message, context]) },
        now
      );

      expect(warnings).toEqual([['[FINDING-005] pruned moderation records', { pruned: 1 }]]);
    });

    // BUG-066: the outcome is what lets the daily job tell a sweep that ran
    // from one that failed — the warning alone has no durable channel.
    it('resolves true when the sweep ran, whether or not anything aged out', async () => {
      await expect(pruneModerationRecords(d1 as unknown as D1Database, undefined, now)).resolves.toBe(
        true
      );
    });

    it('swallows a database failure, reports a zero count and resolves false', async () => {
      const warnings: string[] = [];
      d1.setBeforeStatement(() => {
        throw new Error('D1 exploded while quoting: ban-secret-id');
      });

      await expect(
        pruneModerationRecords(d1 as unknown as D1Database, { warn: (m) => warnings.push(m) }, now)
      ).resolves.toBe(false);

      expect(warnings).toEqual(['[FINDING-005] moderation-record prune failed']);
      expect(warnings.join('')).not.toContain('ban-secret-id');
    });
  });

  describe('moderation write paths prune', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;

    beforeEach(() => {
      env = createMockEnv({ DB: d1 as unknown as D1Database });
      app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use('*', authMiddleware);
      app.route('/api/v1/moderation', moderationRouter);
    });

    const moderate = (path: string, body: Record<string, unknown>): Promise<Response> =>
      Promise.resolve(
        app.request(
          `/api/v1/moderation/${presetId}/${path}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer test-bot-secret',
              'X-User-Discord-ID': moderatorId,
            },
            body: JSON.stringify(body),
          },
          env
        )
      );

    async function seedStale(): Promise<void> {
      const now = Date.now();
      await seedBan('stale-ban', daysAgo(now, 91));
      await seedBan('fresh-ban', daysAgo(now, 10));
      await seedLog('stale-log', 'ban', monthsAgo(now, 13));
      await seedLog('fresh-log', 'ban', monthsAgo(now, 1));
    }

    async function expectPruned(): Promise<void> {
      expect(await ids('banned_users')).toEqual(['fresh-ban']);
      expect((await ids('moderation_log')).filter((id) => id.endsWith('-log'))).toEqual(['fresh-log']);
    }

    it('PATCH /:presetId/status', async () => {
      await seedPreset('approved', "'[1,2,3]'");
      await seedStale();

      const response = await moderate('status', {
        status: 'rejected',
        reason: 'No longer suitable',
        expected_revision: 0,
        expected_status: 'approved',
      });

      expect(response.status).toBe(200);
      await expectPruned();
    });

    it('PATCH /:presetId/revert', async () => {
      await seedPreset('flagged', `'${JSON.stringify({
        name: 'Original name',
        description: 'A valid original description',
        dyes: [1, 2, 3],
        tags: ['original'],
      })}'`);
      await seedStale();

      const response = await moderate('revert', { reason: 'Restore the original safe values', expected_revision: 0, expected_status: 'flagged' });

      expect(response.status).toBe(200);
      await expectPruned();
    });

    it.each(['approve', 'reject'])('PATCH /:presetId/preview-image (%s)', async (action) => {
      await seedPreset();
      await seedStale();

      const response = await moderate('preview-image', { action, preview_image_key: imageKey });

      expect(response.status).toBe(200);
      await expectPruned();
    });

    it('does not prune when the request is a stale 409 (nothing was written)', async () => {
      await seedPreset();
      await seedStale();

      const response = await moderate('preview-image', {
        action: 'approve',
        preview_image_key: `${presetId}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp`,
      });

      expect(response.status).toBe(409);
      expect(await ids('banned_users')).toEqual(['fresh-ban', 'stale-ban']);
    });

    it('a prune failure does not fail the moderator request or undo its write', async () => {
      await seedPreset();
      await seedStale();
      d1.setBeforeStatement(({ sql }) => {
        if (sql.includes('DELETE FROM banned_users')) throw new Error('prune boom');
      });

      const response = await moderate('preview-image', {
        action: 'approve',
        preview_image_key: imageKey,
      });

      expect(response.status).toBe(200);
      const row = await d1
        .prepare('SELECT preview_image_status FROM presets WHERE id = ?')
        .bind(presetId)
        .first<{ preview_image_status: string }>();
      expect(row?.preview_image_status).toBe('approved');
      expect(await ids('banned_users')).toEqual(['fresh-ban', 'stale-ban']);
    });
  });

  describe('DELETE /presets/:id removes the preset moderation_log rows explicitly', () => {
    it('even when the database does not enforce ON DELETE CASCADE', async () => {
      resetCategoryCache();
      const env = createMockEnv({ DB: d1 as unknown as D1Database });
      const app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use('*', authMiddleware);
      app.route('/api/v1/presets', presetsRouter);
      const executionCtx = {
        waitUntil: (_promise: Promise<unknown>) => {},
        passThroughOnException: () => {},
      } as unknown as ExecutionContext;

      await seedPreset();
      await seedLog('approve-row', 'approve', daysAgo(Date.now(), 1), true);
      await seedLog('user-row', 'ban', daysAgo(Date.now(), 1), false);
      // Mimic a connection that does not enforce the FK cascade.
      d1.database.exec('PRAGMA foreign_keys = OFF');

      const response = await app.request(
        `/api/v1/presets/${presetId}`,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer test-bot-secret', 'X-User-Discord-ID': ownerId },
        },
        env,
        executionCtx
      );

      expect(response.status).toBe(200);
      // The preset's own rows go; a user-level row (no preset) is untouched.
      expect(await ids('moderation_log')).toEqual(['user-row']);
    });
  });
});
