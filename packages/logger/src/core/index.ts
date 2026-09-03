/**
 * @xivdyetools/logger - Core Module
 *
 * Base logger implementation and utilities.
 *
 * @module core
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see root CLAUDE.md's Tooling →
// knip bullet and this repo's root `knip.jsonc`.
// `BaseLogger` is an adjudicated KEEP from the 2026-08-18 dead-code audit
// (docs/audits/2026-08-18-discord-worker-dead-code/, DEAD-021): documented
// public API / structurally live — every in-repo consumer subclasses it only
// indirectly, through the preset factories.

export { /** @public */ BaseLogger } from './base-logger.js';
