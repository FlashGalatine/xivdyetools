/**
 * @xivdyetools/worker-kit
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
 * } from '@xivdyetools/worker-kit';
 * import type { MiddlewareVariables } from '@xivdyetools/worker-kit';
 *
 * type Variables = MiddlewareVariables & { auth: AuthContext };
 * const app = new Hono<{ Bindings: Env; Variables: Variables }>();
 *
 * app.use('*', requestIdMiddleware());
 * app.use('*', loggerMiddleware({ serviceName: 'my-worker' }));
 * ```
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.

export { requestIdMiddleware, getRequestId } from './request-id.js';
export type { /** @public */ RequestIdOptions } from './request-id.js';

export { loggerMiddleware, getLogger } from './logger.js';
export type { /** @public */ LoggerMiddlewareOptions } from './logger.js';

export { rateLimitMiddleware } from './rate-limit.js';
export type { /** @public */ RateLimitMiddlewareOptions } from './rate-limit.js';

export type { MiddlewareVariables } from './types.js';
