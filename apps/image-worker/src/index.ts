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
import { validateAndFetchImage } from './validators.js';
import { processImageForExtraction } from './photon.js';

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

export default app;
