/**
 * @xivdyetools/types - Auth Module
 *
 * Authentication type definitions for OAuth flows and JWT.
 *
 * @module auth
 */

// Provider types
export type { AuthProvider, AuthSource, AuthContext } from './provider.js';

// JWT types
export type { PrimaryCharacter, JWTPayload, OAuthState } from './jwt.js';

// Discord types
export type { DiscordTokenResponse, DiscordUser } from './discord.js';

// XIVAuth types
export type {
  XIVAuthTokenResponse,
  XIVAuthCharacter,
  XIVAuthCharacterRegistration,
  XIVAuthSocialIdentity,
  XIVAuthUser,
} from './xivauth.js';

// Response types
export type {
  AuthUser,
  AuthSuccessResponse,
  AuthErrorResponse,
  AuthResponse,
  RefreshSuccessResponse,
  RefreshErrorResponse,
  RefreshResponse,
  UserInfoData,
  UserInfoSuccessResponse,
  UserInfoErrorResponse,
  UserInfoResponse,
} from './response.js';
