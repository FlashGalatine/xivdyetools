/**
 * Capped streaming read for fetched images (FINDING-004, 2026-08-21 audit).
 *
 * `fetchImageWithTimeout` must enforce the byte cap while streaming — a
 * response without Content-Length (or lying about it) must be abandoned once
 * the cap is exceeded, not buffered to completion and checked afterwards.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchImageWithTimeout } from './validators.js';

function streamingResponse(totalBytes: number, chunkSize: number, pulls: { count: number }): Response {
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
  });
  // no Content-Length header on purpose
  return new Response(body, { status: 200 });
}

describe('fetchImageWithTimeout byte cap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
