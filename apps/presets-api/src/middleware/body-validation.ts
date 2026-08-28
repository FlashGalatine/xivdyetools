/**
 * Request body validation middleware
 *
 * SEC-003: JSON depth limiting — prevents deeply nested payloads from
 *          causing excessive CPU consumption during parsing.
 * SEC-004: Request body size limits — rejects oversized payloads before parsing.
 */

import { bodyLimit } from 'hono/body-limit';
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types.js';
import { MAX_PREVIEW_IMAGE_BYTES } from '../services/preview-image-service.js';

/** Maximum request body size in bytes (100KB) */
const MAX_BODY_SIZE = 100 * 1024;

/** Maximum JSON nesting depth */
const MAX_JSON_DEPTH = 10;

/**
 * The preview-image upload is the only route on this Worker that carries a
 * binary body, and the only one that may exceed MAX_BODY_SIZE — an author's
 * screenshot runs to megabytes. Both guards in this module exist to protect
 * JSON endpoints, and both would reject a legitimate upload before the route
 * ever ran, which is precisely what happened: the feature was unreachable in
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

const enforceBodySizeLimit = bodyLimit({
  maxSize: MAX_BODY_SIZE,
  onError: (c) => {
    return c.json(
      {
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: `Request body exceeds maximum size of ${MAX_BODY_SIZE} bytes`,
      },
      413
    );
  },
});

/**
 * FINDING-004 / PAPI-3 (2026-08-21 security audit): the upload route used to
 * be exempt and then buffer the whole body with `arrayBuffer()` before
 * comparing against MAX_PREVIEW_IMAGE_BYTES — the 5 MB rule only applied
 * after up to ~100 MB had been held in memory. Hono's bodyLimit checks
 * Content-Length first and then the actual stream, so the cap binds while
 * bytes arrive. Same status + message as the route's own check, which stays
 * as a backstop, so the client contract is unchanged.
 */
const enforcePreviewImageLimit = bodyLimit({
  maxSize: MAX_PREVIEW_IMAGE_BYTES,
  onError: (c) => {
    return c.json(
      {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Image must be at most 5 MB',
      },
      400
    );
  },
});

/**
 * SEC-004: Body size limit middleware.
 * Rejects requests with bodies larger than MAX_BODY_SIZE.
 * Uses Hono's built-in bodyLimit which checks the actual stream, not just Content-Length.
 * The preview-image upload gets its own (5 MB) limit — see isPreviewImageUpload.
 */
export const bodySizeLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (isPreviewImageUpload(c.req.method, c.req.path)) {
    return enforcePreviewImageLimit(c, next);
  }
  return enforceBodySizeLimit(c, next);
};

/**
 * SEC-003: JSON depth validation middleware.
 * For mutation requests (POST/PATCH/PUT) with JSON content, validates that
 * the parsed JSON does not exceed the maximum nesting depth and does not
 * contain prototype pollution keys.
 */
export const jsonDepthLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const method = c.req.method;
  if (!['POST', 'PATCH', 'PUT'].includes(method)) {
    return next();
  }

  // Binary upload route: nothing here can apply to raw image bytes.
  if (isPreviewImageUpload(method, c.req.path)) {
    return next();
  }

  const contentType = c.req.header('content-type');
  if (!contentType?.includes('application/json')) {
    return next();
  }

  // Read the body text — Hono caches this, so downstream c.req.json() still works
  let text: string;
  try {
    text = await c.req.text();
  } catch {
    return next();
  }

  if (!text) {
    return next();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return c.json(
      { success: false, error: 'BAD_REQUEST', message: 'Invalid JSON syntax' },
      400
    );
  }

  const error = validateStructure(parsed, MAX_JSON_DEPTH, 0);
  if (error) {
    return c.json(
      { success: false, error: 'BAD_REQUEST', message: error },
      400
    );
  }

  await next();
};

/**
 * Recursively validate object structure for depth limits and prototype pollution.
 * Returns an error message if invalid, or null if valid.
 */
function validateStructure(obj: unknown, maxDepth: number, depth: number): string | null {
  if (depth > maxDepth) {
    return `JSON nesting exceeds maximum depth of ${maxDepth}`;
  }

  if (typeof obj !== 'object' || obj === null) {
    return null;
  }

  // Check for prototype pollution keys
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  for (const key of dangerousKeys) {
    if (Object.hasOwn(obj, key)) {
      return 'Invalid JSON structure';
    }
  }

  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const value of values) {
    const error = validateStructure(value, maxDepth, depth + 1);
    if (error) return error;
  }

  return null;
}
