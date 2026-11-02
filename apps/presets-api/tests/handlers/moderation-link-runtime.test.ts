import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { moderationRouter } from '../../src/handlers/moderation';
import { authMiddleware } from '../../src/middleware/auth';
import type { AuthContext, Env } from '../../src/types';
import { createD1Runtime } from '../d1-runtime';
import { createMockEnv } from '../test-utils';

describe('safe link snapshot restoration on real D1', () => {
  let runtime: Awaited<ReturnType<typeof createD1Runtime>>; let db: D1Database; let env: Env;
  let app: Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>;
  const original = { name: 'Original', description: 'Original description.', tags: ['original'], dyes: [4, 5, 6] };
  beforeAll(async () => { runtime = await createD1Runtime(); db = runtime.db; }, 30000);
  afterAll(async () => { await runtime?.dispose(); });
  beforeEach(async () => {
    await db.batch(['moderation_log', 'presets', 'banned_users'].map(t => db.prepare(`DELETE FROM ${t}`)));
    env = createMockEnv({ DB: db, PRESET_METADATA_MODERATION_ENABLED: 'true' }); app = new Hono(); app.use('*', authMiddleware); app.route('/moderation', moderationRouter);
  });
  async function seed(extra: Record<string, unknown>) {
    await db.prepare("INSERT INTO presets (id,name,description,category_id,dyes,tags,status,author_discord_id,previous_values,example_link) VALUES ('p','Edited','Edited description','jobs','[1,2,3]','[]','pending','owner',?,'https://ffxiv.eorzeacollection.com/glamour/flagged')").bind(JSON.stringify({ ...original, ...extra })).run();
  }
  function revert() { return app.request('/moderation/p/revert', { method: 'PATCH', headers: { Authorization: 'Bearer test-bot-secret', 'X-User-Discord-ID': '123456789', 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Restore approved content', expected_revision: 0, expected_status: 'pending' }) }, env); }
  async function state() { return { row: await db.prepare("SELECT * FROM presets WHERE id='p'").first(), audits: (await db.prepare('SELECT COUNT(*) n FROM moderation_log').first<{ n: number }>())!.n }; }
  function review() { return app.request('/moderation/p', { headers: { Authorization: 'Bearer test-bot-secret', 'X-User-Discord-ID': '123456789' } }, env); }
  it('serializes a legacy snapshot as an explicit clear target without rewriting its exact raw CAS value', async () => {
    await seed({}); const before = await state();
    const response = await review(); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ preset: { previous_values: { ...original, example_link: null } } });
    expect(await state()).toEqual(before);
    expect(before.row!.previous_values).toBe(JSON.stringify(original));
    // A real conditional revert must still bind the stored JSON without the
    // outward-only field; serializing the enriched view into CAS would lose.
    expect((await revert()).status).toBe(200);
    const after = await state(); expect(after.audits).toBe(1);
    expect(after.row).toMatchObject({ example_link: null, previous_values: null, status: 'approved' });
  });
  it.each([42, {}, 'https://evil.example/untrusted'])('keeps explicitly invalid stored link %j visible as untrusted and refuses its revert', async link => {
    await seed({ example_link: link }); const before = await state();
    const response = await review(); expect(response.status).toBe(200);
    const view = await response.json() as { preset: { previous_values: { example_link: unknown } } };
    expect(view.preset.previous_values.example_link).toEqual(link);
    expect((await revert()).status).toBe(400); expect(await state()).toEqual(before);
  });
  it.each([undefined, 'false'])('disabled flag %s leaves legacy view unavailable and preserves current link through the real D1 CAS', async flag => {
    env.PRESET_METADATA_MODERATION_ENABLED = flag;
    await seed({}); const before = await state();
    const view = await (await review()).json() as { preset: { previous_values: Record<string, unknown> } };
    expect(Object.hasOwn(view.preset.previous_values, 'example_link')).toBe(false);
    expect(await state()).toEqual(before);
    expect((await revert()).status).toBe(200);
    const after = await state(); expect(after.audits).toBe(1);
    expect(after.row).toMatchObject({ example_link: 'https://ffxiv.eorzeacollection.com/glamour/flagged', status: 'approved', previous_values: null });
  });
  it('flag rollback still restores a recorded explicit null on real D1', async () => {
    env.PRESET_METADATA_MODERATION_ENABLED = 'false'; await seed({ example_link: null });
    const view = await (await review()).json() as { preset: { previous_values: { example_link: unknown } } };
    expect(view.preset.previous_values.example_link).toBeNull();
    expect((await revert()).status).toBe(200);
    const after = await state(); expect(after.audits).toBe(1); expect(after.row!.example_link).toBeNull();
  });
  it('flag rollback cannot trust a malformed explicit link on real D1', async () => {
    env.PRESET_METADATA_MODERATION_ENABLED = 'false'; await seed({ example_link: {} }); const before = await state();
    const view = await (await review()).json() as { preset: { previous_values: { example_link: unknown } } };
    expect(view.preset.previous_values.example_link).toEqual({});
    expect((await revert()).status).toBe(400); expect(await state()).toEqual(before);
  });
  it.each([{}, { example_link: null }, { example_link: '  https://ffxiv.eorzeacollection.com/glamour/original  ' }])('restores snapshot link %j rather than current flagged URL', async extra => {
    await seed(extra); expect((await revert()).status).toBe(200);
    const after = await state(); expect(after.audits).toBe(1);
    expect(after.row).toMatchObject({ name: 'Original', status: 'approved', previous_values: null, example_link: 'example_link' in extra && extra.example_link ? 'https://ffxiv.eorzeacollection.com/glamour/original' : null });
  });
  it.each(['https://evil.example/flagged', 'javascript:alert(1)', 42, {}, 'https://ffxiv.eorzeacollection.com/' + 'x'.repeat(600)])('refuses untrusted snapshot link %j without write or audit', async link => {
    await seed({ example_link: link }); const before = await state();
    const res = await revert(); expect(res.status).toBe(400); expect(await res.json()).toMatchObject({ error: 'VALIDATION_ERROR' }); expect(await state()).toEqual(before);
  });
  it('retains the final active-ban guard for valid links', async () => {
    await seed({ example_link: null });
    await db.prepare("INSERT INTO banned_users (id,discord_id,username,moderator_discord_id,reason) VALUES ('b','owner','Owner','123456789','A sufficient reason')").run();
    const before = await state(); expect((await revert()).status).toBe(409); expect(await state()).toEqual(before);
  });
});
