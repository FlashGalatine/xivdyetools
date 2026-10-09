/**
 * Request body validation middleware
 *
 * SEC-003: JSON depth limiting — prevents deeply nested payloads from
 *          causing excessive CPU consumption during parsing.
 * SEC-004: Request body size limits — rejects oversized payloads before parsing.
 *
 * REFACTOR-009 (docs/audits/2026-09-16-deep-dive): both guards now come from
 * `@xivdyetools/worker-kit/body-guards` — this app previously carried its own
 * near-copy of the same size cap + JSON depth / prototype-pollution check
 * that `apps/presets-api` also had. This file now only supplies this app's
 * cap and error bodies; `bodyGuards()` owns the mechanism.
 */

import { bodyGuards } from '@xivdyetools/worker-kit/body-guards';
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types.js';

/** Maximum request body size in bytes (10KB — OAuth payloads are small) */
const MAX_BODY_SIZE = 10 * 1024;

export const { bodySizeLimit, jsonDepthLimit } = bodyGuards<{ Bindings: Env }>({
  maxSize: MAX_BODY_SIZE,
  // SEC-004: Rejects requests with bodies larger than MAX_BODY_SIZE. Uses
  // Hono's built-in bodyLimit, which checks the actual stream, not just
  // Content-Length.
  onTooLarge: (c) =>
    c.json(
      {
        error: 'Payload too large',
        message: `Request body exceeds maximum size of ${MAX_BODY_SIZE} bytes`,
      },
      413
    ),
  // SEC-003: For mutation requests (POST/PATCH/PUT) with JSON content,
  // rejects a body that fails to parse, exceeds the depth budget, or
  // contains a prototype-pollution key.
  onInvalidJson: (c, message) =>
    c.json({ success: false, error: 'Invalid request body', message }, 400),
  // maxDepth omitted — the factory's default of 10 matches MAX_JSON_DEPTH.
});

/** The two POST routes that parse a JSON body. */
const JSON_BODY_PATHS = new Set(['/auth/callback', '/auth/xivauth/callback']);

/**
 * BUG-149 (oauth half): both callbacks call `c.req.json()` whatever the
 * Content-Type, but the depth / prototype-pollution guard above only inspects
 * JSON-typed bodies, so a `text/plain` body skipped it. A POST to either
 * callback with a non-empty body must say it is JSON (media type compared
 * case-insensitively, parameters ignored). The only client, the web app's
 * auth service, always sends `application/json`. An empty body passes through
 * to the handler's own 400.
 */
export const requireJsonContentType: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.req.method === 'POST' && JSON_BODY_PATHS.has(c.req.path)) {
    // The stream, not the header, is the signal: a `Content-Length: 0` header
    // must not hide a body that is actually present.
    const hasBody = c.req.raw.body !== null;
    const mediaType = (c.req.header('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (hasBody && mediaType !== 'application/json') {
      return c.json(
        {
          success: false,
          error: 'Unsupported Media Type',
          message: 'Content-Type must be application/json',
        },
        415
      );
    }
  }
  return next();
};
