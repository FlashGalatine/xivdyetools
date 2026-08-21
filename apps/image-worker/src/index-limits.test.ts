/**
 * Route-level input limits (FINDING-004, 2026-08-21 audit):
 * - POST /extract validates `maxDimension` before any work
 * - POST /thumbnail enforces the byte cap from Content-Length BEFORE buffering
 *   the body, and after buffering as a backstop, and never hands oversized
 *   bytes to photon.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./validators.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./validators.js')>();
  return { ...actual, validateAndFetchImage: vi.fn() };
});
vi.mock('./photon.js', () => ({
  processImageForExtraction: vi.fn(),
  processImageForThumbnail: vi.fn(() => new Uint8Array([1, 2, 3])),
}));

import app from './index.js';
import type { Env } from './types.js';
import { MAX_FILE_SIZE_BYTES } from './validators.js';
import { processImageForExtraction, processImageForThumbnail } from './photon.js';

const env: Env = { ENVIRONMENT: 'test' };

describe('POST /extract maxDimension validation', () => {
  beforeEach(() => {
    vi.mocked(processImageForExtraction).mockReset();
  });

  it.each([['abc'], [0], [-1], [1.5], [100000]])('rejects maxDimension %p with 400', async (bad) => {
    const res = await app.request(
      'http://localhost/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.discordapp.com/x.png', maxDimension: bad }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/maxDimension/);
    expect(processImageForExtraction).not.toHaveBeenCalled();
  });
});

describe('POST /thumbnail size caps', () => {
  beforeEach(() => {
    vi.mocked(processImageForThumbnail).mockClear();
  });

  it('rejects from Content-Length without buffering the body', async () => {
    const res = await app.request(
      'http://localhost/thumbnail',
      {
        method: 'POST',
        headers: { 'Content-Length': String(MAX_FILE_SIZE_BYTES + 1), 'Content-Type': 'image/png' },
        body: new Uint8Array([1, 2, 3]),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/too large/);
    expect(processImageForThumbnail).not.toHaveBeenCalled();
  });

  it('rejects an oversized body even when Content-Length is absent', async () => {
    const big = new Uint8Array(MAX_FILE_SIZE_BYTES + 16);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(big);
        controller.close();
      },
    });
    const res = await app.request(
      'http://localhost/thumbnail',
      // @ts-expect-error duplex is required by undici for streaming bodies
      { method: 'POST', body, duplex: 'half' },
      env,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/too large/);
    expect(processImageForThumbnail).not.toHaveBeenCalled();
  });

  it('still processes an in-limit body', async () => {
    const res = await app.request(
      'http://localhost/thumbnail',
      { method: 'POST', body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
      env,
    );
    expect(res.status).toBe(200);
    expect(processImageForThumbnail).toHaveBeenCalledTimes(1);
  });
});
