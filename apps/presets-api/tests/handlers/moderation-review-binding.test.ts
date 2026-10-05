/**
 * FINDING-017 (2026-10-03 audit): a moderator's status change must be bound to
 * the revision and status they reviewed, and the notification that produced
 * the review must carry that revision.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moderationRouter } from '../../src/handlers/moderation';
import { presetsRouter } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

type Variables = { auth: AuthContext };

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const presetId = 'preset-review-binding';
const moderatorId = '123456789';
const ownerId = 'owner-9001';

describe('moderation review binding (FINDING-017)', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let d1: SqliteD1;
  let env: Env;

  beforeEach(() => {
    d1 = new SqliteD1(schema);
    env = createMockEnv({ DB: d1 as unknown as D1Database });
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.route('/api/v1/moderation', moderationRouter);
    app.route('/api/v1/presets', presetsRouter);
  });

  afterEach(() => {
    d1.close();
  });

  async function seed(status = 'pending', id = presetId, dyes = '[1,2,3]'): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO presets (
          id, name, description, category_id, dyes, tags, author_discord_id, author_name,
          status, dye_signature
        ) VALUES (?, 'Reviewed name', 'A valid reviewed description', 'jobs', ?,
          '["tag"]', ?, 'Owner', ?, ?)`
      )
      .bind(id, dyes, ownerId, status, dyes)
      .run();
  }

  function headers(userId = moderatorId): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-bot-secret',
      'X-User-Discord-ID': userId,
    };
  }

  function patchStatus(body: Record<string, unknown>): Promise<Response> {
    return Promise.resolve(
      app.request(
        `/api/v1/moderation/${presetId}/status`,
        { method: 'PATCH', headers: headers(), body: JSON.stringify(body) },
        env
      )
    );
  }

  async function row(): Promise<{ status: string; content_revision: number }> {
    const r = await d1
      .prepare('SELECT status, content_revision FROM presets WHERE id = ?')
      .bind(presetId)
      .first<{ status: string; content_revision: number }>();
    if (!r) throw new Error('seeded preset is missing');
    return r;
  }

  async function auditCount(): Promise<number> {
    const r = await d1
      .prepare('SELECT COUNT(*) AS total FROM moderation_log WHERE preset_id = ?')
      .bind(presetId)
      .first<{ total: number }>();
    return r?.total ?? 0;
  }

  describe('PATCH /:presetId/status', () => {
    it.each([
      ['both missing', {}],
      ['revision missing', { expected_status: 'pending' }],
      ['status missing', { expected_revision: 0 }],
      ['revision negative', { expected_revision: -1, expected_status: 'pending' }],
      ['revision fractional', { expected_revision: 0.5, expected_status: 'pending' }],
      ['revision a string', { expected_revision: '0', expected_status: 'pending' }],
      ['status unknown', { expected_revision: 0, expected_status: 'bogus' }],
      ['status not a string', { expected_revision: 0, expected_status: 3 }],
    ])('answers 409 REVISION_REQUIRED with current when %s', async (_label, extra) => {
      await seed();

      const res = await patchStatus({ status: 'approved', ...extra });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        success: false,
        error: 'CONFLICT',
        code: 'REVISION_REQUIRED',
        message: expect.any(String),
        current: { status: 'pending', content_revision: 0 },
      });
      expect(await row()).toEqual({ status: 'pending', content_revision: 0 });
      expect(await auditCount()).toBe(0);
    });

    it('still answers 400 for an invalid target status before the revision check', async () => {
      await seed();
      const res = await patchStatus({ status: 'nope' });
      expect(res.status).toBe(400);
    });

    it('answers 404 when the preset does not exist', async () => {
      const res = await patchStatus({ status: 'approved', expected_revision: 0, expected_status: 'pending' });
      expect(res.status).toBe(404);
    });

    it('answers 409 STALE_REVIEW with current and no log row for an older revision', async () => {
      await seed();
      // An owner edit after the embed was posted: the trigger bumps the revision.
      await d1.prepare("UPDATE presets SET name = 'Edited after review' WHERE id = ?").bind(presetId).run();
      expect((await row()).content_revision).toBe(1);

      const res = await patchStatus({ status: 'approved', expected_revision: 0, expected_status: 'pending' });

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        success: false,
        error: 'CONFLICT',
        code: 'STALE_REVIEW',
        current: { status: 'pending', content_revision: 1 },
      });
      expect(await row()).toEqual({ status: 'pending', content_revision: 1 });
      expect(await auditCount()).toBe(0);
    });

    it('answers 409 STALE_REVIEW with no log row for a wrong expected status', async () => {
      await seed('flagged');

      const res = await patchStatus({ status: 'approved', expected_revision: 0, expected_status: 'pending' });

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({
        code: 'STALE_REVIEW',
        current: { status: 'flagged', content_revision: 0 },
      });
      expect((await row()).status).toBe('flagged');
      expect(await auditCount()).toBe(0);
    });

    it('applies the change and writes exactly one log row for the reviewed revision and status', async () => {
      await seed();

      const res = await patchStatus({
        status: 'approved',
        reason: 'Looks fine',
        expected_revision: 0,
        expected_status: 'pending',
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ success: true, preset: { id: presetId, status: 'approved' } });
      expect((await row()).status).toBe('approved');
      expect(await auditCount()).toBe(1);
    });

    it('a write that lands between the read and the conditional UPDATE is a 409 STALE_REVIEW with no log row', async () => {
      await seed();
      let injected = false;
      d1.setBeforeStatement(({ sql, database }) => {
        if (!injected && sql.includes('UPDATE presets')) {
          injected = true;
          d1.setBeforeStatement(undefined);
          database.prepare("UPDATE presets SET description = 'Edited between read and write' WHERE id = ?").run(presetId);
        }
      });

      const res = await patchStatus({ status: 'approved', expected_revision: 0, expected_status: 'pending' });

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ code: 'STALE_REVIEW', current: { status: 'pending', content_revision: 1 } });
      expect((await row()).status).toBe('pending');
      expect(await auditCount()).toBe(0);
    });
  });

  describe('GET /:presetId', () => {
    it('returns the moderator view and revision for any status', async () => {
      await seed('rejected');

      const res = await app.request(`/api/v1/moderation/${presetId}`, { headers: headers() }, env);

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        success: true,
        content_revision: 0,
        preset: {
          id: presetId,
          name: 'Reviewed name',
          description: 'A valid reviewed description',
          dyes: [1, 2, 3],
          tags: ['tag'],
          category_id: 'jobs',
          author_name: 'Owner',
          author_discord_id: ownerId,
          status: 'rejected',
          moderation_status: 'unknown',
        },
      });
    });

    it('reports a flagged preset as flagged and the post-edit revision', async () => {
      await seed('flagged');
      await d1.prepare("UPDATE presets SET name = 'Edited' WHERE id = ?").bind(presetId).run();

      const body = (await (await app.request(`/api/v1/moderation/${presetId}`, { headers: headers() }, env)).json()) as {
        preset: { moderation_status: string };
        content_revision: number;
      };

      expect(body.preset.moderation_status).toBe('flagged');
      expect(body.content_revision).toBe(1);
    });

    it('refuses a non-moderator with 403', async () => {
      await seed();
      const res = await app.request(`/api/v1/moderation/${presetId}`, { headers: headers(ownerId) }, env);
      expect(res.status).toBe(403);
    });

    it('answers 404 for a missing preset', async () => {
      const res = await app.request('/api/v1/moderation/missing', { headers: headers() }, env);
      expect(res.status).toBe(404);
    });

    it('does not shadow /pending, /stats, /failed-notifications or /:id/history', async () => {
      await seed();

      const pending = await app.request('/api/v1/moderation/pending', { headers: headers() }, env);
      expect(pending.status).toBe(200);
      expect(await pending.json()).toHaveProperty('presets');

      const stats = await app.request('/api/v1/moderation/stats', { headers: headers() }, env);
      expect(stats.status).toBe(200);
      expect(await stats.json()).not.toHaveProperty('preset');

      const failed = await app.request('/api/v1/moderation/failed-notifications', { headers: headers() }, env);
      expect(failed.status).toBe(200);
      expect(await failed.json()).not.toHaveProperty('preset');

      const history = await app.request(`/api/v1/moderation/${presetId}/history`, { headers: headers() }, env);
      expect(history.status).toBe(200);
      expect(await history.json()).toHaveProperty('history');
    });
  });

  describe('submission notification payload', () => {
    function envWithWebhook(): { env: Env; bodies: Array<{ preset: Record<string, unknown> }> } {
      const bodies: Array<{ preset: Record<string, unknown> }> = [];
      const withWebhook = createMockEnv({
        DB: d1 as unknown as D1Database,
        INTERNAL_WEBHOOK_SECRET: 'webhook-secret',
        DISCORD_WORKER: {
          fetch: async (request: Request) => {
            bodies.push((await request.json()) as { preset: Record<string, unknown> });
            return new Response('ok', { status: 200 });
          },
        } as unknown as Fetcher,
      });
      return { env: withWebhook, bodies };
    }

    function ctx(): { ctx: ExecutionContext; settle: () => Promise<void> } {
      const promises: Promise<unknown>[] = [];
      return {
        ctx: { waitUntil: (p: Promise<unknown>) => promises.push(p), passThroughOnException: () => {} } as unknown as ExecutionContext,
        settle: async () => {
          await Promise.allSettled(promises);
        },
      };
    }

    it('carries the row\'s content_revision AFTER an owner edit that re-notifies moderators', async () => {
      await seed('pending');
      const { env: hookEnv, bodies } = envWithWebhook();
      const { ctx: executionCtx, settle } = ctx();

      const res = await app.request(
        `/api/v1/presets/${presetId}`,
        {
          method: 'PATCH',
          headers: headers(ownerId),
          body: JSON.stringify({ name: 'Edited after the first embed' }),
        },
        hookEnv,
        executionCtx
      );
      await settle();

      expect(res.status).toBe(200);
      const stored = await row();
      expect(stored.content_revision).toBeGreaterThan(0);
      expect(bodies).toHaveLength(1);
      expect(bodies[0].preset).toMatchObject({
        id: presetId,
        status: 'pending',
        content_revision: stored.content_revision,
      });
    });

    it('carries the row\'s content_revision on a new submission', async () => {
      const { env: hookEnv, bodies } = envWithWebhook();
      const { ctx: executionCtx, settle } = ctx();

      const res = await app.request(
        '/api/v1/presets',
        {
          method: 'POST',
          headers: headers(ownerId),
          body: JSON.stringify({
            name: 'Brand new palette',
            description: 'A brand new valid description',
            category_id: 'jobs',
            dyes: [10, 11, 12],
            tags: ['new'],
          }),
        },
        hookEnv,
        executionCtx
      );
      await settle();

      expect(res.status).toBe(201);
      const created = (await res.clone().json()) as { preset: { id: string } };
      const stored = await d1
        .prepare('SELECT content_revision FROM presets WHERE id = ?')
        .bind(created.preset.id)
        .first<{ content_revision: number }>();
      expect(bodies).toHaveLength(1);
      expect(bodies[0].preset.content_revision).toBe(stored!.content_revision);
    });

    it('sends no notification when the new row is gone by the time it is re-read', async () => {
      const { env: hookEnv, bodies } = envWithWebhook();
      const { ctx: executionCtx, settle } = ctx();
      let deleted = false;
      d1.setBeforeStatement(({ sql, database }) => {
        if (!deleted && sql.includes('SELECT * FROM presets WHERE id = ?')) {
          deleted = true;
          database.exec('DELETE FROM votes; DELETE FROM presets;');
        }
      });

      const res = await app.request(
        '/api/v1/presets',
        {
          method: 'POST',
          headers: headers(ownerId),
          body: JSON.stringify({
            name: 'Vanishing palette',
            description: 'A brand new valid description',
            category_id: 'jobs',
            dyes: [20, 21, 22],
            tags: ['new'],
          }),
        },
        hookEnv,
        executionCtx
      );
      await settle();

      expect(deleted).toBe(true);
      expect(res.status).toBe(201);
      expect(bodies).toHaveLength(0);
    });

    it('sends no notification when the edited row is gone by the time it is re-read', async () => {
      await seed('pending');
      const { env: hookEnv, bodies } = envWithWebhook();
      const { ctx: executionCtx, settle } = ctx();
      let reads = 0;
      let deleted = false;
      d1.setBeforeStatement(({ sql, database }) => {
        if (sql.includes('SELECT * FROM presets WHERE id = ?') && ++reads === 2) {
          deleted = true;
          database.exec('DELETE FROM votes; DELETE FROM presets;');
        }
      });

      const res = await app.request(
        `/api/v1/presets/${presetId}`,
        {
          method: 'PATCH',
          headers: headers(ownerId),
          body: JSON.stringify({ name: 'Edited then vanished' }),
        },
        hookEnv,
        executionCtx
      );
      await settle();

      expect(deleted).toBe(true);
      expect(res.status).toBe(200);
      expect(bodies).toHaveLength(0);
    });
  });
});
