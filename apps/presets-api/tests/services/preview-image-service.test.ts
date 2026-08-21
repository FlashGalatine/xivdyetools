/**
 * Preview Image Service Tests
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { MockR2Bucket } from '@xivdyetools/test-utils';
import {
  sniffImageType,
  storePreviewImage,
  deletePreviewImage,
  purgePreviewImageCache,
  PREVIEW_IMAGE_CACHE_CONTROL,
} from '../../src/services/preview-image-service';
import { createMockEnv } from '../test-utils';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe('sniffImageType', () => {
  it('identifies png, jpeg and webp by magic bytes', () => {
    expect(sniffImageType(png)).toBe('png');
    expect(sniffImageType(jpeg)).toBe('jpeg');
    expect(sniffImageType(webp)).toBe('webp');
  });

  it('rejects a non-image, however it was labelled', () => {
    expect(sniffImageType(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]))).toBeNull();
  });

  it('rejects a RIFF container that is not WEBP', () => {
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);
    expect(sniffImageType(wav)).toBeNull();
  });

  it('rejects a buffer too short to carry a signature', () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

// FINDING-018 / PAPI-4 (2026-08-21 security audit): objects were stored with
// `max-age=31536000, immutable` and takedown only deleted the R2 object, so a
// rejected or deleted picture kept resolving from the edge cache for up to a
// year. The edge TTL is now one day, and every takedown path purges the URL.
describe('storePreviewImage (FINDING-018)', () => {
  it('stores under a single-use {presetId}/{uuid}.webp key with a short edge TTL', async () => {
    const env = createMockEnv();
    const bucket = env.THUMBNAILS as unknown as MockR2Bucket;

    const key = await storePreviewImage(env, 'preset-1', png);

    expect(key).toMatch(/^preset-1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/);
    const stored = bucket._store.get(key);
    expect(stored?.httpMetadata?.contentType).toBe('image/webp');
    // Browser: long + immutable (the key is single-use, the URL never changes
    // meaning). Edge: one day, so a purge failure bounds exposure to 24 h.
    expect(stored?.httpMetadata?.cacheControl).toBe(PREVIEW_IMAGE_CACHE_CONTROL);
    expect(PREVIEW_IMAGE_CACHE_CONTROL).toBe('public, max-age=31536000, immutable, s-maxage=86400');
  });

  it('never reuses a key — a replaced image always gets a new URL', async () => {
    const env = createMockEnv();

    const first = await storePreviewImage(env, 'preset-1', png);
    const second = await storePreviewImage(env, 'preset-1', png);

    expect(second).not.toBe(first);
  });

  it('throws when image-worker cannot process the bytes and stores nothing', async () => {
    const env = createMockEnv({
      IMAGE_WORKER: { fetch: async () => new Response('bad', { status: 400 }) } as unknown as Fetcher,
    });
    const bucket = env.THUMBNAILS as unknown as MockR2Bucket;

    await expect(storePreviewImage(env, 'preset-1', png)).rejects.toThrow('Image could not be processed');
    expect(bucket._store.size).toBe(0);
  });
});

describe('purgePreviewImageCache / deletePreviewImage (FINDING-018)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const purgeCredentials = { CACHE_PURGE_ZONE_ID: 'zone-123', CACHE_PURGE_API_TOKEN: 'purge-token' };

  function stubPurgeApi(response: () => Promise<Response>) {
    const fetchMock = vi.fn(response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('purges the public URL of the key through the Cloudflare cache-purge API', async () => {
    const fetchMock = stubPurgeApi(
      async () => new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    const env = createMockEnv(purgeCredentials);

    const result = await purgePreviewImageCache(env, 'preset-1/a.webp');

    expect(result).toBe('purged');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/zones/zone-123/purge_cache');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer purge-token');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      files: ['https://shots.xivdyetools.app/preset-1/a.webp'],
    });
  });

  it('is skipped (no request) when the purge credentials are not configured', async () => {
    const fetchMock = stubPurgeApi(async () => new Response('{}', { status: 200 }));
    const env = createMockEnv(); // no CACHE_PURGE_* set

    expect(await purgePreviewImageCache(env, 'preset-1/a.webp')).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a failed purge without throwing (an API error)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubPurgeApi(async () => new Response('{"success":false}', { status: 403 }));
    const env = createMockEnv(purgeCredentials);

    expect(await purgePreviewImageCache(env, 'preset-1/a.webp')).toBe('failed');
    expect(error).toHaveBeenCalled();
  });

  it('reports a failed purge without throwing (a network error)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubPurgeApi(async () => {
      throw new Error('network down');
    });
    const env = createMockEnv(purgeCredentials);

    expect(await purgePreviewImageCache(env, 'preset-1/a.webp')).toBe('failed');
  });

  it('deletePreviewImage removes the object and then purges its URL', async () => {
    const fetchMock = stubPurgeApi(
      async () => new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    const env = createMockEnv(purgeCredentials);
    const bucket = env.THUMBNAILS as unknown as MockR2Bucket;
    await bucket.put('preset-1/a.webp', new ArrayBuffer(4));

    await deletePreviewImage(env, 'preset-1/a.webp');

    expect(bucket._store.has('preset-1/a.webp')).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual({
      files: ['https://shots.xivdyetools.app/preset-1/a.webp'],
    });
  });

  it('deletePreviewImage does not purge when the R2 delete throws — the object still exists', async () => {
    const fetchMock = stubPurgeApi(async () => new Response('{}', { status: 200 }));
    const env = createMockEnv(purgeCredentials);
    (env.THUMBNAILS as unknown as MockR2Bucket).delete = async () => {
      throw new Error('R2 down');
    };

    await expect(deletePreviewImage(env, 'preset-1/a.webp')).rejects.toThrow('R2 down');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletePreviewImage still succeeds when the purge fails — the takedown is the DB + R2 state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubPurgeApi(async () => new Response('{}', { status: 500 }));
    const env = createMockEnv(purgeCredentials);
    const bucket = env.THUMBNAILS as unknown as MockR2Bucket;
    await bucket.put('preset-1/a.webp', new ArrayBuffer(4));

    await expect(deletePreviewImage(env, 'preset-1/a.webp')).resolves.toBeUndefined();
    expect(bucket._store.has('preset-1/a.webp')).toBe(false);
  });

  it('deletePreviewImage is a no-op for a missing key', async () => {
    const fetchMock = stubPurgeApi(async () => new Response('{}', { status: 200 }));
    const env = createMockEnv(purgeCredentials);

    await deletePreviewImage(env, null);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
