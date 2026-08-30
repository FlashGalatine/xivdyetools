/**
 * Preset API Client
 *
 * Functional module for communicating with the xivdyetools-worker preset API.
 * All functions are stateless and take environment as a parameter.
 *
 * Uses Cloudflare Service Bindings for Worker-to-Worker communication when available,
 * which avoids error 1042 (Worker fetch to different worker on same account).
 *
 * @module services/preset-api
 */

import { isModeratorId } from '@xivdyetools/bot-logic';
import {
  hmacSignHex,
  createBotSignatureV2,
  BOT_SIGNATURE_V2_HEADER,
  BOT_SIGNATURE_NONCE_HEADER,
} from '@xivdyetools/auth';
import type { Env } from '../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  type CommunityPreset,
  type PresetListResponse,
  type PresetSubmitResponse,
  type PresetSubmission,
  type PresetEditRequest,
  type PresetEditResponse,
  type VoteResponse,
  type PresetFilters,
  PresetAPIError,
} from '../types/preset.js';

/** Upper bound on one presets-api call (service binding or URL fallback). */
export const PRESET_API_TIMEOUT_MS = 10_000;

// ============================================================================
// HMAC Signature Generation
// ============================================================================

/**
 * Generate HMAC-SHA256 signature for bot authentication
 *
 * SECURITY: This cryptographically binds the user headers to the request,
 * preventing header spoofing attacks even if BOT_API_SECRET is leaked.
 *
 * Delegates to `@xivdyetools/auth`'s `hmacSignHex` (follow-up 3, superseding
 * DEAD-019's "kept as-is" from the 2026-08-18 dead-code audit). That audit
 * held off because `hmacSignHex` throws for secrets under 32 bytes
 * (FINDING-009) and `BOT_SIGNING_SECRET` had no length floor; env-validation
 * now enforces ≥32 bytes wherever the secret is set, so the throw path is
 * unreachable in a valid deployment.
 *
 * @param timestamp - Unix timestamp (seconds)
 * @param userDiscordId - User's Discord ID
 * @param userName - User's Discord name
 * @param signingSecret - The BOT_SIGNING_SECRET
 * @returns Hex-encoded HMAC signature
 */
async function generateRequestSignature(
  timestamp: number,
  userDiscordId: string | undefined,
  userName: string | undefined,
  signingSecret: string,
): Promise<string> {
  const message = `${timestamp}:${userDiscordId || ''}:${userName || ''}`;
  return hmacSignHex(message, signingSecret);
}

// ============================================================================
// Core Request Function
// ============================================================================

/**
 * Make an authenticated request to the preset API
 *
 * Uses Service Binding (env.PRESETS_API) when available for direct Worker-to-Worker
 * communication. Falls back to external URL (env.PRESETS_API_URL) if binding is not
 * configured (useful for local development).
 *
 * FINDING-020 (2026-08-21 security audit): callers percent-encode every
 * user-influenced path segment (`encodeURIComponent`) before building `path`,
 * so `..`, `/`, `?` and `#` in a preset id cannot steer the request onto a
 * different presets-api route. The same encoded path is what the v2
 * signature binds.
 *
 * @param env - Environment bindings
 * @param method - HTTP method
 * @param path - API path (e.g., '/api/v1/presets')
 * @param options - Request options
 * @returns Parsed JSON response
 * @throws PresetAPIError on failure
 */
async function request<T>(
  env: Env,
  method: string,
  path: string,
  options: {
    body?: unknown;
    userDiscordId?: string;
    userName?: string;
    requestId?: string; // For distributed tracing across service bindings
    logger?: ExtendedLogger;
  } = {},
): Promise<T> {
  // Require either service binding or URL-based configuration
  if (!env.PRESETS_API && (!env.PRESETS_API_URL || !env.BOT_API_SECRET)) {
    throw new PresetAPIError(503, 'Preset API not configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add request ID for distributed tracing
  if (options.requestId) {
    headers['X-Request-ID'] = options.requestId;
  }

  // Add auth header if using URL-based fetch (service binding uses internal auth)
  if (env.BOT_API_SECRET) {
    headers['Authorization'] = `Bearer ${env.BOT_API_SECRET}`;
  }

  // Add user context headers for authenticated operations
  if (options.userDiscordId) {
    headers['X-User-Discord-ID'] = options.userDiscordId;
  }
  if (options.userName) {
    headers['X-User-Discord-Name'] = options.userName;
  }

  // Serialise once: the same bytes are signed (v2) and sent
  const bodyText = options.body ? JSON.stringify(options.body) : undefined;

  // SECURITY: Add HMAC signature for bot authentication
  // This must be done for BOTH service binding and URL-based requests,
  // as the Presets API requires signature verification in production
  if (env.BOT_SIGNING_SECRET) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateRequestSignature(
      timestamp,
      options.userDiscordId,
      options.userName,
      env.BOT_SIGNING_SECRET,
    );
    headers['X-Request-Timestamp'] = String(timestamp);
    headers['X-Request-Signature'] = signature; // v1 — kept during rollover

    // FINDING-014 (2026-08-21 audit): v2 binds method + path + body hash +
    // nonce + identity (60 s window); presets-api verifies it whenever present
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
  }

  try {
    let response: Response;

    // Bounded wait either way: a stalled presets-api/D1 call must surface as a
    // failure (and its analytics row as `upstream_presets`) instead of holding
    // the command's trace until the runtime ends the isolate.
    const signal = AbortSignal.timeout(PRESET_API_TIMEOUT_MS);
    if (env.PRESETS_API) {
      // Use Service Binding for Worker-to-Worker communication
      // This avoids Cloudflare error 1042
      response = await env.PRESETS_API.fetch(
        new Request(`https://internal${path}`, {
          method,
          headers,
          body: bodyText,
          signal,
        }),
      );
    } else {
      // Fall back to external URL (for local dev or if service binding not configured)
      const url = `${env.PRESETS_API_URL}${path}`;
      response = await fetch(url, {
        method,
        headers,
        body: bodyText,
        signal,
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
    // Network or parsing error
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
 * Check if the preset API is configured and available
 *
 * Returns true if either:
 * - Service Binding (PRESETS_API) is configured (preferred)
 * - External URL (PRESETS_API_URL) and auth secret (BOT_API_SECRET) are set
 */
export function isApiEnabled(env: Env): boolean {
  return Boolean(env.PRESETS_API || (env.PRESETS_API_URL && env.BOT_API_SECRET));
}

/**
 * Check if a user is a moderator based on MODERATOR_IDS environment variable
 */
export function isModerator(env: Env, userId: string): boolean {
  // BUG-073 (2026-07-18 audit): shared grammar (whitespace/comma separators +
  // snowflake validation) — the old comma-only split silently failed closed
  // for newline-separated secrets that moderation-worker accepts
  return isModeratorId(env.MODERATOR_IDS, userId);
}

// ============================================================================
// Preset Functions
// ============================================================================

/**
 * Get a paginated list of presets with optional filtering
 */
export async function getPresets(
  env: Env,
  filters: PresetFilters = {},
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
 *
 * @returns Preset or null if not found
 */
export async function getPreset(env: Env, id: string): Promise<CommunityPreset | null> {
  try {
    return await request<CommunityPreset>(env, 'GET', `/api/v1/presets/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof PresetAPIError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Search for a preset by name
 *
 * @returns First matching preset or null if not found
 */
export async function getPresetByName(env: Env, name: string): Promise<CommunityPreset | null> {
  // BUG-034 (2026-07-18 audit): fetch a full page — limit 1 returned only the
  // search-RANKED top hit, making an exact-named preset unreachable whenever
  // a partial match ranked higher
  const response = await getPresets(env, {
    search: name,
    status: 'approved',
    limit: 25,
  });

  // Find exact match first, then partial match
  const exactMatch = response.presets.find((p) => p.name.toLowerCase() === name.toLowerCase());
  return exactMatch || response.presets[0] || null;
}

/**
 * Get a random preset, optionally filtered by category
 */
export async function getRandomPreset(
  env: Env,
  category?: string,
): Promise<CommunityPreset | null> {
  const filters: PresetFilters = {
    status: 'approved',
    limit: 50, // Get a pool of presets
  };

  if (category) {
    filters.category = category as PresetFilters['category'];
  }

  const response = await getPresets(env, filters);

  if (response.presets.length === 0) {
    return null;
  }

  // Pick a random one from the pool
  const randomIndex = Math.floor(Math.random() * response.presets.length);
  return response.presets[randomIndex];
}

/**
 * Submit a new preset
 */
export async function submitPreset(
  env: Env,
  submission: PresetSubmission,
  userDiscordId: string,
  userName: string,
): Promise<PresetSubmitResponse> {
  return request<PresetSubmitResponse>(env, 'POST', '/api/v1/presets', {
    body: submission,
    userDiscordId,
    userName,
  });
}

/**
 * Get all presets owned by a user
 *
 * Returns presets in all statuses (pending, approved, rejected)
 * Sorted by creation date (newest first)
 */
export async function getMyPresets(env: Env, userDiscordId: string): Promise<CommunityPreset[]> {
  const response = await request<{ presets: CommunityPreset[]; total: number }>(
    env,
    'GET',
    '/api/v1/presets/mine',
    { userDiscordId },
  );
  return response.presets;
}

/**
 * Edit a preset (owner only)
 *
 * If name/description changes trigger content moderation and content is flagged,
 * the preset will be set to 'pending' status with previous values stored for revert.
 *
 * @returns Edit response with updated preset and moderation status
 * @throws PresetAPIError with status 409 if dye combination is duplicate
 */
export async function editPreset(
  env: Env,
  presetId: string,
  updates: PresetEditRequest,
  userDiscordId: string,
  userName: string,
): Promise<PresetEditResponse> {
  return request<PresetEditResponse>(env, 'PATCH', `/api/v1/presets/${encodeURIComponent(presetId)}`, {
    body: updates,
    userDiscordId,
    userName,
  });
}

// ============================================================================
// Vote Functions
// ============================================================================

/**
 * Add a vote to a preset
 */
export async function voteForPreset(
  env: Env,
  presetId: string,
  userDiscordId: string,
): Promise<VoteResponse> {
  return request<VoteResponse>(env, 'POST', `/api/v1/votes/${encodeURIComponent(presetId)}`, {
    userDiscordId,
  });
}

/**
 * Remove a vote from a preset
 */
export async function removeVote(
  env: Env,
  presetId: string,
  userDiscordId: string,
): Promise<VoteResponse> {
  return request<VoteResponse>(env, 'DELETE', `/api/v1/votes/${encodeURIComponent(presetId)}`, {
    userDiscordId,
  });
}

/**
 * Check if a user has voted for a preset
 */
export async function hasVoted(
  env: Env,
  presetId: string,
  userDiscordId: string,
  logger?: ExtendedLogger,
): Promise<boolean> {
  try {
    const response = await request<{ has_voted: boolean }>(
      env,
      'GET',
      `/api/v1/votes/${encodeURIComponent(presetId)}/check`,
      { userDiscordId, logger },
    );
    return response.has_voted;
  } catch (error) {
    // If check fails, assume not voted
    if (logger) {
      logger.error('Failed to check vote status', error instanceof Error ? error : undefined);
    }
    return false;
  }
}

/**
 * Result of a preview-image moderation action.
 * Mirrors presets-api's PATCH /api/v1/moderation/:presetId/preview-image contract.
 */
export interface PreviewImageModerationResult {
  success: boolean;
  preview_image_status: 'approved' | 'none';
}

/**
 * Approve or reject a preset's pending preview image (moderators only).
 *
 * Rejecting deletes the image and resets its status to 'none' — it does NOT
 * touch the preset's own status (a bad picture is not a bad palette).
 *
 * SECURITY: `moderatorId`/`moderatorName` must be the CLICKING user's Discord
 * identity, not the bot's — presets-api authorises the moderator from the
 * bot-auth headers these populate.
 */
export async function setPreviewImageStatus(
  env: Env,
  presetId: string,
  action: 'approve' | 'reject',
  moderatorId: string,
  moderatorName?: string,
): Promise<PreviewImageModerationResult> {
  return request<PreviewImageModerationResult>(
    env,
    'PATCH',
    `/api/v1/moderation/${encodeURIComponent(presetId)}/preview-image`,
    {
      body: { action },
      userDiscordId: moderatorId,
      userName: moderatorName,
    },
  );
}

// ============================================================================
// Autocomplete Helpers
// ============================================================================

/**
 * Search presets for autocomplete suggestions
 *
 * @param env - Environment bindings
 * @param query - Search query
 * @param options - Additional options
 * @returns Array of autocomplete choices
 */
export async function searchPresetsForAutocomplete(
  env: Env,
  query: string,
  options: {
    status?: 'approved' | 'pending';
    limit?: number;
    logger?: ExtendedLogger;
  } = {},
): Promise<Array<{ name: string; value: string }>> {
  try {
    const filters: PresetFilters = {
      status: options.status || 'approved',
      limit: options.limit || 25,
    };

    if (query.length > 0) {
      filters.search = query;
    } else {
      // Show popular presets when no query
      filters.sort = 'popular';
    }

    const response = await getPresets(env, filters);

    return response.presets.map((preset) => ({
      // Format: "Name (X★)" or "Name (X★) by Author"
      name: preset.author_name
        ? `${preset.name} (${preset.vote_count}★) by ${preset.author_name}`
        : `${preset.name} (${preset.vote_count}★)`,
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
