/**
 * Preview image storage: sniff, hand to image-worker, put in R2.
 *
 * The author uploads a picture for their preset's card. This module owns the
 * bytes; the moderation gate lives in preset-service's rowToPreset.
 *
 * @module services/preview-image-service
 */

import type { Env } from '../types.js';
import { PREVIEW_IMAGE_PUBLIC_BASE } from './preset-service.js';

/**
 * FINDING-011 (2026-08-29 security audit): minimal logger interface for this
 * module — the purge/delete path only ever logs a URL (built from an
 * already-random object key) and an HTTP status, never a preset name.
 */
interface PreviewImageLogger {
  info(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Cloudflare's cap for this route; also bounds what image-worker decodes. */
export const MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Cache policy for every stored object (FINDING-018 / PAPI-4).
 *
 * Browser: a year + `immutable` — the UUID in the key makes every URL
 * single-use, so a URL can never come to mean a different image and a browser
 * never needs to revalidate it. Edge (`s-maxage`): ONE DAY. Takedown (reject,
 * author delete, preset delete, replace) deletes the object and purges the
 * URL; the short edge TTL is the backstop that bounds how long a removed
 * picture can still be served when the purge is not configured or fails.
 * Before this the edge TTL was also a year and nothing purged, so a rejected
 * image stayed reachable at its old URL for up to 365 days.
 */
export const PREVIEW_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable, s-maxage=86400';

/** The purge API is best-effort; never let a slow call hold a takedown hostage. */
const CACHE_PURGE_TIMEOUT_MS = 5_000;

/** Public URL of a stored object — the cache key the purge has to name. */
export function previewImagePublicUrl(key: string): string {
  return `${PREVIEW_IMAGE_PUBLIC_BASE}/${key}`;
}

export type CachePurgeResult = 'purged' | 'skipped' | 'failed';

/**
 * Evict a preview image's public URL from the Cloudflare edge cache
 * (FINDING-018). Single-file purge via the zone `purge_cache` API — needs
 * `CACHE_PURGE_ZONE_ID` (the zone serving shots.xivdyetools.app) and
 * `CACHE_PURGE_API_TOKEN` (a token with Zone.Cache Purge). Both optional:
 * without them this is a no-op and `PREVIEW_IMAGE_CACHE_CONTROL`'s one-day
 * `s-maxage` bounds the exposure instead.
 *
 * Never throws. A failed purge is logged and reported as 'failed'; the
 * caller's DB + R2 state is already correct and must not be rolled back or
 * reported as an error over it.
 */
export async function purgePreviewImageCache(
  env: Env,
  key: string | null,
  logger?: PreviewImageLogger
): Promise<CachePurgeResult> {
  if (!key) return 'skipped';
  const zoneId = env.CACHE_PURGE_ZONE_ID?.trim();
  const token = env.CACHE_PURGE_API_TOKEN?.trim();
  if (!zoneId || !token) return 'skipped';

  const url = previewImagePublicUrl(key);
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: [url] }),
        signal: AbortSignal.timeout(CACHE_PURGE_TIMEOUT_MS),
      }
    );
    if (!response.ok) {
      (logger ?? console).error(`[preview-image] cache purge failed for ${url}: HTTP ${response.status}`);
      return 'failed';
    }
    // Success is logged too, so a production tail can prove the purge path is
    // live (not merely that it did not fail) once the optional credentials are set.
    (logger ?? console).info(`[preview-image] cache purged ${url}`);
    return 'purged';
  } catch (err) {
    (logger ?? console).error(`[preview-image] cache purge failed for ${url}`, err);
    return 'failed';
  }
}

/**
 * Identify an image by its leading bytes.
 *
 * The declared Content-Type is a hint, never the decision — a PNG header on a
 * 300 MB archive is the oldest trick there is, and the browser will happily
 * label anything image/png.
 */
export function sniffImageType(bytes: Uint8Array): 'png' | 'jpeg' | 'webp' | null {
  if (bytes.length < 12) return null;

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }

  // RIFF....WEBP — the container alone is not enough, WAV shares the prefix.
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Crop + encode via image-worker, then store in R2.
 *
 * @returns the R2 key of the stored object
 * @throws when image-worker cannot decode the bytes
 */
export async function storePreviewImage(
  env: Env,
  presetId: string,
  bytes: Uint8Array
): Promise<string> {
  const response = await env.IMAGE_WORKER.fetch(
    new Request('https://image-worker/thumbnail', {
      method: 'POST',
      body: bytes,
    })
  );

  if (!response.ok) {
    throw new Error('Image could not be processed');
  }

  const webp = await response.arrayBuffer();
  const key = `${presetId}/${crypto.randomUUID()}.webp`;

  await env.THUMBNAILS.put(key, webp, {
    httpMetadata: {
      contentType: 'image/webp',
      // Safe to mark immutable for browsers: the UUID makes every key
      // single-use, so this URL can never come to mean something else. The
      // edge TTL is short — see PREVIEW_IMAGE_CACHE_CONTROL.
      cacheControl: PREVIEW_IMAGE_CACHE_CONTROL,
    },
  });

  return key;
}

/**
 * Remove a stored object and evict its URL from the edge cache; missing keys
 * are not an error.
 *
 * Order matters (FINDING-018): delete FIRST, then purge. Purging before a
 * delete that then fails would just let the edge re-fetch and re-cache the
 * still-existing object. If the delete throws, the object is still there, so
 * there is nothing to purge and the error propagates to the caller (who
 * already treats an R2 failure as "orphaned object, not a failed request").
 * The purge itself never throws.
 */
export async function deletePreviewImage(
  env: Env,
  key: string | null,
  logger?: PreviewImageLogger
): Promise<void> {
  if (!key) return;
  await env.THUMBNAILS.delete(key);
  await purgePreviewImageCache(env, key, logger);
}

/** The columns a mutating route needs to decide ownership, visibility and which object to touch. */
export interface PresetImageState {
  author_discord_id: string | null;
  preview_image_key: string | null;
  name: string;
  /** FINDING-016: needed for the same 404-for-the-unprivileged rule GET applies */
  status: string;
}

/**
 * Read the ownership, status, storage-key and name columns straight off the row.
 *
 * `getPresetById` returns a CommunityPreset, which carries only the gated
 * `preview_image_url` and deliberately never exposes `preview_image_key` — so
 * it cannot answer "which object do I replace or delete?". `name` rides
 * along here too so the upload route's moderator notification can title
 * itself without a second query.
 */
export async function getPresetImageState(
  db: D1Database,
  id: string
): Promise<PresetImageState | null> {
  const row = await db
    .prepare('SELECT author_discord_id, preview_image_key, name, status FROM presets WHERE id = ?')
    .bind(id)
    .first<PresetImageState>();
  return row ?? null;
}
