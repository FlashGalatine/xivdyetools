/**
 * Rate Limit Presets
 *
 * Pre-built configurations for common rate limiting scenarios.
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.
// This subpath (`@xivdyetools/worker-kit/rate-limiter/presets`) is a published
// `package.json#exports` entry, so all seven re-exports below are public API
// even though every in-repo consumer currently reaches them via the sibling
// `rate-limiter/index.ts` barrel instead.

export {
  /** @public */
  OAUTH_LIMITS,
  /** @public */
  getOAuthLimit,
  /** @public */
  DISCORD_COMMAND_LIMITS,
  /** @public */
  getDiscordCommandLimit,
  /** @public */
  MODERATION_LIMITS,
  /** @public */
  getModerationLimit,
  /** @public */
  PUBLIC_API_LIMITS,
} from './configs.js';
