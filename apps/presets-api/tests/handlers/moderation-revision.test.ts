import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

type Variables = { auth: AuthContext };

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const presetId = 'preset-moderation-revision';
const moderatorId = '123456789';
const initialSnapshot = {
  name: 'Original name',
  description: 'A valid original description',
  dyes: [1, 2, 3],
  tags: ['original'],
};
const newerSnapshot = {
  name: 'Newer saved name',
  description: 'A newer valid saved description',
  dyes: [4, 5, 6],
  tags: ['newer'],
};

describe('moderation revision contract', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let d1: SqliteD1;
  let env: Env;

  beforeEach(() => {
    d1 = new SqliteD1(schema);
    env = createMockEnv({ DB: d1 as unknown as D1Database });
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.route('/api/v1/moderation', moderationRouter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    d1.close();
  });

  async function seedRevertablePreset(status = 'flagged'): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO presets (
          id, name, description, category_id, dyes, tags, author_discord_id, author_name,
          status, dye_signature, previous_values
        ) VALUES (?, 'Edited name', 'A valid edited description', 'jobs', '[7,8,9]',
          '["edited"]', 'owner-9001', 'Owner', ?, '[7,8,9]', ?)`
      )
      .bind(presetId, status, JSON.stringify(initialSnapshot))
      .run();
  }

  async function moderationRequest(path: 'status' | 'revert', body: Record<string, unknown>): Promise<Response> {
    return app.request(
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
    );
  }

  async function state(): Promise<{
    name: string;
    description: string;
    dyes: string;
    tags: string;
    status: string;
    previous_values: string | null;
    content_revision: number;
    vote_count: number;
    preview_image_key: string | null;
    preview_image_status: string;
  }> {
    const row = await d1
      .prepare(
        `SELECT name, description, dyes, tags, status, previous_values, content_revision,
                vote_count, preview_image_key, preview_image_status
         FROM presets WHERE id = ?`
      )
      .bind(presetId)
      .first<{
        name: string;
        description: string;
        dyes: string;
        tags: string;
        status: string;
        previous_values: string | null;
        content_revision: number;
        vote_count: number;
        preview_image_key: string | null;
        preview_image_status: string;
      }>();
    if (!row) throw new Error('seeded preset is missing');
    return row;
  }

  async function auditCount(): Promise<number> {
    const row = await d1
      .prepare('SELECT COUNT(*) AS total FROM moderation_log WHERE preset_id = ?')
      .bind(presetId)
      .first<{ total: number }>();
    return row?.total ?? 0;
  }

  function interleaveFirstPresetUpdate(write: (database: typeof d1.database) => void): void {
    let injected = false;
    d1.setBeforeStatement(({ sql, database }) => {
      if (!injected && sql.includes('UPDATE presets')) {
        injected = true;
        d1.setBeforeStatement(undefined);
        write(database);
      }
    });
  }

  it.each(['hidden', 'flagged', 'rejected'] as const)(
    'returns 409 and preserves a newer moderator %s when reverting an older snapshot',
    async (winnerStatus) => {
      await seedRevertablePreset();
      interleaveFirstPresetUpdate((database) => {
        database
          .prepare("UPDATE presets SET name = 'Newer moderation winner', status = ? WHERE id = ?")
          .run(winnerStatus, presetId);
      });

      const response = await moderationRequest('revert', { reason: 'Restore the original safe values' });

      expect(response.status).toBe(409);
      expect(await state()).toMatchObject({
        name: 'Newer moderation winner',
        status: winnerStatus,
        previous_values: JSON.stringify(initialSnapshot),
      });
      expect(await auditCount()).toBe(0);
    }
  );

  it('returns 409 after status ABA and inserts no audit for the stale transition', async () => {
    await seedRevertablePreset('approved');
    interleaveFirstPresetUpdate((database) => {
      for (const status of ['flagged', 'approved']) {
        database.prepare('UPDATE presets SET status = ? WHERE id = ?').run(status, presetId);
      }
    });

    const response = await moderationRequest('status', { status: 'rejected', reason: 'No longer suitable' });

    expect(response.status).toBe(409);
    expect(await state()).toMatchObject({ status: 'approved', name: 'Edited name', content_revision: 2 });
    expect(await auditCount()).toBe(0);
  });

  it('returns 409 when a newer edit replaces previous_values before the revert write', async () => {
    await seedRevertablePreset();
    interleaveFirstPresetUpdate((database) => {
      database
        .prepare(
          'UPDATE presets SET name = ?, description = ?, dyes = ?, tags = ?, dye_signature = ?, previous_values = ? WHERE id = ?'
        )
        .run(
          newerSnapshot.name,
          newerSnapshot.description,
          JSON.stringify(newerSnapshot.dyes),
          JSON.stringify(newerSnapshot.tags),
          JSON.stringify(newerSnapshot.dyes),
          JSON.stringify(newerSnapshot),
          presetId
        );
    });

    const response = await moderationRequest('revert', { reason: 'Restore the reviewed revision' });

    expect(response.status).toBe(409);
    expect(await state()).toMatchObject({
      name: newerSnapshot.name,
      description: newerSnapshot.description,
      dyes: JSON.stringify(newerSnapshot.dyes),
      tags: JSON.stringify(newerSnapshot.tags),
      previous_values: JSON.stringify(newerSnapshot),
    });
    expect(await auditCount()).toBe(0);
  });

  it('allows a fresh revert and writes exactly one audit row', async () => {
    await seedRevertablePreset();

    const response = await moderationRequest('revert', { reason: 'Restore the reviewed original' });

    expect(response.status).toBe(200);
    expect(await state()).toMatchObject({
      name: initialSnapshot.name,
      description: initialSnapshot.description,
      dyes: JSON.stringify(initialSnapshot.dyes),
      tags: JSON.stringify(initialSnapshot.tags),
      status: 'approved',
      previous_values: null,
    });
    expect(await auditCount()).toBe(1);
  });

  it('rolls back a fresh revert when its audit insert fails', async () => {
    await seedRevertablePreset();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('duplicate-revert-log');
    await d1
      .prepare(
        "INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action) VALUES ('duplicate-revert-log', ?, ?, 'revert')"
      )
      .bind(presetId, moderatorId)
      .run();

    const response = await moderationRequest('revert', { reason: 'Restore the reviewed original' });

    expect(response.status).toBe(500);
    expect(await state()).toMatchObject({
      name: 'Edited name',
      status: 'flagged',
      previous_values: JSON.stringify(initialSnapshot),
    });
    expect(await auditCount()).toBe(1);
  });

  it('does not reject a revert after vote-only and preview-only writes', async () => {
    await seedRevertablePreset();
    interleaveFirstPresetUpdate((database) => {
      database
        .prepare(
          "UPDATE presets SET vote_count = vote_count + 1, preview_image_key = 'preset-moderation-revision/new.webp', preview_image_status = 'pending' WHERE id = ?"
        )
        .run(presetId);
    });

    const response = await moderationRequest('revert', { reason: 'Restore the reviewed original' });

    expect(response.status).toBe(200);
    expect(await state()).toMatchObject({
      status: 'approved',
      vote_count: 1,
      preview_image_key: 'preset-moderation-revision/new.webp',
      preview_image_status: 'pending',
    });
    expect(await auditCount()).toBe(1);
  });
});
