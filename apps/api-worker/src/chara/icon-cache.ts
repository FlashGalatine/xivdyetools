/** Binary icon storage. Public cache policy is applied only by the route. */
import { readBoundedBytes } from '../lib/bounded-body.js';
import type { XivapiAssetContext } from './xivapi.js';

export const MAX_ICON_BYTES = 1024 * 1024;
export const ICON_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
export const ICON_RETAIN_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_NAME = 'chara-icons';
const POLICY_VERSION = 1;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((value, i) => bytes[i] === value)
  );
}

export interface IconCacheEntry {
  bytes: Uint8Array;
  etag: string | null;
  cachedAt: number;
}

export class CharaIconCache {
  private key(context: XivapiAssetContext, iconId: number): Request {
    return new Request(
      'https://cache.internal/chara-icon/' +
        encodeURIComponent(JSON.stringify([POLICY_VERSION, context.base, context.version, iconId])),
    );
  }

  async get(context: XivapiAssetContext, iconId: number): Promise<IconCacheEntry | null> {
    if (!context.cacheable || typeof caches === 'undefined') return null;
    try {
      const edge = await caches.open(CACHE_NAME);
      const response = await edge.match(this.key(context, iconId));
      if (!response) return null;
      const rawTime = response.headers.get('X-Cached-At');
      if (rawTime === null || rawTime.trim() === '') return null;
      const cachedAt = Number(rawTime);
      const age = Date.now() - cachedAt;
      if (!Number.isFinite(cachedAt) || cachedAt < 0 || age < 0 || age >= ICON_RETAIN_MS)
        return null;
      const bytes = await readBoundedBytes(response.body, MAX_ICON_BYTES);
      return isPng(bytes) ? { bytes, etag: response.headers.get('X-Origin-ETag'), cachedAt } : null;
    } catch {
      return null;
    }
  }

  async put(context: XivapiAssetContext, iconId: number, entry: IconCacheEntry): Promise<void> {
    if (!context.cacheable || typeof caches === 'undefined') return;
    try {
      if (entry.bytes.length > MAX_ICON_BYTES || !isPng(entry.bytes)) return;
      const headers = new Headers({
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=' + String(ICON_RETAIN_MS / 1000),
        'X-Cached-At': String(entry.cachedAt),
      });
      if (entry.etag !== null) headers.set('X-Origin-ETag', entry.etag);
      const edge = await caches.open(CACHE_NAME);
      await edge.put(this.key(context, iconId), new Response(entry.bytes, { headers }));
    } catch {
      // The cache is optional; a failed write must not lose a valid image.
    }
  }
}
