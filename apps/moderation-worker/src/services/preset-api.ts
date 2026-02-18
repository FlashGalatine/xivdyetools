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

import type { Env } from '../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type {
  CommunityPreset,
  PresetListResponse,
  ModerationStats,
  ModerationLogEntry,
  PresetFilters,
} from '../types/preset.js';
import { PresetAPIError } from '../types/preset.js';

// ============================================================================
// HMAC Signature Generation
// ============================================================================

/**
 * Generate HMAC-SHA256 signature for bot authentication
 *
 * The signature proves that:
 * 1. Request came from authorized moderation bot
 * 2. Request has not been tampered with
 * 3. Request is recent (timestamp prevents replay attacks)
 *
 * SECURITY REQUIREMENTS FOR RECEIVING API:
 * - MUST validate timestamp is within 5 minutes of current time
 * - MUST use constant-time comparison for signature validation
 * - MUST reject requests with timestamps older than 5 minutes
 * - SHOULD allow 60-second clock skew for future timestamps
 *
 * Signature format: HMAC-SHA256(timestamp:discordId:userName)
 *
 * @see docs/HMAC_SIGNATURE_SPEC.md for complete specification
 * @param timestamp - Unix timestamp in seconds (not milliseconds)
 * @param userDiscordId - Discord user ID initiating the request
 * @param userName - Discord username (for audit trail)
 * @param signingSecret - Shared secret between bots (env.BOT_SIGNING_SECRET)
 * @returns Hex-encoded HMAC signature
 *
 * @example
 * ```typescript
 * const timestamp = Math.floor(Date.now() / 1000);
 * const signature = await generateRequestSignature(
 *   timestamp,
 *   '123456789',
 *   'username',
 *   env.BOT_SIGNING_SECRET
 * );
 * // Use in headers:
 * // X-Request-Timestamp: timestamp
 * // X-Request-Signature: signature
 * ```
 */
async function generateRequestSignature(
  timestamp: number,
  userDiscordId: string | undefined,
  userName: string | undefined,
  signingSecret: string
): Promise<string> {
  // Message format: timestamp:discordId:userName
  // Empty string for missing fields to maintain consistent format
  const message = `${timestamp}:${userDiscordId || ''}:${userName || ''}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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
  } = {}
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

  if (env.BOT_SIGNING_SECRET) {
    const timestamp = Math.floor(Date.now() / 1000); // Unix seconds
    const signature = await generateRequestSignature(
      timestamp,
      options.userDiscordId,
      options.userName,
      env.BOT_SIGNING_SECRET
    );
    headers['X-Request-Timestamp'] = String(timestamp);
    headers['X-Request-Signature'] = signature;

    // CRITICAL: The receiving API MUST validate this timestamp is within 5 minutes
    // to prevent replay attacks. See docs/HMAC_SIGNATURE_SPEC.md

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
          body: options.body ? JSON.stringify(options.body) : undefined,
        })
      );
    } else {
      const url = `${env.PRESETS_API_URL}${path}`;
      response = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    }

    const data = (await response.json()) as T & { message?: string; error?: string };

    if (!response.ok) {
      throw new PresetAPIError(
        response.status,
        data.message || data.error || `API request failed with status ${response.status}`,
        data
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
        'This reduces security for worker-to-worker communication.'
    );
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}

/**
 * Check if the preset API is configured and available
 */
export function isApiEnabled(env: Env): boolean {
  return Boolean(env.PRESETS_API || (env.PRESETS_API_URL && env.BOT_API_SECRET));
}

// Module-level cache for moderator IDs
let moderatorIdsCache: Set<string> | null = null;

/**
 * Validates if a string is a valid Discord snowflake ID
 * Snowflakes are 17-19 digit numeric strings
 *
 * @param id - The ID to validate
 * @returns true if valid snowflake format, false otherwise
 */
function isValidDiscordSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
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

  // Parse and validate moderator IDs
  const moderatorIds = new Set<string>();

  if (env.MODERATOR_IDS) {
    const ids = env.MODERATOR_IDS.split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    for (const id of ids) {
      if (isValidDiscordSnowflake(id)) {
        moderatorIds.add(id);
      } else {
        // Log invalid IDs but don't fail - this could be logged if logger is available
        console.warn(`Invalid moderator ID format (not a Discord snowflake): ${id}`);
      }
    }
  }

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
  filters: PresetFilters = {}
): Promise<PresetListResponse> {
  const params = new URLSearchParams();

  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const query = params.toString();
  return request<PresetListResponse>(env, 'GET', `/api/v1/presets${query ? `?${query}` : ''}`);
}

/**
 * Get a single preset by ID
 */
export async function getPreset(env: Env, id: string): Promise<CommunityPreset | null> {
  try {
    return await request<CommunityPreset>(env, 'GET', `/api/v1/presets/${id}`);
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
 */
export async function getPendingPresets(
  env: Env,
  moderatorId: string
): Promise<CommunityPreset[]> {
  const response = await request<{ presets: CommunityPreset[] }>(
    env,
    'GET',
    '/api/v1/moderation/pending',
    { userDiscordId: moderatorId }
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
  reason?: string
): Promise<CommunityPreset> {
  const response = await request<{ preset: CommunityPreset }>(
    env,
    'PATCH',
    `/api/v1/moderation/${presetId}/status`,
    {
      body: { status: 'approved', reason },
      userDiscordId: moderatorId,
    }
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
  reason: string
): Promise<CommunityPreset> {
  const response = await request<{ preset: CommunityPreset }>(
    env,
    'PATCH',
    `/api/v1/moderation/${presetId}/status`,
    {
      body: { status: 'rejected', reason },
      userDiscordId: moderatorId,
    }
  );
  return response.preset;
}

/**
 * Get moderation statistics
 */
export async function getModerationStats(
  env: Env,
  moderatorId: string
): Promise<ModerationStats> {
  const response = await request<{ stats: ModerationStats }>(
    env,
    'GET',
    '/api/v1/moderation/stats',
    { userDiscordId: moderatorId }
  );
  return response.stats;
}

/**
 * Get moderation history for a preset
 */
export async function getModerationHistory(
  env: Env,
  presetId: string,
  moderatorId: string
): Promise<ModerationLogEntry[]> {
  const response = await request<{ history: ModerationLogEntry[] }>(
    env,
    'GET',
    `/api/v1/moderation/${presetId}/history`,
    { userDiscordId: moderatorId }
  );
  return response.history;
}

/**
 * Revert a preset to its previous values (moderators only)
 */
export async function revertPreset(
  env: Env,
  presetId: string,
  reason: string,
  moderatorId: string
): Promise<CommunityPreset> {
  const response = await request<{ success: boolean; preset: CommunityPreset }>(
    env,
    'PATCH',
    `/api/v1/moderation/${presetId}/revert`,
    {
      body: { reason },
      userDiscordId: moderatorId,
    }
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
    logger?: ExtendedLogger;
  } = {}
): Promise<Array<{ name: string; value: string }>> {
  try {
    const filters: PresetFilters = {
      status: options.status || 'pending',
      limit: options.limit || 25,
    };

    if (query.length > 0) {
      filters.search = query;
    }

    const response = await getPresets(env, filters);

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
        error instanceof Error ? error : undefined
      );
    }
    return [];
  }
}
