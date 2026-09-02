/**
 * @xivdyetools/types - Error Module
 *
 * Error handling types and utilities.
 *
 * @module error
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see root CLAUDE.md's Tooling →
// knip bullet and this repo's root `knip.jsonc`.

export { ErrorCode } from './codes.js';
export { AppError } from './app-error.js';
export type { /** @public */ ErrorSeverity } from './app-error.js';
