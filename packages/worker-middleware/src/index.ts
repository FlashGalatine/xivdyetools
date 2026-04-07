/**
 * @xivdyetools/worker-middleware
 *
 * Shared Hono middleware for xivdyetools Cloudflare Workers.
 *
 * Provides a consistent middleware stack for request ID management,
 * structured logging, and (future) rate limiting across all workers.
 *
 * REFACTOR-001: Extracted from duplicated middleware across 5 workers.
 *
 * @packageDocumentation
 *
 * @example Basic usage
 * ```typescript
 * import {
 *   requestIdMiddleware,
 *   loggerMiddleware,
 *   getRequestId,
 *   getLogger,
 * } from '@xivdyetools/worker-middleware';
 * import type { MiddlewareVariables } from '@xivdyetools/worker-middleware';
 *
 * type Variables = MiddlewareVariables & { auth: AuthContext };
 * const app = new Hono<{ Bindings: Env; Variables: Variables }>();
 *
 * app.use('*', requestIdMiddleware());
 * app.use('*', loggerMiddleware({ serviceName: 'my-worker' }));
 * ```
 */

export { requestIdMiddleware, getRequestId } from './request-id.js';
export type { RequestIdOptions } from './request-id.js';

export { loggerMiddleware, getLogger } from './logger.js';
export type { LoggerMiddlewareOptions } from './logger.js';

export type { MiddlewareVariables } from './types.js';
