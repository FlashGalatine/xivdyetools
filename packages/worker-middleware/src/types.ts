/**
 * @xivdyetools/worker-middleware - Type Definitions
 *
 * Shared types for Hono context variables set by the middleware stack.
 *
 * @module types
 */

import type { ExtendedLogger } from '@xivdyetools/logger';

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
