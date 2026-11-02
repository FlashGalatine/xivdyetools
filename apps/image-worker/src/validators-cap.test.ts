/**
 * Capped streaming read for fetched images (FINDING-004, 2026-08-21 audit).
 *
 * `fetchImageWithTimeout` must enforce the byte cap while streaming — a
 * response without Content-Length (or lying about it) must be abandoned once
 * the cap is exceeded, not buffered to completion and checked afterwards.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchImageWithTimeout, readBodyWithCap } from './validators.js';

function streamingResponse(totalBytes: number, chunkSize: number, pulls: { count: number; cancelled?: boolean }): Response {
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) {
        controller.close();
        return;
      }
      pulls.count++;
      const n = Math.min(chunkSize, totalBytes - sent);
      controller.enqueue(new Uint8Array(n));
      sent += n;
    },
    cancel() { pulls.cancelled = true; },
  });
  // no Content-Length header on purpose
  return new Response(body, { status: 200 });
}

describe('fetchImageWithTimeout byte cap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('readBodyWithCap accepts 5 MiB and rejects a stream one byte above it', async () => {
    const exact = streamingResponse(5 * 1024 * 1024, 1024 * 1024, { count: 0 });
    expect((await readBodyWithCap(exact.body)).byteLength).toBe(5 * 1024 * 1024);
    const oversized = streamingResponse(5 * 1024 * 1024 + 1, 1024 * 1024, { count: 0 });
    await expect(readBodyWithCap(oversized.body).then((bytes) => bytes.byteLength)).rejects.toThrow('Image too large. Maximum size is 5MB');
  });

  it.each([false, true])('accepts an exact 5 MiB CDN stream with Content-Length present=%s', async (declared) => {
    const response = streamingResponse(5 * 1024 * 1024, 1024 * 1024, { count: 0 });
    if (declared) response.headers.set('Content-Length', String(5 * 1024 * 1024));
    vi.stubGlobal('fetch', vi.fn(async () => response));
    expect((await fetchImageWithTimeout('https://cdn.discordapp.com/x.png')).byteLength).toBe(5 * 1024 * 1024);
  });

  it.each([false, true])('rejects a CDN stream one byte above 5 MiB with lying Content-Length present=%s', async (declared) => {
    const response = streamingResponse(5 * 1024 * 1024 + 1, 1024 * 1024, { count: 0 });
    if (declared) response.headers.set('Content-Length', '1');
    vi.stubGlobal('fetch', vi.fn(async () => response));
    await expect(fetchImageWithTimeout('https://cdn.discordapp.com/x.png').then((bytes) => bytes.byteLength))
      .rejects.toThrow('Image too large. Maximum size is 5MB');
  });

  it('rejects a declared CDN size above 5 MiB before consuming the stream', async () => {
    const response = streamingResponse(1024, 1024, { count: 0 });
    response.headers.set('Content-Length', String(5 * 1024 * 1024 + 1));
    const bodyRead = vi.spyOn(response, 'body', 'get');
    vi.stubGlobal('fetch', vi.fn(async () => response));
    await expect(fetchImageWithTimeout('https://cdn.discordapp.com/x.png').then((bytes) => bytes.byteLength)).rejects.toThrow('Image too large (5.0MB). Maximum size is 5MB');
    expect(bodyRead).not.toHaveBeenCalled();
    bodyRead.mockRestore();
  });

  it.each([false, true])('cancels an oversized CDN stream with lying Content-Length present=%s', async (declared) => {
    const pulls = { count: 0, cancelled: false };
    const response = streamingResponse(8 * 1024 * 1024, 1024 * 1024, pulls);
    if (declared) response.headers.set('Content-Length', '1');
    vi.stubGlobal('fetch', vi.fn(async () => response));
    await expect(fetchImageWithTimeout('https://cdn.discordapp.com/x.png').then((bytes) => bytes.byteLength)).rejects.toThrow('Image too large. Maximum size is 5MB');
    expect(pulls.cancelled).toBe(true);
    expect(pulls.count).toBeLessThanOrEqual(7);
  });

  it('stops reading once the cap is exceeded when Content-Length is absent', async () => {
    const pulls = { count: 0 };
    vi.stubGlobal('fetch', vi.fn(async () => streamingResponse(64 * 1024, 1024, pulls)));

    await expect(
      fetchImageWithTimeout('https://cdn.discordapp.com/attachments/1/2/x.png', { maxBytes: 4096 }),
    ).rejects.toThrow(/too large/);

    // 4 KB cap, 1 KB chunks: must give up within a few chunks, not read all 64
    expect(pulls.count).toBeLessThanOrEqual(6);
  });

  it('returns the bytes for an in-cap stream', async () => {
    const pulls = { count: 0 };
    vi.stubGlobal('fetch', vi.fn(async () => streamingResponse(3000, 1024, pulls)));

    const bytes = await fetchImageWithTimeout('https://cdn.discordapp.com/attachments/1/2/x.png', {
      maxBytes: 4096,
    });
    expect(bytes.byteLength).toBe(3000);
  });
});
