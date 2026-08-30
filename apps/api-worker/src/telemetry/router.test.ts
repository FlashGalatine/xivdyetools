/**
 * `POST /v1/telemetry` through the real app (middleware chain, error
 * handler). Analytics Engine is a mock binding; the schema itself is covered
 * in schema.test.ts — this file checks the HTTP contract and the write path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from '../index';
import { createMockEnv } from '../../tests/test-utils';
import { createMockExecutionContext } from '../universalis/test-setup';

const writeDataPoint = vi.fn();
const analytics = { writeDataPoint } as unknown as AnalyticsEngineDataset;

const VALID = {
  v: 1,
  ver: '5.0.3',
  env: 'production',
  locale: 'en',
  theme: 'standard-dark',
  vp: 'd',
  events: [
    { n: 'tool_view', p: { tool: 'harmony', entry: 'initial' } },
    { n: 'tool_leave', p: { tool: 'harmony', entry: 'initial' }, d: 12 },
  ],
};

function post(body: string, env = createMockEnv({ ANALYTICS: analytics }), contentType = 'text/plain') {
  const ctx = createMockExecutionContext();
  const res = app.request(
    '/v1/telemetry',
    { method: 'POST', headers: { 'Content-Type': contentType }, body },
    env,
    ctx,
  );
  return { res, ctx };
}

describe('POST /v1/telemetry', () => {
  beforeEach(() => {
    writeDataPoint.mockReset();
  });

  it('answers 204 and writes nothing for an event named after an Object.prototype member', async () => {
    const body = JSON.stringify({
      ...VALID,
      events: [{ n: 'constructor', p: {} }, { n: '__proto__', p: {} }, { n: 'toString', p: {} }],
    });
    const { res, ctx } = post(body);
    const response = await res;
    expect(response.status).toBe(204);
    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('answers 204 with no body and writes one datapoint per valid event', async () => {
    const { res, ctx } = post(JSON.stringify(VALID));
    const response = await res;
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
    expect(writeDataPoint).toHaveBeenCalledTimes(2);
    expect(writeDataPoint).toHaveBeenNthCalledWith(1, {
      indexes: ['tool_view'],
      blobs: ['tool_view', 'harmony', 'initial', '', 'en', 'standard-dark', 'd', '5.0.3', 'production'],
      doubles: [0],
    });
    expect(writeDataPoint).toHaveBeenNthCalledWith(2, {
      indexes: ['tool_leave'],
      blobs: ['tool_leave', 'harmony', 'initial', '', 'en', 'standard-dark', 'd', '5.0.3', 'production'],
      doubles: [12],
    });
  });

  it('accepts a text/plain body (what sendBeacon sends) and application/json alike', async () => {
    const plain = await post(JSON.stringify(VALID), undefined, 'text/plain;charset=UTF-8').res;
    const json = await post(JSON.stringify(VALID), undefined, 'application/json').res;
    expect(plain.status).toBe(204);
    expect(json.status).toBe(204);
  });

  it('still answers 204 when every event is dropped', async () => {
    const { res, ctx } = post(JSON.stringify({ ...VALID, events: [{ n: 'nope', p: {} }] }));
    expect((await res).status).toBe(204);
    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('answers 400 INVALID_BODY for non-JSON and for JSON that is not a v1 batch', async () => {
    const notJson = await post('{not json').res;
    expect(notJson.status).toBe(400);
    expect(((await notJson.json()) as any).error).toBe('INVALID_BODY');

    const notBatch = await post(JSON.stringify({ v: 2, events: [] })).res;
    expect(notBatch.status).toBe(400);
    expect(((await notBatch.json()) as any).error).toBe('INVALID_BODY');
  });

  it('answers 413 INVALID_BODY for a body over 16 KB', async () => {
    const huge = JSON.stringify({ ...VALID, pad: 'x'.repeat(17 * 1024) });
    const res = await post(huge).res;
    expect(res.status).toBe(413);
    expect(((await res.json()) as any).error).toBe('INVALID_BODY');
  });

  it('answers 204 and writes nothing when the ANALYTICS binding is absent', async () => {
    const { res, ctx } = post(JSON.stringify(VALID), createMockEnv());
    expect((await res).status).toBe(204);
    await (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('survives a throwing writeDataPoint (telemetry never fails the request)', async () => {
    writeDataPoint.mockImplementation(() => {
      throw new Error('AE down');
    });
    const { res, ctx } = post(JSON.stringify(VALID));
    expect((await res).status).toBe(204);
    await expect(
      (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll(),
    ).resolves.toBeDefined();
  });

  it('is not reachable with GET', async () => {
    const res = await app.request('/v1/telemetry', { method: 'GET' }, createMockEnv());
    expect(res.status).toBe(404);
  });
});
