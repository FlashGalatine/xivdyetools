/**
 * OPT-002: the acquisition / ko / zh tables (3.4 MB of JSON) used to be
 * evaluated at isolate start for EVERY route, /health included. They are read
 * only by POST /v1/chara/resolve, so they now load on first use. The factories
 * below record when each table is evaluated.
 */
import { describe, it, expect, vi } from 'vitest';

const evaluated = vi.hoisted(() => ({ acquisition: 0, ko: 0, zh: 0 }));
vi.mock('./data/acquisition.en.json', () => {
  evaluated.acquisition++;
  return { default: { '18085': 'Test line' } };
});
vi.mock('./data/item-names.ko.json', () => {
  evaluated.ko++;
  return { default: { '18085': '한국어' } };
});
vi.mock('./data/item-names.zh.json', () => {
  evaluated.zh++;
  return { default: { '18085': '中文' } };
});

import { createMockEnv } from '../../tests/test-utils';
import { createMockExecutionContext, resetAllMocks } from '../universalis/test-setup';

describe('chara tables load lazily (OPT-002)', () => {
  it('are not evaluated by importing the app or serving other routes', async () => {
    resetAllMocks();
    const { default: app } = await import('../index');
    const env = createMockEnv();
    const health = await app.request('/health', {}, env, createMockExecutionContext());
    expect(health.status).toBe(200);
    const dyes = await app.request('/v1/dyes/categories', {}, env, createMockExecutionContext());
    expect(dyes.status).toBe(200);
    expect(evaluated).toEqual({ acquisition: 0, ko: 0, zh: 0 });
  });

  it('are loaded once, on the first /v1/chara/resolve, and then used', async () => {
    resetAllMocks();
    const row = {
      row_id: 18085,
      fields: {
        Name: 'Beech Mask of Casting',
        Icon: { id: 41716 },
        ModelMain: 328041,
        ModelSub: 0,
        EquipSlotCategory: { fields: { Head: 1 } },
      },
    };
    // What the tables' evaluation count was when the upstream search answered.
    const atSearch: Array<typeof evaluated> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        // Stand-in for network latency: a load started before the request went
        // out has had time to finish evaluating by the time it "answers".
        await new Promise((resolve) => setTimeout(resolve, 20));
        atSearch.push({ ...evaluated });
        return new Response(JSON.stringify({ version: 'k', results: [row] }), { status: 200 });
      }),
    );
    const { default: app } = await import('../index');
    const env = createMockEnv({ XIVAPI_BASE: 'https://lazy.test', XIVAPI_VERSION: 'pinned' });
    const post = () =>
      app.request(
        '/v1/chara/resolve',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gear: [{ slot: 'HeadGear', base: 361, variant: 5 }] }),
        },
        env,
        createMockExecutionContext(),
      );
    const res = await post();
    expect(res.status).toBe(200);
    const item = ((await res.json()) as any).data.items.HeadGear;
    expect(item.names.ko).toBe('한국어');
    expect(item.names.zh).toBe('中文');
    expect(item.acquisition).toBe('Test line');
    expect(evaluated).toEqual({ acquisition: 1, ko: 1, zh: 1 });
    // Review: the load starts with the request and overlaps the search.
    expect(atSearch).toEqual([{ acquisition: 1, ko: 1, zh: 1 }]);

    await post();
    expect(evaluated).toEqual({ acquisition: 1, ko: 1, zh: 1 });
    vi.unstubAllGlobals();
  });
});
