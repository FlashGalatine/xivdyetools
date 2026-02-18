/**
 * @xivdyetools/types - XIVAuth OAuth Types
 *
 * XIVAuth OAuth and user types.
 *
 * @module auth/xivauth
 */

/**
 * XIVAuth OAuth token response
 */
export interface XIVAuthTokenResponse {
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
 * XIVAuth character object from /api/v1/characters
 */
export interface XIVAuthCharacter {
  /** Lodestone character ID */
  id: number;

  /** Character name */
  name: string;

  /** Home world/server name */
  home_world: string;

  /** True if character is verified */
  verified: boolean;
}

/**
 * XIVAuth character registration (full response)
 */
export interface XIVAuthCharacterRegistration {
  /** Lodestone character ID */
  lodestone_id: number;

  /** Character name */
  name: string;

  /** Home world/server name */
  home_world: string;

  /** Data center name */
  data_center: string;

  /** True if character is verified */
  verified: boolean;
}

/**
 * XIVAuth social identity from /api/v1/user
 *
 * Represents a linked external account (Discord, etc.)
 */
export interface XIVAuthSocialIdentity {
  /** Provider name (e.g., 'discord') */
  provider: string;

  /** External ID (e.g., Discord snowflake) */
  external_id: string;

  /** Display name on the external service */
  name: string | null;

  /** Nickname on the external service */
  nickname: string | null;

  /** When the link was created */
  created_at: string;

  /** When the link was last updated */
  updated_at: string;
}

/**
 * XIVAuth user object from /api/v1/user
 *
 * NOTE: This is the ACTUAL response structure from XIVAuth.
 * XIVAuth does NOT return username or avatar_url in user endpoint.
 */
export interface XIVAuthUser {
  /** XIVAuth UUID */
  id: string;

  /** Array of linked accounts (Discord, etc.) */
  social_identities?: XIVAuthSocialIdentity[];

  /** True if user has MFA enabled */
  mfa_enabled: boolean;

  /** True if user has any verified characters */
  verified_characters: boolean;

  /** Account creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;
}
