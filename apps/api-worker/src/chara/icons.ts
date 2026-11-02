/** Validate upstream PNGs and decide whether the route should update its cache. */
import { ApiError, ErrorCode } from '../lib/api-error.js';
import { BodyTooLargeError, readBoundedBytes } from '../lib/bounded-body.js';
import { ICON_FRESH_MS, MAX_ICON_BYTES, isPng } from './icon-cache.js';
import type { CharaIconCache, IconCacheEntry } from './icon-cache.js';
import { UpstreamUnavailableError } from './xivapi.js';
import type { XivapiAssetContext, XivapiClient } from './xivapi.js';

export interface IconPayload {
  bytes: Uint8Array;
  cacheStatus: 'HIT' | 'MISS';
  cacheUpdate: IconCacheEntry | null;
}

export async function loadIcon(
  client: XivapiClient,
  context: XivapiAssetContext,
  iconId: number,
  cache: CharaIconCache,
  admit?: () => Promise<void>,
): Promise<IconPayload> {
  const retained = await cache.get(context, iconId);
  if (retained && Date.now() - retained.cachedAt < ICON_FRESH_MS) {
    return { bytes: retained.bytes, cacheStatus: 'HIT', cacheUpdate: null };
  }
  if (admit) await admit();
  const upstream = await client.fetchIcon(iconId, context, retained?.etag ?? undefined);
  if (upstream.status === 304) {
    if (!retained || !retained.etag)
      throw new UpstreamUnavailableError(304, 'no retained PNG for conditional response');
    const entry = {
      bytes: retained.bytes,
      etag: upstream.headers.get('ETag') ?? retained.etag,
      cachedAt: Date.now(),
    };
    return { bytes: entry.bytes, cacheStatus: 'MISS', cacheUpdate: entry };
  }
  if (upstream.status === 404) throw new ApiError(ErrorCode.NOT_FOUND, 'No icon ' + iconId, 404);
  if (!upstream.ok)
    throw new ApiError(
      ErrorCode.UPSTREAM_UNAVAILABLE,
      'Icon upstream answered ' + upstream.status,
      503,
    );
  if (Number(upstream.headers.get('Content-Length') ?? '0') > MAX_ICON_BYTES) {
    throw new ApiError(ErrorCode.UPSTREAM_UNAVAILABLE, 'Icon exceeds the size ceiling', 503);
  }
  let bytes: Uint8Array;
  try {
    bytes = await readBoundedBytes(upstream.body, MAX_ICON_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      throw new ApiError(ErrorCode.UPSTREAM_UNAVAILABLE, 'Icon exceeds the size ceiling', 503);
    }
    throw new UpstreamUnavailableError(0, 'icon body unavailable');
  }
  if (!isPng(bytes))
    throw new ApiError(ErrorCode.UPSTREAM_UNAVAILABLE, 'Icon upstream did not return a PNG', 503);
  return {
    bytes,
    cacheStatus: 'MISS',
    cacheUpdate: context.cacheable
      ? { bytes, etag: upstream.headers.get('ETag'), cachedAt: Date.now() }
      : null,
  };
}
