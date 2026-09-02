/**
 * Preset API Client (Moderation-focused)
 *
 * Functional module for communicating with the xivdyetools-worker preset API.
 * This is a subset containing only moderation-related functions.
 *
 * Uses Cloudflare Service Bindings for Worker-to-Worker communication when available.
 *
 * @module services/preset-api
 */

import { parseModeratorIds } from '@xivdyetools/bot-logic';
import {
  createBotSignatureV2,
  BOT_SIGNATURE_V2_HEADER,
  BOT_SIGNATURE_NONCE_HEADER,
} from '@xivdyetools/auth';
import type { Env } from '../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { isValidSnowflake } from '@xivdyetools/types';
import type {
  CommunityPreset,
  PresetListResponse,
  ModerationStats,
  PresetFilters,
} from '@xivdyetools/types';
import type { ModerationQueueEntry } from '../types/preset.js';
import { PresetAPIError } from '../types/preset.js';

// ============================================================================
// Core Request Function
// ============================================================================

/**
 * Make an authenticated request to the preset API
 */
async function request<T>(
  env: Env,
  method: string,
  path: string,
  options: {
    body?: unknown;
    userDiscordId?: string;
    userName?: string;
    requestId?: string;
    logger?: ExtendedLogger;
  } = {},
): Promise<T> {
  if (!env.PRESETS_API && (!env.PRESETS_API_URL || !env.BOT_API_SECRET)) {
    throw new PresetAPIError(503, 'Preset API not configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (options.requestId) {
    headers['X-Request-ID'] = options.requestId;
  }

  if (env.BOT_API_SECRET) {
    headers['Authorization'] = `Bearer ${env.BOT_API_SECRET}`;
  }

  if (options.userDiscordId) {
    headers['X-User-Discord-ID'] = options.userDiscordId;
  }
  if (options.userName) {
    headers['X-User-Discord-Name'] = options.userName;
  }

  // Serialise once: the same bytes are signed (v2) and sent
  const bodyText = options.body ? JSON.stringify(options.body) : undefined;

  if (env.BOT_SIGNING_SECRET) {
    const timestamp = Math.floor(Date.now() / 1000); // Unix seconds
    headers['X-Request-Timestamp'] = String(timestamp);

    // FINDING-014 (2026-08-21 audit): v2 binds method + path + body hash +
    // nonce + identity (60 s window); presets-api verifies it whenever present.
    // The legacy v1 header (a bare timestamp:userId:userName HMAC that bound
    // nothing about the request itself) is no longer sent — presets-api stopped
    // accepting it in 2.2.0 (FINDING-015, 2026-08-29 audit).
    const nonce = crypto.randomUUID();
    headers[BOT_SIGNATURE_NONCE_HEADER] = nonce;
    headers[BOT_SIGNATURE_V2_HEADER] = await createBotSignatureV2(
      {
        method,
        path: new URL(`https://internal${path}`).pathname,
        body: bodyText,
        timestamp: String(timestamp),
        nonce,
        userDiscordId: options.userDiscordId,
        userName: options.userName,
      },
      env.BOT_SIGNING_SECRET,
    );

    if (options.logger) {
      options.logger.debug('Generated HMAC signature', {
        timestamp,
        hasSignature: true,
        userId: options.userDiscordId,
      });
    }
  }

  try {
    let response: Response;

    if (env.PRESETS_API) {
      response = await env.PRESETS_API.fetch(
        new Request(`https://internal${path}`, {
          method,
          headers,
          body: bodyText,
        }),
      );
    } else {
      const url = `${env.PRESETS_API_URL}${path}`;
      response = await fetch(url, {
        method,
        headers,
        body: bodyText,
      });
    }

    const data: T & { message?: string; error?: string } = await response.json();

    if (!response.ok) {
      throw new PresetAPIError(
        response.status,
        data.message || data.error || `API request failed with status ${response.status}`,
        data,
      );
    }

    return data;
  } catch (error) {
    if (error instanceof PresetAPIError) {
      throw error;
    }
    if (options.logger) {
      options.logger.error('Preset API request failed', error instanceof Error ? error : undefined);
    }
    throw new PresetAPIError(500, 'Failed to communicate with preset API', error);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate security configuration at startup
 * Logs warnings for missing security-critical secrets
 */
export function validateSecurityConfig(env: Env): {
  valid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check if using service binding vs HTTP API
  const usingServiceBinding = Boolean(env.PRESETS_API);

  if (!usingServiceBinding) {
    // When using HTTP API, BOT_API_SECRET is required
    if (!env.BOT_API_SECRET) {
      errors.push('BOT_API_SECRET is required when using PRESETS_API_URL');
    }
  }

  // BOT_SIGNING_SECRET is recommended for HMAC request signing
  if (!env.BOT_SIGNING_SECRET) {
    warnings.push(
      'BOT_SIGNING_SECRET is not set - HMAC request signatures will be disabled. ' +
        'This reduces security for worker-to-worker communication.',
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

// Module-level cache for moderator IDs
let moderatorIdsCache: Set<string> | null = null;

/**
 * Validates if a string is a valid Discord snowflake ID
 * FINDING-002: Now delegates to shared utility from @xivdyetools/types
 *
 * @param id - The ID to validate
 * @returns true if valid snowflake format, false otherwise
 */
function isValidDiscordSnowflake(id: string): boolean {
  return isValidSnowflake(id);
}

/**
 * Parse and cache moderator IDs from environment variable
 * Validates snowflake format and creates a Set for O(1) lookups
 *
 * @param env - Environment variables
 * @returns Set of valid moderator IDs
 */
function getModerators(env: Env): Set<string> {
  // Return cached value if available
  if (moderatorIdsCache !== null) {
    return moderatorIdsCache;
  }

  // BUG-073 (2026-07-18 audit): shared grammar with discord-worker —
  // whitespace/comma separators + snowflake validation (the old comma-only
  // split here contradicted this worker's own documentation)
  const moderatorIds = parseModeratorIds(env.MODERATOR_IDS);

  // Cache the result
  moderatorIdsCache = moderatorIds;
  return moderatorIds;
}

/**
 * Check if a user is a moderator based on MODERATOR_IDS environment variable
 * Uses cached Set for O(1) lookup performance
 *
 * @param env - Environment variables
 * @param userId - Discord user ID to check
 * @returns true if user is a moderator, false otherwise
 */
export function isModerator(env: Env, userId: string): boolean {
  if (!env.MODERATOR_IDS) return false;

  // Validate userId format before checking
  if (!isValidDiscordSnowflake(userId)) {
    return false;
  }

  const moderators = getModerators(env);
  return moderators.has(userId);
}

// ============================================================================
// Preset Functions (Read-only for moderation)
// ============================================================================

/**
 * Get a paginated list of presets with optional filtering
 */
export async function getPresets(
  env: Env,
  filters: PresetFilters = {},
  moderatorId?: string,
): Promise<PresetListResponse> {
  const params = new URLSearchParams();

  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const query = params.toString();
  // MOD-13 (FINDING-034, 2026-08-21 audit): presets-api 403s `status=pending`
  // for anonymous callers, so the moderator identity must travel with the
  // request (it is also what the HMAC covers).
  return request<PresetListResponse>(env, 'GET', `/api/v1/presets${query ? `?${query}` : ''}`, {
    userDiscordId: moderatorId,
  });
}

/**
 * FINDING-020 (2026-08-21 security audit): every identifier interpolated into
 * a presets-api path is encoded first. Handlers validate the shape (UUID /
 * snowflake) at their boundary; this is the defence-in-depth layer so that a
 * value which slipped through can only ever address a single path segment.
 */
function pathSegment(id: string): string {
  return encodeURIComponent(id);
}

/**
 * Get a single preset by ID
 */
export async function getPreset(env: Env, id: string): Promise<CommunityPreset | null> {
  try {
    return await request<CommunityPreset>(env, 'GET', `/api/v1/presets/${pathSegment(id)}`);
  } catch (error) {
    if (error instanceof PresetAPIError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

// ============================================================================
// Moderation Functions
// ============================================================================

/**
 * Get presets pending moderation
 *
 * FINDING-001 (2026-08-11 fix wave): typed as ModerationQueueEntry[], not
 * CommunityPreset[] — the API has always included `pending_preview_image_url`
 * on this endpoint (presets-api's ModerationQueueEntry), but this client
 * discarded it at the type level, leaving handlePendingAction with no way to
 * tell a text-pending entry from an image-only one.
 */
export async function getPendingPresets(
  env: Env,
  moderatorId: string,
): Promise<ModerationQueueEntry[]> {
  const response = await request<{ presets: ModerationQueueEntry[] }>(
    env,
    'GET',
    '/api/v1/moderation/pending',
    { userDiscordId: moderatorId },
  );
  return response.presets;
}

/**
 * Approve a preset
 */
export async function approvePreset(
  env: Env,
  presetId: string,
  moderatorId: string,
  reason?: string,
): Promise<CommunityPreset> {
  const response = await request<{ preset: CommunityPreset }>(
    env,
    'PATCH',
    `/api/v1/moderation/${pathSegment(presetId)}/status`,
    {
      body: { status: 'approved', reason },
      userDiscordId: moderatorId,
    },
  );
  return response.preset;
}

/**
 * Reject a preset
 */
export async function rejectPreset(
  env: Env,
  presetId: string,
  moderatorId: string,
  reason: string,
): Promise<CommunityPreset> {
  const response = await request<{ preset: CommunityPreset }>(
    env,
    'PATCH',
    `/api/v1/moderation/${pathSegment(presetId)}/status`,
    {
      body: { status: 'rejected', reason },
      userDiscordId: moderatorId,
    },
  );
  return response.preset;
}

/**
 * Get moderation statistics
 */
export async function getModerationStats(env: Env, moderatorId: string): Promise<ModerationStats> {
  const response = await request<{ stats: ModerationStats }>(
    env,
    'GET',
    '/api/v1/moderation/stats',
    { userDiscordId: moderatorId },
  );
  return response.stats;
}

/**
 * Revert a preset to its previous values (moderators only)
 */
export async function revertPreset(
  env: Env,
  presetId: string,
  reason: string,
  moderatorId: string,
): Promise<CommunityPreset> {
  const response = await request<{ success: boolean; preset: CommunityPreset }>(
    env,
    'PATCH',
    `/api/v1/moderation/${pathSegment(presetId)}/revert`,
    {
      body: { reason },
      userDiscordId: moderatorId,
    },
  );
  return response.preset;
}

// ============================================================================
// Autocomplete Helpers
// ============================================================================

/**
 * Search presets for autocomplete suggestions
 */
export async function searchPresetsForAutocomplete(
  env: Env,
  query: string,
  options: {
    status?: 'approved' | 'pending';
    limit?: number;
    /** MOD-13: the moderator asking — required for `status: 'pending'` to return anything */
    userDiscordId?: string;
    logger?: ExtendedLogger;
  } = {},
): Promise<Array<{ name: string; value: string }>> {
  try {
    const filters: PresetFilters = {
      status: options.status || 'pending',
      limit: options.limit || 25,
    };

    if (query.length > 0) {
      filters.search = query;
    }

    const response = await getPresets(env, filters, options.userDiscordId);

    return response.presets.map((preset) => ({
      name: preset.author_name
        ? `${preset.name} (${preset.vote_count}\u2605) by ${preset.author_name}`
        : `${preset.name} (${preset.vote_count}\u2605)`,
      value: preset.id,
    }));
  } catch (error) {
    if (options.logger) {
      options.logger.error(
        'Preset autocomplete search failed',
        error instanceof Error ? error : undefined,
      );
    }
    return [];
  }
}
