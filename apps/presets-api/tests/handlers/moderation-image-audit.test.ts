/**
 * FINDING-020 (2026-10-03 audit): approving or rejecting a preview image is a
 * moderator decision, so it belongs in moderation_log — written in the same
 * batch as the conditional UPDATE, so a stale review writes neither.
 *
 * Runs against a real SQLite database built from schema.sql, so `changes()`
 * gating the log row is exercised for real.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MockR2Bucket } from '@xivdyetools/test-utils';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

type Variables = { auth: AuthContext };

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const presetId = 'preset-image-audit';
const imageKey = `${presetId}/0b8a1c52-4d6e-4f43-9a55-1f0f6a7c9e21.webp`;
const moderatorId = '123456789';

interface LogRow {
  preset_id: string;
  moderator_discord_id: string;
  action: string;
  reason: string | null;
}

describe('preview-image moderation audit (FINDING-020)', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let d1: SqliteD1;
  let env: Env;

  beforeEach(async () => {
    d1 = new SqliteD1(schema);
    env = createMockEnv({ DB: d1 as unknown as D1Database });
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.route('/api/v1/moderation', moderationRouter);
    await d1
      .prepare(
        `INSERT INTO presets (
          id, name, description, category_id, dyes, tags, author_discord_id, author_name,
          status, dye_signature, preview_image_key, preview_image_status
        ) VALUES (?, 'Image preset', 'A valid image description', 'jobs', '[1,2,3]',
          '["tag"]', 'owner-1', 'Owner', 'approved', '[1,2,3]', ?, 'pending')`
      )
      .bind(presetId, imageKey)
      .run();
    await (env.THUMBNAILS as unknown as MockR2Bucket).put(imageKey, new ArrayBuffer(4));
  });

  afterEach(() => {
    d1.close();
  });

  function review(action: string, key = imageKey): Promise<Response> {
    return Promise.resolve(
      app.request(
        `/api/v1/moderation/${presetId}/preview-image`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-bot-secret',
            'X-User-Discord-ID': moderatorId,
          },
          body: JSON.stringify({ action, preview_image_key: key }),
        },
        env
      )
    );
  }

  async function history(): Promise<LogRow[]> {
    const res = await app.request(
      `/api/v1/moderation/${presetId}/history`,
      { headers: { Authorization: 'Bearer test-bot-secret', 'X-User-Discord-ID': moderatorId } },
      env
    );
    expect(res.status).toBe(200);
    return ((await res.json()) as { history: LogRow[] }).history;
  }

  async function logCount(): Promise<number> {
    const r = await d1.prepare('SELECT COUNT(*) AS total FROM moderation_log').first<{ total: number }>();
    return r?.total ?? 0;
  }

  it('records image_approve, attributed to the moderator, and history shows it', async () => {
    const res = await review('approve');

    expect(res.status).toBe(200);
    expect(await history()).toEqual([
      expect.objectContaining({
        preset_id: presetId,
        moderator_discord_id: moderatorId,
        action: 'image_approve',
        reason: null,
      }),
    ]);
  });

  it('records image_reject, clears the image, and still deletes the R2 object', async () => {
    const res = await review('reject');

    expect(res.status).toBe(200);
    expect((await history()).map((h) => h.action)).toEqual(['image_reject']);
    const row = await d1
      .prepare('SELECT preview_image_key, preview_image_status FROM presets WHERE id = ?')
      .bind(presetId)
      .first<{ preview_image_key: string | null; preview_image_status: string }>();
    expect(row).toEqual({ preview_image_key: null, preview_image_status: 'none' });
    expect((env.THUMBNAILS as unknown as MockR2Bucket)._store.has(imageKey)).toBe(false);
  });

  it('a stale approve (409) writes no log row', async () => {
    expect((await review('approve')).status).toBe(200);
    expect(await logCount()).toBe(1);

    // The image is no longer pending: the conditional UPDATE changes nothing.
    const res = await review('approve');

    expect(res.status).toBe(409);
    expect(await logCount()).toBe(1);
  });

  it('a stale reject (a replaced image) writes no log row and keeps the R2 object', async () => {
    await d1
      .prepare("UPDATE presets SET preview_image_key = ? WHERE id = ?")
      .bind(`${presetId}/11111111-2222-3333-4444-555555555555.webp`, presetId)
      .run();

    const res = await review('reject');

    expect(res.status).toBe(409);
    expect(await logCount()).toBe(0);
    expect((env.THUMBNAILS as unknown as MockR2Bucket)._store.has(imageKey)).toBe(true);
  });
});
