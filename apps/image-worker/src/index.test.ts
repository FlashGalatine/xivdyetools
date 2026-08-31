import { describe, it, expect, vi, beforeEach } from 'vitest';
import app from './index.js';
import type { Env } from './types.js';

const env: Env = { ENVIRONMENT: 'test' };

describe('image-worker', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('http://localhost/health', {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns 404 for unknown paths', async () => {
    const res = await app.request('http://localhost/nope', {}, env);

    expect(res.status).toBe(404);
  });
});

// Keep the real helpers (readBodyWithCap, validateFileSize, limits) and mock
// only the network-touching entry point — FINDING-004 wired the helpers into
// the routes, so a bare mock would leave them undefined.
vi.mock('./validators.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./validators.js')>();
  return { ...actual, validateAndFetchImage: vi.fn() };
});
vi.mock('./photon.js', () => ({
  processImageForExtraction: vi.fn(),
  processImageForThumbnail: vi.fn(),
}));

import { validateAndFetchImage } from './validators.js';
import { processImageForExtraction, processImageForThumbnail } from './photon.js';

describe('POST /extract', () => {
  beforeEach(() => {
    vi.mocked(validateAndFetchImage).mockReset();
    vi.mocked(processImageForExtraction).mockReset();
  });

  it('returns RGBA pixels with dimension headers', async () => {
    vi.mocked(validateAndFetchImage).mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3]),
      format: 'png',
    });
    vi.mocked(processImageForExtraction).mockResolvedValue({
      pixels: new Uint8Array([10, 20, 30, 255]),
      width: 1,
      height: 1,
    });

    const res = await app.request(
      'http://localhost/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.discordapp.com/x.png' }),
      },
      env
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('X-Image-Width')).toBe('1');
    expect(res.headers.get('X-Image-Height')).toBe('1');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([10, 20, 30, 255]));
  });

  it('passes maxDimension through to the processor', async () => {
    vi.mocked(validateAndFetchImage).mockResolvedValue({
      buffer: new Uint8Array([1]),
      format: 'png',
    });
    vi.mocked(processImageForExtraction).mockResolvedValue({
      pixels: new Uint8Array([0, 0, 0, 255]),
      width: 1,
      height: 1,
    });

    await app.request(
      'http://localhost/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.discordapp.com/x.png', maxDimension: 64 }),
      },
      env
    );

    expect(vi.mocked(processImageForExtraction)).toHaveBeenCalledWith(expect.any(Uint8Array), {
      maxDimension: 64,
    });
  });

  it('preserves the original error message verbatim', async () => {
    // extractor.ts substring-matches this text to pick a localized message.
    vi.mocked(validateAndFetchImage).mockRejectedValue(
      new Error('Image too large: 12MB exceeds 10MB limit')
    );

    const res = await app.request(
      'http://localhost/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.discordapp.com/x.png' }),
      },
      env
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Image too large: 12MB exceeds 10MB limit' });
  });

  it('rejects a request with no url', async () => {
    const res = await app.request(
      'http://localhost/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      env
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No image URL provided' });
  });
});

describe('POST /thumbnail', () => {
  beforeEach(() => {
    vi.mocked(processImageForThumbnail).mockReset();
  });

  it('returns WebP bytes with correct content type', async () => {
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF header
    vi.mocked(processImageForThumbnail).mockReturnValue(webpBytes);

    const res = await app.request(
      'http://localhost/thumbnail',
      {
        method: 'POST',
        body: new Uint8Array([0x89, 0x50, 0x4E, 0x47]), // PNG header
      },
      env
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(webpBytes);
  });

  it('rejects an empty body', async () => {
    const res = await app.request(
      'http://localhost/thumbnail',
      {
        method: 'POST',
        body: new Uint8Array(0),
      },
      env
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'No image data provided' });
  });

  it('rejects bytes that are not a decodable image', async () => {
    vi.mocked(processImageForThumbnail).mockImplementationOnce(() => {
      throw new Error('Failed to load image: Invalid image format');
    });

    const res = await app.request(
      'http://localhost/thumbnail',
      {
        method: 'POST',
        body: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      },
      env
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'Failed to load image: Invalid image format',
    });
  });
});

// FINDING-023 (2026-08-29 security audit): the workers.dev hostname guard in
// index.ts. `https://image-worker/...` is the exact literal both real
// callers construct (discord-worker's image-client.ts:54, presets-api's
// preview-image-service.ts:152) — see-through it above is the pre-existing
// `http://localhost/...` test convenience, which also isn't a workers.dev
// host and so was never at risk of being caught by this guard.
describe('workers.dev hostname guard (FINDING-023)', () => {
  beforeEach(() => {
    vi.mocked(validateAndFetchImage).mockReset();
    vi.mocked(processImageForExtraction).mockReset();
    vi.mocked(processImageForThumbnail).mockReset();
  });

  it('refuses /health on a workers.dev hostname', async () => {
    const res = await app.request(
      'https://xivdyetools-image-worker.example-account.workers.dev/health',
      {},
      env
    );

    expect(res.status).toBe(404);
  });

  // Fix round 1 (S8-R8): a trailing dot is the RFC 1035 absolute-FQDN
  // spelling of the same host (`acct.workers.dev.` === `acct.workers.dev`)
  // and used to slip past a bare `endsWith('.workers.dev')` check.
  it('refuses /health on a workers.dev hostname with a trailing dot', async () => {
    const res = await app.request(
      'https://xivdyetools-image-worker.example-account.workers.dev./health',
      {},
      env
    );

    expect(res.status).toBe(404);
  });

  it('refuses /extract on a workers.dev hostname and does no work', async () => {
    const res = await app.request(
      'https://xivdyetools-image-worker.example-account.workers.dev/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.discordapp.com/x.png' }),
      },
      env
    );

    expect(res.status).toBe(404);
    expect(validateAndFetchImage).not.toHaveBeenCalled();
    expect(processImageForExtraction).not.toHaveBeenCalled();
  });

  it('refuses /thumbnail on a workers.dev hostname and does no work', async () => {
    const res = await app.request(
      'https://xivdyetools-image-worker.example-account.workers.dev/thumbnail',
      {
        method: 'POST',
        body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      },
      env
    );

    expect(res.status).toBe(404);
    expect(processImageForThumbnail).not.toHaveBeenCalled();
  });

  it("still serves /extract on the callers' real hostname", async () => {
    vi.mocked(validateAndFetchImage).mockResolvedValue({
      buffer: new Uint8Array([1]),
      format: 'png',
    });
    vi.mocked(processImageForExtraction).mockResolvedValue({
      pixels: new Uint8Array([0, 0, 0, 255]),
      width: 1,
      height: 1,
    });

    const res = await app.request(
      'https://image-worker/extract',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://cdn.discordapp.com/x.png' }),
      },
      env
    );

    expect(res.status).toBe(200);
    expect(validateAndFetchImage).toHaveBeenCalled();
    expect(processImageForExtraction).toHaveBeenCalled();
  });

  it("still serves /thumbnail on the callers' real hostname", async () => {
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    vi.mocked(processImageForThumbnail).mockReturnValue(webpBytes);

    const res = await app.request(
      'https://image-worker/thumbnail',
      {
        method: 'POST',
        body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      },
      env
    );

    expect(res.status).toBe(200);
    expect(processImageForThumbnail).toHaveBeenCalled();
  });
});
