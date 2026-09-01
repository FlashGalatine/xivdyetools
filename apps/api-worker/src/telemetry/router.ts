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
 * developers.xivdyetools.app, no envelope, no body on success. Rate-limited
 * per IP on its own bucket (`TELEMETRY_RATE_LIMITER`, 240 / 60 s — see
 * middleware/rate-limit.ts): the API bucket keys per IP too, and many opted-in
 * tabs behind one NAT address must never 429 the user-facing `/v1/chara/*`
 * calls sharing that address.
 *
 * Two headers decide the batch's fate before a byte of the body is read
 * (FINDING-014): `Sec-GPC: 1` drops it outright, and only the web app's own
 * origins are written — the accepted origin also *is* the `env` dimension, so
 * beta traffic can no longer label itself production. See origin.ts.
 *
 * Privacy: nothing from the request other than the validated batch reaches a
 * datapoint — no IP, no User-Agent, no request id — and no log line ever
 * carries the Origin value.
 */

import { Hono } from 'hono';
import { getLogger } from '@xivdyetools/worker-kit';
import type { Env, Variables } from '../types.js';
import { ApiError, ErrorCode } from '../lib/api-error.js';
import { BodyTooLargeError, readBoundedText } from '../lib/bounded-body.js';
import { resolveTelemetryOrigin } from './origin.js';
import { MAX_BODY_BYTES, parseTelemetryBatch, type TelemetryDataPoint } from './schema.js';

const telemetryRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

function writePoints(
  analytics: AnalyticsEngineDataset,
  points: TelemetryDataPoint[],
  log: ReturnType<typeof getLogger> | undefined,
): void {
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
  // Global Privacy Control first, and unconditionally: the privacy page
  // promises analytics never run when the browser sends it, so a GPC beacon
  // leaves no trace at all — no datapoint, and no log line of its own.
  if (c.req.header('sec-gpc')?.trim() === '1') {
    return c.body(null, 204);
  }

  const log = getLogger(c);

  // FINDING-014: gate on the sender before touching the body — an unaccepted
  // beacon costs one header read, never a 16 KB read and a JSON parse.
  const origin = resolveTelemetryOrigin(c.req.header('origin') ?? null, c.env.ENVIRONMENT);
  if (!origin.accepted) {
    // 204 and drop, not 403: the client is `sendBeacon` and cannot read the
    // response, so a 4xx would only tell a scripted sender that a gate exists
    // — and the documented contract is "204 once parsed". The Origin value is
    // deliberately not logged.
    log?.debug('telemetry batch dropped', { operation: 'telemetry', reason: 'origin' });
    return c.body(null, 204);
  }

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

  // `origin.env` is undefined only for a loopback beacon on a non-production
  // worker; there the validated body field still decides blob9.
  const parsed = parseTelemetryBatch(json, { env: origin.env });
  if (!parsed) {
    throw new ApiError(ErrorCode.INVALID_BODY, 'Body must be a v1 telemetry batch', 400);
  }

  if (parsed.dropped > 0) {
    log?.debug('telemetry events dropped', { operation: 'telemetry', dropped: parsed.dropped });
  }

  const analytics = c.env.ANALYTICS;
  if (analytics && parsed.points.length > 0) {
    c.executionCtx.waitUntil(
      Promise.resolve().then(() => writePoints(analytics, parsed.points, log)),
    );
  }

  return c.body(null, 204);
});

export { telemetryRouter };
