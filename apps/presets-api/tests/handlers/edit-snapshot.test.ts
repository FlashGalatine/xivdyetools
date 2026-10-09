/**
 * BUG-003 follow-up (2026-10-04 deep-dive): the write-once revert snapshot
 * (`previous_values`, BUG-052) holds only text that was live as `approved`.
 *
 * A revert restores the snapshot AND approves it. The snapshot used to be
 * taken by the first owner edit that tripped moderation whatever the stored
 * status, so a rejected preset's flagged resubmission snapshotted the rejected
 * text, a pending preset's snapshotted text nobody had approved — and since
 * only a revert ever clears the snapshot, a later approval left it in place:
 * the next flagged edit then offered a Revert that would publish the rejected
 * text. Now only an edit of an `approved` preset takes one.
 *
 * SQLite-backed (the real schema and trigger), so `previous_values` is read
 * back from the row, not inferred from the SQL text. No PERSPECTIVE_API_KEY is
 * configured, so every changed text comes back `unscored` — which the edit
 * path handles exactly like flagged text (FINDING-005 / FINDING-019).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moderationRouter } from '../../src/handlers/moderation';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { SqliteD1 } from '../sqlite-d1';

type Variables = { auth: AuthContext };

/** What discord-worker receives on `/webhooks/preset-submission`. */
type NotificationBody = {
  is_edit?: boolean;
  edited_from_status?: string;
  preset: { status: string; previous_values?: unknown };
};

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const presetId = 'preset-edit-snapshot';
const ownerId = 'owner-9001';
const moderatorId = '123456789';

/** The text the preset holds before the edit under test. */
const STORED = {
  name: 'Stored name',
  description: 'The stored description, long enough.',
  tags: ['stored'],
  dyes: [1, 2, 3],
};

/** A snapshot written by an earlier edit. */
const OLDER_SNAPSHOT = {
  name: 'Older name',
  description: 'An older description, long enough.',
  tags: ['older'],
  dyes: [1, 2, 3],
};

describe('the revert snapshot holds only approved text (BUG-003 follow-up)', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let d1: SqliteD1;
  let env: Env;
  let bodies: NotificationBody[];
  let pending: Promise<unknown>[];
  let ctx: ExecutionContext;

  beforeEach(() => {
    resetCategoryCache();
    d1 = new SqliteD1(schema);
    bodies = [];
    pending = [];
    env = createMockEnv({
      DB: d1 as unknown as D1Database,
      INTERNAL_WEBHOOK_SECRET: 'webhook-secret',
      DISCORD_WORKER: {
        fetch: async (request: Request) => {
          bodies.push((await request.json()) as NotificationBody);
          return new Response('ok', { status: 200 });
        },
      } as unknown as Fetcher,
    });
    ctx = {
      waitUntil: (p: Promise<unknown>) => pending.push(p),
      passThroughOnException: () => {},
    } as unknown as ExecutionContext;
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.route('/api/v1/presets', presetsRouter);
    app.route('/api/v1/moderation', moderationRouter);
  });

  afterEach(() => {
    d1.close();
  });

  async function seed(status: string, snapshot: typeof OLDER_SNAPSHOT | null = null): Promise<void> {
    await d1
      .prepare(
        `INSERT INTO presets (
          id, name, description, category_id, dyes, tags, author_discord_id, author_name,
          status, dye_signature, previous_values
        ) VALUES (?, ?, ?, 'jobs', ?, ?, ?, 'Owner', ?, ?, ?)`
      )
      .bind(
        presetId,
        STORED.name,
        STORED.description,
        JSON.stringify(STORED.dyes),
        JSON.stringify(STORED.tags),
        ownerId,
        status,
        JSON.stringify(STORED.dyes),
        snapshot ? JSON.stringify(snapshot) : null
      )
      .run();
  }

  function headers(userId: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-bot-secret',
      'X-User-Discord-ID': userId,
    };
  }

  /** An owner text edit — new text, so it is moderated and (unscored) trips it. */
  async function ownerEdit(name: string): Promise<Response> {
    const res = await app.request(
      `/api/v1/presets/${presetId}`,
      { method: 'PATCH', headers: headers(ownerId), body: JSON.stringify({ name }) },
      env,
      ctx
    );
    await Promise.allSettled(pending);
    return res;
  }

  async function stored(): Promise<{ status: string; previous_values: string | null; content_revision: number }> {
    const r = await d1
      .prepare('SELECT status, previous_values, content_revision FROM presets WHERE id = ?')
      .bind(presetId)
      .first<{ status: string; previous_values: string | null; content_revision: number }>();
    if (!r) throw new Error('seeded preset is missing');
    return r;
  }

  it('snapshots the approved text when an approved preset is edited into the queue', async () => {
    await seed('approved');

    const res = await ownerEdit('An edited name');

    expect(res.status).toBe(200);
    const row = await stored();
    expect(row.status).toBe('pending');
    expect(JSON.parse(row.previous_values!)).toEqual(STORED);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ is_edit: true, edited_from_status: 'approved' });
    expect(bodies[0].preset.previous_values).toEqual(STORED);
  });

  it('keeps an approved preset\'s existing snapshot (write-once)', async () => {
    await seed('approved', OLDER_SNAPSHOT);

    const res = await ownerEdit('An edited name');

    expect(res.status).toBe(200);
    const row = await stored();
    expect(row.status).toBe('pending');
    expect(JSON.parse(row.previous_values!)).toEqual(OLDER_SNAPSHOT);
  });

  it('takes no snapshot when a rejected preset is resubmitted with text that trips moderation', async () => {
    await seed('rejected');

    const res = await ownerEdit('A resubmitted name');

    expect(res.status).toBe(200);
    const row = await stored();
    expect(row.status).toBe('pending');
    expect(row.previous_values).toBeNull();
    // So the moderation embed has nothing to offer a Revert on
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ is_edit: true, edited_from_status: 'rejected' });
    expect(bodies[0].preset.previous_values).toBeNull();
  });

  it('takes no snapshot when a pending preset is edited with text that trips moderation', async () => {
    await seed('pending');

    const res = await ownerEdit('A re-edited name');

    expect(res.status).toBe(200);
    const row = await stored();
    expect(row.status).toBe('pending');
    expect(row.previous_values).toBeNull();
    expect(bodies).toHaveLength(1);
    expect(bodies[0].preset.previous_values).toBeNull();
  });

  it('takes no snapshot when a flagged preset is edited with text that trips moderation', async () => {
    await seed('flagged');

    const res = await ownerEdit('A re-edited name');

    expect(res.status).toBe(200);
    const row = await stored();
    expect(row.status).toBe('flagged');
    expect(row.previous_values).toBeNull();
    // `flagged` is the moderator's own state: no owner edit notifies them
    expect(bodies).toHaveLength(0);
  });

  it('leaves a snapshot a pending preset already holds untouched — no new one, and no clean-up', async () => {
    // A row written before this rule: the snapshot may hold text nobody
    // approved. An owner edit neither replaces it nor clears it — that is a
    // deploy-time data question, not something an edit should decide.
    await seed('pending', OLDER_SNAPSHOT);

    const res = await ownerEdit('A re-edited name');

    expect(res.status).toBe(200);
    expect(JSON.parse((await stored()).previous_values!)).toEqual(OLDER_SNAPSHOT);
  });

  it('no longer lets a rejected text ride a later approval into a Revert', async () => {
    // The sequence the old rule allowed: resubmit a rejected preset with text
    // that trips moderation (old rule: snapshot of the REJECTED text), a
    // moderator approves the resubmission (approval never clears a snapshot),
    // then a further edit trips moderation — and the embed offered Revert to
    // the rejected text, now marked as an edit of an approved preset.
    await seed('rejected');
    expect((await ownerEdit('A resubmitted name')).status).toBe(200);

    const queued = await stored();
    const approve = await app.request(
      `/api/v1/moderation/${presetId}/status`,
      {
        method: 'PATCH',
        headers: headers(moderatorId),
        body: JSON.stringify({
          status: 'approved',
          expected_revision: queued.content_revision,
          expected_status: 'pending',
        }),
      },
      env,
      ctx
    );
    expect(approve.status).toBe(200);
    expect((await stored()).status).toBe('approved');

    expect((await ownerEdit('A further edited name')).status).toBe(200);

    const last = bodies[bodies.length - 1];
    expect(last).toMatchObject({ is_edit: true, edited_from_status: 'approved' });
    // The snapshot is the text the moderator approved — never the rejected one
    expect(last.preset.previous_values).toEqual({ ...STORED, name: 'A resubmitted name' });
    expect(JSON.parse((await stored()).previous_values!)).toEqual({ ...STORED, name: 'A resubmitted name' });
  });
});
