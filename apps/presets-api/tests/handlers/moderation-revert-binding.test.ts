/**
 * FINDING-017 follow-up: PATCH /:presetId/revert must be bound to the revision
 * and status the moderator reviewed, failing closed exactly like /status.
 */
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
const presetId = 'preset-revert-binding';
const moderatorId = '123456789';
const reason = 'Restore the last known good values';
const previous = {
  name: 'Original name',
  description: 'A valid original description',
  dyes: [4, 5, 6],
  tags: ['original'],
};

describe('moderation revert binding (FINDING-017 follow-up)', () => {
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
    d1.close();
  });

  async function seed(status = 'flagged'): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO presets (
          id, name, description, category_id, dyes, tags, author_discord_id, author_name,
          status, dye_signature, previous_values
        ) VALUES (?, 'Edited name', 'An edited valid description', 'jobs', '[1,2,3]',
          '["edited"]', 'owner-9001', 'Owner', ?, '[1,2,3]', ?)`
      )
      .bind(presetId, status, JSON.stringify(previous))
      .run();
  }

  function revert(body: Record<string, unknown>): Promise<Response> {
    return Promise.resolve(
      app.request(
        `/api/v1/moderation/${presetId}/revert`,
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
  }

  async function row(): Promise<{ name: string; status: string; content_revision: number; previous_values: string | null }> {
    const r = await d1
      .prepare('SELECT name, status, content_revision, previous_values FROM presets WHERE id = ?')
      .bind(presetId)
      .first<{ name: string; status: string; content_revision: number; previous_values: string | null }>();
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

  it.each([
    ['both missing', {}],
    ['revision missing', { expected_status: 'flagged' }],
    ['status missing', { expected_revision: 0 }],
    ['revision negative', { expected_revision: -1, expected_status: 'flagged' }],
    ['revision fractional', { expected_revision: 0.5, expected_status: 'flagged' }],
    ['revision a string', { expected_revision: '0', expected_status: 'flagged' }],
    ['status unknown', { expected_revision: 0, expected_status: 'bogus' }],
    ['status not a string', { expected_revision: 0, expected_status: 3 }],
  ])('answers 409 REVISION_REQUIRED with current when %s', async (_label, extra) => {
    await seed();

    const res = await revert({ reason, ...extra });
    const stored = await row();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      error: 'CONFLICT',
      code: 'REVISION_REQUIRED',
      message: expect.any(String),
      current: { status: 'flagged', content_revision: stored.content_revision },
    });
    expect(stored.name).toBe('Edited name');
    expect(stored.previous_values).not.toBeNull();
    expect(await auditCount()).toBe(0);
  });

  it('answers 404 when the preset does not exist', async () => {
    const res = await revert({ reason, expected_revision: 0, expected_status: 'flagged' });
    expect(res.status).toBe(404);
  });

  it('answers 409 STALE_REVIEW with current for an older revision', async () => {
    await seed();
    // A further owner edit after the embed was posted: the trigger bumps the revision.
    await d1.prepare("UPDATE presets SET description = 'Edited after the review' WHERE id = ?").bind(presetId).run();
    const before = await row();
    expect(before.content_revision).toBeGreaterThan(0);

    const res = await revert({ reason, expected_revision: 0, expected_status: 'flagged' });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      success: false,
      error: 'CONFLICT',
      code: 'STALE_REVIEW',
      current: { status: 'flagged', content_revision: before.content_revision },
    });
    expect(await row()).toEqual(before);
    expect(await auditCount()).toBe(0);
  });

  it('answers 409 STALE_REVIEW with no log row for a wrong expected status', async () => {
    await seed('flagged');
    const before = await row();

    const res = await revert({ reason, expected_revision: before.content_revision, expected_status: 'pending' });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: 'STALE_REVIEW',
      current: { status: 'flagged', content_revision: before.content_revision },
    });
    expect(await row()).toEqual(before);
    expect(await auditCount()).toBe(0);
  });

  it('reverts and writes exactly one log row for the reviewed revision and status', async () => {
    await seed();
    const { content_revision } = await row();

    const res = await revert({ reason, expected_revision: content_revision, expected_status: 'flagged' });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      preset: { id: presetId, name: 'Original name', status: 'approved' },
    });
    const after = await row();
    expect(after.name).toBe('Original name');
    expect(after.status).toBe('approved');
    expect(after.previous_values).toBeNull();
    expect(await auditCount()).toBe(1);
  });

  it("a write that lands between the read and the conditional UPDATE is a 409 STALE_REVIEW with no log row", async () => {
    await seed();
    const { content_revision } = await row();
    let injected = false;
    d1.setBeforeStatement(({ sql, database }) => {
      if (!injected && sql.includes('UPDATE presets')) {
        injected = true;
        d1.setBeforeStatement(undefined);
        database.prepare("UPDATE presets SET description = 'Edited between read and write' WHERE id = ?").run(presetId);
      }
    });

    const res = await revert({ reason, expected_revision: content_revision, expected_status: 'flagged' });

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: 'STALE_REVIEW',
      current: { status: 'flagged', content_revision: content_revision + 1 },
    });
    const after = await row();
    expect(after.name).toBe('Edited name');
    expect(after.status).toBe('flagged');
    expect(await auditCount()).toBe(0);
  });
});
