/**
 * Who may write into the telemetry dataset, and under which `env`.
 *
 * FINDING-014 (2026-08-29 security audit): `POST /v1/telemetry` accepted a
 * batch from anyone, so any third-party page could `sendBeacon` allowlisted
 * events from its visitors' browsers and skew the four product metrics; and
 * the `env` dimension (`blob9`) was whatever the body claimed, so beta traffic
 * could label itself `production` (beta.xivdyetools.app shares the production
 * worker — there is no beta env — and the blob is the only separator).
 *
 * The web app is the only legitimate sender and a browser always attaches
 * `Origin` to its cross-origin `sendBeacon`/`fetch` POSTs, so one header both
 * gates the write and *is* the environment dimension. A non-browser client can
 * still forge the header; the gate raises the bar from "any web page's
 * visitors" to "a direct HTTP client", which is the scope the finding claims.
 *
 * Nothing here is logged — see the router: the Origin value never reaches a
 * log line.
 */

import type { TelemetryEnv } from './schema.js';

/** The only origins whose beacons are written, and the environment each one means. */
const TELEMETRY_ORIGINS = new Map<string, TelemetryEnv>([
  ['https://xivdyetools.app', 'production'],
  ['https://beta.xivdyetools.app', 'beta'],
]);

/**
 * `wrangler dev` (8790) behind `vite dev` (5173). A serialized Origin is
 * scheme + host + optional port with no path or trailing slash, so anchoring
 * both ends is enough to reject `http://localhost.evil.example`.
 */
const LOOPBACK_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

/**
 * `accepted: false` → the router answers 204 and writes nothing.
 * `env: undefined` means "no server-derived environment" (the loopback case),
 * and only then does the validated body field still decide `blob9`.
 */
export type TelemetryOriginDecision =
  | { accepted: true; env: TelemetryEnv | undefined }
  | { accepted: false };

/**
 * Decide a batch's fate from its `Origin` header.
 *
 * @param origin - The request's `Origin` header, or `null` when absent.
 * @param environment - `c.env.ENVIRONMENT`; the loopback exception exists only
 *   off production, so a forged `Origin: http://localhost` cannot write to the
 *   production dataset.
 */
export function resolveTelemetryOrigin(
  origin: string | null,
  environment: string | undefined,
): TelemetryOriginDecision {
  if (!origin) return { accepted: false };

  // Exact match, never a prefix/suffix test: `https://xivdyetools.app.evil.example`
  // and `https://xivdyetools.app:8443` are different origins.
  const env = TELEMETRY_ORIGINS.get(origin);
  if (env) return { accepted: true, env };

  if (environment !== 'production' && LOOPBACK_ORIGIN.test(origin)) {
    return { accepted: true, env: undefined };
  }

  return { accepted: false };
}
