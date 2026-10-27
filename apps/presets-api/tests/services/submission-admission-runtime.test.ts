import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetsRouter, resetCategoryCache } from '../../src/handlers/presets';
import { authMiddleware } from '../../src/middleware/auth';
import { getEffectiveSubmissionCountToday } from '../../src/services/rate-limit-service';
import type { AuthContext, Env } from '../../src/types';
import { createD1Runtime } from '../d1-runtime';
import { createMockEnv } from '../test-utils';

describe('submission admission on real local D1', () => {
  let runtime: Awaited<ReturnType<typeof createD1Runtime>>;
  let db: D1Database;
  let env: Env;
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  let payloads: { comment: { text: string }; doNotStore: boolean }[];
  let notices: unknown[];
  let pending: Promise<unknown>[];
  let scorer: () => Promise<void>;
  const owner = 'owner-admission';
  const today = () => new Date().toISOString().slice(0, 10) + 'T12:00:00.000Z';
  beforeAll(async () => { runtime = await createD1Runtime(); db = runtime.db; }, 30000);
  afterAll(async () => { await runtime?.dispose(); });
  beforeEach(async () => {
    await db.batch(['votes', 'moderation_log', 'presets', 'submission_events', 'banned_users', 'failed_notifications'].map(t => db.prepare(`DELETE FROM ${t}`)));
    resetCategoryCache();
    payloads = []; notices = []; pending = [];
    scorer = async () => {};
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      payloads.push(JSON.parse(String(init.body)) as typeof payloads[number]);
      await scorer();
      return Response.json({ attributeScores: { TOXICITY: { summaryScore: { value: 0.01 } } } });
    });
    env = createMockEnv({ DB: db, PRESET_METADATA_MODERATION_ENABLED: 'true', PERSPECTIVE_API_KEY: 'key', INTERNAL_WEBHOOK_SECRET: 'secret',
      DISCORD_WORKER: { fetch: async (request: Request) => { notices.push(await request.json()); return new Response('ok'); } } as unknown as Fetcher });
    app = new Hono(); app.use('*', authMiddleware); app.route('/presets', presetsRouter);
  });
  afterEach(async () => { await Promise.all(pending); vi.unstubAllGlobals(); vi.useRealTimers(); });
  function request(dyes = [1, 2, 3], extra: Record<string, unknown> = {}) {
    return app.request('/presets', { method: 'POST', headers: { Authorization: 'Bearer test-bot-secret', 'X-User-Discord-ID': owner, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ocean palette', description: 'A calm ocean palette.', category_id: 'jobs', tags: ['tagmarker'], dyes, ...extra }) }, env,
    { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext);
  }
  async function events(n: number) {
    for (let i = 0; i < n; i++) await db.prepare("INSERT INTO submission_events (user_discord_id,kind,preset_id,created_at) VALUES (?,'submission',?,?)").bind(owner, `deleted-${i}`, today()).run();
  }
  async function legacy(id: string, time = today()) {
    await db.prepare("INSERT INTO presets (id,name,description,category_id,dyes,tags,author_discord_id,created_at) VALUES (?,'Legacy','Legacy description','jobs','[90,91,92]','[]',?,?)").bind(id, owner, time).run();
  }
  async function counts() {
    const count = async (table: string) => (await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first<{ n: number }>())!.n;
    return { presets: await count('presets'), events: await count('submission_events'), votes: await count('votes') };
  }
  async function reporting() {
    const res = await app.request('/presets/rate-limit', { headers: { Authorization: 'Bearer test-bot-secret', 'X-User-Discord-ID': owner } }, env);
    return await res.json() as { remaining: number; reset_at: string };
  }
  it.each([2, 12])('admits exactly one distinct submission at cap minus one from %i contenders', async n => {
    await events(9);
    const responses = await Promise.all(Array.from({ length: n }, (_, i) => request([1, 2, 10 + i])));
    expect(responses.filter(r => r.status === 201)).toHaveLength(1);
    expect(responses.filter(r => r.status === 429)).toHaveLength(n - 1);
    expect(payloads).toHaveLength(1);
    await Promise.all(pending);
    expect(notices).toHaveLength(1);
    expect(await counts()).toEqual({ presets: 1, events: 10, votes: 1 });
    expect((await reporting()).remaining).toBe(0);
    const winner = responses.find(r => r.status === 201)!;
    const body = await winner.json() as { preset: { id: string; vote_count: number }; remaining_submissions: number };
    expect(body.preset.vote_count).toBe(1);
    expect(body.remaining_submissions).toBe(0);
    const event = await db.prepare('SELECT preset_id FROM submission_events ORDER BY id DESC LIMIT 1').first<{ preset_id: string }>();
    expect(event!.preset_id).toBe(body.preset.id);
  });
  it('same-dye last-slot contenders cannot spend multiple moderation calls', async () => {
    await events(9);
    // Hold actual duplicate-query results until every contender has read.
    // All four then reach real conditional admission with the same cheap view.
    const prepare = db.prepare.bind(db);
    let readers = 0;
    let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    env.DB = { prepare(sql: string) {
      const statement = prepare(sql);
      if (!sql.includes("WHERE dye_signature = ? AND status IN")) return statement;
      const bind = statement.bind.bind(statement);
      statement.bind = (...values: unknown[]) => {
        const bound = bind(...values); const first = bound.first.bind(bound);
        bound.first = async <T>() => { const result = await first<T>(); if (++readers === 4) release(); await gate; return result; };
        return bound;
      };
      return statement;
    }, batch: db.batch.bind(db) } as D1Database;
    const responses = await Promise.all([request(), request(), request(), request()]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 429, 429, 429]);
    expect(payloads).toHaveLength(1);
    expect(await counts()).toEqual({ presets: 1, events: 10, votes: 1 });
  });
  it('quota denial performs no moderation, create, vote or notification', async () => {
    await events(10);
    const res = await request();
    expect(res.status).toBe(429);
    expect(await counts()).toEqual({ presets: 0, events: 10, votes: 0 });
    expect(payloads).toHaveLength(0); expect(notices).toHaveLength(0); expect(pending).toHaveLength(0);
  });
  it('a known duplicate votes without reserving or moderating at exhausted submission quota', async () => {
    await legacy('known'); await events(10);
    await db.prepare("UPDATE presets SET status='approved',dye_signature='[90,91,92]' WHERE id='known'").run();
    const res = await request([90, 91, 92]);
    expect(res.status).toBe(200);
    expect(await counts()).toEqual({ presets: 1, events: 10, votes: 1 });
    expect(payloads).toHaveLength(0);
  });
  it('counts today events plus unrelated legacy rows, with all reporting paths agreeing', async () => {
    await events(1); await legacy('legacy');
    expect(await getEffectiveSubmissionCountToday(db, owner)).toBe(2);
    expect((await reporting()).remaining).toBe(8);
    const res = await request();
    expect(res.status).toBe(201);
    expect((await res.json() as { remaining_submissions: number }).remaining_submissions).toBe(7);
    expect(await getEffectiveSubmissionCountToday(db, owner)).toBe(3);
    expect((await reporting()).remaining).toBe(7);
  });
  it.each(['other-user', 'other-kind'])('a matching ID in %s does not represent the legacy row', async variant => {
    await legacy('legacy');
    await db.prepare('INSERT INTO submission_events (user_discord_id,kind,preset_id,created_at) VALUES (?,?,?,?)').bind(variant === 'other-user' ? 'someone-else' : owner, variant === 'other-kind' ? 'text_edit' : 'submission', 'legacy', today()).run();
    expect(await getEffectiveSubmissionCountToday(db, owner)).toBe(1);
    await events(8);
    expect((await reporting()).remaining).toBe(1);
    const res = await request(); expect(res.status).toBe(201);
    expect((await reporting()).remaining).toBe(0);
  });
  it('yesterday admission completing today is charged only yesterday, and reports a coherent current window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-26T23:59:59.000Z'));
    scorer = async () => { vi.setSystemTime(new Date('2026-10-27T00:00:01.000Z')); };
    const res = await request(); expect(res.status).toBe(201);
    const body = await res.json() as { remaining_submissions: number; preset: { id: string } };
    expect(body.remaining_submissions).toBe(10);
    const event = await db.prepare('SELECT preset_id,created_at FROM submission_events').first();
    expect(event).toEqual({ preset_id: body.preset.id, created_at: '2026-10-26T23:59:59.000Z' });
    expect(await getEffectiveSubmissionCountToday(db, owner)).toBe(0);
    expect(await reporting()).toMatchObject({ remaining: 10, reset_at: '2026-10-28T00:00:00.000Z' });
  });
  it('admission database outage fails closed with 503 before any paid work', async () => {
    const prepare = db.prepare.bind(db);
    env.DB = { prepare(sql: string) { if (/INSERT INTO submission_events/.test(sql)) throw new Error('admission unavailable'); return prepare(sql); }, batch: db.batch.bind(db) } as D1Database;
    const res = await request(); expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ success: false, error: 'SERVICE_UNAVAILABLE', message: 'Daily submission limits are temporarily unavailable. Please try again later.' });
    expect(await counts()).toEqual({ presets: 0, events: 0, votes: 0 });
    expect(payloads).toHaveLength(0); expect(notices).toHaveLength(0); expect(pending).toHaveLength(0);
  });
  it('a database create failure retains the already spent moderation attempt', async () => {
    const prepare = db.prepare.bind(db);
    env.DB = { prepare(sql: string) { if (/INSERT INTO presets/.test(sql)) throw new Error('create unavailable'); return prepare(sql); }, batch: db.batch.bind(db) } as D1Database;
    expect((await request()).status).toBe(500);
    expect(payloads).toHaveLength(1);
    expect(await counts()).toEqual({ presets: 0, events: 1, votes: 0 });
    expect((await reporting()).remaining).toBe(9);
    expect(notices).toHaveLength(0);
  });
  it('same-dye collision after moderation retains both attempts and converts the loser to a vote', async () => {
    let waiting = 0; let release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    scorer = async () => { if (++waiting === 2) release(); await gate; };
    const responses = await Promise.all([request(), request()]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 201]);
    expect(payloads).toHaveLength(2);
    expect(await counts()).toEqual({ presets: 1, events: 2, votes: 1 });
    expect((await reporting()).remaining).toBe(8);
  });
  it('sends tags and decoded path only to the actual scorer and stores the complete normalized link', async () => {
    const link = 'https://usermarker:credentialmarker@ffxiv.eorzeacollection.com/glamour/%70athmarker?querymarker=secret#fragmentmarker';
    const res = await request([1, 2, 3], { example_link: link }); expect(res.status).toBe(201);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].doNotStore).toBe(true);
    expect(payloads[0].comment.text).toContain('tagmarker'); expect(payloads[0].comment.text).toContain('pathmarker');
    expect(payloads[0].comment.text).not.toMatch(/usermarker|credentialmarker|querymarker|fragmentmarker|eorzeacollection|https:/);
    expect((await db.prepare('SELECT example_link FROM presets').first())!.example_link).toBe(link);
  });
  it('deleted successful presets keep their admission charge', async () => {
    const response = await request(); expect(response.status).toBe(201);
    await db.batch([db.prepare('DELETE FROM votes'), db.prepare('DELETE FROM presets')]);
    expect(await counts()).toEqual({ presets: 0, events: 1, votes: 0 });
    expect((await reporting()).remaining).toBe(9);
  });
  it('the historical live-row backstop participates in admission, not just reporting', async () => {
    await events(9); await legacy('legacy');
    expect((await request()).status).toBe(429);
    expect(payloads).toHaveLength(0); expect(await counts()).toEqual({ presets: 1, events: 9, votes: 0 });
    expect((await reporting()).remaining).toBe(0);
  });
  it('a failed auto-vote never invents a successful response vote', async () => {
    env.DB = { prepare: db.prepare.bind(db), batch: async () => { throw new Error('vote batch unavailable'); } } as unknown as D1Database;
    const response = await request(); expect(response.status).toBe(201);
    expect((await response.json() as { preset: { vote_count: number } }).preset.vote_count).toBe(0);
    expect((await db.prepare('SELECT vote_count FROM presets').first())!.vote_count).toBe(0);
    expect(await counts()).toEqual({ presets: 1, events: 1, votes: 0 });
  });
  it('a denied admission keeps its captured reset even if D1 completes after midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-26T23:59:59.000Z'));
    await events(10);
    const prepare = db.prepare.bind(db);
    env.DB = { prepare(sql: string) {
      const statement = prepare(sql);
      if (!/INSERT INTO submission_events/.test(sql)) return statement;
      const bind = statement.bind.bind(statement);
      statement.bind = (...values: unknown[]) => {
        const bound = bind(...values); const first = bound.first.bind(bound);
        bound.first = async <T>() => { const result = await first<T>(); vi.setSystemTime(new Date('2026-10-27T00:00:01.000Z')); return result; };
        return bound;
      };
      return statement;
    }, batch: db.batch.bind(db) } as D1Database;
    const res = await request(); expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ reset_at: '2026-10-27T00:00:00.000Z' });
    expect(payloads).toHaveLength(0);
  });
  it('GET reporting captures count and reset together when D1 crosses midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-26T23:59:59.000Z'));
    await events(2);
    const prepare = db.prepare.bind(db);
    env.DB = { prepare(sql: string) {
      const statement = prepare(sql);
      if (!/AS count/.test(sql)) return statement;
      const bind = statement.bind.bind(statement);
      statement.bind = (...values: unknown[]) => {
        const bound = bind(...values); const first = bound.first.bind(bound);
        bound.first = async <T>() => { const result = await first<T>(); vi.setSystemTime(new Date('2026-10-27T00:00:01.000Z')); return result; };
        return bound;
      };
      return statement;
    }, batch: db.batch.bind(db) } as D1Database;
    expect(await reporting()).toMatchObject({ remaining: 8, reset_at: '2026-10-27T00:00:00.000Z' });
  });
});
