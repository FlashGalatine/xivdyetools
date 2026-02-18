/**
 * @xivdyetools/logger - Worker Preset
 *
 * Pre-configured logger for Cloudflare Workers (oauth, presets-api, discord-worker).
 *
 * @module presets/worker
 */

import { JsonAdapter } from '../adapters/json-adapter.js';
import type { ExtendedLogger, LoggerConfig } from '../types.js';
// LOGGER-REF-003 FIX: Import from centralized constants
import { WORKER_REDACT_FIELDS } from '../constants.js';

/**
 * Options for worker logger
 */
export interface WorkerLoggerOptions {
  /** Service name for log aggregation */
  service: string;

  /** Environment (production, development, staging) */
  environment: string;

  /** API version */
  version?: string;

  /** Minimum log level */
  level?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Create a worker-optimized logger
 *
 * Features:
 * - JSON structured output for log aggregation
 * - Service/environment context in all logs
 * - Request correlation ID support
 * - Secret redaction
 *
 * @example
 * ```typescript
 * // In your Cloudflare Worker
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
 *     const logger = createWorkerLogger({
 *       service: 'xivdyetools-presets-api',
 *       environment: env.ENVIRONMENT,
 *       version: env.API_VERSION,
 *     }, requestId);
 *
 *     logger.info('Request received', { path: new URL(request.url).pathname });
 *     // ...
 *   }
 * };
 * ```
 */
export function createWorkerLogger(
  options: WorkerLoggerOptions,
  requestId?: string
): ExtendedLogger {
  const { service, environment, version, level } = options;

  const config: Partial<LoggerConfig> = {
    level: level ?? (environment === 'production' ? 'info' : 'debug'),
    format: 'json',
    timestamps: true,
    sanitizeErrors: true,
    redactFields: [...WORKER_REDACT_FIELDS],
  };

  const logger = new JsonAdapter(config);

  // Set service context
  logger.setContext({
    service,
    environment,
    ...(version && { version }),
    ...(requestId && { requestId }),
  });

  return logger;
}

/**
 * Create a request-scoped logger with correlation ID
 *
 * Convenience function for creating per-request loggers in Hono middleware.
 *
 * @example
 * ```typescript
 * // Hono middleware
 * app.use('*', async (c, next) => {
 *   const requestId = c.req.header('x-request-id') || crypto.randomUUID();
 *   c.set('requestId', requestId);
 *   c.set('logger', createRequestLogger({
 *     ENVIRONMENT: c.env.ENVIRONMENT,
 *     API_VERSION: c.env.API_VERSION,
 *     SERVICE_NAME: 'xivdyetools-presets-api',
 *   }, requestId));
 *
 *   // Add request ID to response headers
 *   c.header('x-request-id', requestId);
 *
 *   await next();
 * });
 * ```
 */
export function createRequestLogger(
  env: {
    ENVIRONMENT: string;
    API_VERSION?: string;
    SERVICE_NAME?: string;
  },
  requestId: string
): ExtendedLogger {
  return createWorkerLogger(
    {
      service: env.SERVICE_NAME ?? 'xivdyetools-worker',
      environment: env.ENVIRONMENT,
      version: env.API_VERSION,
    },
    requestId
  );
}

/**
 * Generate or extract request ID from headers
 *
 * @example
 * ```typescript
 * const requestId = getRequestId(request);
 * const logger = createWorkerLogger({ service: 'api', environment: 'production' }, requestId);
 * ```
 */
export function getRequestId(request: Request): string {
  return (
    request.headers.get('x-request-id') ||
    request.headers.get('cf-ray') ||
    crypto.randomUUID()
  );
}
