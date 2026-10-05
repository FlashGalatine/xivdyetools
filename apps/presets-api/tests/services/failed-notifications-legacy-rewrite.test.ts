/**
 * One-off rollout statement for pre-FINDING-017 dead letters (2.4.0 CHANGELOG,
 * "Rollout"). Rows written before 2026-08-30 (commit 780cf992) hold the whole
 * notification (author id, author name, preset text); the statement rewrites
 * them in place to `toDeadLetterRecord`'s reduced shape.
 *
 * The SQL under test is read from migrations/0015_rewrite_legacy_dead_letters.sql,
 * the file the operator runs with `wrangler d1 execute --file`. Real SQLite,
 * schema from schema.sql.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listFailedNotifications } from '../../src/services/notification-service';
import { SqliteD1 } from '../sqlite-d1';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url).toString()), 'utf8').replace(/\r\n/g, '\n');

const schema = read('../../schema.sql');
// Comment lines stripped; what remains is the single UPDATE the operator runs.
const rolloutSql = read('../../migrations/0015_rewrite_legacy_dead_letters.sql')
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.startsWith('--'))
  .join('\n');

const legacySubmission = JSON.stringify({
  type: 'submission',
  preset: {
    id: 'preset-legacy-1',
    name: 'Sunset over Costa del Sol',
    description: 'Warm oranges',
    category_id: 'aesthetics',
    dyes: [1, 2, 3],
    tags: ['warm'],
    author_name: 'Author Displayname',
    author_discord_id: '123456789012345678',
    status: 'pending',
    moderation_status: 'flagged',
    source: 'web',
    created_at: '2026-08-01T11:00:00.000Z',
  },
});

const legacyPreview = JSON.stringify({
  type: 'preview_image',
  preview_image_key: 'pending/preset-legacy-2/abc.webp',
  preset: { id: 'preset-legacy-2', name: 'Another', author_name: 'Author Displayname' },
});

const currentSubmission = JSON.stringify({
  type: 'submission',
  preset_id: 'preset-current',
  moderation_status: 'clean',
  content_revision: 3,
});

describe('legacy dead-letter rewrite (one-off rollout SQL)', () => {
  let d1: SqliteD1;

  const insert = (payload: string, resolvedAt: string | null = null): void => {
    d1.database
      .prepare('INSERT INTO failed_notifications (payload, error, attempts, resolved_at) VALUES (?, ?, 4, ?)')
      .run(payload, 'timeout', resolvedAt);
  };
  const payloads = (): string[] =>
    (d1.database.prepare('SELECT payload FROM failed_notifications ORDER BY id').all() as { payload: string }[]).map(
      (r) => r.payload
    );

  beforeEach(() => {
    d1 = new SqliteD1(schema);
    insert(legacySubmission);
    // Resolved a day ago: inside the 30-day window, so the listing's own prune keeps it.
    insert(legacyPreview, new Date(Date.now() - 86_400_000).toISOString().slice(0, 19).replace('T', ' '));
    insert(currentSubmission);
    insert('not json at all');
  });
  afterEach(() => d1.close());

  it('rewrites legacy rows to the reduced shape and leaves every other row untouched', () => {
    d1.database.exec(rolloutSql);

    const [sub, preview, current, garbage] = payloads();
    expect(JSON.parse(sub)).toEqual({
      type: 'submission',
      preset_id: 'preset-legacy-1',
      moderation_status: 'flagged',
    });
    expect(JSON.parse(preview)).toEqual({ type: 'preview_image', preset_id: 'preset-legacy-2' });
    expect(current).toBe(currentSubmission);
    expect(garbage).toBe('not json at all');

    const all = payloads().join('');
    expect(all).not.toContain('author_discord_id');
    expect(all).not.toContain('Author Displayname');
    expect(all).not.toContain('Sunset over Costa del Sol');
  });

  it('is idempotent: a second run changes nothing', () => {
    d1.database.exec(rolloutSql);
    const once = payloads();
    d1.database.exec(rolloutSql);
    expect(payloads()).toEqual(once);
  });

  it('leaves a rewritten row readable by the moderator listing (no content_revision needed)', async () => {
    d1.database.exec(rolloutSql);

    const rows = await listFailedNotifications(d1 as unknown as D1Database, true);
    const byId = new Map(rows.map((r) => [r.preset_id, r]));

    expect(byId.get('preset-legacy-1')).toMatchObject({
      type: 'submission',
      preset_id: 'preset-legacy-1',
      moderation_status: 'flagged',
      error: 'timeout',
      attempts: 4,
      resolved_at: null,
    });
    expect(byId.get('preset-legacy-2')).toMatchObject({
      type: 'preview_image',
      preset_id: 'preset-legacy-2',
    });
    expect(byId.get('preset-legacy-2')?.moderation_status).toBeUndefined();
  });

  it('is still matched by the preset-delete batch (json $.preset_id) after the rewrite', async () => {
    d1.database.exec(rolloutSql);
    // The exact predicate DELETE /presets/:id binds (handlers/presets.ts).
    await d1
      .prepare(
        `DELETE FROM failed_notifications
       WHERE json_valid(payload)
         AND (json_extract(payload, '$.preset_id') = ? OR json_extract(payload, '$.preset.id') = ?)`
      )
      .bind('preset-legacy-1', 'preset-legacy-1')
      .run();

    const remaining = payloads().map((p) => (p.startsWith('{') ? (JSON.parse(p) as { preset_id: string }).preset_id : p));
    expect(remaining).toEqual(['preset-legacy-2', 'preset-current', 'not json at all']);
  });
});
