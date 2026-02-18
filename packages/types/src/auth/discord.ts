/**
 * @xivdyetools/types - Discord OAuth Types
 *
 * Discord OAuth and user types.
 *
 * @module auth/discord
 */

/**
 * Discord OAuth token response
 */
export interface DiscordTokenResponse {
  /** OAuth access token */
  access_token: string;

  /** Token type (usually "Bearer") */
  token_type: string;

  /** Token lifetime in seconds */
  expires_in: number;

  /** Refresh token for obtaining new access tokens */
  refresh_token: string;

  /** Granted scopes (space-separated) */
  scope: string;
}

/**
 * Discord user object from /users/@me
 */
export interface DiscordUser {
  /** Discord snowflake ID */
  id: string;

  /** Username (not nickname) */
  username: string;

  /** Legacy discriminator (usually "0" now) */
  discriminator: string;

  /** Display name (new Discord usernames) */
  global_name: string | null;

  /** Avatar hash */
  avatar: string | null;

  /** True if user is a bot */
  bot?: boolean;

  /** True if user is a system user */
  system?: boolean;

  /** True if user has MFA enabled */
  mfa_enabled?: boolean;

  /** Banner hash */
  banner?: string | null;

  /** Banner color as integer */
  accent_color?: number | null;

  /** User's locale setting */
  locale?: string;

  /** True if email is verified */
  verified?: boolean;

  /** User's email (requires email scope) */
  email?: string | null;

  /** User flags bitmap */
  flags?: number;

  /** Nitro subscription type */
  premium_type?: number;

  /** Public flags bitmap */
  public_flags?: number;
}
