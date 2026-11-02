import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { SqliteD1 } from '../sqlite-d1';
import { createMockEnv } from '../test-utils';

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
const flags = [undefined, 'false', 'TRUE', '1', ' true ', 'garbage', 'true'];
describe('temporary metadata activation boundary', () => {
  let db: SqliteD1; let env: Env; let texts: string[]; let pending: Promise<unknown>[];
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  const snapshot = { name: 'Original', description: 'Original description.', dyes: [4, 5, 6], tags: ['original'] };
  const current = 'https://ffxiv.eorzeacollection.com/glamour/current';
  beforeEach(async () => {
    resetCategoryCache(); db = new SqliteD1(schema); texts = []; pending = [];
    env = createMockEnv({ DB: db as unknown as D1Database, PERSPECTIVE_API_KEY: 'key' });
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => { texts.push((JSON.parse(String(init.body)) as { comment: { text: string } }).comment.text); return Response.json({ attributeScores: { TOXICITY: { summaryScore: { value: 0.95 } } } }); });
    app = new Hono(); app.use('*', authMiddleware); app.route('/presets', presetsRouter); app.route('/moderation', moderationRouter);
    await db.prepare("INSERT INTO presets (id,name,description,category_id,dyes,tags,status,author_discord_id,example_link,dye_signature) VALUES ('p','Stored name','Stored description.','jobs','[1,2,3]','[\"storedtag\"]','approved','owner',?,'[1,2,3]')").bind(current).run();
  });
  afterEach(async () => { await Promise.all(pending); db.close(); vi.unstubAllGlobals(); });
  function mode(flag: string | undefined) { Object.assign(env, { PRESET_METADATA_MODERATION_ENABLED: flag }); }
  function request(path: string, method = 'GET', body?: unknown) {
    return app.request(path, { method, headers: { Authorization: 'Bearer test-bot-secret', 'X-User-Discord-ID': path.startsWith('/moderation') ? '123456789' : 'owner', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, env,
      { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext);
  }
  async function state() { return (await db.prepare("SELECT * FROM presets WHERE id='p'").first())!; }
  async function used(kind: string) { return (await db.prepare('SELECT COUNT(*) n FROM submission_events WHERE kind=?').bind(kind).first<{ n: number }>())!.n; }
  it.each(flags)('flag %s gates new scorer fields on create while submission admission stays active', async flag => {
    mode(flag);
    const res = await request('/presets', 'POST', { name: 'Ocean palette', description: 'A calm ocean palette.', category_id: 'jobs', dyes: [7, 8, 9], tags: ['newtagmarker'], example_link: 'https://ffxiv.eorzeacollection.com/glamour/pathmarker?q=private#hidden' });
    expect(res.status).toBe(201); expect(texts).toHaveLength(1); expect(await used('submission')).toBe(1);
    if (flag === 'true') { expect(texts[0]).toContain('newtagmarker'); expect(texts[0]).toContain('pathmarker'); }
    else expect(texts[0]).toBe('Ocean palette A calm ocean palette.');
    expect(texts[0]).not.toMatch(/eorzeacollection|private|hidden/);
  });
  it.each(flags)('flag %s gates metadata-only quota, status and new snapshot link together', async flag => {
    mode(flag);
    const res = await request('/presets/p', 'PATCH', { tags: ['changedtag'], example_link: current + '?new=1' }); expect(res.status).toBe(200);
    const after = await state();
    if (flag === 'true') {
      expect(texts).toHaveLength(1); expect(await used('text_edit')).toBe(1); expect(await used('flagged_edit')).toBe(1);
      expect(after.status).toBe('pending'); expect(JSON.parse(String(after.previous_values))).toMatchObject({ example_link: current });
    } else {
      expect(texts).toHaveLength(0); expect(await used('text_edit')).toBe(0); expect(await used('flagged_edit')).toBe(0);
      expect(after.status).toBe('approved'); expect(after.previous_values).toBeNull();
    }
    expect(after.example_link).toBe(current + '?new=1');
  });
  it.each(flags)('flag %s preserves name moderation while gating newly captured snapshot link', async flag => {
    mode(flag); expect((await request('/presets/p', 'PATCH', { name: 'Changed name' })).status).toBe(200);
    expect(texts).toHaveLength(1); expect(await used('text_edit')).toBe(1);
    const after = await state(); expect(after.status).toBe('pending');
    const previous = JSON.parse(String(after.previous_values)) as Record<string, unknown>;
    expect(Object.hasOwn(previous, 'example_link')).toBe(flag === 'true');
    if (flag === 'true') expect(previous.example_link).toBe(current);
    else expect(texts[0]).toBe('Changed name Stored description.');
  });
  it.each(flags)('flag %s controls only missing legacy link view and revert, with exact raw CAS', async flag => {
    mode(flag); const raw = JSON.stringify(snapshot);
    await db.prepare("UPDATE presets SET status='pending',previous_values=? WHERE id='p'").bind(raw).run();
    const before = await state(); const review = await request('/moderation/p'); expect(review.status).toBe(200);
    const view = await review.json() as { preset: { previous_values: Record<string, unknown> }; content_revision: number };
    expect(Object.hasOwn(view.preset.previous_values, 'example_link')).toBe(flag === 'true');
    if (flag === 'true') expect(view.preset.previous_values.example_link).toBeNull();
    const ownerView = await (await request('/presets/p')).json() as { previous_values: Record<string, unknown> };
    expect(Object.hasOwn(ownerView.previous_values, 'example_link')).toBe(flag === 'true');
    const mine = await (await request('/presets/mine')).json() as { presets: { previous_values: Record<string, unknown> }[] };
    expect(Object.hasOwn(mine.presets[0].previous_values, 'example_link')).toBe(flag === 'true');
    const queue = await (await request('/moderation/pending')).json() as { presets: { previous_values: Record<string, unknown> }[] };
    expect(Object.hasOwn(queue.presets[0].previous_values, 'example_link')).toBe(flag === 'true');
    expect((await state()).previous_values).toBe(raw);
    const response = await request('/moderation/p/revert', 'PATCH', { reason: 'Restore original content', expected_revision: view.content_revision, expected_status: 'pending' });
    expect(response.status).toBe(200); expect((await state()).example_link).toBe(flag === 'true' ? null : current);
    expect(before.previous_values).toBe(raw);
  });
  it.each([undefined, 'false', 'true'])('flag %s cannot downgrade an explicitly recorded target during rollback', async flag => {
    mode(flag);
    for (const target of [null, '  https://ffxiv.eorzeacollection.com/glamour/original  ', 'https://evil.example/untrusted']) {
      const raw = JSON.stringify({ ...snapshot, example_link: target });
      await db.prepare("UPDATE presets SET status='pending',previous_values=?,example_link=? WHERE id='p'").bind(raw, current).run();
      const before = await state(); const view = await (await request('/moderation/p')).json() as { preset: { previous_values: Record<string, unknown> }; content_revision: number };
      expect(view.preset.previous_values.example_link).toBe(target);
      const response = await request('/moderation/p/revert', 'PATCH', { reason: 'Restore original content', expected_revision: view.content_revision, expected_status: 'pending' });
      if (target === 'https://evil.example/untrusted') { expect(response.status).toBe(400); expect(await state()).toEqual(before); }
      else { expect(response.status).toBe(200); expect((await state()).example_link).toBe(target === null ? null : 'https://ffxiv.eorzeacollection.com/glamour/original'); }
    }
  });
});
