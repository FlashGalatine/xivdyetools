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

/** Maximum request body size in bytes (100KB) */
const MAX_BODY_SIZE = 100 * 1024;

/** Maximum JSON nesting depth */
const MAX_JSON_DEPTH = 10;

/**
 * SEC-004: Body size limit middleware.
 * Rejects requests with bodies larger than MAX_BODY_SIZE.
 * Uses Hono's built-in bodyLimit which checks the actual stream, not just Content-Length.
 */
export const bodySizeLimit = bodyLimit({
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
