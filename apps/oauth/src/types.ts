/**
 * Type definitions for OAuth Worker
 *
 * Re-exports shared types from @xivdyetools/types and defines
 * project-specific types for the OAuth worker.
 */

// ============================================
// RE-EXPORT SHARED TYPES
// ============================================

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { AuthProvider } from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { JWTPayload } from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { DiscordTokenResponse, DiscordUser } from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type {
  XIVAuthTokenResponse,
  XIVAuthCharacterRegistration,
  XIVAuthUser,
} from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { AuthResponse, UserInfoResponse } from '@xivdyetools/types';

// ============================================
// CLOUDFLARE BINDINGS (Project-specific)
// ============================================

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
  // Environment variables
  ENVIRONMENT: string;
  DISCORD_CLIENT_ID: string;
  XIVAUTH_CLIENT_ID: string;
  FRONTEND_URL: string;
  WORKER_URL: string;
  JWT_EXPIRY: string;

  // Secrets
  DISCORD_CLIENT_SECRET: string;
  XIVAUTH_CLIENT_SECRET?: string; // Optional - only needed for confidential client mode
  JWT_SECRET: string;

  // KV Namespaces (optional for backward compatibility)
  // Also the FALLBACK /auth/* rate limiter under the 'rl:' prefix (OPT-004)
  TOKEN_BLACKLIST?: KVNamespace;

  // FINDING-003 (2026-08-21 audit): native Workers Rate Limiting bindings
  // (`[[ratelimits]]`), one per distinct OAUTH_LIMITS value — preferred over KV.
  RL_AUTH_10?: RateLimit;
  RL_AUTH_20?: RateLimit;
  RL_AUTH_30?: RateLimit;

  // D1 Database for user management
  DB: D1Database;
}

// ============================================
// DATABASE ROW TYPES (Project-specific)
// ============================================

/**
 * Database user row.
 *
 * FINDING-002 (2026-08-29 security audit): no `avatar_url`. The column was
 * write-only — every response recomputes the CDN URL from the Discord id and
 * the `avatar` hash — and `migrations/0001_drop_xivauth_characters.sql` drops
 * it from the live database.
 */
export interface UserRow {
  id: string; // Our internal UUID
  discord_id: string | null;
  xivauth_id: string | null;
  auth_provider: string;
  username: string;
  created_at: string;
  updated_at: string;
}
