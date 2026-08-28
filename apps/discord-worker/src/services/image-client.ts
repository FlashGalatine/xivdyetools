/**
 * Image Worker client.
 *
 * Calls xivdyetools-image-worker over a service binding to decode an image and
 * return its raw RGBA pixels. photon lives there rather than here so this
 * Worker stays under Cloudflare's size limit — see
 * docs/operations/IMAGE_WORKER_SPLIT.md.
 *
 * @module services/image-client
 */

import type { Env } from '../types/env.js';

/** Pixel data returned by the image worker. */
export interface ExtractedImage {
  pixels: Uint8Array;
  width: number;
  height: number;
}

/**
 * Validate, fetch and decode an image, returning raw RGBA pixels.
 *
 * Server-side failures are rethrown with their message preserved verbatim,
 * because the caller substring-matches it ('SSRF', 'Discord CDN', 'too large',
 * 'format', 'timeout') to choose a localized user-facing message.
 *
 * @throws Error if the binding is absent or the image worker rejects the image
 */
export async function extractImagePixels(
  env: Env,
  url: string,
  options: { maxDimension?: number } = {}
): Promise<ExtractedImage> {
  if (!env.IMAGE_WORKER) {
    throw new Error('IMAGE_WORKER binding is not configured');
  }

  const payload: { url: string; maxDimension?: number } = { url };
  if (options.maxDimension !== undefined) {
    payload.maxDimension = options.maxDimension;
  }

  const response = await env.IMAGE_WORKER.fetch(
    new Request('https://image-worker/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );

  if (!response.ok) {
    let message = `Image processing failed: HTTP ${response.status}`;
    try {
      const body = await response.json<{ error?: string }>();
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message);
  }

  return {
    pixels: new Uint8Array(await response.arrayBuffer()),
    width: Number(response.headers.get('X-Image-Width') ?? 0),
    height: Number(response.headers.get('X-Image-Height') ?? 0),
  };
}
