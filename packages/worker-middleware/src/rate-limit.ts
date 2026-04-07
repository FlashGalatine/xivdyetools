/**
 * Rate Limit Middleware Factory
 *
 * REFACTOR-002: Extracted shared rate limiting middleware pattern
 * from duplicated implementations across workers.
 *
 * Provides consistent:
 * - X-RateLimit-* response headers (via shared package)
 * - Retry-After calculation
 * - Fail-open error handling with structured logging
 * - 429 response format
 *
 * @module rate-limit
 */

import type { Context, MiddlewareHandler } from 'hono';
import type {
  RateLimiter,
  RateLimitConfig,
  RateLimitResult,
} from '@xivdyetools/rate-limiter';
import { getRateLimitHeaders } from '@xivdyetools/rate-limiter';

/**
 * Options for the rate limit middleware factory.
 *
 * Workers configure their specific backends and key strategies
 * while sharing the common middleware boilerplate.
 */
export interface RateLimitMiddlewareOptions {
  /**
   * Rate limiter backend instance, or a factory that creates one
   * from the Hono context (for lazy initialization when the backend
   * needs request-time bindings like KV namespaces).
   */
  backend: RateLimiter | ((c: Context) => RateLimiter);

  /**
   * Extract the rate limit key from the Hono context.
   *
   * Common patterns:
   * - IP-based: `(c) => getClientIp(c.req.raw)`
   * - User-based: `(c) => c.get('userId')`
   * - Compound: `(c) => \`${getClientIp(c.req.raw)}:${c.req.path}\``
   */
  keyExtractor: (c: Context) => string;

  /**
   * Rate limit configuration (max requests, window, burst).
   * Can also be a function for dynamic per-request config.
   */
  config: RateLimitConfig | ((c: Context) => RateLimitConfig);

  /**
   * Behavior when the rate limiter backend errors.
   * - `'fail-open'` (default): Allow the request through
   * - `'fail-closed'`: Return 429
   */
  onError?: 'fail-open' | 'fail-closed';

  /**
   * Custom 429 response body factory.
   * If not provided, a standard JSON error response is returned.
   */
  formatError?: (c: Context, retryAfter: number) => Response;
}

/**
 * Create a rate limiting middleware for Hono.
 *
 * @param options - Rate limit middleware configuration
 * @returns Hono middleware handler
 *
 * @example IP-based rate limiting (presets-api style)
 * ```typescript
 * import { rateLimitMiddleware } from '@xivdyetools/worker-middleware';
 * import { MemoryRateLimiter, getClientIp, PUBLIC_API_LIMITS } from '@xivdyetools/rate-limiter';
 *
 * const limiter = new MemoryRateLimiter();
 *
 * app.use('/api/*', rateLimitMiddleware({
 *   backend: limiter,
 *   keyExtractor: (c) => getClientIp(c.req.raw),
 *   config: PUBLIC_API_LIMITS.default,
 * }));
 * ```
 *
 * @example KV-backed rate limiting (api-worker style)
 * ```typescript
 * import { rateLimitMiddleware } from '@xivdyetools/worker-middleware';
 * import { KVRateLimiter, getClientIp } from '@xivdyetools/rate-limiter';
 *
 * app.use('*', rateLimitMiddleware({
 *   backend: new KVRateLimiter({ kv: env.RATE_LIMIT, keyPrefix: 'api:ip:' }),
 *   keyExtractor: (c) => getClientIp(c.req.raw),
 *   config: { maxRequests: 60, windowMs: 60_000, burstAllowance: 5, failOpen: true },
 * }));
 * ```
 */
export function rateLimitMiddleware(
  options: RateLimitMiddlewareOptions,
): MiddlewareHandler {
  const { keyExtractor, onError = 'fail-open', formatError } = options;

  return async (c, next): Promise<Response | void> => {
    const key = keyExtractor(c);
    const config =
      typeof options.config === 'function' ? options.config(c) : options.config;
    const backend =
      typeof options.backend === 'function' ? options.backend(c) : options.backend;

    let result: RateLimitResult;

    try {
      result = await backend.check(key, config);
    } catch (error) {
      // REFACTOR-002: Consistent error handling across workers
      const logger = c.get('logger');
      if (logger) {
        logger.warn('Rate limiter backend error', {
          onError,
          key,
          path: c.req.path,
          method: c.req.method,
        });
      }

      if (onError === 'fail-open') {
        await next();
        return;
      }

      // fail-closed: treat as rate limited
      const retryAfter = Math.ceil(config.windowMs / 1000);
      c.header('Retry-After', String(retryAfter));
      if (formatError) {
        return formatError(c, retryAfter);
      }
      return c.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter,
        },
        429,
      );
    }

    // REFACTOR-002: Warn on backend errors that were handled with fail-open
    if (result.backendError) {
      const logger = c.get('logger');
      if (logger) {
        logger.warn('Rate limiter backend error (failing open)', {
          key,
          path: c.req.path,
          method: c.req.method,
        });
      }
    }

    // Set standard rate limit headers on all responses
    const headers = getRateLimitHeaders(result);
    for (const [headerName, headerValue] of Object.entries(headers)) {
      c.header(headerName, headerValue);
    }

    if (!result.allowed) {
      const retryAfter =
        result.retryAfter ??
        Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
      c.header('Retry-After', String(retryAfter));

      if (formatError) {
        return formatError(c, retryAfter);
      }

      return c.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter,
        },
        429,
      );
    }

    await next();
  };
}
