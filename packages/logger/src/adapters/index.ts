/**
 * @xivdyetools/logger - Adapters Module
 *
 * Logger adapters for different output targets.
 *
 * @module adapters
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.
// The three adapters below are an adjudicated KEEP from the 2026-08-18
// dead-code audit (docs/audits/2026-08-18-discord-worker-dead-code/,
// DEAD-021): documented public API / structurally live extension points,
// even though every in-repo consumer goes through a preset factory instead
// of constructing an adapter directly.

export { /** @public */ ConsoleAdapter } from './console-adapter.js';
export { /** @public */ JsonAdapter } from './json-adapter.js';
export { /** @public */ NoopAdapter } from './noop-adapter.js';
