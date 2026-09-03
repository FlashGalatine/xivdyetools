/**
 * @xivdyetools/types - Auth Module
 *
 * Authentication type definitions for OAuth flows and JWT.
 *
 * @module auth
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see root CLAUDE.md's Tooling →
// knip bullet and this repo's root `knip.jsonc`.

// Provider types
export type { AuthProvider, AuthSource, AuthContext } from './provider.js';

// JWT types
export type { /** @public */ PrimaryCharacter, JWTPayload } from './jwt.js';

// Discord types
export type { DiscordTokenResponse, DiscordUser } from './discord.js';

// Discord Snowflake validation (FINDING-002)
export { isValidSnowflake } from './discord-snowflake.js';

// XIVAuth types
export type {
  XIVAuthTokenResponse,
  /** @public */
  XIVAuthCharacter,
  XIVAuthCharacterRegistration,
  /** @public */
  XIVAuthSocialIdentity,
  XIVAuthUser,
} from './xivauth.js';

// Response types
export type {
  AuthUser,
  /** @public */
  AuthSuccessResponse,
  /** @public */
  AuthErrorResponse,
  AuthResponse,
  /** @public */
  RefreshSuccessResponse,
  /** @public */
  RefreshErrorResponse,
  /** @public */
  RefreshResponse,
  /** @public */
  UserInfoData,
  /** @public */
  UserInfoSuccessResponse,
  /** @public */
  UserInfoErrorResponse,
  UserInfoResponse,
} from './response.js';
