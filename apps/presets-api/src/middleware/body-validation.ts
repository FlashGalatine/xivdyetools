/**
 * Request body validation middleware
 *
 * SEC-003: JSON depth limiting — prevents deeply nested payloads from
 *          causing excessive CPU consumption during parsing.
 * SEC-004: Request body size limits — rejects oversized payloads before parsing.
 *
 * REFACTOR-009 (docs/audits/2026-09-16-deep-dive): the two guards themselves
 * are `@xivdyetools/worker-kit`'s `bodyGuards()` factory — this module now
 * only supplies this Worker's parameters (size cap, error envelopes, the
 * preview-image exemption) and keeps the local names everything else imports.
 */

import { bodyGuards } from '@xivdyetools/worker-kit/body-guards';
import type { Env } from '../types.js';
import { MAX_PREVIEW_IMAGE_BYTES } from '../services/preview-image-service.js';

/** Maximum request body size in bytes (100KB) */
const MAX_BODY_SIZE = 100 * 1024;

/** Maximum JSON nesting depth */
const MAX_JSON_DEPTH = 10;

/**
 * The preview-image upload is the only route on this Worker that carries a
 * binary body, and the only one that may exceed MAX_BODY_SIZE — an author's
 * screenshot runs to megabytes. Both guards below exist to protect JSON
 * endpoints, and both would reject a legitimate upload before the route ever
 * ran, which is precisely what happened: the feature was unreachable in
 * production while its own tests passed, because they mounted the router
 * without this middleware.
 *
 * The exemption is deliberately scoped to this one method+path so no other
 * endpoint inherits the right to a large or non-JSON body. The route enforces
 * the real limits itself: 5 MB (MAX_PREVIEW_IMAGE_BYTES) plus a magic-byte
 * sniff that ignores the declared Content-Type entirely.
 */
const PREVIEW_IMAGE_PATH = /^\/api\/v1\/presets\/[^/]+\/preview-image\/?$/;

/** Image media types the upload route accepts (mirrors sniffImageType). */
export const PREVIEW_IMAGE_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** True for the one request shape that is allowed a large, non-JSON body. */
export function isPreviewImageUpload(method: string, path: string): boolean {
  return method === 'POST' && PREVIEW_IMAGE_PATH.test(path);
}

/**
 * SEC-003 / SEC-004: this Worker's two body guards.
 *
 * `bodySizeLimit` rejects requests with bodies larger than MAX_BODY_SIZE
 * (Content-Length first, then the actual stream — FINDING-004 / PAPI-3,
 * 2026-08-21 security audit: the upload route used to buffer the whole body
 * with `arrayBuffer()` before comparing against MAX_PREVIEW_IMAGE_BYTES, so
 * the 5 MB rule only applied after up to ~100 MB had already been held in
 * memory). `jsonDepthLimit` validates JSON structure on mutation requests.
 * The preview-image upload gets its own (5 MB) cap and skips the JSON check
 * entirely — see isPreviewImageUpload.
 */
export const { bodySizeLimit, jsonDepthLimit } = bodyGuards<{ Bindings: Env }>({
  maxSize: MAX_BODY_SIZE,
  maxDepth: MAX_JSON_DEPTH,
  onTooLarge: (c) =>
    c.json(
      {
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: `Request body exceeds maximum size of ${MAX_BODY_SIZE} bytes`,
      },
      413
    ),
  onInvalidJson: (c, message) =>
    c.json({ success: false, error: 'BAD_REQUEST', message }, 400),
  exempt: {
    match: (c) => isPreviewImageUpload(c.req.method, c.req.path),
    maxSize: MAX_PREVIEW_IMAGE_BYTES,
    onTooLarge: (c) =>
      c.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Image must be at most 5 MB',
        },
        400
      ),
  },
});
