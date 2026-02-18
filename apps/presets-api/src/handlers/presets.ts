/**
 * Presets Handler
 * Routes for preset listing, retrieval, and submission
 */

import { Hono } from 'hono';
import type { Env, AuthContext, PresetFilters, PresetSubmission, PresetEditRequest, PresetPreviousValues } from '../types.js';
import { requireAuth, requireUserContext } from '../middleware/auth.js';
import { requireNotBannedCheck } from '../middleware/ban-check.js';
import {
  ErrorCode,
  errorResponse,
  invalidJsonResponse,
  validationErrorResponse,
  forbiddenResponse,
  notFoundResponse,
  internalErrorResponse,
} from '../utils/api-response.js';
import {
  getPresets,
  getFeaturedPresets,
  getPresetById,
  getPresetsByUser,
  findDuplicatePreset,
  findDuplicatePresetExcluding,
  createPreset,
  updatePreset,
} from '../services/preset-service.js';
import { moderateContent } from '../services/moderation-service.js';
// PRESETS-REF-001 FIX: Import from centralized validation service
import {
  validatePresetName,
  validatePresetDescription,
  validatePresetDyes,
  validatePresetTags,
} from '../services/validation-service.js';
import { addVote } from './votes.js';
import { checkSubmissionRateLimit, getRemainingSubmissions } from '../services/rate-limit-service.js';

type Variables = {
  auth: AuthContext;
};

export const presetsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * GET /api/v1/presets
 * List presets with filtering and pagination
 */
presetsRouter.get('/', async (c) => {
  const { category, search, status, sort, page, limit, is_curated } = c.req.query();

  const filters: PresetFilters = {
    category: category as PresetFilters['category'],
    search,
    status: status as PresetFilters['status'],
    sort: sort as PresetFilters['sort'],
    page: page ? parseInt(page, 10) : undefined,
    limit: limit ? Math.min(parseInt(limit, 10), 50) : undefined, // Cap at 50 for performance
    is_curated: is_curated === 'true' ? true : is_curated === 'false' ? false : undefined,
  };

  const response = await getPresets(c.env.DB, filters);
  return c.json(response);
});

/**
 * GET /api/v1/presets/featured
 * Get top-voted presets for homepage display
 */
presetsRouter.get('/featured', async (c) => {
  const presets = await getFeaturedPresets(c.env.DB);
  return c.json({ presets });
});

// ============================================
// AUTHENTICATED ENDPOINTS
// ============================================

/**
 * GET /api/v1/presets/mine
 * Get the current user's submitted presets (all statuses)
 */
presetsRouter.get('/mine', async (c) => {
  // Require authentication
  const authError = requireAuth(c);
  if (authError) return authError;

  // Require user context
  const userError = requireUserContext(c);
  if (userError) return userError;

  const auth = c.get('auth');

  const presets = await getPresetsByUser(c.env.DB, auth.userDiscordId!);

  return c.json({
    presets,
    total: presets.length,
  });
});

/**
 * GET /api/v1/presets/rate-limit
 * Get remaining submissions for the authenticated user today
 */
presetsRouter.get('/rate-limit', async (c) => {
  // Require authentication
  const authError = requireAuth(c);
  if (authError) return authError;

  // Require user context
  const userError = requireUserContext(c);
  if (userError) return userError;

  const auth = c.get('auth');

  const { remaining, resetAt } = await getRemainingSubmissions(c.env.DB, auth.userDiscordId!);

  return c.json({
    remaining,
    limit: 10,
    reset_at: resetAt.toISOString(),
  });
});

/**
 * PATCH /api/v1/presets/refresh-author
 * Update all presets by the authenticated user to use their current display name
 * Called automatically on web app login to keep author names in sync with Discord
 */
presetsRouter.patch('/refresh-author', async (c) => {
  // Require authentication
  const authError = requireAuth(c);
  if (authError) return authError;

  // Require user context
  const userError = requireUserContext(c);
  if (userError) return userError;

  const auth = c.get('auth');

  // Guard against undefined userDiscordId (defensive coding)
  if (!auth.userDiscordId) {
    return validationErrorResponse(c, 'User ID required for author refresh');
  }

  // Update all presets by this user to use their current display name
  const result = await c.env.DB.prepare(`
    UPDATE presets
    SET author_name = ?
    WHERE author_discord_id = ?
  `)
    .bind(auth.userName, auth.userDiscordId)
    .run();

  return c.json({
    success: true,
    updated: result.meta.changes,
  });
});

// ============================================
// DYNAMIC ID ROUTES (must be after specific routes)
// ============================================

/**
 * DELETE /api/v1/presets/:id
 * Delete a preset (owner or moderator only)
 */
presetsRouter.delete('/:id', async (c) => {
  // Require authentication
  const authError = requireAuth(c);
  if (authError) return authError;

  // Require user context
  const userError = requireUserContext(c);
  if (userError) return userError;

  const auth = c.get('auth');
  const id = c.req.param('id');

  // Get preset to check ownership
  const preset = await getPresetById(c.env.DB, id);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  // Only owner or moderator can delete
  if (preset.author_discord_id !== auth.userDiscordId && !auth.isModerator) {
    return forbiddenResponse(c, "Cannot delete another user's preset");
  }

  // Delete votes and preset in transaction
  // PRESETS-PERF-001: Using batch() for atomicity guarantee, not performance.
  // D1 batch() ensures both deletes succeed or both fail.
  // For 2 queries, overhead is negligible vs. transaction safety benefit.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM votes WHERE preset_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM presets WHERE id = ?').bind(id),
  ]);

  return c.json({ success: true, message: 'Preset deleted' });
});

/**
 * PATCH /api/v1/presets/:id
 * Edit a preset (owner only)
 */
presetsRouter.patch('/:id', async (c) => {
  // Require authentication
  const authError = requireAuth(c);
  if (authError) return authError;

  // Require user context
  const userError = requireUserContext(c);
  if (userError) return userError;

  // Check if user is banned
  const banError = await requireNotBannedCheck(c);
  if (banError) return banError;

  const auth = c.get('auth');
  const id = c.req.param('id');

  // Get preset to check ownership
  const preset = await getPresetById(c.env.DB, id);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  // Only owner can edit (moderators cannot edit others' presets)
  if (preset.author_discord_id !== auth.userDiscordId) {
    return forbiddenResponse(c, 'You can only edit your own presets');
  }

  // Parse request body
  let body: PresetEditRequest;
  try {
    body = await c.req.json<PresetEditRequest>();
  } catch {
    return invalidJsonResponse(c);
  }

  // Check if any updates provided
  if (!body.name && !body.description && !body.dyes && !body.tags) {
    return validationErrorResponse(c, 'No updates provided');
  }

  // Validate provided fields
  const validationError = validateEditRequest(body);
  if (validationError) {
    return validationErrorResponse(c, validationError);
  }

  // If dyes are being changed, check for duplicates (excluding this preset)
  if (body.dyes) {
    const duplicate = await findDuplicatePresetExcluding(c.env.DB, body.dyes, id);
    if (duplicate) {
      return c.json(
        {
          success: false,
          error: ErrorCode.DUPLICATE_RESOURCE,
          message: 'This dye combination already exists',
          duplicate: {
            id: duplicate.id,
            name: duplicate.name,
            author_name: duplicate.author_name,
          },
        },
        409
      );
    }
  }

  // Determine if content moderation is needed (name or description changed)
  // PRESETS-BUG-003: Vote counts are preserved during edits - this is intentional
  // as users voted on the dye combination, not just the name/description.
  let moderationStatus: 'approved' | 'pending' = 'approved';
  let previousValues: PresetPreviousValues | null | undefined;

  if (body.name || body.description) {
    // Run content moderation on new values
    const nameToCheck = body.name || preset.name;
    const descriptionToCheck = body.description || preset.description;

    const moderationResult = await moderateContent(
      nameToCheck,
      descriptionToCheck,
      c.env
    );

    if (!moderationResult.passed) {
      // Store previous values for potential revert
      previousValues = {
        name: preset.name,
        description: preset.description,
        tags: preset.tags,
        dyes: preset.dyes,
      };
      moderationStatus = 'pending';
    }
    // PRESETS-CRITICAL-004: Do NOT clear previous_values when moderation passes
    // Keep the audit trail of previously-flagged content for compliance and pattern detection
    // The previous_values field now serves as an append-only audit log
    // If moderationResult.passed is true, we simply don't update previousValues,
    // preserving any existing audit history
  }

  // Update the preset
  // PRESETS-BUG-002: Always pass moderation status so that presets
  // previously flagged can be un-flagged when the user fixes the content
  const updatedPreset = await updatePreset(
    c.env.DB,
    id,
    body,
    previousValues,
    moderationStatus
  );

  if (!updatedPreset) {
    return internalErrorResponse(c, 'Failed to update preset');
  }

  // If flagged, notify Discord for moderation
  // PRESETS-REF-002: Fire-and-forget notification - errors don't fail the request
  // but are logged with preset context for debugging
  if (moderationStatus === 'pending') {
    c.executionCtx.waitUntil(
      notifyDiscordBot(c.env, {
        type: 'submission',
        preset: {
          ...updatedPreset,
          author_name: preset.author_name || 'Unknown User',
          author_discord_id: preset.author_discord_id,
          status: 'pending',
          moderation_status: 'flagged',
          source: auth.authSource,
        },
      }).catch((err) => {
        // Log with context for easier debugging
        console.error(`[PRESETS-REF-002] Discord notification failed for preset edit: id=${updatedPreset.id}, name="${updatedPreset.name}"`, err);
      })
    );
  }

  return c.json({
    success: true,
    preset: updatedPreset,
    moderation_status: moderationStatus,
  });
});

/**
 * GET /api/v1/presets/:id
 * Get a single preset by ID
 */
presetsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const preset = await getPresetById(c.env.DB, id);

  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  return c.json(preset);
});

/**
 * POST /api/v1/presets
 * Submit a new preset
 */
presetsRouter.post('/', async (c) => {
  // Require authentication
  const authError = requireAuth(c);
  if (authError) return authError;

  // Require user context
  const userError = requireUserContext(c);
  if (userError) return userError;

  // Check if user is banned
  const banError = await requireNotBannedCheck(c);
  if (banError) return banError;

  const auth = c.get('auth');

  // Check rate limit (10 submissions per day)
  const rateLimitResult = await checkSubmissionRateLimit(c.env.DB, auth.userDiscordId!);
  if (!rateLimitResult.allowed) {
    return c.json(
      {
        success: false,
        error: ErrorCode.RATE_LIMITED,
        message: `You've reached your daily submission limit (10 per day). Try again tomorrow.`,
        remaining: 0,
        reset_at: rateLimitResult.resetAt.toISOString(),
      },
      429
    );
  }

  // Parse request body
  let body: PresetSubmission;
  try {
    body = await c.req.json<PresetSubmission>();
  } catch {
    return invalidJsonResponse(c);
  }

  // Validate submission (PRESETS-CRITICAL-002: now queries categories from database)
  const validationError = await validateSubmission(body, c.env.DB);
  if (validationError) {
    return validationErrorResponse(c, validationError);
  }

  // Check for duplicate dye combinations
  const duplicate = await findDuplicatePreset(c.env.DB, body.dyes);
  if (duplicate) {
    // Add vote to existing preset
    const voteResult = await addVote(c.env.DB, duplicate.id, auth.userDiscordId!);

    return c.json({
      success: true,
      duplicate,
      vote_added: voteResult.success && !voteResult.already_voted,
    });
  }

  // Moderate content
  const moderationResult = await moderateContent(
    body.name,
    body.description,
    c.env
  );

  // Determine status based on moderation
  const status = moderationResult.passed ? 'approved' : 'pending';

  // PRESETS-CRITICAL-001: Handle race condition in duplicate detection
  // Wrap createPreset in try-catch to handle UNIQUE constraint violations
  // If another request created the same preset while we were checking, we'll catch
  // the constraint violation and vote on that preset instead
  let preset;
  try {
    preset = await createPreset(
      c.env.DB,
      body,
      auth.userDiscordId!,
      auth.userName || 'Unknown User',
      status
    );
  } catch (error) {
    // Check if this is a UNIQUE constraint violation on dye_signature
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('UNIQUE constraint failed') && errorMessage.includes('dye_signature')) {
      // Race condition occurred - another request created this preset first
      // Try to find and vote on the existing preset
      const existingPreset = await findDuplicatePreset(c.env.DB, body.dyes);
      if (existingPreset) {
        const voteResult = await addVote(c.env.DB, existingPreset.id, auth.userDiscordId!);
        return c.json({
          success: true,
          duplicate: existingPreset,
          vote_added: voteResult.success && !voteResult.already_voted,
        });
      }
    }
    // Re-throw if it's not a duplicate constraint error
    throw error;
  }

  // Auto-vote for own preset
  await addVote(c.env.DB, preset.id, auth.userDiscordId!);

  // Send notification to Discord worker (non-blocking)
  // PRESETS-REF-002: Fire-and-forget notification - errors don't fail the request
  // Use waitUntil to keep the worker alive while notification completes
  c.executionCtx.waitUntil(
    notifyDiscordBot(c.env, {
      type: 'submission',
      preset: {
        ...preset,
        author_name: auth.userName?.trim() || 'Unknown User', // PRESETS-HIGH-002
        author_discord_id: auth.userDiscordId!,
        status,
        moderation_status: moderationResult.passed ? 'clean' : 'flagged',
        source: auth.authSource,
      },
    }).catch((err) => {
      // Log with context for easier debugging
      console.error(`[PRESETS-REF-002] Discord notification failed for new preset: id=${preset.id}, name="${preset.name}"`, err);
    })
  );

  // Get updated rate limit info
  const { remaining } = await getRemainingSubmissions(c.env.DB, auth.userDiscordId!);

  return c.json(
    {
      success: true,
      preset,
      moderation_status: status,
      remaining_submissions: remaining,
    },
    201
  );
});

// ============================================
// VALIDATION HELPERS
// ============================================

// PRESETS-CRITICAL-002: Cache valid categories from database
// Categories are cached at module level and refreshed periodically
let cachedCategories: string[] | null = null;
let categoryCacheTime = 0;
const CATEGORY_CACHE_TTL = 60000; // 1 minute

/**
 * Reset the category cache (exported for testing)
 */
export function resetCategoryCache(): void {
  cachedCategories = null;
  categoryCacheTime = 0;
}

/**
 * Get valid category IDs from database with caching
 * This replaces the hardcoded VALID_CATEGORIES array
 */
async function getValidCategories(db: D1Database): Promise<string[]> {
  const now = Date.now();

  // Return cached categories if still valid
  if (cachedCategories && now - categoryCacheTime < CATEGORY_CACHE_TTL) {
    return cachedCategories;
  }

  // Query database for valid category IDs
  const result = await db.prepare('SELECT id FROM categories').all<{ id: string }>();
  cachedCategories = (result.results || []).map(row => row.id);
  categoryCacheTime = now;

  return cachedCategories;
}

/**
 * Validate preset submission (all fields required)
 * PRESETS-REF-001 FIX: Uses centralized validators from validation-service
 */
async function validateSubmission(body: PresetSubmission, db: D1Database): Promise<string | null> {
  // All fields required for creation
  if (!body.name) return 'Name is required';
  const nameError = validatePresetName(body.name);
  if (nameError) return nameError;

  if (!body.description) return 'Description is required';
  const descError = validatePresetDescription(body.description);
  if (descError) return descError;

  // PRESETS-CRITICAL-002: Validate category against database
  if (!body.category_id) return 'Category is required';
  const validCategories = await getValidCategories(db);
  if (!validCategories.includes(body.category_id)) {
    return 'Invalid category';
  }

  const dyesError = validatePresetDyes(body.dyes);
  if (dyesError) return dyesError;

  const tagsError = validatePresetTags(body.tags);
  if (tagsError) return tagsError;

  return null;
}

/**
 * Validate preset edit request (all fields optional)
 * PRESETS-REF-001 FIX: Uses centralized validators from validation-service
 */
function validateEditRequest(body: PresetEditRequest): string | null {
  // All fields optional for edit, but validate if provided
  if (body.name !== undefined) {
    const nameError = validatePresetName(body.name);
    if (nameError) return nameError;
  }

  if (body.description !== undefined) {
    const descError = validatePresetDescription(body.description);
    if (descError) return descError;
  }

  if (body.dyes !== undefined) {
    const dyesError = validatePresetDyes(body.dyes);
    if (dyesError) return dyesError;
  }

  if (body.tags !== undefined) {
    const tagsError = validatePresetTags(body.tags);
    if (tagsError) return tagsError;
  }

  return null;
}

// ============================================
// DISCORD BOT NOTIFICATION
// ============================================

interface PresetNotificationPayload {
  type: 'submission';
  preset: {
    id: string;
    name: string;
    description: string;
    category_id: string;
    dyes: number[];
    tags: string[];
    author_name: string;
    author_discord_id: string;
    status: 'pending' | 'approved' | 'rejected';
    moderation_status: 'clean' | 'flagged' | 'auto_approved';
    source: 'bot' | 'web' | 'none';
    created_at: string;
  };
}

/**
 * PRESETS-CRITICAL-003: Retry configuration for Discord notifications
 */
const NOTIFICATION_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attempt: number): number {
  const delay = Math.min(
    NOTIFICATION_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
    NOTIFICATION_RETRY_CONFIG.maxDelayMs
  );
  // Add jitter (±25%) to prevent thundering herd
  return delay * (0.75 + Math.random() * 0.5);
}

/**
 * Notify the Discord worker about a new preset submission
 * Uses Cloudflare Service Binding for Worker-to-Worker communication (avoids error 1042)
 *
 * PRESETS-CRITICAL-003: Now includes retry with exponential backoff
 * Retries up to 3 times on transient failures
 */
async function notifyDiscordBot(env: Env, payload: PresetNotificationPayload): Promise<void> {
  // Check if service binding is configured
  if (!env.DISCORD_WORKER || !env.INTERNAL_WEBHOOK_SECRET) {
    console.log('Discord worker binding not configured, skipping notification');
    return;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= NOTIFICATION_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Use service binding for direct Worker-to-Worker communication
      // The hostname is ignored - only the path matters
      const response = await env.DISCORD_WORKER.fetch(
        new Request('https://internal/webhooks/preset-submission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.INTERNAL_WEBHOOK_SECRET}`,
          },
          body: JSON.stringify(payload),
        })
      );

      if (response.ok) {
        if (attempt > 0) {
          console.log(`Discord notification succeeded on retry ${attempt}`);
        }
        return; // Success!
      }

      // Non-retryable errors (4xx client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Discord worker returned ${response.status}: ${await response.text()}`);
      }

      // Server error - will retry
      lastError = new Error(`Discord worker returned ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-network errors
      if (lastError.message.includes('returned 4')) {
        throw lastError;
      }
    }

    // If we have more retries, wait before trying again
    if (attempt < NOTIFICATION_RETRY_CONFIG.maxRetries) {
      const delay = getBackoffDelay(attempt);
      console.log(`Discord notification failed, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${NOTIFICATION_RETRY_CONFIG.maxRetries})`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError || new Error('Discord notification failed after all retries');
}
