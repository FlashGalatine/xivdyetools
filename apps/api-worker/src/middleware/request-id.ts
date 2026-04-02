/**
 * Request ID Middleware
 *
 * Generates or preserves a unique request ID for distributed tracing.
 * Validates format to prevent log injection attacks.
 */

import type { Context, Next } from 'hono';
import type { Env, Variables } from '../types.js';

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function requestIdMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
): Promise<void | Response> {
  const headerRequestId = c.req.header('X-Request-ID');
  const requestId = headerRequestId && UUID_PATTERN.test(headerRequestId)
    ? headerRequestId
    : crypto.randomUUID();

  c.set('requestId', requestId);

  await next();

  c.header('X-Request-ID', requestId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRequestId(c: Context<any>): string {
  try {
    return (c.get('requestId') as string | undefined) || 'unknown';
  } catch {
    return 'unknown';
  }
}
