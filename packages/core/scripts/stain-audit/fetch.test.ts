import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchStainCapture, type Transport } from './fetch.js';

const pins = {
  version: '0874aee069e1e7c4',
  schema: 'exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb',
};
function page(ids: number[] = []): Response {
  return Response.json({
    ...pins,
    rows: ids.map((row_id) => ({
      row_id,
      fields: {
        Name: 'Black',
        'Name@ja': '',
        'Name@de': '',
        'Name@fr': '',
        Color: 0,
        Shade: 0,
        SubOrder: 0,
        IsMetallic: false,
        IsHousingApplicable: false,
        Item: [],
      },
    })),
  });
}
function setup(responses: (Response | Error)[]) {
  const urls: URL[] = [];
  const waits: number[] = [];
  const transport: Transport = {
    now: () => Date.now(),
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
    fetch: (input, options) => {
      urls.push(
        new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url),
      );
      expect(options?.redirect).toBe('manual');
      const next = responses.shift();
      if (!next) return Promise.reject(new Error('Unexpected fetch'));
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
  };
  return { transport, urls, waits };
}
afterEach(() => vi.useRealTimers());

describe('pinned complete-sheet fetching', () => {
  it('reads the full research pages and pins later requests', async () => {
    const responses = [1, 2, 3].map(
      (n) =>
        new Response(
          readFileSync(
            new URL(
              `./fixtures/2026-10-20/stain-page-${String(n).padStart(4, '0')}.json`,
              import.meta.url,
            ),
          ),
          { headers: { 'content-type': 'application/json' } },
        ),
    );
    const { transport, urls, waits } = setup(responses);
    const result = await fetchStainCapture({ mode: 'latest' }, transport);
    expect(result.snapshot.rows).toHaveLength(129);
    expect(result.pages.map((p) => p.page.rows.length)).toEqual([100, 29, 0]);
    expect(urls[0].searchParams.has('rows')).toBe(false);
    expect(urls[0].searchParams.has('after')).toBe(false);
    expect(urls[0].searchParams.get('language')).toBe('en');
    expect(urls[0].searchParams.get('limit')).toBe('100');
    expect(urls[0].searchParams.get('fields')).toBe(
      'Name,Name@ja,Name@de,Name@fr,Color,Shade,SubOrder,IsMetallic,IsHousingApplicable,Item[].Name',
    );
    expect(urls[1].searchParams.get('after')).toBe('99');
    expect(urls[2].searchParams.get('after')).toBe('128');
    expect(
      urls
        .slice(1)
        .every(
          (url) =>
            url.searchParams.get('version') === pins.version &&
            url.searchParams.get('schema') === pins.schema,
        ),
    ).toBe(true);
    expect(waits).toEqual([250, 250]);
  });
  it('rejects noncanonical response pins before accepting a snapshot', async () => {
    const bad = Response.json({ version: 'latest', schema: 'latest', rows: [] });
    const { transport } = setup([page([0]), bad]);
    // Same noncanonical pins on every page must not be mistaken for a pinned scan.
    const raw = (await page([0]).json()) as Record<string, unknown>;
    const initial = Response.json({ ...raw, version: 'latest', schema: 'latest' });
    const run = setup([initial, Response.json({ version: 'latest', schema: 'latest', rows: [] })]);
    await expect(fetchStainCapture({ mode: 'latest' }, run.transport)).rejects.toThrow(
      /canonical|pin/i,
    );
    await expect(
      fetchStainCapture(
        { mode: 'pinned', pins: { version: 'latest', schema: 'latest' } },
        transport,
      ),
    ).rejects.toThrow(/canonical|pin/i);
  });
  it('continues past clamped short pages and supplies explicit first-page pins', async () => {
    const { transport, urls } = setup([page([0, 4]), page([7]), page()]);
    const result = await fetchStainCapture({ mode: 'pinned', pins }, transport);
    expect(result.snapshot.rows.map((row) => row.stainID)).toEqual([0, 4, 7]);
    expect(urls[0].searchParams.get('version')).toBe(pins.version);
    expect(urls[2].searchParams.get('after')).toBe('7');
  });
  it.each([
    ['duplicate rows', () => [page([0, 1]), page([1]), page()]],
    ['pin drift', () => [page([0]), Response.json({ ...pins, version: 'changed', rows: [] })]],
    ['schema drift', () => [page([0]), Response.json({ ...pins, schema: 'changed', rows: [] })]],
    ['empty first page', () => [page()]],
    ['missing fields', () => [Response.json({ ...pins, rows: [{ row_id: 1, fields: {} }] })]],
  ] as const)('fails incomplete on %s', async (_label, responses) => {
    const { transport } = setup(responses());
    await expect(fetchStainCapture({ mode: 'latest' }, transport)).rejects.toThrow(/incomplete/i);
  });
  it('fails at twenty successful pages without falsely declaring completion', async () => {
    const { transport, urls } = setup(Array.from({ length: 21 }, (_, n) => page([n])));
    await expect(fetchStainCapture({ mode: 'latest' }, transport)).rejects.toThrow(
      /incomplete.*page|page.*limit/i,
    );
    expect(urls).toHaveLength(20);
  });
  it.each([400, 404, 302])('does not retry permanent status %s', async (status) => {
    const { transport, urls, waits } = setup([new Response('', { status }), page([0]), page()]);
    await expect(fetchStainCapture({ mode: 'latest' }, transport)).rejects.toThrow(/incomplete/i);
    expect(urls).toHaveLength(1);
    expect(waits).toEqual([]);
  });
  it('retries transient transport errors and 503 with bounded backoff', async () => {
    const { transport, waits } = setup([
      new TypeError('network'),
      new Response('', { status: 503 }),
      page([0]),
      page(),
    ]);
    const result = await fetchStainCapture({ mode: 'latest' }, transport);
    expect(result.pages[0].attempts).toBe(3);
    expect(waits).toEqual([1000, 2000, 250]);
  });
  it('stops after three attempts and reports page/cursor context', async () => {
    const { transport, urls } = setup([
      page([0]),
      ...Array.from({ length: 4 }, () => new Response('', { status: 503 })),
    ]);
    await expect(fetchStainCapture({ mode: 'latest' }, transport)).rejects.toThrow(
      /page 2.*after=0.*0874aee/i,
    );
    expect(urls).toHaveLength(4);
  });
  it.each(['5', 'Thu, 01 Jan 1970 00:00:05 GMT'])(
    'honors Retry-After %s as a minimum',
    async (retryAfter) => {
      vi.useFakeTimers();
      vi.setSystemTime(0);
      const { transport, waits } = setup([
        new Response('', { status: 429, headers: { 'retry-after': retryAfter } }),
        page([0]),
        page(),
      ]);
      await fetchStainCapture({ mode: 'latest' }, transport);
      expect(waits[0]).toBe(5000);
    },
  );
  it('fails rather than retrying before a Retry-After beyond the total budget', async () => {
    const { transport, urls, waits } = setup([
      new Response('', { status: 429, headers: { 'retry-after': '600' } }),
      page([0]),
    ]);
    await expect(fetchStainCapture({ mode: 'latest' }, transport)).rejects.toThrow(
      /budget|deadline/i,
    );
    expect(urls).toHaveLength(1);
    expect(waits).toEqual([]);
  });
  it('applies the five-minute deadline across successful pages', async () => {
    const { transport, urls } = setup([page([0]), page([1]), page()]);
    let clock = 0;
    transport.now = () => clock;
    transport.sleep = () => {
      clock += 300_000;
      return Promise.resolve();
    };
    await expect(fetchStainCapture({ mode: 'latest' }, transport)).rejects.toThrow(
      /budget|deadline/i,
    );
    expect(urls).toHaveLength(1);
  });
  it.each(['not json', '{'])('does not retry malformed JSON/content type (%s)', async (body) => {
    const response = new Response(body, {
      headers: { 'content-type': body === '{' ? 'application/json' : 'text/html' },
    });
    const { transport, urls } = setup([response, page([0])]);
    await expect(fetchStainCapture({ mode: 'latest' }, transport)).rejects.toThrow(/incomplete/i);
    expect(urls).toHaveLength(1);
  });
  it('cancels a chunked oversized body without relying on Content-Length', async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1));
      },
      cancel() {
        cancelled = true;
      },
    });
    const { transport, urls } = setup([
      new Response(stream, { headers: { 'content-type': 'application/json' } }),
    ]);
    await expect(fetchStainCapture({ mode: 'latest' }, transport)).rejects.toThrow(
      /byte|size|MiB/i,
    );
    expect(cancelled).toBe(true);
    expect(urls).toHaveLength(1);
  });
  it.each(['headers', 'body'])('bounds and aborts a stalled %s on every attempt', async (phase) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let attempts = 0;
    let cancellations = 0;
    const signals: AbortSignal[] = [];
    const transport: Transport = {
      now: () => Date.now(),
      sleep: () => Promise.resolve(),
      fetch: (_input, options) => {
        attempts++;
        signals.push(options!.signal!);
        if (phase === 'headers') return new Promise<Response>(() => {});
        return Promise.resolve(
          new Response(
            new ReadableStream({
              cancel() {
                cancellations++;
              },
            }),
            { headers: { 'content-type': 'application/json' } },
          ),
        );
      },
    };
    const pending = fetchStainCapture({ mode: 'latest' }, transport);
    const assertion = expect(pending).rejects.toThrow(/timeout|timed out/i);
    await vi.runAllTimersAsync();
    await assertion;
    expect(attempts).toBe(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    if (phase === 'body') expect(cancellations).toBe(3);
  });
});
