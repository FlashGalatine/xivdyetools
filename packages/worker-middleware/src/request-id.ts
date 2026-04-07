/**
 * Request ID Middleware
 *
 * Generates or preserves a unique request ID for each request.
 * This enables distributed tracing across service boundaries.
 *
 * - Preserves incoming X-Request-ID header if present
 * - Optionally validates format to prevent log injection attacks
 * - Generates a new UUID v4 if not present or invalid
 * - Stores in Hono context for use in logging
 * - Adds to response headers for client visibility
 *
 * REFACTOR-001: Extracted from 5 worker-local implementations into shared package.
 *
 * @module request-id
 */

import type { Context, MiddlewareHandler } from 'hono';

/**
 * UUID v4 regex pattern for validating request IDs.
 * SECURITY: Prevents log injection by rejecting malformed request IDs.
 */
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/**
 * Options for request ID middleware.
 */
export interface RequestIdOptions {
  /**
   * Validate incoming X-Request-ID against UUID format.
   * When true, malformed request IDs are rejected and a new UUID is generated.
   * Recommended for public-facing APIs to prevent log injection.
   *
   * @default true
   */
  validateFormat?: boolean;
}

/**
 * Factory that returns a Hono middleware for request ID management.
 *
 * @example
 * ```typescript
 * import { requestIdMiddleware } from '@xivdyetools/worker-middleware';
 *
 * // Default: validates UUID format (recommended)
 * app.use('*', requestIdMiddleware());
 *
 * // Opt out of validation (trusts upstream headers)
 * app.use('*', requestIdMiddleware({ validateFormat: false }));
 * ```
 */
export function requestIdMiddleware(options?: RequestIdOptions): MiddlewareHandler {
  const validateFormat = options?.validateFormat ?? true;

  return async (c, next) => {
    const headerRequestId = c.req.header('X-Request-ID');

    let requestId: string;
    if (headerRequestId) {
      if (validateFormat) {
        requestId = UUID_PATTERN.test(headerRequestId) ? headerRequestId : crypto.randomUUID();
      } else {
        requestId = headerRequestId;
      }
    } else {
      requestId = crypto.randomUUID();
    }

    c.set('requestId', requestId);

    await next();

    c.header('X-Request-ID', requestId);
  };
}

/**
 * Safe helper to get request ID from context with fallback.
 * Useful in error handlers where the middleware may not have run.
 *
 * @example
 * ```typescript
 * app.onError((err, c) => {
 *   const requestId = getRequestId(c);
 *   console.error(`[${requestId}] Error:`, err);
 *   return c.json({ error: 'Internal error', requestId }, 500);
 * });
 * ```
 */
// BUG-003 FIX: ContextVariableMap augmentation (in types.ts) makes this type-safe
// without needing Context<any>. 'requestId' key is globally registered.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRequestId(c: Context<any, any, any>): string {
  try {
    return (c.get('requestId') as string | undefined) || 'unknown';
  } catch {
    return 'unknown';
  }
}
