/**
 * @xivdyetools/types - Dye Module
 *
 * FFXIV dye type definitions.
 *
 * @module dye
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.

export type { Dye, /** @public */ LocalizedDye, DyeWithDistance } from './dye.js';
export type { FacewearColor } from './facewear.js';
export type { DyeTypeFilters } from './dye-filters.js';
