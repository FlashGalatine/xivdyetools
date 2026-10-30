import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcquisitionSource, pinnedSelection } from '../../scripts/acquisition/upstream.js';

const version = '0874aee069e1e7c4';
const schema = `exdschema@2:rev:${'a'.repeat(40)}`;
const otherSchema = `exdschema@2:rev:${'b'.repeat(40)}`;
const teamcraftCommit = 'acc77d406cc50a78caf0210f805ec7b069607af0';
const pins = { version, schema };
const row = { ...pins, row_id: 1, fields: { Name: 'Gil' } };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const dirs: string[] = [];
async function cacheDir() {
  const dir = await mkdtemp(join(tmpdir(), 'acquisition-upstream-'));
  dirs.push(dir);
  return dir;
}
function replay(fetch: typeof globalThis.fetch, options = {}) {
  return new AcquisitionSource({ ...pins, fetch, ...options });
}
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('pinnedSelection', () => {
  it('requires recorded immutable pins and uses an explicit schema only for legacy metadata', () => {
    expect(
      pinnedSelection({ teamcraftCommit, xivapiVersion: version, xivapiSchema: schema }),
    ).toEqual({ teamcraftCommit, ...pins });
    expect(pinnedSelection({ teamcraftCommit, xivapiVersion: version }, schema)).toEqual({
      teamcraftCommit,
      ...pins,
    });
    expect(() => pinnedSelection({ teamcraftCommit, xivapiVersion: version })).toThrow(/schema/i);
    expect(() =>
      pinnedSelection(
        { teamcraftCommit, xivapiVersion: version, xivapiSchema: schema },
        otherSchema,
      ),
    ).toThrow(/schema/i);
  });
  it.each([
    null,
    {},
    { teamcraftCommit, xivapiVersion: 'latest', xivapiSchema: schema },
    { teamcraftCommit: 'staging', xivapiVersion: version, xivapiSchema: schema },
    { teamcraftCommit, xivapiVersion: version.toUpperCase(), xivapiSchema: schema },
    { teamcraftCommit, xivapiVersion: version, xivapiSchema: 'latest' },
  ])('rejects malformed recorded metadata: %j', (meta) => {
    expect(() => pinnedSelection(meta)).toThrow();
  });
  it('does not replace malformed recorded schema with an override', () => {
    expect(() =>
      pinnedSelection({ teamcraftCommit, xivapiVersion: version, xivapiSchema: null }, schema),
    ).toThrow(/schema/i);
    expect(() => pinnedSelection({ teamcraftCommit, xivapiVersion: version }, 'latest')).toThrow(
      /schema/i,
    );
  });
});

describe('AcquisitionSource pins', () => {
  it('discovers once, locks both pins, and includes both on cursor requests', async () => {
    const urls: URL[] = [];
    const fetch: typeof globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      urls.push(url);
      if (urls.length === 1) return jsonResponse(row);
      return jsonResponse({
        ...pins,
        results: [{ row_id: 1, fields: { Name: 'Gil' } }],
        next: 'opaque',
      });
    };
    const source = new AcquisitionSource({ fetch });
    expect(() => source.pins).toThrow(/resolved/i);
    expect(await source.resolve()).toEqual(pins);
    await source.get('search', { cursor: 'opaque', version: 'latest', schema: otherSchema });
    expect(urls.map((url) => url.pathname)).toEqual(['/api/sheet/Item/1', '/api/search']);
    expect(urls[0].searchParams.get('version')).toBe('latest');
    expect(urls[0].searchParams.get('fields')).toBe('Name');
    expect(urls[1].searchParams.get('version')).toBe(version);
    expect(urls[1].searchParams.get('schema')).toBe(schema);
    expect(urls[1].searchParams.get('cursor')).toBe('opaque');
    const copy = source.pins;
    copy.version = 'bad';
    const resolved = await source.resolve();
    resolved.schema = 'bad';
    expect(source.pins).toEqual(pins);
  });
  it('skips discovery for immutable replay and copies constructor options', async () => {
    const options = { ...pins, fetch: vi.fn(async () => jsonResponse(row)) };
    const source = new AcquisitionSource(options);
    options.schema = otherSchema;
    expect(await source.resolve()).toEqual(pins);
    expect(options.fetch).not.toHaveBeenCalled();
    expect(await source.get('sheet/Item/1', { fields: 'Name' })).toEqual(row);
    expect(options.fetch).toHaveBeenCalledTimes(1);
  });
  it('sends explicit version and schema during discovery and rejects conflicts', async () => {
    let requested: URL | undefined;
    const source = new AcquisitionSource({
      version: '7.5',
      schema,
      fetch: async (input) => {
        requested = new URL(String(input));
        return jsonResponse({ ...row, schema: otherSchema });
      },
    });
    await expect(source.resolve()).rejects.toThrow(/schema/i);
    expect(requested?.searchParams.get('version')).toBe('7.5');
    expect(requested?.searchParams.get('schema')).toBe(schema);
  });
  it.each([
    { fields: {} },
    { ...row, version: 'latest' },
    { ...row, schema: undefined },
    { ...row, schema: 'exdschema@2:latest' },
    { ...row, version: '1111111111111111' },
  ])('rejects missing, malformed, or conflicting discovery metadata: %j', async (body) => {
    const source = new AcquisitionSource({ version, fetch: async () => jsonResponse(body) });
    await expect(source.resolve()).rejects.toThrow();
    expect(() => source.pins).toThrow();
  });
  it.each([
    { results: [] },
    { ...pins, schema: otherSchema, results: [] },
    { ...pins, version: '1111111111111111', results: [] },
    { ...pins, results: [[{ row_id: 1, fields: {} }]] },
    { ...pins, rows: [[]] },
    { ...pins, fields: [] },
    { ...pins, results: [{ row_id: 1, fields: null }] },
    { ...pins, rows: [{ row_id: '1' }] },
    { ...pins, error: 'unexpected' },
    { ...pins, results: [{ ...row, schema: otherSchema }] },
  ])('fails closed on invalid cursor response: %j', async (body) => {
    const source = replay(async () => jsonResponse(body));
    await expect(source.get('search', { cursor: 'opaque' })).rejects.toThrow();
    expect(source.pins).toEqual(pins);
  });
  it('accepts sheet listings with row ids and empty valid search results', async () => {
    const source = replay(async (input) =>
      jsonResponse(
        String(input).includes('/search?')
          ? { ...pins, results: [] }
          : { ...pins, rows: [{ row_id: 0 }, { row_id: 1 }] },
      ),
    );
    expect(await source.get('sheet/FateShop', {})).toEqual({
      ...pins,
      rows: [{ row_id: 0 }, { row_id: 1 }],
    });
    expect(await source.get('search', {})).toEqual({ ...pins, results: [] });
  });
});

describe('immutable cache', () => {
  it('replays exact URLs offline and partitions schema identity', async () => {
    const dir = await cacheDir();
    await replay(async () => jsonResponse(row), { cacheDir: dir }).get('sheet/Item/1', {
      fields: 'Name',
    });
    const fetch = vi.fn<typeof globalThis.fetch>();
    const offline = replay(fetch, { cacheDir: dir, offline: true });
    expect(await offline.get('sheet/Item/1', { fields: 'Name' })).toEqual(row);
    await expect(offline.get('sheet/Item/2', { fields: 'Name' })).rejects.toThrow(/cache|offline/i);
    await expect(
      replay(fetch, { schema: otherSchema, cacheDir: dir, offline: true }).get('sheet/Item/1', {
        fields: 'Name',
      }),
    ).rejects.toThrow(/cache|offline/i);
    expect(fetch).not.toHaveBeenCalled();
    const files = await readdir(dir);
    expect(files).toHaveLength(1);
    const envelope = JSON.parse(await readFile(join(dir, files[0]), 'utf8'));
    expect(envelope.body).toBe(JSON.stringify(row));
    expect(files[0]).toBe(`${createHash('sha256').update(envelope.url).digest('hex')}.json`);
  });
  it.each([
    {},
    { version, schema },
    { cacheDir: 'unused' },
    { cacheDir: 'unused', version: 'latest', schema },
  ])('requires immutable pins and a cache directory offline: %j', (options) => {
    expect(() => new AcquisitionSource({ ...options, offline: true })).toThrow(/offline/i);
  });
  it.each([
    'not json',
    '{}',
    JSON.stringify({ url: 'wrong', body: '{}' }),
    JSON.stringify({ body: {} }),
    'wrong-pins',
    'wrong-payload',
  ])('rejects invalid cache without network fallback: %s', async (invalid) => {
    const dir = await cacheDir();
    await replay(async () => jsonResponse(row), { cacheDir: dir }).get('sheet/Item/1', {});
    const [file] = await readdir(dir);
    const envelope = JSON.parse(await readFile(join(dir, file), 'utf8'));
    const replacement =
      invalid === 'wrong-pins' || invalid === 'wrong-payload'
        ? JSON.stringify({
            ...envelope,
            body: JSON.stringify(
              invalid === 'wrong-pins' ? { ...row, schema: otherSchema } : { ...pins, fields: [] },
            ),
          })
        : invalid;
    await writeFile(join(dir, file), replacement);
    const fetch = vi.fn<typeof globalThis.fetch>();
    await expect(replay(fetch, { cacheDir: dir }).get('sheet/Item/1', {})).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never stores discovery, invalid JSON, or invalid XIVAPI payloads', async () => {
    const dir = await cacheDir();
    await new AcquisitionSource({ cacheDir: dir, fetch: async () => jsonResponse(row) }).resolve();
    await expect(
      replay(async () => new Response('{'), { cacheDir: dir }).get('sheet/Item/1', {}),
    ).rejects.toThrow();
    await expect(
      replay(async () => jsonResponse({ ...pins, fields: [] }), { cacheDir: dir }).get(
        'sheet/Item/1',
        {},
      ),
    ).rejects.toThrow();
    expect(await readdir(dir)).toEqual([]);
  });
  it('caches immutable Teamcraft JSON, but never mutable commit discovery', async () => {
    const dir = await cacheDir();
    const url = `https://raw.githubusercontent.com/ffxiv-teamcraft/ffxiv-teamcraft/${teamcraftCommit}/libs/data/src/lib/json/shops.json`;
    const source = replay(async () => jsonResponse({ shops: [] }), { cacheDir: dir });
    expect(await source.json(url)).toEqual({ shops: [] });
    expect(await replay(vi.fn(), { cacheDir: dir, offline: true }).json(url)).toEqual({
      shops: [],
    });
    await source.json(
      'https://api.github.com/repos/ffxiv-teamcraft/ffxiv-teamcraft/commits/staging',
    );
    expect(await readdir(dir)).toHaveLength(1);
    await expect(
      replay(vi.fn(), { cacheDir: dir, offline: true }).json(
        'https://api.github.com/repos/ffxiv-teamcraft/ffxiv-teamcraft/commits/staging',
      ),
    ).rejects.toThrow(/offline/i);
  });
});

describe('bounded transport', () => {
  it('retries 5xx at most three times with 2s and 4s backoff', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const source = replay(async () =>
      ++attempts < 3 ? new Response('', { status: 502 }) : jsonResponse(row),
    );
    const result = source.get('sheet/Item/1', {});
    await vi.advanceTimersByTimeAsync(1999);
    expect(attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(3999);
    expect(attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual(row);
    expect(attempts).toBe(3);
    let failures = 0;
    const failed = expect(
      replay(async () => {
        failures++;
        return new Response('', { status: 500 });
      }).get('sheet/Item/1', {}),
    ).rejects.toThrow(/500/);
    await Promise.all([vi.advanceTimersByTimeAsync(6000), failed]);
    expect(failures).toBe(3);
  });
  it.each([429, 503])('fails immediately for XIVAPI %i and stores nothing', async (status) => {
    const dir = await cacheDir();
    let attempts = 0;
    const source = replay(
      async () => {
        attempts++;
        return new Response('', { status });
      },
      { cacheDir: dir },
    );
    await expect(source.get('sheet/Item/1', {})).rejects.toThrow(new RegExp(String(status)));
    expect(attempts).toBe(1);
    expect(await readdir(dir)).toEqual([]);
  });
  it('bounds stalled fetch even when fetch ignores its abort signal', async () => {
    vi.useFakeTimers();
    const source = replay(async () => new Promise<Response>(() => {}));
    const result = expect(source.get('sheet/Item/1', {})).rejects.toThrow(/timeout/i);
    await Promise.all([vi.advanceTimersByTimeAsync(90_001), result]);
  });
  it('bounds a stalled body after successful headers', async () => {
    vi.useFakeTimers();
    let cancelled = false;
    const source = replay(
      async () =>
        new Response(
          new ReadableStream({
            start() {},
            cancel() {
              cancelled = true;
            },
          }),
        ),
    );
    const result = expect(source.get('sheet/Item/1', {})).rejects.toThrow(/timeout/i);
    await Promise.all([vi.advanceTimersByTimeAsync(90_001), result]);
    expect(cancelled).toBe(true);
  });
  it('cancels a response that arrives after fetch ignored the timeout abort', async () => {
    vi.useFakeTimers();
    let respond: ((response: Response) => void) | undefined;
    let cancelled = false;
    const source = replay(
      async () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    );
    const result = expect(source.get('sheet/Item/1', {})).rejects.toThrow(/timeout/i);
    await Promise.all([vi.advanceTimersByTimeAsync(90_001), result]);
    respond!(
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(cancelled).toBe(true);
  });
  it('caps streamed decoded body bytes before parsing or caching', async () => {
    const dir = await cacheDir();
    const source = replay(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(row)));
              controller.close();
            },
          }),
        ),
      { cacheDir: dir, maxBodyBytes: 32 },
    );
    await expect(source.get('sheet/Item/1', {})).rejects.toThrow(/body|bytes|large/i);
    expect(await readdir(dir)).toEqual([]);
  });
});
