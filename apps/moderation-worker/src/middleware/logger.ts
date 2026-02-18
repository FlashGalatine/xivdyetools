/**
 * Request Logger Middleware
 *
 * Creates a per-request structured logger using @xivdyetools/logger.
 * The logger is request-scoped with correlation ID for distributed tracing.
 */

import type { Context, Next } from 'hono';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { createRequestLogger } from '@xivdyetools/logger/worker';
import type { Env } from '../types/env.js';
import { sanitizeUrl } from '../utils/url-sanitizer.js';

/**
 * Variables type for Hono context with logger
 */
export type LoggerVariables = {
  requestId: string;
  logger: ExtendedLogger;
};

/**
 * Request logger middleware function.
 */
export async function loggerMiddleware(
  c: Context<{ Bindings: Env; Variables: LoggerVariables }>,
  next: Next
): Promise<void | Response> {
  const requestId = c.get('requestId');

  const logger = createRequestLogger(
    {
      ENVIRONMENT: 'production',
      SERVICE_NAME: 'xivdyetools-moderation-worker',
    },
    requestId
  );

  c.set('logger', logger);

  const startTime = performance.now();
  const { method, path } = getRequestInfo(c);

  logger.info('Request started', {
    method,
    path,
  });

  await next();

  const duration = performance.now() - startTime;
  const status = c.res.status;

  logger.info('Request completed', {
    method,
    path,
    status,
    durationMs: Math.round(duration * 100) / 100,
  });
}

/**
 * Helper to get logger from context with fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLogger(c: Context<any>): ExtendedLogger | undefined {
  try {
    return c.get('logger');
  } catch {
    return undefined;
  }
}

/**
 * Extract request info for logging
 * Sanitizes URLs to prevent token exposure in logs
 */
function getRequestInfo(c: Context): { method: string; path: string } {
  const url = new URL(c.req.url);
  return {
    method: c.req.method,
    path: sanitizeUrl(url.pathname + url.search), // Sanitize path + query params
  };
}
