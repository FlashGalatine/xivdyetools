/**
 * Preview image storage: sniff, hand to image-worker, put in R2.
 *
 * The author uploads a picture for their preset's card. This module owns the
 * bytes; the moderation gate lives in preset-service's rowToPreset.
 *
 * @module services/preview-image-service
 */

import type { Env } from '../types.js';

/** Cloudflare's cap for this route; also bounds what image-worker decodes. */
export const MAX_PREVIEW_IMAGE_BYTES = 5 * 1024 * 1024;

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
      // Safe to mark immutable: the UUID makes every key single-use, so this
      // URL can never come to mean something else.
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  return key;
}

/** Remove a stored object; missing keys are not an error. */
export async function deletePreviewImage(env: Env, key: string | null): Promise<void> {
  if (!key) return;
  await env.THUMBNAILS.delete(key);
}

/**
 * Read the ownership and storage-key columns straight off the row.
 *
 * `getPresetById` returns a CommunityPreset, which carries only the gated
 * `preview_image_url` and deliberately never exposes `preview_image_key` — so
 * it cannot answer "which object do I replace or delete?".
 */
export async function getPresetImageState(
  db: D1Database,
  id: string
): Promise<{ author_discord_id: string | null; preview_image_key: string | null } | null> {
  const row = await db
    .prepare('SELECT author_discord_id, preview_image_key FROM presets WHERE id = ?')
    .bind(id)
    .first<{ author_discord_id: string | null; preview_image_key: string | null }>();
  return row ?? null;
}
