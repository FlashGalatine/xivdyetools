import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { SqliteD1 } from '../sqlite-d1';
import { createMockEnv } from '../test-utils';

const schema = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url).toString()), 'utf8');
describe('metadata edits, effective categories and bounded pagination', () => {
  let db: SqliteD1; let env: Env;
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  let texts: string[]; let notices: unknown[]; let pending: Promise<unknown>[];
  let toxicity: number;
  beforeEach(async () => {
    resetCategoryCache(); db = new SqliteD1(schema); texts = []; notices = []; pending = []; toxicity = 0.01;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      texts.push((JSON.parse(String(init.body)) as { comment: { text: string } }).comment.text);
      return Response.json({ attributeScores: { TOXICITY: { summaryScore: { value: toxicity } } } });
    });
    env = createMockEnv({ DB: db as unknown as D1Database, PRESET_METADATA_MODERATION_ENABLED: 'true', PERSPECTIVE_API_KEY: 'key', INTERNAL_WEBHOOK_SECRET: 'secret',
      DISCORD_WORKER: { fetch: async (req: Request) => { notices.push(await req.json()); return new Response('ok'); } } as unknown as Fetcher });
    app = new Hono(); app.use('*', authMiddleware); app.route('/presets', presetsRouter);
    await db.prepare("INSERT INTO presets (id,name,description,category_id,secondary_categories,dyes,tags,author_discord_id,author_name,status,example_link,dye_signature) VALUES ('p','Stored name','A calm stored description.','jobs','[\"events\"]','[1,2,3]','[\"stored\"]','owner','Owner','approved','https://ffxiv.eorzeacollection.com/glamour/original?old=1','[1,2,3]')").run();
  });
  afterEach(async () => { await Promise.all(pending); db.close(); vi.unstubAllGlobals(); });
  function edit(body: Record<string, unknown>) {
    return app.request('/presets/p', { method: 'PATCH', headers: { Authorization: 'Bearer test-bot-secret', 'X-User-Discord-ID': 'owner', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, env,
      { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext);
  }
  async function used() { return (await db.prepare("SELECT COUNT(*) n FROM submission_events WHERE kind='text_edit'").first<{ n: number }>())!.n; }
  async function row() { return (await db.prepare("SELECT * FROM presets WHERE id='p'").first())!; }
  it.each(['approved', 'pending', 'rejected', 'flagged'])('tag changes on %s are scored and charged with established status behavior', async status => {
    await db.prepare("UPDATE presets SET status=? WHERE id='p'").bind(status).run();
    const res = await edit({ tags: ['changedmarker'] }); expect(res.status).toBe(200);
    expect(await used()).toBe(1); expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('changedmarker'); expect(texts[0]).toContain('Stored name'); expect(texts[0]).toContain('original');
    expect((await row()).status).toBe(status === 'rejected' ? 'pending' : status);
    await Promise.all(pending); expect(notices).toHaveLength(['pending', 'rejected'].includes(status) ? 1 : 0);
  });
  it.each(['approved', 'pending', 'rejected', 'flagged'])('flagged link edits on %s preserve owner status rules', async status => {
    await db.prepare("UPDATE presets SET status=? WHERE id='p'").bind(status).run(); toxicity = 0.95;
    expect((await edit({ example_link: 'https://ffxiv.eorzeacollection.com/glamour/newpath' })).status).toBe(200);
    expect(texts[0]).toContain('newpath'); expect(await used()).toBe(1);
    expect((await row()).status).toBe(status === 'flagged' ? 'flagged' : 'pending');
    await Promise.all(pending); expect(notices).toHaveLength(status === 'flagged' ? 0 : 1);
    const snapshot = (await row()).previous_values;
    if (status === 'approved') expect(JSON.parse(String(snapshot))).toMatchObject({ example_link: 'https://ffxiv.eorzeacollection.com/glamour/original?old=1' });
    else expect(snapshot).toBeNull();
  });
  it('all four effective fields resubmitted unchanged consume no quota or call', async () => {
    expect((await edit({ name: 'Stored name', description: 'A calm stored description.', tags: ['stored'], example_link: 'https://ffxiv.eorzeacollection.com/glamour/original?old=1' })).status).toBe(200);
    expect(await used()).toBe(0); expect(texts).toHaveLength(0);
  });
  it.each([
    { before: null, after: 'https://ffxiv.eorzeacollection.com/glamour/new' },
    { before: 'https://ffxiv.eorzeacollection.com/glamour/original?old=1', after: 'https://ffxiv.eorzeacollection.com/glamour/original?new=1' },
    { before: 'https://ffxiv.eorzeacollection.com/glamour/original?old=1', after: null },
  ])('the actual edit notification carries replaced link $before and current link $after', async ({ before, after }) => {
    await db.prepare("UPDATE presets SET example_link=? WHERE id='p'").bind(before).run(); toxicity = 0.95;
    expect((await edit({ example_link: after })).status).toBe(200);
    await Promise.all(pending); expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ edited_from: { example_link: before }, preset: { example_link: after } });
    expect(await used()).toBe(1);
  });
  it.each(['?new=1', '?old=1#newfragment'])('a query/fragment-only stored link change %s consumes a text slot', async suffix => {
    expect((await edit({ example_link: 'https://ffxiv.eorzeacollection.com/glamour/original' + suffix })).status).toBe(200);
    expect(await used()).toBe(1); expect(texts).toHaveLength(1);
    expect(texts[0]).not.toMatch(/newfragment|old=|new=/);
  });
  it('exhausted text quota stops metadata moderation and all writes', async () => {
    for (let i = 0; i < 30; i++) await db.prepare("INSERT INTO submission_events (user_discord_id,kind) VALUES ('owner','text_edit')").run();
    const before = await row();
    expect((await edit({ tags: ['changed'] })).status).toBe(429);
    expect(texts).toHaveLength(0); expect(await row()).toEqual(before); expect(notices).toHaveLength(0);
  });
  it.each(['missing', 'outage'])('metadata editing with scorer %s queues approved content', async failure => {
    if (failure === 'missing') env.PERSPECTIVE_API_KEY = undefined;
    else vi.stubGlobal('fetch', async () => new Response('unavailable', { status: 503 }));
    expect((await edit({ tags: ['changed'] })).status).toBe(200);
    expect((await row()).status).toBe('pending'); expect(await used()).toBe(1);
  });
  it('new snapshots include explicit null links and remain write-once', async () => {
    await db.prepare("UPDATE presets SET example_link=NULL WHERE id='p'").run(); toxicity = 0.99;
    expect((await edit({ tags: ['first'] })).status).toBe(200);
    const snapshot = String((await row()).previous_values);
    expect(JSON.parse(snapshot)).toMatchObject({ example_link: null });
    expect((await edit({ tags: ['second'] })).status).toBe(200);
    expect((await row()).previous_values).toBe(snapshot);
  });
  it('rejects promoting an omitted stored secondary to primary', async () => {
    const before = await row(); expect((await edit({ category_id: 'events' })).status).toBe(400);
    expect(await row()).toEqual(before); expect(await used()).toBe(0);
  });
  it('explicit null primary is invalid rather than an omitted-field fallback', async () => {
    const before = await row(); expect((await edit({ category_id: null })).status).toBe(400);
    expect(await row()).toEqual(before); expect(texts).toHaveLength(0);
  });
  it.each([{ secondary: ['jobs'] }, { secondary: ['events', 'events'] }, { secondary: ['unknown'] }, { secondary: ['events', 'seasons', 'zones'] }])('rejects stored invalid effective secondary values $secondary', async ({ secondary }) => {
    await db.prepare("UPDATE presets SET secondary_categories=? WHERE id='p'").bind(JSON.stringify(secondary)).run();
    const before = await row(); expect((await edit({ category_id: 'jobs' })).status).toBe(400); expect(await row()).toEqual(before);
  });
  it('allows unchanged valid categories and explicit secondary clearing without text quota or revision drift', async () => {
    const before = await row();
    expect((await edit({ category_id: 'jobs' })).status).toBe(200);
    expect((await row()).secondary_categories).toBe('["events"]');
    expect((await row()).content_revision).toBe(before.content_revision);
    expect((await edit({ category_id: 'events', secondary_categories: [] })).status).toBe(200);
    expect((await row()).secondary_categories).toBe('[]');
    expect(await used()).toBe(0); expect(texts).toHaveLength(0);
    expect((await row()).content_revision).toBe(Number(before.content_revision) + 1);
  });
  it.each([
    [undefined, undefined, 1, 20], ['NaN', 'nope', 1, 20], ['-100', '-2', 1, 1], ['7suffix', '200', 7, 50],
    ['10000', '2', 10000, 2], ['10001', '50', 10000, 50], ['9'.repeat(400), '50', 10000, 50],
  ])('bounds pagination page %s limit %s before DB offset', async (page, limit, wantPage, wantLimit) => {
    const query = new URLSearchParams(); if (page !== undefined) query.set('page', page); if (limit !== undefined) query.set('limit', limit);
    const res = await app.request('/presets?' + query.toString(), {}, env); expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ page: wantPage, limit: wantLimit });
  });
});
