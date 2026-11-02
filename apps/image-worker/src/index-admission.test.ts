import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app from './index.js';
import { validateAndFetchImage } from './validators.js';
import { processImageForExtraction, processImageForThumbnail } from './photon.js';

vi.mock('./validators.js', async (original) => ({
  ...await original<typeof import('./validators.js')>(),
  validateAndFetchImage: vi.fn(),
}));
vi.mock('./photon.js', () => ({
  processImageForExtraction: vi.fn(),
  processImageForThumbnail: vi.fn(),
}));

const encoded = new TextEncoder();
const json = encoded.encode(JSON.stringify({ url: 'https://cdn.discordapp.com/x.png' }));
const pixels = { pixels: new Uint8Array([1, 2, 3, 255]), width: 1, height: 1 };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function request(path = '/extract', body: BodyInit = json, signal?: AbortSignal) {
  return app.request(new Request(`https://image-worker${path}`, {
    method: 'POST', body, signal, duplex: 'half',
  } as RequestInit), undefined, {});
}
function blockedStream(bytes = json, cancellation: 'normal' | 'reject' | 'stall' = 'normal') {
  const entered = deferred<void>();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let pulls = 0;
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
    pull() { pulls++; entered.resolve(); },
    cancel() {
      cancelled++;
      if (cancellation === 'reject') return Promise.reject(new Error('private cancellation'));
      if (cancellation === 'stall') return new Promise<void>(() => {});
    },
  }, { highWaterMark: 0 });
  return { body, entered: entered.promise, get pulls() { return pulls; },
    get cancelled() { return cancelled; },
    finish() { controller.enqueue(bytes); controller.close(); } };
}
async function expectBusy(path: string, cancellation: 'normal' | 'reject' | 'stall' = 'normal') {
  let pulls = 0;
  let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) { pulls++; c.enqueue(json); c.close(); },
    cancel() {
      cancelled++;
      if (cancellation === 'reject') return Promise.reject(new Error('private cancellation'));
      if (cancellation === 'stall') return new Promise<void>(() => {});
    },
  }, { highWaterMark: 0 });
  const response = await request(path, body);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'Image processing unavailable' });
  expect(pulls).toBe(0);
  expect(cancelled).toBe(1);
}

beforeEach(() => {
  vi.mocked(validateAndFetchImage).mockReset().mockResolvedValue({ buffer: new Uint8Array([1]), format: 'png' });
  vi.mocked(processImageForExtraction).mockReset().mockResolvedValue(pixels);
  vi.mocked(processImageForThumbnail).mockReset().mockReturnValue(new Uint8Array([2]));
});
afterEach(() => { vi.restoreAllMocks(); });

describe('shared image admission', () => {
  it.each(['/extract', '/thumbnail'])('holds acquisition at %s before refusing either route without reading', async path => {
    const stream = blockedStream(path === '/extract' ? json : new Uint8Array([1]));
    const first = request(path, stream.body);
    await stream.entered;
    try {
      await expectBusy('/extract');
      await expectBusy('/thumbnail');
      expect(validateAndFetchImage).not.toHaveBeenCalled();
      expect(processImageForExtraction).not.toHaveBeenCalled();
      expect(processImageForThumbnail).not.toHaveBeenCalled();
      expect((await app.request('https://image-worker/health', {}, {})).status).toBe(200);
      expect((await app.request('https://image-worker/nope', {}, {})).status).toBe(404);
      expect((await app.request('https://image-worker/extract', {}, {})).status).toBe(404);
      expect((await app.request('https://private.workers.dev/thumbnail', { method: 'POST', body: 'x' }, {})).status).toBe(404);
    } finally { stream.finish(); await first; }
    expect((await request()).status).toBe(200);
  });

  it.each(['fetch', 'processing'])('holds %s until actual completion despite abort', async stage => {
    const entered = deferred<void>();
    const resume = deferred<void>();
    if (stage === 'fetch') vi.mocked(validateAndFetchImage).mockImplementationOnce(async () => {
      entered.resolve(); await resume.promise; return { buffer: new Uint8Array([1]), format: 'png' };
    });
    else vi.mocked(processImageForExtraction).mockImplementationOnce(async () => {
      entered.resolve(); await resume.promise; return pixels;
    });
    const abort = new AbortController();
    const first = request('/extract', json, abort.signal);
    await entered.promise;
    abort.abort();
    try { await expectBusy('/thumbnail'); }
    finally { resume.resolve(); await first; }
    if (stage === 'fetch') expect(processImageForExtraction).not.toHaveBeenCalled();
    expect((await request()).status).toBe(200);
  });

  it.each(['reject', 'stall'] as const)('returns overload promptly when unused body cancellation will %s', async cancellation => {
    const stream = blockedStream();
    const first = request('/extract', stream.body);
    await stream.entered;
    try { await expectBusy('/thumbnail', cancellation); }
    finally { stream.finish(); await first; }
  });

  it('handles a synchronous unused-body cancellation throw without reading', async () => {
    const stream = blockedStream();
    const first = request('/extract', stream.body);
    await stream.entered;
    const cancel = vi.fn(() => { throw new Error('private cancellation'); });
    const getReader = vi.fn(() => { throw new Error('must not read'); });
    const raw = new Request('https://image-worker/thumbnail', { method: 'POST', body: 'x' });
    Object.defineProperty(raw, 'body', { value: { cancel, getReader } });
    try {
      const result = await app.request(raw, undefined, {});
      expect(result.status).toBe(503);
      expect(await result.json()).toEqual({ error: 'Image processing unavailable' });
      expect(cancel).toHaveBeenCalledOnce();
      expect(getReader).not.toHaveBeenCalled();
    } finally { stream.finish(); await first; }
  });

  it('does not release while an owned body reader ignores abort cancellation', async () => {
    const abort = new AbortController();
    const entered = deferred<void>();
    const resume = deferred<ReadableStreamReadResult<Uint8Array>>();
    const reader = {
      read: vi.fn(() => { entered.resolve(); return resume.promise; }),
      cancel: vi.fn(async () => {}),
      releaseLock: vi.fn(),
    };
    const raw = new Request('https://image-worker/thumbnail', { method: 'POST', body: 'x', signal: abort.signal });
    Object.defineProperty(raw, 'body', { value: { getReader: () => reader } });
    const first = app.request(raw, undefined, {});
    await entered.promise;
    abort.abort();
    try {
      await expectBusy('/extract');
      expect(reader.cancel).toHaveBeenCalledOnce();
      expect(reader.releaseLock).not.toHaveBeenCalled();
    } finally { resume.resolve({ done: false, value: new Uint8Array([1]) }); await first; }
    expect(reader.releaseLock).toHaveBeenCalledOnce();
    expect(processImageForThumbnail).not.toHaveBeenCalled();
    expect((await request()).status).toBe(200);
  });

  it.each(['validation', 'json', 'maxDimension', 'fetch', 'processing', 'read', 'thumbnail-read', 'thumbnail-empty', 'thumbnail-processing'] as const)('releases after %s failure', async failure => {
    let body: BodyInit = json;
    let path = '/extract';
    if (failure === 'validation') body = '{}';
    if (failure === 'json') body = '{';
    if (failure === 'maxDimension') body = JSON.stringify({ url: 'https://cdn.discordapp.com/x.png', maxDimension: 9 });
    if (failure === 'fetch') vi.mocked(validateAndFetchImage).mockRejectedValueOnce(new Error('Unsupported image format'));
    if (failure === 'processing') vi.mocked(processImageForExtraction).mockRejectedValueOnce(new Error('Failed to load image'));
    if (failure === 'read') body = new ReadableStream({ start(c) { c.error(new Error('private read')); } });
    if (failure.startsWith('thumbnail-')) path = '/thumbnail';
    if (failure === 'thumbnail-read') body = new ReadableStream({ start(c) { c.error(new Error('private read')); } });
    if (failure === 'thumbnail-empty') body = '';
    if (failure === 'thumbnail-processing') vi.mocked(processImageForThumbnail).mockImplementationOnce(() => { throw new Error('Failed to load image'); });
    expect((await request(path, body)).status).toBe(400);
    expect((await request()).status).toBe(200);
  });

  it('retains JSON decoding semantics for a UTF-8 BOM and a non-JSON content type', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...json]);
    const raw = new Request('https://image-worker/extract', { method: 'POST', body: bytes, headers: { 'Content-Type': 'text/plain' } });
    expect((await app.request(raw, undefined, {})).status).toBe(200);
    expect(validateAndFetchImage).toHaveBeenCalledWith('https://cdn.discordapp.com/x.png', raw.signal);
  });

  it.each(['/extract', '/thumbnail'])('pre-aborted %s never reads or decodes', async path => {
    const abort = new AbortController(); abort.abort();
    const stream = blockedStream();
    expect((await request(path, stream.body, abort.signal)).status).toBe(503);
    expect(stream.pulls).toBe(0);
    expect(stream.cancelled).toBe(1);
    expect(validateAndFetchImage).not.toHaveBeenCalled();
    expect(processImageForExtraction).not.toHaveBeenCalled();
    expect(processImageForThumbnail).not.toHaveBeenCalled();
    expect((await request()).status).toBe(200);
  });

  it.each(['/extract', '/thumbnail'])('mid-read abort at %s cancels a stalled source without decoding', async path => {
    const abort = new AbortController();
    const stream = blockedStream(json, 'stall');
    const first = request(path, stream.body, abort.signal);
    await stream.entered;
    abort.abort();
    expect((await first).status).toBe(503);
    expect(stream.cancelled).toBe(1);
    expect(validateAndFetchImage).not.toHaveBeenCalled();
    expect(processImageForExtraction).not.toHaveBeenCalled();
    expect(processImageForThumbnail).not.toHaveBeenCalled();
    expect((await request()).status).toBe(200);
  });
});
