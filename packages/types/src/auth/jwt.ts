/**
 * @xivdyetools/types - JWT Types
 *
 * JWT payload and related types.
 *
 * @module auth/jwt
 */

import type { AuthProvider } from './provider.js';

/**
 * Primary FFXIV character info (for XIVAuth users)
 *
 * Included in JWT for users who authenticated via XIVAuth
 * and have a verified character.
 */
export interface PrimaryCharacter {
  /** Character name */
  name: string;

  /** Server/World name */
  server: string;

  /** True if character is verified on XIVAuth */
  verified: boolean;
}

/**
 * JWT payload structure
 *
 * Contains both standard JWT claims and custom claims
 * for user identification.
 */
export interface JWTPayload {
  // Standard JWT claims
  /** Subject - Internal user ID */
  sub: string;

  /** Issued at timestamp */
  iat: number;

  /** Expiration timestamp */
  exp: number;

  /** Issuer (worker URL) */
  iss: string;

  /** JWT ID for revocation (optional for backward compat) */
  jti?: string;

  // Custom claims
  /** Display username */
  username: string;

  /** Discord global display name (if available) */
  global_name: string | null;

  /** Avatar hash or URL */
  avatar: string | null;

  // Multi-provider support
  /** Which provider was used to authenticate */
  auth_provider: AuthProvider;

  /** Discord snowflake ID (if Discord auth or linked) */
  discord_id?: string;

  /** XIVAuth UUID (if XIVAuth auth) */
  xivauth_id?: string;

  // XIVAuth-specific (optional)
  /** Primary FFXIV character info (if XIVAuth user) */
  primary_character?: PrimaryCharacter;
}

/**
 * OAuth state stored during authentication flow
 *
 * Stored temporarily while user is redirected to OAuth provider.
 */
export interface OAuthState {
  /** PKCE code verifier */
  code_verifier: string;

  /** Redirect URI used in the flow */
  redirect_uri: string;

  /** Path to redirect to after auth completes */
  return_path?: string;
}
