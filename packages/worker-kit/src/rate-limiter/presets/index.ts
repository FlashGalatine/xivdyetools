/**
 * Rate Limit Presets
 *
 * Pre-built configurations for common rate limiting scenarios.
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see root CLAUDE.md's Tooling →
// knip bullet and this repo's root `knip.jsonc`.
// This subpath (`@xivdyetools/worker-kit/rate-limiter/presets`) is a published
// `package.json#exports` entry, so all seven re-exports below are public API.
// Four (`getOAuthLimit`, `getDiscordCommandLimit`, `getModerationLimit`,
// `PUBLIC_API_LIMITS`) also have an in-repo consumer that reaches them via the
// sibling `rate-limiter/index.ts` barrel instead of this subpath; the other
// three (`OAUTH_LIMITS`, `DISCORD_COMMAND_LIMITS`, `MODERATION_LIMITS`) have
// no in-repo consumer by any path.

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
