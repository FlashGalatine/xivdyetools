/**
 * Request ID Middleware
 *
 * Generates or preserves a unique request ID for each request.
 * This enables distributed tracing across service boundaries.
 *
 * - Preserves incoming X-Request-ID header if present (from discord-worker)
 * - Validates format to prevent log injection attacks
 * - Generates a new UUID v4 if not present or invalid
 * - Stores in Hono context for use in logging
 * - Adds to response headers for client visibility
 */

import type { Context, Next } from 'hono';
import type { Env, AuthContext } from '../types.js';

/**
 * UUID v4 regex pattern for validating request IDs
 * SECURITY: Prevents log injection by rejecting malformed request IDs
 */
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/**
 * Validate that a request ID matches expected UUID format
 */
function isValidRequestId(id: string): boolean {
  return UUID_PATTERN.test(id);
}

/**
 * Variables type for Hono context
 */
export type RequestIdVariables = {
  requestId: string;
  auth: AuthContext;
};

/**
 * Request ID middleware function.
 * Add this early in the middleware chain (after logger, before business logic).
 */
export async function requestIdMiddleware(
  c: Context<{ Bindings: Env; Variables: RequestIdVariables }>,
  next: Next
): Promise<void | Response> {
  // Get existing request ID from header
  // Discord-worker will pass X-Request-ID when calling this API
  const headerRequestId = c.req.header('X-Request-ID');

  // SECURITY: Validate format to prevent log injection attacks
  // Only accept properly formatted UUIDs
  const requestId = headerRequestId && isValidRequestId(headerRequestId)
    ? headerRequestId
    : crypto.randomUUID();

  // Store in context for use in handlers and error logging
  c.set('requestId', requestId);

  await next();

  // Add to response headers so clients can see it
  c.header('X-Request-ID', requestId);
}

/**
 * Helper to get request ID from context with fallback.
 * Useful in error handlers where the middleware may not have run.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRequestId(c: Context<any>): string {
  try {
    return c.get('requestId') || 'unknown';
  } catch {
    return 'unknown';
  }
}
