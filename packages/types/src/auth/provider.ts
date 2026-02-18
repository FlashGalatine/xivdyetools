/**
 * @xivdyetools/types - Auth Provider Types
 *
 * Authentication provider and context types.
 *
 * @module auth/provider
 */

/**
 * Supported authentication providers
 */
export type AuthProvider = 'discord' | 'xivauth';

/**
 * Source of authentication in API requests
 *
 * - `none`: Unauthenticated request
 * - `bot`: Request from Discord bot (via service binding or API key)
 * - `web`: Request from web app (via JWT)
 */
export type AuthSource = 'none' | 'bot' | 'web';

/**
 * Authentication context for API requests
 *
 * Attached to requests after authentication middleware runs.
 */
export interface AuthContext {
  /** True if the request is authenticated */
  isAuthenticated: boolean;

  /** True if the user has moderator privileges */
  isModerator: boolean;

  /** Discord user ID (if authenticated) */
  userDiscordId?: string;

  /** Display name (if authenticated) */
  userName?: string;

  /** How the user authenticated */
  authSource: AuthSource;
}
