/**
 * @xivdyetools/types - Auth Response Types
 *
 * API response types for authentication endpoints.
 *
 * @module auth/response
 */

import type { AuthProvider } from './provider.js';
import type { PrimaryCharacter } from './jwt.js';

/**
 * User info included in auth responses
 */
export interface AuthUser {
  /** Internal user ID */
  id: string;

  /** Display username */
  username: string;

  /** Discord global display name */
  global_name: string | null;

  /** Avatar hash */
  avatar: string | null;

  /** Full avatar URL */
  avatar_url: string | null;

  /** Which provider was used to authenticate */
  auth_provider?: AuthProvider;

  /** Primary FFXIV character (if XIVAuth user) */
  primary_character?: PrimaryCharacter;
}

/**
 * Successful authentication response
 */
export interface AuthSuccessResponse {
  /** Authentication succeeded */
  success: true;

  /** JWT token */
  token: string;

  /** User information */
  user: AuthUser;

  /** Token expiration timestamp (ms since epoch) */
  expires_at: number;
}

/**
 * Failed authentication response
 */
export interface AuthErrorResponse {
  /** Authentication failed */
  success: false;

  /** Error message describing the failure */
  error: string;
}

/**
 * Response from authentication endpoints
 *
 * Uses discriminated union for type-safe handling:
 * ```typescript
 * if (response.success) {
 *   // TypeScript knows: token, user, expires_at exist
 *   console.log(response.user.username);
 * } else {
 *   // TypeScript knows: error exists
 *   console.error(response.error);
 * }
 * ```
 */
export type AuthResponse = AuthSuccessResponse | AuthErrorResponse;

/**
 * Successful token refresh response
 */
export interface RefreshSuccessResponse {
  /** Refresh succeeded */
  success: true;

  /** New JWT token */
  token: string;

  /** New token expiration timestamp (ms since epoch) */
  expires_at: number;
}

/**
 * Failed token refresh response
 */
export interface RefreshErrorResponse {
  /** Refresh failed */
  success: false;

  /** Error message describing the failure */
  error: string;
}

/**
 * Response from token refresh endpoint
 *
 * Uses discriminated union for type-safe handling.
 */
export type RefreshResponse = RefreshSuccessResponse | RefreshErrorResponse;

/**
 * User info data returned in UserInfoResponse
 */
export interface UserInfoData {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  avatar_url: string | null;
}

/**
 * Successful user info response
 */
export interface UserInfoSuccessResponse {
  /** Request succeeded */
  success: true;

  /** User information */
  user: UserInfoData;
}

/**
 * Failed user info response
 */
export interface UserInfoErrorResponse {
  /** Request failed */
  success: false;

  /** Error message describing the failure */
  error: string;
}

/**
 * Response from user info endpoint
 *
 * Uses discriminated union for type-safe handling.
 */
export type UserInfoResponse = UserInfoSuccessResponse | UserInfoErrorResponse;
