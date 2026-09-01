/**
 * XIV Dye Tools Worker - Type Definitions
 *
 * Re-exports shared types from @xivdyetools/types and defines
 * project-specific types for the presets API worker.
 */

import type { ModerationResult as SharedModerationResult } from '@xivdyetools/types';

// ============================================
// RE-EXPORT SHARED TYPES
// ============================================

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type {
  PresetStatus,
  PresetCategory,
  CategoryMeta,
  CommunityPreset,
  PresetPreviousValues,
  PresetSubmission,
  PresetFilters,
  PresetEditRequest,
  PresetListResponse,
  VoteResponse,
} from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { AuthSource, AuthContext } from '@xivdyetools/types';

/**
 * @deprecated Import directly from '@xivdyetools/types' instead.
 * These re-exports will be removed in the next major version.
 */
export type { ModerationResult, ModerationLogEntry, RateLimitResult } from '@xivdyetools/types';

// ============================================
// MODERATION (Project-specific)
// ============================================

/**
 * How a moderation verdict was reached — the shared `ModerationResult.method`
 * plus this worker's fourth outcome.
 *
 * FINDING-005 (2026-08-29 security audit): a Perspective call that produced no
 * usable verdict (non-OK status including 429, the 5 s timeout, a thrown fetch,
 * an unparsable body) used to return `null`, which `moderateContent` read as
 * "clean, checked locally". Perspective's default quota is ~1 QPS, so a burst
 * of edits auto-approved everything behind the first 429 with only the local
 * word list — one entry — standing between it and publication.
 * `'perspective_unavailable'` is a *failure to decide*, never a pass: it is
 * reported with `passed: false` so every caller queues the content for a human,
 * and it is distinguishable from `'perspective'` (a real toxicity verdict) for
 * logging and for the moderator-facing copy.
 *
 * This union is local to presets-api rather than widened in `@xivdyetools/types`
 * because it describes this worker's moderation pipeline, not the published
 * preset contract, which is unchanged.
 */
export type PresetModerationMethod =
  | SharedModerationResult['method']
  | 'perspective_unavailable';

/** A `ModerationResult` that can also report "the service could not answer". */
export interface PresetModerationResult extends Omit<SharedModerationResult, 'method'> {
  method: PresetModerationMethod;
}

// ============================================
// RETENTION (Project-specific)
// ============================================

/**
 * The slice of `ExtendedLogger` the age-based prunes need (FINDING-017,
 * 2026-08-29 security audit). Structurally satisfied by the request logger
 * `c.get('logger')` returns; declared narrowly because a prune must never be
 * able to log anything but a count — no user id, no preset id, no error text
 * (a D1 error can quote the statement that failed, and quoting a statement
 * over these tables is how the content this finding removes gets back into a
 * log line).
 */
export interface RetentionLogger {
  warn(message: string, context?: Record<string, unknown>): void;
}

// ============================================
// CLOUDFLARE BINDINGS (Project-specific)
// ============================================

export interface Env {
  // D1 Database
  DB: D1Database;

  // Service bindings
  DISCORD_WORKER?: Fetcher;
  IMAGE_WORKER: Fetcher;

  // R2 buckets
  THUMBNAILS: R2Bucket;

  /**
   * FINDING-003: native Workers Rate Limiting binding (`[[ratelimits]]`,
   * limit 100 / 60 s) for the public per-IP limiter; memory fallback when absent.
   */
  RL_PUBLIC?: RateLimit;

  // Environment variables
  ENVIRONMENT: string;
  API_VERSION: string;
  CORS_ORIGIN: string;
  ADDITIONAL_CORS_ORIGINS?: string; // Comma-separated additional allowed origins

  // Secrets (set via wrangler secret put)
  BOT_API_SECRET: string;
  BOT_SIGNING_SECRET?: string; // HMAC signing key for bot request verification
  MODERATOR_IDS: string;
  PERSPECTIVE_API_KEY?: string;
  MODERATION_WEBHOOK_URL?: string;
  OWNER_DISCORD_ID?: string;
  DISCORD_BOT_TOKEN?: string;

  // Web OAuth (shared with xivdyetools-oauth-worker)
  JWT_SECRET?: string;
  /**
   * FINDING-015: expected `iss` claim (the oauth worker's WORKER_URL). When
   * set, tokens from any other issuer are rejected. Plain var, not a secret.
   */
  JWT_ISSUER?: string;
  /**
   * FINDING-002: the oauth worker's jti blacklist (same KV namespace). When
   * bound, revoked tokens are rejected by authMiddleware; absent in tests/dev.
   */
  TOKEN_BLACKLIST?: KVNamespace;

  // Discord bot webhook for notifications
  DISCORD_BOT_WEBHOOK_URL?: string;
  INTERNAL_WEBHOOK_SECRET?: string;

  /**
   * FINDING-018: Cloudflare zone that serves `shots.xivdyetools.app` and an API
   * token with `Zone.Cache Purge`, used to evict a preview image's URL from the
   * edge cache when it is rejected / deleted / replaced. Both optional: when
   * either is absent the purge is skipped and the one-day `s-maxage` on the
   * object is the only bound on how long a removed image stays reachable.
   */
  CACHE_PURGE_ZONE_ID?: string;
  CACHE_PURGE_API_TOKEN?: string;
}

// ============================================
// DATABASE ROW TYPES (Raw from D1)
// ============================================

export interface PresetRow {
  id: string;
  name: string;
  description: string;
  category_id: string;
  dyes: string; // JSON string
  tags: string; // JSON string
  author_discord_id: string | null;
  author_name: string | null;
  vote_count: number;
  status: string;
  is_curated: number; // SQLite boolean (0 or 1)
  created_at: string;
  updated_at: string;
  dye_signature: string | null;
  previous_values: string | null; // JSON string of PresetPreviousValues
  example_link: string | null; // 8A: allowlisted page URL, stored not copied
  preview_image_key: string | null; // R2 key, {presetId}/{uuid}.webp
  preview_image_status: string; // 'none' | 'pending' | 'approved'
  secondary_categories: string; // JSON array of PresetCategory; never null
  rejection_reason?: string | null; // joined from moderation_log on /mine only
}

export interface CategoryRow {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  is_curated: number;
  display_order: number;
}

export interface VoteRow {
  preset_id: string;
  user_discord_id: string;
  created_at: string;
}
