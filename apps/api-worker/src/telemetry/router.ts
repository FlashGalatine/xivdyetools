/**
 * `POST /v1/telemetry` — opt-in web-app usage telemetry into Analytics Engine.
 *
 * The browser beacons a small JSON batch as `text/plain` (a CORS-safelisted
 * type, so `sendBeacon` needs no preflight); the body is read with the byte
 * budget and parsed regardless of the declared Content-Type. Every event is
 * validated by `schema.ts` — unknown or malformed events are dropped, the
 * batch is never rejected for them — and each survivor becomes one
 * `writeDataPoint` in `waitUntil`, so the response never waits on AE.
 *
 * Deliberately NOT part of the public API: undocumented on
 * developers.xivdyetools.app, no envelope, no body on success. Mounted under
 * `/v1` so the per-IP rate limiter applies (65 / 60 s is far above one
 * beacon every 15 s).
 *
 * Privacy: nothing from the request other than the validated batch reaches a
 * datapoint — no IP, no User-Agent, no request id.
 */

import { Hono } from 'hono';
import { getLogger } from '@xivdyetools/worker-kit';
import type { Env, Variables } from '../types.js';
import { ApiError, ErrorCode } from '../lib/api-error.js';
import { BodyTooLargeError, readBoundedText } from '../lib/bounded-body.js';
import { MAX_BODY_BYTES, parseTelemetryBatch, type TelemetryDataPoint } from './schema.js';

const telemetryRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// eslint-disable-next-line @typescript-eslint/require-await -- writeDataPoint is synchronous; async so the call site can waitUntil it
async function writePoints(
  analytics: AnalyticsEngineDataset,
  points: TelemetryDataPoint[],
  log: ReturnType<typeof getLogger> | undefined,
): Promise<void> {
  for (const point of points) {
    try {
      analytics.writeDataPoint(point);
    } catch (error) {
      // Telemetry must never surface as an error to the client or the logs' error stream.
      log?.debug('telemetry write failed', { operation: 'telemetry', error: String(error) });
    }
  }
}

telemetryRouter.post('/', async (c) => {
  let text: string;
  try {
    text = await readBoundedText(c.req.raw.body, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      throw new ApiError(ErrorCode.INVALID_BODY, `Body exceeds ${MAX_BODY_BYTES} bytes`, 413);
    }
    throw error;
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(ErrorCode.INVALID_BODY, 'Body must be JSON', 400);
  }

  const parsed = parseTelemetryBatch(json);
  if (!parsed) {
    throw new ApiError(ErrorCode.INVALID_BODY, 'Body must be a v1 telemetry batch', 400);
  }

  const log = getLogger(c);
  if (parsed.dropped > 0) {
    log?.debug('telemetry events dropped', { operation: 'telemetry', dropped: parsed.dropped });
  }

  const analytics = c.env.ANALYTICS;
  if (analytics && parsed.points.length > 0) {
    c.executionCtx.waitUntil(writePoints(analytics, parsed.points, log));
  }

  return c.body(null, 204);
});

export { telemetryRouter };
