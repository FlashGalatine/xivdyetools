/**
 * `POST /v1/telemetry` through the real app (middleware chain, error
 * handler). Analytics Engine is a mock binding; the schema itself is covered
 * in schema.test.ts and the allowlist in origin.test.ts — this file checks the
 * HTTP contract, the Origin/GPC gate and the write path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from '../index';
import { createMockEnv } from '../../tests/test-utils';
import { createMockExecutionContext } from '../universalis/test-setup';

const writeDataPoint = vi.fn();
const analytics = { writeDataPoint } as unknown as AnalyticsEngineDataset;

/** What the shipped web app sends; every case uses it unless it says otherwise. */
const WEB_APP_ORIGIN = 'https://xivdyetools.app';

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

/**
 * `headers` overrides the defaults; an explicit `undefined` removes one
 * (that is how the "no Origin at all" case is expressed).
 */
function post(
  body: string,
  env = createMockEnv({ ANALYTICS: analytics }),
  contentType = 'text/plain',
  headers: Record<string, string | undefined> = {},
) {
  const merged: Record<string, string> = { 'Content-Type': contentType, Origin: WEB_APP_ORIGIN };
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) delete merged[name];
    else merged[name] = value;
  }
  const ctx = createMockExecutionContext();
  const res = app.request('/v1/telemetry', { method: 'POST', headers: merged, body }, env, ctx);
  return { res, ctx };
}

function settle(ctx: ExecutionContext): Promise<unknown> {
  return (ctx as unknown as { _waitForAll: () => Promise<unknown> })._waitForAll();
}

/**
 * The request logger writes one JSON line per entry through `console.log`
 * (JsonAdapter), so capturing it is how "the drop is logged without the
 * Origin value" and "GPC leaves no telemetry log line" are checked.
 */
const logSpies: { mockRestore: () => void }[] = [];
function captureLogLines(): () => string[] {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    lines.push(args.map((arg) => String(arg)).join(' '));
  });
  logSpies.push(spy);
  return () => lines;
}

/** The telemetry route's own log entries (the request logger's own two are not ours). */
function telemetryLogs(lines: string[]): { message: string; context?: Record<string, unknown> }[] {
  return lines
    .map((line) => {
      try {
        return JSON.parse(line) as { message?: string; context?: Record<string, unknown> };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is { message: string; context?: Record<string, unknown> } =>
      typeof entry?.message === 'string' && entry.message.startsWith('telemetry'),
    );
}

describe('POST /v1/telemetry', () => {
  beforeEach(() => {
    writeDataPoint.mockReset();
  });

  afterEach(() => {
    for (const spy of logSpies.splice(0)) spy.mockRestore();
  });

  it('answers 204 and writes nothing for an event named after an Object.prototype member', async () => {
    const body = JSON.stringify({
      ...VALID,
      events: [{ n: 'constructor', p: {} }, { n: '__proto__', p: {} }, { n: 'toString', p: {} }],
    });
    const { res, ctx } = post(body);
    const response = await res;
    expect(response.status).toBe(204);
    await settle(ctx);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('answers 204 with no body and writes one datapoint per valid event', async () => {
    const { res, ctx } = post(JSON.stringify(VALID));
    const response = await res;
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    await settle(ctx);
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
    await settle(ctx);
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
    await settle(ctx);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('survives a throwing writeDataPoint (telemetry never fails the request)', async () => {
    writeDataPoint.mockImplementation(() => {
      throw new Error('AE down');
    });
    const { res, ctx } = post(JSON.stringify(VALID));
    expect((await res).status).toBe(204);
    await expect(settle(ctx)).resolves.toBeDefined();
  });

  it('is not reachable with GET', async () => {
    const res = await app.request('/v1/telemetry', { method: 'GET' }, createMockEnv());
    expect(res.status).toBe(404);
  });

  // ---- FINDING-014: Origin gate -------------------------------------------

  it('answers 204 and writes nothing when the beacon carries no Origin', async () => {
    const { res, ctx } = post(JSON.stringify(VALID), undefined, undefined, { Origin: undefined });
    expect((await res).status).toBe(204);
    await settle(ctx);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('answers 204 and writes nothing for an Origin that is not the web app', async () => {
    for (const origin of ['https://evil.example', 'https://xivdyetools.app.evil.example']) {
      writeDataPoint.mockReset();
      const { res, ctx } = post(JSON.stringify(VALID), undefined, undefined, { Origin: origin });
      expect((await res).status, origin).toBe(204);
      await settle(ctx);
      expect(writeDataPoint, origin).not.toHaveBeenCalled();
    }
  });

  it('decides the Origin before reading the body (an oversized batch is dropped, not 413)', async () => {
    const huge = JSON.stringify({ ...VALID, pad: 'x'.repeat(17 * 1024) });
    const { res, ctx } = post(huge, undefined, undefined, { Origin: 'https://evil.example' });
    expect((await res).status).toBe(204);
    await settle(ctx);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('logs the drop with a reason and never with the Origin value', async () => {
    const lines = captureLogLines();
    const { res, ctx } = post(JSON.stringify(VALID), undefined, undefined, {
      Origin: 'https://evil.example',
    });
    expect((await res).status).toBe(204);
    await settle(ctx);
    const dropped = telemetryLogs(lines());
    expect(dropped).toHaveLength(1);
    expect(dropped[0].message).toBe('telemetry batch dropped');
    expect(dropped[0].context).toMatchObject({ operation: 'telemetry', reason: 'origin' });
    expect(lines().join('\n')).not.toContain('evil.example');
  });

  // ---- FINDING-014: env derived from the Origin ----------------------------

  it('labels a beta beacon beta even when the body claims production', async () => {
    const { res, ctx } = post(JSON.stringify(VALID), undefined, undefined, {
      Origin: 'https://beta.xivdyetools.app',
    });
    expect((await res).status).toBe(204);
    await settle(ctx);
    expect(writeDataPoint).toHaveBeenCalledTimes(2);
    expect(writeDataPoint.mock.calls[0][0].blobs[8]).toBe('beta');
    expect(writeDataPoint.mock.calls[1][0].blobs[8]).toBe('beta');
  });

  it('labels a production beacon production even when the body claims beta or garbage', async () => {
    for (const env of ['beta', 'staging', undefined]) {
      writeDataPoint.mockReset();
      const body: Record<string, unknown> = { ...VALID };
      if (env === undefined) delete body['env'];
      else body['env'] = env;
      const { res, ctx } = post(JSON.stringify(body));
      expect((await res).status, String(env)).toBe(204);
      await settle(ctx);
      expect(writeDataPoint.mock.calls[0][0].blobs[8], String(env)).toBe('production');
    }
  });

  // ---- FINDING-014: Global Privacy Control ---------------------------------

  it('drops the batch on Sec-GPC: 1 without a write or a telemetry log line', async () => {
    const lines = captureLogLines();
    const { res, ctx } = post(JSON.stringify(VALID), undefined, undefined, { 'Sec-GPC': '1' });
    expect((await res).status).toBe(204);
    await settle(ctx);
    expect(writeDataPoint).not.toHaveBeenCalled();
    expect(telemetryLogs(lines())).toEqual([]);
  });

  it('writes normally when Sec-GPC is 0', async () => {
    const { res, ctx } = post(JSON.stringify(VALID), undefined, undefined, { 'Sec-GPC': '0' });
    expect((await res).status).toBe(204);
    await settle(ctx);
    expect(writeDataPoint).toHaveBeenCalledTimes(2);
  });

  // ---- FINDING-014: local development -------------------------------------

  it('accepts a localhost Origin on a non-production worker and keeps the body env', async () => {
    const env = createMockEnv({ ANALYTICS: analytics, ENVIRONMENT: 'development' });
    const { res, ctx } = post(JSON.stringify({ ...VALID, env: 'beta' }), env, undefined, {
      Origin: 'http://localhost:5173',
    });
    expect((await res).status).toBe(204);
    await settle(ctx);
    expect(writeDataPoint).toHaveBeenCalledTimes(2);
    expect(writeDataPoint.mock.calls[0][0].blobs[8]).toBe('beta');
  });

  it('drops a localhost Origin on the production worker', async () => {
    const env = createMockEnv({ ANALYTICS: analytics, ENVIRONMENT: 'production' });
    const { res, ctx } = post(JSON.stringify(VALID), env, undefined, {
      Origin: 'http://localhost:5173',
    });
    expect((await res).status).toBe(204);
    await settle(ctx);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
