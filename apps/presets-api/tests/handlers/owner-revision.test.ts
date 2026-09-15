import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

type Variables = { auth: AuthContext };

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const presetId = 'preset-owner-revision';
const ownerId = 'owner-9001';
const sameMillisecond = '2026-09-15T00:00:00.000Z';

describe('owner preset edit revision contract', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let d1: SqliteD1;
  let env: Env;
  const executionCtx = {
    waitUntil: (_promise: Promise<unknown>) => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  beforeEach(() => {
    resetCategoryCache();
    d1 = new SqliteD1(schema);
    env = createMockEnv({ DB: d1 as unknown as D1Database });
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.route('/api/v1/presets', presetsRouter);
  });

  afterEach(() => {
    d1.close();
  });

  async function seedPreset(status = 'approved'): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO presets (
          id, name, description, category_id, dyes, tags, author_discord_id, author_name,
          status, dye_signature, created_at, updated_at
        ) VALUES (?, 'Original name', 'A valid original description', 'jobs', '[1,2,3]',
          '["original"]', ?, 'Owner', ?, '[1,2,3]', ?, ?)`
      )
      .bind(presetId, ownerId, status, sameMillisecond, sameMillisecond)
      .run();
  }

  async function ownerPatch(body: Record<string, unknown>): Promise<Response> {
    return app.request(
      `/api/v1/presets/${presetId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-bot-secret',
          'X-User-Discord-ID': ownerId,
        },
        body: JSON.stringify(body),
      },
      env,
      executionCtx
    );
  }

  async function presetState(): Promise<{
    author_discord_id: string | null;
    status: string;
    tags: string;
    vote_count: number;
    preview_image_key: string | null;
    preview_image_status: string;
  }> {
    const row = await d1
      .prepare(
        `SELECT author_discord_id, status, tags, vote_count, preview_image_key, preview_image_status
         FROM presets WHERE id = ?`
      )
      .bind(presetId)
      .first<{
        author_discord_id: string | null;
        status: string;
        tags: string;
        vote_count: number;
        preview_image_key: string | null;
        preview_image_status: string;
      }>();
    if (!row) throw new Error('seeded preset is missing');
    return row;
  }

  function interleaveFirstOwnerUpdate(write: (database: typeof d1.database) => void | Promise<void>): void {
    let injected = false;
    d1.setBeforeStatement(async ({ sql, database }) => {
      if (!injected && sql.trimStart().startsWith('UPDATE presets')) {
        injected = true;
        d1.setBeforeStatement(undefined);
        await write(database);
      }
    });
  }

  it('returns 409 and preserves a newer moderator flag that lands between the owner read and write', async () => {
    await seedPreset();
    interleaveFirstOwnerUpdate((database) => {
      database
        .prepare("UPDATE presets SET status = 'flagged', updated_at = ? WHERE id = ?")
        .run(sameMillisecond, presetId);
    });

    const response = await ownerPatch({ tags: ['owner-edit'] });

    expect(response.status).toBe(409);
    expect(await presetState()).toMatchObject({ status: 'flagged', tags: '["original"]' });
  });

  it('returns 409 after a same-millisecond status ABA back to approved and does not apply the stale owner edit', async () => {
    await seedPreset();
    interleaveFirstOwnerUpdate((database) => {
      for (const status of ['flagged', 'approved']) {
        database
          .prepare('UPDATE presets SET status = ?, updated_at = ? WHERE id = ?')
          .run(status, sameMillisecond, presetId);
      }
    });

    const response = await ownerPatch({ tags: ['owner-edit'] });

    expect(response.status).toBe(409);
    expect(await presetState()).toMatchObject({ status: 'approved', tags: '["original"]' });
  });

  it('allows exactly one of two owner requests that both read the original revision', async () => {
    await seedPreset();
    let second: Promise<Response> | undefined;
    interleaveFirstOwnerUpdate(async () => {
      second = ownerPatch({ tags: ['second-owner-edit'] });
      await second;
    });

    const first = await ownerPatch({ tags: ['first-owner-edit'] });

    expect([first.status, (await second!).status].sort()).toEqual([200, 409]);
    expect(await presetState()).toMatchObject({ tags: '["second-owner-edit"]' });
  });

  it('returns 409 when ownership changes between the owner read and write', async () => {
    await seedPreset();
    interleaveFirstOwnerUpdate((database) => {
      database
        .prepare('UPDATE presets SET author_discord_id = ?, updated_at = ? WHERE id = ?')
        .run('new-owner-9002', sameMillisecond, presetId);
    });

    const response = await ownerPatch({ tags: ['owner-edit'] });

    expect(response.status).toBe(409);
    expect(await presetState()).toMatchObject({
      author_discord_id: 'new-owner-9002',
      tags: '["original"]',
    });
  });

  it('persists a fresh owner edit', async () => {
    await seedPreset();

    const response = await ownerPatch({ tags: ['fresh-owner-edit'] });

    expect(response.status).toBe(200);
    expect(await presetState()).toMatchObject({
      author_discord_id: ownerId,
      status: 'approved',
      tags: '["fresh-owner-edit"]',
    });
  });

  it('does not reject an owner edit after a vote-only write', async () => {
    await seedPreset();
    interleaveFirstOwnerUpdate((database) => {
      database.prepare('UPDATE presets SET vote_count = vote_count + 1 WHERE id = ?').run(presetId);
    });

    const response = await ownerPatch({ tags: ['after-vote'] });

    expect(response.status).toBe(200);
    expect(await presetState()).toMatchObject({ tags: '["after-vote"]', vote_count: 1 });
  });

  it('does not reject an owner edit after a preview-only write', async () => {
    await seedPreset();
    interleaveFirstOwnerUpdate((database) => {
      database
        .prepare(
          "UPDATE presets SET preview_image_key = 'preset-owner-revision/new.webp', preview_image_status = 'pending' WHERE id = ?"
        )
        .run(presetId);
    });

    const response = await ownerPatch({ tags: ['after-preview'] });

    expect(response.status).toBe(200);
    expect(await presetState()).toMatchObject({
      tags: '["after-preview"]',
      preview_image_key: 'preset-owner-revision/new.webp',
      preview_image_status: 'pending',
    });
  });

  it('returns 409 and leaves a moderator hide in place when a rejected owner resubmission goes stale', async () => {
    await seedPreset('rejected');
    interleaveFirstOwnerUpdate((database) => {
      database
        .prepare("UPDATE presets SET status = 'hidden', updated_at = ? WHERE id = ?")
        .run(sameMillisecond, presetId);
    });

    const response = await ownerPatch({ name: 'Resubmitted name' });

    expect(response.status).toBe(409);
    expect(await presetState()).toMatchObject({
      status: 'hidden',
      tags: '["original"]',
    });
  });
});
