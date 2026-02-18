/**
 * Request ID Middleware
 *
 * Generates or preserves a unique request ID for each request.
 * This enables distributed tracing across service boundaries.
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types/env.js';

/**
 * Variables type for Hono context
 */
export type RequestIdVariables = {
  requestId: string;
};

/**
 * Request ID middleware function.
 */
export async function requestIdMiddleware(
  c: Context<{ Bindings: Env; Variables: RequestIdVariables }>,
  next: Next
): Promise<void | Response> {
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();

  c.set('requestId', requestId);

  await next();

  c.header('X-Request-ID', requestId);
}

/**
 * Helper to get request ID from context with fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRequestId(c: Context<any>): string {
  try {
    return c.get('requestId') || 'unknown';
  } catch {
    return 'unknown';
  }
}
