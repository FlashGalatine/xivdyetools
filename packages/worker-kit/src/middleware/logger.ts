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

import type { Context, Env, Input, MiddlewareHandler } from 'hono';
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
   * 2026-08-29 FINDING-010: defaults to `false` and should stay that way.
   * The User-Agent is per-client context that `apps/web-app/PRIVACY.md`
   * promises is "never collected" — every current consumer either omits
   * this option or sets it `false` explicitly (the three that opted in
   * dropped it in the 2026-08-29 audit's Sprints 1, 2 and 5). Opting back in
   * puts that promise's contents into whatever transport carries this log
   * line (`wrangler tail`, and Workers Logs wherever a consumer enables it).
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
 * import { loggerMiddleware } from '@xivdyetools/worker-kit';
 *
 * // Basic usage
 * app.use('*', loggerMiddleware({ serviceName: 'my-worker' }));
 *
 * // With all options
 * app.use('*', loggerMiddleware({
 *   serviceName: 'xivdyetools-presets-api',
 *   readApiVersionFromEnv: true,
 *   logUserAgent: false, // 2026-08-29 FINDING-010: keep false — see the option's JSDoc
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
    const requestId = c.get('requestId');

    // Build logger config from options + env
    // BUG-003 FIX: Use Record<string, unknown> instead of any
    const env = c.env as Record<string, unknown>;
    const environment = readEnvironmentFromEnv
      ? (typeof env?.ENVIRONMENT === 'string' ? env.ENVIRONMENT : '') || 'production'
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
// REFACTOR-003 + LINT-FIX (2026-04-29): Forwarding generics over Hono's
// `Context<E, P, I>` preserves the caller's exact context shape end-to-end
// instead of widening to a bare `Context`. This avoids
// @typescript-eslint/no-unsafe-argument on narrowly-typed callers (e.g.
// presets-api's `MiddlewareVariables & { auth: AuthContext }`) without
// resorting to `Context<any, any, any>`. Defaults use Hono's constraint
// types (Env / string / Input) so we don't introduce explicit `any` or
// `{}` for our defaults to trip on. The ContextVariableMap augmentation
// in types.ts resolves the 'logger' key independently of these generics.
export function getLogger<
  E extends Env = Env,
  P extends string = string,
  I extends Input = Input,
>(c: Context<E, P, I>): ExtendedLogger | undefined {
  try {
    return c.get('logger');
  } catch {
    return undefined;
  }
}
