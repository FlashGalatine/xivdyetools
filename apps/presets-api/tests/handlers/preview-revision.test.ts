import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

type Variables = { auth: AuthContext };

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const presetId = 'preset-123';
const key1 = 'preset-123/K1.webp';
const key2 = 'preset-123/K2.webp';

describe('preview-image revision contract', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let d1: SqliteD1;
  let deleted: string[];
  let env: Env;

  beforeEach(() => {
    d1 = new SqliteD1(schema);
    deleted = [];
    env = createMockEnv({
      DB: d1 as unknown as D1Database,
      THUMBNAILS: {
        delete: async (key: string | string[]) => {
          deleted.push(...(Array.isArray(key) ? key : [key]));
        },
      } as unknown as R2Bucket,
    });
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.route('/api/v1/moderation', moderationRouter);
  });

  afterEach(() => {
    d1.close();
  });

  async function seedPreview(key: string, status = 'pending'): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO presets (
          id, name, description, category_id, dyes, tags, status, preview_image_key, preview_image_status
        ) VALUES (?, 'Test preset', 'A valid test description', 'jobs', '[1,2,3]', '[]', 'approved', ?, ?)`
      )
      .bind(presetId, key, status)
      .run();
  }

  async function revision(action: 'approve' | 'reject', key: string, moderator = '123456789'): Promise<Response> {
    return app.request(
      `/api/v1/moderation/${presetId}/preview-image`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-bot-secret',
          'X-User-Discord-ID': moderator,
        },
        body: JSON.stringify({ action, preview_image_key: key }),
      },
      env
    );
  }

  async function imageState(): Promise<{ preview_image_key: string | null; preview_image_status: string }> {
    const row = await d1
      .prepare('SELECT preview_image_key, preview_image_status FROM presets WHERE id = ?')
      .bind(presetId)
      .first<{ preview_image_key: string | null; preview_image_status: string }>();
    if (!row) throw new Error('seeded preset is missing');
    return row;
  }

  it('keeps UPDATE RETURNING rows and changes() for a conditional batched log', async () => {
    await seedPreview(key1);

    const results = await d1.batch([
      d1
        .prepare(
          "UPDATE presets SET preview_image_status = 'approved' WHERE id = ? AND preview_image_status = 'pending' RETURNING preview_image_key"
        )
        .bind(presetId),
      d1
        .prepare(
          "INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, created_at) SELECT ?, ?, ?, 'approve', ? WHERE changes() > 0"
        )
        .bind('log-1', presetId, '123456789', '2026-09-15T00:00:00.000Z'),
    ]);

    expect(results[0].results).toEqual([{ preview_image_key: key1 }]);
    expect(results[0].meta.changes).toBe(1);
    expect(results[1].meta.changes).toBe(1);
    expect(
      await d1.prepare('SELECT COUNT(*) AS total FROM moderation_log WHERE id = ?').bind('log-1').first<{ total: number }>()
    ).toEqual({ total: 1 });
  });

  it.each([
    ['approve', 'approved'],
    ['reject', 'none'],
  ] as const)('accepts the matching pending revision for %s', async (action, expectedStatus) => {
    await seedPreview(key1);

    const response = await revision(action, key1);

    expect(response.status).toBe(200);
    expect(await imageState()).toEqual({
      preview_image_key: action === 'reject' ? null : key1,
      preview_image_status: expectedStatus,
    });
    expect(deleted).toEqual(action === 'reject' ? [key1] : []);
  });

  it.each(['approve', 'reject'] as const)(
    'returns 409 for a K1 %s after K2 replaced it without changing or deleting K2',
    async (action) => {
      await seedPreview(key2);

      const response = await revision(action, key1);

      expect(response.status).toBe(409);
      expect(await imageState()).toEqual({ preview_image_key: key2, preview_image_status: 'pending' });
      expect(deleted).toEqual([]);
    }
  );

  it.each(['approve', 'reject'] as const)(
    'preserves K2 when it replaces K1 immediately before the %s UPDATE',
    async (action) => {
      await seedPreview(key1);
      let replaced = false;
      d1.setBeforeStatement(({ sql, database }) => {
        if (!replaced && sql.startsWith('UPDATE presets')) {
          replaced = true;
          database.prepare(
            "UPDATE presets SET preview_image_key = ?, preview_image_status = 'pending' WHERE id = ?"
          ).run(key2, presetId);
        }
      });

      const response = await revision(action, key1);

      expect(response.status).toBe(409);
      expect(await imageState()).toEqual({ preview_image_key: key2, preview_image_status: 'pending' });
      expect(deleted).toEqual([]);
    }
  );

  it.each([
    { action: 'approve' },
    { action: 'approve', preview_image_key: '' },
    { action: 'approve', preview_image_key: 'other/K1.webp' },
    { action: 'approve', preview_image_key: 'preset-123/K1.png' },
  ])('fails closed for unversioned or malformed review bodies: %o', async (body) => {
    await seedPreview(key1);

    const response = await app.request(
      `/api/v1/moderation/${presetId}/preview-image`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-bot-secret',
          'X-User-Discord-ID': '123456789',
        },
        body: JSON.stringify(body),
      },
      env
    );

    expect(response.status).toBe(400);
    expect(await imageState()).toEqual({ preview_image_key: key1, preview_image_status: 'pending' });
  });

  it('returns 409 for a repeated action after the revision was decided', async () => {
    await seedPreview(key1);
    expect((await revision('approve', key1)).status).toBe(200);

    const repeated = await revision('approve', key1);

    expect(repeated.status).toBe(409);
    expect(await imageState()).toEqual({ preview_image_key: key1, preview_image_status: 'approved' });
  });

  it('refuses a non-moderator before any revision action', async () => {
    await seedPreview(key1);

    const response = await revision('approve', key1, 'not-a-moderator');

    expect(response.status).toBe(403);
    expect(await imageState()).toEqual({ preview_image_key: key1, preview_image_status: 'pending' });
  });
});
