/**
 * Request Logger Middleware
 *
 * Creates a per-request structured logger using @xivdyetools/logger.
 * The logger is request-scoped with correlation ID for distributed tracing.
 *
 * This middleware should be used after requestIdMiddleware to ensure
 * the request ID is available.
 *
 * REFACTOR-001: Extracted from 4 worker-local implementations into shared package.
 *
 * @module logger
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { createRequestLogger } from '@xivdyetools/logger/worker';

/**
 * Options for the logger middleware factory.
 */
export interface LoggerMiddlewareOptions {
  /**
   * Service name for log aggregation.
   * Appears in every log entry as the `service` field.
   */
  serviceName: string;

  /**
   * Read ENVIRONMENT from `c.env.ENVIRONMENT` at request time.
   * When false, defaults to `'production'` for log level purposes.
   *
   * @default true
   */
  readEnvironmentFromEnv?: boolean;

  /**
   * Read API_VERSION from `c.env.API_VERSION` at request time.
   *
   * @default false
   */
  readApiVersionFromEnv?: boolean;

  /**
   * Log the User-Agent header in the "Request started" log entry.
   *
   * @default false
   */
  logUserAgent?: boolean;

  /**
   * Optional function to sanitize the URL path before logging.
   * Useful for redacting tokens or sensitive query parameters.
   *
   * @example
   * ```typescript
   * import { sanitizeUrl } from './utils/url-sanitizer.js';
   *
   * loggerMiddleware({
   *   serviceName: 'my-worker',
   *   sanitizePath: sanitizeUrl,
   * })
   * ```
   */
  sanitizePath?: (path: string) => string;
}

/**
 * Extract request info for logging.
 */
function getRequestInfo(
  c: Context,
  sanitizePath?: (path: string) => string,
): { method: string; path: string } {
  const url = new URL(c.req.url);
  const rawPath = sanitizePath
    ? sanitizePath(url.pathname + url.search)
    : url.pathname;
  return {
    method: c.req.method,
    path: rawPath,
  };
}

/**
 * Factory that returns a Hono middleware for structured request logging.
 *
 * @example
 * ```typescript
 * import { loggerMiddleware } from '@xivdyetools/worker-middleware';
 *
 * // Basic usage
 * app.use('*', loggerMiddleware({ serviceName: 'my-worker' }));
 *
 * // With all options
 * app.use('*', loggerMiddleware({
 *   serviceName: 'xivdyetools-presets-api',
 *   readApiVersionFromEnv: true,
 *   logUserAgent: true,
 *   sanitizePath: (path) => path.replace(/token=[^&]+/, 'token=***'),
 * }));
 * ```
 */
export function loggerMiddleware(options: LoggerMiddlewareOptions): MiddlewareHandler {
  const {
    serviceName,
    readEnvironmentFromEnv = true,
    readApiVersionFromEnv = false,
    logUserAgent = false,
    sanitizePath,
  } = options;

  return async (c, next) => {
    const requestId = c.get('requestId') as string;

    // Build logger config from options + env
    // BUG-003 FIX: Use Record<string, unknown> instead of any
    const env = c.env as Record<string, unknown>;
    const environment = readEnvironmentFromEnv
      ? (String(env?.ENVIRONMENT ?? '') || 'production')
      : 'production';
    const apiVersion = readApiVersionFromEnv
      ? (typeof env?.API_VERSION === 'string' ? env.API_VERSION : undefined)
      : undefined;

    const logger = createRequestLogger(
      {
        ENVIRONMENT: environment,
        ...(apiVersion ? { API_VERSION: apiVersion } : {}),
        SERVICE_NAME: serviceName,
      },
      requestId,
    );

    c.set('logger', logger);

    // Log request start
    const startTime = performance.now();
    const { method, path } = getRequestInfo(c, sanitizePath);

    const startContext: Record<string, unknown> = { method, path };
    if (logUserAgent) {
      startContext.userAgent = c.req.header('user-agent');
    }
    logger.info('Request started', startContext);

    await next();

    // Log request completion
    const duration = performance.now() - startTime;
    const status = c.res.status;

    logger.info('Request completed', {
      method,
      path,
      status,
      durationMs: Math.round(duration * 100) / 100,
    });
  };
}

/**
 * Safe helper to get logger from context with fallback.
 * Useful in error handlers where the middleware may not have run.
 *
 * @example
 * ```typescript
 * app.onError((err, c) => {
 *   const logger = getLogger(c);
 *   logger?.error('Unhandled error', err);
 *   return c.json({ error: 'Internal error' }, 500);
 * });
 * ```
 */
// BUG-003 FIX: ContextVariableMap augmentation (in types.ts) makes this type-safe
// without needing Context<any>. 'logger' key is globally registered.
export function getLogger(c: Context): ExtendedLogger | undefined {
  try {
    return c.get('logger') as ExtendedLogger | undefined;
  } catch {
    return undefined;
  }
}
