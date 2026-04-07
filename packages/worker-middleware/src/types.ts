/**
 * @xivdyetools/worker-middleware - Type Definitions
 *
 * Shared types for Hono context variables set by the middleware stack.
 *
 * BUG-003 FIX: Augments Hono's ContextVariableMap so that `c.get('requestId')`
 * and `c.get('logger')` work on ANY Context without requiring `Context<any>`.
 *
 * @module types
 */

import type { ExtendedLogger } from '@xivdyetools/logger';

/**
 * Hono module augmentation for middleware-provided context variables.
 *
 * This makes `requestId` and `logger` available on every Hono Context
 * without requiring workers to manually extend their Variables type.
 * Workers can still extend Variables for app-specific context (e.g. auth).
 */
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    logger: ExtendedLogger;
  }
}

/**
 * Base context variables set by the shared middleware stack.
 *
 * Workers should extend this with their own app-specific variables:
 *
 * @example
 * ```typescript
 * import type { MiddlewareVariables } from '@xivdyetools/worker-middleware';
 *
 * type Variables = MiddlewareVariables & {
 *   auth: AuthContext;
 * };
 *
 * const app = new Hono<{ Bindings: Env; Variables: Variables }>();
 * ```
 */
export type MiddlewareVariables = {
  /** Request correlation ID for distributed tracing */
  requestId: string;

  /** Request-scoped structured logger */
  logger: ExtendedLogger;
};
