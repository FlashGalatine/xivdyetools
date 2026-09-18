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
