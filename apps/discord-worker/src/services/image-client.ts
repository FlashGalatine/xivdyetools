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
 * Upper bound on one image-worker round trip (its own CDN fetch is capped at
 * 10 s inside the worker). Without it a stalled binding call would hold the
 * command's analytics trace until the runtime ended the isolate.
 */
export const IMAGE_WORKER_TIMEOUT_MS = 10_000;

/**
 * Validate, fetch and decode an image, returning raw RGBA pixels.
 *
 * Server-side failures are rethrown with their message preserved verbatim,
 * because two callers substring-match it — the extractor to choose the
 * localized user-facing message, the command trace to classify the failure as
 * `image_input`. The one table of markers is `services/image-input-errors.ts`.
 *
 * @throws Error if the binding is absent, the image worker rejects the image,
 *   or the call exceeds {@link IMAGE_WORKER_TIMEOUT_MS} (a `TimeoutError`)
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
      signal: AbortSignal.timeout(IMAGE_WORKER_TIMEOUT_MS),
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
