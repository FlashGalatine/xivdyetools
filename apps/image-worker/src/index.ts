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

/**
 * FINDING-023 (2026-08-29 security audit): this Worker has no legitimate
 * public route. Both callers reach it purely through a Service Binding —
 * discord-worker's image-client.ts:54 and presets-api's
 * preview-image-service.ts:152 each construct
 * `new Request('https://image-worker/<path>', …)`, a URL that is never
 * resolved over DNS, so a service-binding call always arrives here with
 * hostname literally `image-worker`. The only way a *different* hostname
 * ever reaches this handler is a genuine public request — reachable only if
 * `workers_dev` is ever flipped back to true by mistake, since neither
 * environment declares any routes (wrangler.toml, pinned by
 * src/wrangler-config.test.ts). That request would carry the account's
 * `*.workers.dev` hostname. Refuse it here, before any body read, fetch, or
 * decode — for every route, /health included, so a scanner gets the same
 * answer whichever path it tries.
 *
 * Placed after requestId/logger rather than before: neither of those two
 * middlewares reads the body, fetches, or decodes anything, so ordering
 * after them still satisfies "before any body read/fetch/decode". Fix
 * round 2 (S8-R13): this comment previously claimed the ordering makes a
 * config-drift hit "visible in the structured request log" — optimistic.
 * No `wrangler.toml` in this repo declares an `[observability]` block, and
 * the 2026-08-29 security audit found Workers Logs off on all nine
 * scripts, so by default nothing persists that log line anywhere. Ordering
 * after requestId/logger means a hit is visible during a live
 * `wrangler tail` session, not after the fact — still worth the free
 * ordering, just not the retroactive visibility this used to claim.
 *
 * 404, not 403: this Worker's whole premise is "no public surface exists
 * here" (see CLAUDE.md / README.md). A flipped deployment should still
 * look exactly like the routeless worker it is supposed to be, rather than
 * confirm to a scanner that something is being deliberately gatekept —
 * `c.notFound()` is Hono's own unmatched-route response, so a refused
 * request is byte-for-byte indistinguishable from one that hit an
 * undefined path. The hostname itself is never echoed back.
 *
 * This is defence in depth, not the primary control. The primary control
 * is that there is no public surface to reach at all: workers_dev = false
 * and no routes, in both environments.
 *
 * Fix round 1 (S8-R8): a hostname is allowed one trailing dot (RFC 1035's
 * absolute-FQDN form — `acct.workers.dev.` and `acct.workers.dev` name the
 * same host), and `URL` preserves it in `.hostname` rather than
 * normalising it away, so `acct.workers.dev.` used to slip past
 * `endsWith('.workers.dev')` and reach the real handler. Strip at most one
 * trailing dot before the suffix check closes that gap without weakening
 * it: `image-worker` (no trailing dot; both real callers' literal host)
 * is untouched by the strip, so it is exactly as unaffected as before.
 */
app.use('*', async (c, next) => {
  const { hostname } = new URL(c.req.url);
  const normalizedHostname = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
  if (normalizedHostname.endsWith('.workers.dev')) {
    return c.notFound();
  }
  await next();
});

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
