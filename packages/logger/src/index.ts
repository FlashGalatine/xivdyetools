/**
 * @xivdyetools/logger
 *
 * Unified logging for the xivdyetools ecosystem.
 *
 * Supports browser, Node.js, and Cloudflare Workers environments
 * with a consistent API.
 *
 * @packageDocumentation
 *
 * @example Basic usage
 * ```typescript
 * import { createBrowserLogger } from '@xivdyetools/logger';
 *
 * const logger = createBrowserLogger();
 * logger.info('Application started');
 * logger.error('Failed to load data', error, { userId: '123' });
 * ```
 *
 * @example Worker usage
 * ```typescript
 * import { createWorkerLogger, getRequestId } from '@xivdyetools/logger/worker';
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const logger = createWorkerLogger({
 *       service: 'my-api',
 *       environment: env.ENVIRONMENT,
 *     }, getRequestId(request));
 *
 *     logger.info('Request received');
 *   }
 * };
 * ```
 *
 * @example Library usage
 * ```typescript
 * import { NoOpLogger, ConsoleLogger } from '@xivdyetools/logger/library';
 * import type { Logger } from '@xivdyetools/logger';
 *
 * class MyService {
 *   constructor(private logger: Logger = NoOpLogger) {}
 *
 *   doWork() {
 *     this.logger.debug('Doing work...');
 *   }
 * }
 *
 * // Consumer can enable logging:
 * const service = new MyService(ConsoleLogger);
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================
export type {
  LogLevel,
  LogContext,
  LogEntry,
  Logger,
  ExtendedLogger,
  LoggerConfig,
  ErrorTracker,
} from './types.js';

// ============================================================================
// Core Exports
// ============================================================================
export { BaseLogger, createSimpleLogger } from './core/index.js';

// ============================================================================
// Adapter Exports
// ============================================================================
export { ConsoleAdapter, JsonAdapter, NoopAdapter } from './adapters/index.js';

// ============================================================================
// Preset Exports
// ============================================================================
export {
  // Browser
  createBrowserLogger,
  browserLogger,
  perf,
  // Worker
  createWorkerLogger,
  createRequestLogger,
  getRequestId,
  // Library
  NoOpLogger,
  ConsoleLogger,
  createLibraryLogger,
} from './presets/index.js';

export type { BrowserLoggerOptions, WorkerLoggerOptions } from './presets/index.js';
