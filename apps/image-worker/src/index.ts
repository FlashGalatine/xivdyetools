/**
 * XIV Dye Tools Image Worker
 *
 * Decodes, resizes and extracts raw RGBA pixels from images using
 * @cf-wasm/photon. Split out of discord-worker so the bot does not carry a
 * 1.5 MiB image library that only /extractor uses — see
 * docs/operations/IMAGE_WORKER_SPLIT.md.
 *
 * Reachable only via service binding; it has no public routes.
 *
 * @module index
 */

import { Hono } from 'hono';
import { requestIdMiddleware, loggerMiddleware } from '@xivdyetools/worker-kit';
import type { Env } from './types.js';
import {
  validateAndFetchImage,
  validateFileSize,
  readBodyWithCap,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
} from './validators.js';
import { processImageForExtraction, processImageForThumbnail } from './photon.js';

/** FINDING-004: `maxDimension` must be an integer in [16, MAX_IMAGE_DIMENSION]. */
const MIN_MAX_DIMENSION = 16;
function isValidMaxDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_MAX_DIMENSION &&
    value <= MAX_IMAGE_DIMENSION
  );
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', requestIdMiddleware());
app.use(
  '*',
  loggerMiddleware({
    serviceName: 'xivdyetools-image-worker',
    readEnvironmentFromEnv: false,
  })
);

app.get('/health', (c) => c.json({ status: 'ok' }));

/**
 * Decode an image and return its raw RGBA pixels.
 *
 * Internal only — reached via service binding from discord-worker.
 *
 * The error envelope is a hard contract: discord-worker's extractor
 * substring-matches `error` for 'SSRF', 'Discord CDN', 'too large', 'format'
 * and 'timeout' to choose a localized message. Never reword or generalise it.
 */
app.post('/extract', async (c) => {
  let body: { url?: string; maxDimension?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.url) {
    return c.json({ error: 'No image URL provided' }, 400);
  }

  // FINDING-004: reject a malformed maxDimension before any fetch/decode work
  if (body.maxDimension !== undefined && !isValidMaxDimension(body.maxDimension)) {
    return c.json(
      {
        error: `Invalid maxDimension: expected an integer between ${MIN_MAX_DIMENSION} and ${MAX_IMAGE_DIMENSION}`,
      },
      400
    );
  }

  try {
    const { buffer } = await validateAndFetchImage(body.url);
    const processed = await processImageForExtraction(
      buffer,
      body.maxDimension === undefined ? {} : { maxDimension: body.maxDimension }
    );

    return new Response(processed.pixels, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Image-Width': String(processed.width),
        'X-Image-Height': String(processed.height),
      },
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Image processing failed' },
      400
    );
  }
});

/**
 * Crop and encode an uploaded image into a card thumbnail.
 *
 * Internal only — reached via service binding from presets-api. Unlike
 * /extract this takes raw bytes rather than a URL: the caller already holds
 * the file, so there is nothing to fetch and no SSRF surface.
 */
app.post('/thumbnail', async (c) => {
  // FINDING-004: enforce the byte cap from Content-Length before buffering,
  // then while streaming — never hold an oversized body in memory.
  const declared = c.req.header('Content-Length');
  if (declared) {
    const size = parseInt(declared, 10);
    if (Number.isFinite(size) && size > MAX_FILE_SIZE_BYTES) {
      return c.json({ error: validateFileSize(size) ?? 'Image too large' }, 400);
    }
  }

  let buffer: Uint8Array;
  try {
    buffer = await readBodyWithCap(c.req.raw.body, MAX_FILE_SIZE_BYTES);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Image too large' }, 400);
  }

  if (buffer.byteLength === 0) {
    return c.json({ error: 'No image data provided' }, 400);
  }

  try {
    const webp = processImageForThumbnail(buffer);
    return new Response(webp, {
      status: 200,
      headers: { 'Content-Type': 'image/webp' },
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Image processing failed' },
      400
    );
  }
});

export default app;
