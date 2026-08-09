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

export default app;
