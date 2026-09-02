/**
 * @xivdyetools/logger - Presets Module
 *
 * Pre-configured logger factories for different environments.
 *
 * @module presets
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see root CLAUDE.md's Tooling →
// knip bullet and this repo's root `knip.jsonc`.
// The preset factories below (and their options types) are an adjudicated
// KEEP from the 2026-08-18 dead-code audit
// (docs/audits/2026-08-18-discord-worker-dead-code/, DEAD-021): documented
// public API / structurally live — every in-repo consumer imports them via
// the `/browser`, `/worker` and `/library` subpaths directly, not this
// barrel or the root barrel.

export { /** @public */ createBrowserLogger, /** @public */ browserLogger } from './browser.js';
export type { /** @public */ BrowserLoggerOptions } from './browser.js';

export {
  /** @public */
  createWorkerLogger,
  /** @public */
  createRequestLogger,
} from './worker.js';
export type { /** @public */ WorkerLoggerOptions } from './worker.js';

export {
  /** @public */
  NoOpLogger,
  /** @public */
  ConsoleLogger,
  createLibraryLogger,
} from './library.js';
