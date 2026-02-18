/**
 * @xivdyetools/logger - Presets Module
 *
 * Pre-configured logger factories for different environments.
 *
 * @module presets
 */

export { createBrowserLogger, browserLogger, perf } from './browser.js';
export type { BrowserLoggerOptions } from './browser.js';

export { createWorkerLogger, createRequestLogger, getRequestId } from './worker.js';
export type { WorkerLoggerOptions } from './worker.js';

export { NoOpLogger, ConsoleLogger, createLibraryLogger } from './library.js';
