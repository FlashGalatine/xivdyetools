/**
 * XIV Dye Tools Worker - Type Definitions
 *
 * Re-exports shared types from @xivdyetools/types and defines
 * project-specific types for the presets API worker.
 */

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
  PresetSubmitResponse,
  PresetEditResponse,
  VoteResponse,
  ModerationResponse,
  CategoryListResponse,
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

  // Discord bot webhook for notifications
  DISCORD_BOT_WEBHOOK_URL?: string;
  INTERNAL_WEBHOOK_SECRET?: string;
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
