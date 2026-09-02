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
 * import { createRequestLogger } from '@xivdyetools/logger/worker';
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
 *     const logger = createRequestLogger({
 *       ENVIRONMENT: env.ENVIRONMENT,
 *       API_VERSION: env.API_VERSION,
 *       SERVICE_NAME: 'my-api',
 *     }, requestId);
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

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.
// `BaseLogger`, the three adapters and the preset factories/options types
// are an adjudicated KEEP from the 2026-08-18 dead-code audit
// (docs/audits/2026-08-18-discord-worker-dead-code/, DEAD-021): documented
// public API / structurally live, even though in-repo consumers reach most
// of them via a subpath (`/browser`, `/worker`, `/library`) rather than this
// root barrel.

// ============================================================================
// Type Exports
// ============================================================================
export type {
  /** @public */
  LogLevel,
  /** @public */
  LogContext,
  /** @public */
  LogEntry,
  /** @public */
  Logger,
  ExtendedLogger,
  /** @public */
  LoggerConfig,
  /** @public */
  ErrorTracker,
} from './types.js';

// ============================================================================
// Core Exports
// ============================================================================
export { /** @public */ BaseLogger } from './core/index.js';

// ============================================================================
// Adapter Exports
// ============================================================================
export {
  /** @public */
  ConsoleAdapter,
  /** @public */
  JsonAdapter,
  /** @public */
  NoopAdapter,
} from './adapters/index.js';

// ============================================================================
// Preset Exports
// ============================================================================
export {
  // Browser
  /** @public */
  createBrowserLogger,
  /** @public */
  browserLogger,
  // Worker
  /** @public */
  createWorkerLogger,
  /** @public */
  createRequestLogger,
  // Library
  /** @public */
  NoOpLogger,
  /** @public */
  ConsoleLogger,
  createLibraryLogger,
} from './presets/index.js';

export type {
  /** @public */
  BrowserLoggerOptions,
  /** @public */
  WorkerLoggerOptions,
} from './presets/index.js';
