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
  validateExampleLink,
  normalizeExampleLink,
} from '../services/validation-service.js';
import { addVote } from './votes.js';
import {
  checkSubmissionRateLimit,
  getRemainingSubmissions,
  getSubmissionCountToday,
  getNextResetUTC,
  DAILY_SUBMISSION_LIMIT,
} from '../services/rate-limit-service.js';
import {
  notifyDiscordBot,
  storeFailedNotification,
  type PresetNotificationPayload,
} from '../services/notification-service.js';
import { getValidCategories } from '../services/category-service.js';
import {
  sniffImageType,
  storePreviewImage,
  deletePreviewImage,
  getPresetImageState,
  MAX_PREVIEW_IMAGE_BYTES,
} from '../services/preview-image-service.js';

// REFACTOR-017: category cache moved to category-service; re-exported because
// tests (and any external callers) reach it through this module
export { resetCategoryCache } from '../services/category-service.js';

type Variables = {
  auth: AuthContext;
};

export const presetsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// BUG-014/015 (2026-07-18 audit): statuses anonymous callers may list, and the
// helper that keeps the previous_values audit snapshot out of public responses.
const MODERATOR_STATUSES: readonly string[] = ['pending', 'approved', 'rejected', 'flagged'];

function stripAuditData<T extends { previous_values?: unknown }>(preset: T): Omit<T, 'previous_values'> {
  const publicPreset = { ...preset };
  delete publicPreset.previous_values;
  return publicPreset;
}

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * GET /api/v1/presets
 * List presets with filtering and pagination
 */
presetsRouter.get('/', async (c) => {
  const { category, search, status, sort, page, limit, is_curated } = c.req.query();
  const auth = c.get('auth');

  // BUG-015 (2026-07-18 audit): the moderation queue must not be publicly
  // listable. Only moderators may filter by non-approved statuses; unknown
  // values are rejected instead of silently returning an empty list.
  if (status && !MODERATOR_STATUSES.includes(status)) {
    return validationErrorResponse(c, 'Invalid status filter');
  }
  if (status && status !== 'approved' && !auth.isModerator) {
    return forbiddenResponse(c, 'Only moderators can filter by non-approved status');
  }

  const filters: PresetFilters = {
    category: category as PresetFilters['category'],
    search,
    status: status as PresetFilters['status'],
    sort: sort as PresetFilters['sort'],
    // BUG-016 (2026-07-18 audit): clamp pagination — a NaN bind is rejected by
    // D1 as a 500, and SQLite treats LIMIT -1 as "no limit", bypassing the cap.
    page: Math.max(1, Number.parseInt(page ?? '', 10) || 1),
    limit: Math.min(Math.max(1, Number.parseInt(limit ?? '', 10) || 20), 50), // Cap at 50 for performance
    is_curated: is_curated === 'true' ? true : is_curated === 'false' ? false : undefined,
  };

  const response = await getPresets(c.env.DB, filters, c.get('logger'));
  if (!auth.isModerator) {
    return c.json({ ...response, presets: response.presets.map(stripAuditData) });
  }
  return c.json(response);
});

/**
 * GET /api/v1/presets/featured
 * Get top-voted presets for homepage display
 */
presetsRouter.get('/featured', async (c) => {
  const presets = await getFeaturedPresets(c.env.DB, c.get('logger'));
  // BUG-014 (2026-07-18 audit): keep audit snapshots out of public responses
  return c.json({ presets: presets.map(stripAuditData) });
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

  const presets = await getPresetsByUser(c.env.DB, auth.userDiscordId!, c.get('logger'));

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

  // One row read answers both questions this handler has: who owns the preset,
  // and which R2 object belongs to it. getPresetById returns a CommunityPreset,
  // which deliberately hides preview_image_key, so it cannot answer the second
  // — reading the row directly avoids a second SELECT for the same row.
  const preset = await getPresetImageState(c.env.DB, id);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  // Only owner or moderator can delete
  if (preset.author_discord_id !== auth.userDiscordId && !auth.isModerator) {
    return forbiddenResponse(c, "Cannot delete another user's preset");
  }

  // Captured before the batch, since the row that holds it is about to go.
  const previousKey = preset.preview_image_key;

  // Delete votes and preset in transaction
  // PRESETS-PERF-001: Using batch() for atomicity guarantee, not performance.
  // D1 batch() ensures both deletes succeed or both fail.
  // For 2 queries, overhead is negligible vs. transaction safety benefit.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM votes WHERE preset_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM presets WHERE id = ?').bind(id),
  ]);

  // DB write before the R2 delete, deliberately (same rule as the upload and
  // moderator-reject paths): if the batch throws, leaving the delete undone
  // just orphans the object in R2 — invisible and cheap to clean up later.
  // Delete first would risk the opposite: a row still pointing at a key that
  // no longer exists, so an approved preset's card serves a broken image.
  // Never trade a broken live image for a tidy bucket.
  //
  // The row is already gone by this point, so an R2 hiccup here must not turn
  // a completed delete into a 500 the caller would reasonably retry.
  try {
    await deletePreviewImage(c.env, previousKey);
  } catch (err) {
    console.error(`[preview-image] R2 delete failed after preset delete: id=${id}`, err);
  }

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
  if (
    !body.name &&
    !body.description &&
    !body.dyes &&
    !body.tags &&
    body.example_link === undefined
  ) {
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

  // BUG-001 (2026-07-18 audit): an owner edit must never lift a moderator-set
  // status. Hidden presets cannot be resurfaced by editing at all; a preset
  // that is pending/rejected/flagged stays in (or returns to) the moderation
  // queue. Only a currently-approved preset may remain approved after an edit.
  if (preset.status === 'hidden') {
    return forbiddenResponse(c, 'This preset cannot be edited');
  }

  // Determine if content moderation is needed (name or description changed)
  // PRESETS-BUG-003: Vote counts are preserved during edits - this is intentional
  // as users voted on the dye combination, not just the name/description.
  let moderationStatus: 'approved' | 'pending' =
    preset.status === 'approved' ? 'approved' : 'pending';
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
      // BUG-052 (2026-07-18 audit): write-once snapshot — only capture
      // previous_values when none exists yet, so successive flagged edits
      // can't overwrite the oldest known-good state (the revert target).
      if (!preset.previous_values) {
        previousValues = {
          name: preset.name,
          description: preset.description,
          tags: preset.tags,
          dyes: preset.dyes,
        };
      }
      moderationStatus = 'pending';
    }
    // PRESETS-CRITICAL-004: Do NOT clear previous_values when moderation passes.
    // previous_values holds the oldest clean snapshot (last-known-good for
    // moderator revert), not an append-only history — leaving previousValues
    // undefined here preserves whatever snapshot already exists.
  }

  // Update the preset
  // PRESETS-BUG-002: Always pass moderation status so that presets
  // previously flagged can be un-flagged when the user fixes the content
  let updatedPreset;
  try {
    updatedPreset = await updatePreset(
      c.env.DB,
      id,
      body,
      previousValues,
      moderationStatus
    );
  } catch (error) {
    // BUG-003 (2026-07-18 audit): the duplicate pre-check races with concurrent
    // writers — recover from the UNIQUE dye_signature violation as a 409
    // instead of an unhandled 500
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('UNIQUE constraint failed') && errorMessage.includes('dye_signature')) {
      const duplicate = body.dyes
        ? await findDuplicatePresetExcluding(c.env.DB, body.dyes, id)
        : null;
      return c.json(
        {
          success: false,
          error: ErrorCode.DUPLICATE_RESOURCE,
          message: 'This dye combination already exists',
          ...(duplicate && {
            duplicate: {
              id: duplicate.id,
              name: duplicate.name,
              author_name: duplicate.author_name,
            },
          }),
        },
        409
      );
    }
    throw error;
  }

  if (!updatedPreset) {
    return internalErrorResponse(c, 'Failed to update preset');
  }

  // If flagged, notify Discord for moderation
  // PRESETS-REF-002: Fire-and-forget notification - errors don't fail the request
  // but are logged with preset context for debugging
  if (moderationStatus === 'pending') {
    const editPayload: PresetNotificationPayload = {
      type: 'submission',
      preset: {
        ...updatedPreset,
        author_name: preset.author_name || 'Unknown User',
        author_discord_id: preset.author_discord_id,
        status: 'pending',
        moderation_status: 'flagged',
        source: auth.authSource,
      },
    };
    c.executionCtx.waitUntil(
      notifyDiscordBot(c.env, editPayload).catch(async (err) => {
        console.error(`[PRESETS-REF-002] Discord notification failed for preset edit: id=${updatedPreset.id}, name="${updatedPreset.name}"`, err);
        // BUG-015: Persist failed notification for moderator review
        await storeFailedNotification(c.env.DB, editPayload, err);
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

  // BUG-014 (2026-07-18 audit): non-approved presets (hidden/pending/rejected/
  // flagged) are only visible to their owner or a moderator; everyone else gets
  // the same 404 as a nonexistent ID so hidden content can't be probed. The
  // previous_values audit snapshot is likewise privileged-only.
  const auth = c.get('auth');
  const isPrivileged =
    auth.isModerator ||
    (auth.userDiscordId !== undefined && preset.author_discord_id === auth.userDiscordId);
  if (preset.status !== 'approved' && !isPrivileged) {
    return notFoundResponse(c, 'Preset');
  }

  return c.json(isPrivileged ? preset : stripAuditData(preset));
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

  // BUG-049 (2026-07-18 audit): the pre-check above is check-then-insert, so N
  // concurrent submissions at 9/10 quota could all pass. Re-count now that our
  // INSERT landed — the count includes it, so anything over the limit means
  // concurrent requests overshot and this one rolls itself back.
  // OPT-016: this same count replaces the old getRemainingSubmissions re-query,
  // so the happy path still issues one post-create COUNT, now load-bearing.
  const submissionsToday = await getSubmissionCountToday(c.env.DB, auth.userDiscordId!);
  if (submissionsToday > DAILY_SUBMISSION_LIMIT) {
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM votes WHERE preset_id = ?').bind(preset.id),
      c.env.DB.prepare('DELETE FROM presets WHERE id = ?').bind(preset.id),
    ]);
    return c.json(
      {
        success: false,
        error: ErrorCode.RATE_LIMITED,
        message: `You've reached your daily submission limit (10 per day). Try again tomorrow.`,
        remaining: 0,
        reset_at: getNextResetUTC().toISOString(),
      },
      429
    );
  }

  // Send notification to Discord worker (non-blocking)
  // PRESETS-REF-002: Fire-and-forget notification - errors don't fail the request
  // Use waitUntil to keep the worker alive while notification completes
  const submissionPayload: PresetNotificationPayload = {
    type: 'submission',
    preset: {
      ...preset,
      author_name: auth.userName?.trim() || 'Unknown User', // PRESETS-HIGH-002
      author_discord_id: auth.userDiscordId!,
      status,
      moderation_status: moderationResult.passed ? 'clean' : 'flagged',
      source: auth.authSource,
    },
  };
  c.executionCtx.waitUntil(
    notifyDiscordBot(c.env, submissionPayload).catch(async (err) => {
      console.error(`[PRESETS-REF-002] Discord notification failed for new preset: id=${preset.id}, name="${preset.name}"`, err);
      // BUG-015: Persist failed notification for moderator review
      await storeFailedNotification(c.env.DB, submissionPayload, err);
    })
  );

  return c.json(
    {
      success: true,
      preset,
      moderation_status: status,
      // OPT-016: derived from the enforcement count above — no extra query
      remaining_submissions: Math.max(0, DAILY_SUBMISSION_LIMIT - submissionsToday),
    },
    201
  );
});

/**
 * POST /:id/preview-image — the author uploads their card picture.
 *
 * Author-only: a preset's picture is the author's to choose. The upload lands
 * as 'pending' and is invisible until a moderator approves it.
 */
presetsRouter.post('/:id/preview-image', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const userError = requireUserContext(c);
  if (userError) return userError;

  const banError = await requireNotBannedCheck(c);
  if (banError) return banError;

  const auth = c.get('auth');
  const presetId = c.req.param('id');

  // Row-level read: we need preview_image_key, which CommunityPreset hides.
  const preset = await getPresetImageState(c.env.DB, presetId);
  if (!preset) {
    return c.json(
      { success: false, error: ErrorCode.NOT_FOUND, message: 'Preset not found' },
      404
    );
  }

  if (preset.author_discord_id !== auth.userDiscordId) {
    return c.json(
      {
        success: false,
        error: ErrorCode.FORBIDDEN,
        message: 'Only the author can set a preview image',
      },
      403
    );
  }

  const bytes = new Uint8Array(await c.req.arrayBuffer());

  if (bytes.byteLength === 0) {
    return c.json(
      { success: false, error: ErrorCode.VALIDATION_ERROR, message: 'No image data provided' },
      400
    );
  }

  if (bytes.byteLength > MAX_PREVIEW_IMAGE_BYTES) {
    return c.json(
      {
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: 'Image must be at most 5 MB',
      },
      400
    );
  }

  if (!sniffImageType(bytes)) {
    return c.json(
      {
        success: false,
        error: ErrorCode.VALIDATION_ERROR,
        message: 'Image must be a PNG, JPEG or WebP',
      },
      400
    );
  }

  let key: string;
  try {
    key = await storePreviewImage(c.env, presetId, bytes);
  } catch {
    return c.json(
      { success: false, error: ErrorCode.VALIDATION_ERROR, message: 'Image could not be processed' },
      400
    );
  }

  // Capture the OLD key before the UPDATE overwrites it, so the delete below
  // can never target the object we just wrote.
  const previousKey = preset.preview_image_key;

  // DB UPDATE before the old-object delete, deliberately: if the UPDATE
  // throws, leaving the delete undone just orphans the old object in R2
  // (invisible, negligible cost, cleanable later). Doing it the other way
  // round — delete then UPDATE — risks the opposite failure: a row left
  // pointing at a key that no longer exists, so an approved preset's card
  // starts 404ing on every view. Never trade a broken live image for a tidy
  // bucket.
  await c.env.DB.prepare(
    `UPDATE presets SET preview_image_key = ?, preview_image_status = 'pending', updated_at = ? WHERE id = ?`
  )
    .bind(key, new Date().toISOString(), presetId)
    .run();

  // Replace any previous image so an abandoned object is not orphaned.
  // The DB already points at the new key, so the author's upload has fully
  // succeeded; an R2 hiccup deleting the *old* object must not be reported to
  // them as a failed upload. The orphan is the accepted failure mode here.
  try {
    await deletePreviewImage(c.env, previousKey);
  } catch (err) {
    console.error(`[preview-image] R2 delete of replaced image failed: id=${presetId}`, err);
  }

  // Same fire-and-forget notification path as a new submission: retries with
  // backoff, and a dead-letter row when they are exhausted, so a moderator
  // queue entry is never silently lost. Not awaited — the image is stored and
  // pending either way, and a notification failure must not fail the upload
  // the author just completed.
  const imagePayload: PresetNotificationPayload = {
    type: 'preview_image',
    preview_image_key: key,
    preset: {
      id: presetId,
      name: preset.name ?? '',
      author_name: auth.userName ?? '',
    },
  };
  c.executionCtx.waitUntil(
    notifyDiscordBot(c.env, imagePayload).catch(async (err) => {
      console.error(`[preview-image] Discord notification failed: id=${presetId}`, err);
      await storeFailedNotification(c.env.DB, imagePayload, err);
    })
  );

  return c.json({ success: true, status: 'pending' });
});

// ============================================
// VALIDATION HELPERS
// ============================================

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

  const linkError = validateExampleLink(body.example_link);
  if (linkError) return linkError;
  body.example_link = normalizeExampleLink(body.example_link);

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

  if (body.example_link !== undefined) {
    const linkError = validateExampleLink(body.example_link);
    if (linkError) return linkError;
    body.example_link = normalizeExampleLink(body.example_link);
  }

  return null;
}

// REFACTOR-017 (2026-07-18 audit): the Discord notification subsystem
// (payload types, retry/backoff, dead-letter writes) moved to
// services/notification-service.ts; the category cache moved to
// services/category-service.ts.
