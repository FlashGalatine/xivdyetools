/**
 * Presets Handler
 * Routes for preset listing, retrieval, and submission
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type {
  Env,
  AuthContext,
  CommunityPreset,
  PresetFilters,
  PresetSubmission,
  PresetEditRequest,
  PresetPreviousValues,
} from '../types.js';
import { requireAuth, requireUserContext } from '../middleware/auth.js';
import { requireNotBanned } from '../middleware/ban-check.js';
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
  validateSecondaryCategories,
} from '../services/validation-service.js';
import { addVote } from './votes.js';
import {
  checkSubmissionRateLimit,
  getRemainingSubmissions,
  getSubmissionCountToday,
  getNextResetUTC,
  DAILY_SUBMISSION_LIMIT,
  // FINDING-008: append-only per-user quotas
  checkDailyEventLimit,
  recordSubmissionEvent,
  DAILY_FLAGGED_EDIT_LIMIT,
  DAILY_PREVIEW_UPLOAD_LIMIT,
  // FINDING-005: pre-moderation cap on name/description edits
  DAILY_TEXT_EDIT_LIMIT,
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

// FINDING-017 (PAPI-9): the ban check covers EVERY mutating route on this
// router — DELETE /:id, PATCH /refresh-author and DELETE /:id/preview-image
// previously had none. Registered once, here, ahead of the routes, so a new
// route cannot forget it. Unauthenticated requests pass straight through
// (nothing to check) and get their 401 from the handler exactly as before.
presetsRouter.on(['POST', 'PATCH', 'DELETE'], '*', requireNotBanned);

/**
 * THE visibility rule (BUG-014, FINDING-016 / PAPI-11), in one place.
 *
 * A non-approved preset (pending / rejected / flagged / hidden) exists only
 * for its owner and for moderators. Everyone else gets the same 404 as a
 * nonexistent id — from GET, and from every mutating route as well: a 403
 * from DELETE / PATCH / preview-image used to confirm that a hidden UUID
 * exists while GET denied it. An approved preset is public, so the ordinary
 * 403 ("not yours") reveals nothing there.
 */
function canSeePreset(
  auth: AuthContext,
  preset: { status: string; author_discord_id: string | null }
): boolean {
  return (
    preset.status === 'approved' ||
    auth.isModerator ||
    (auth.userDiscordId !== undefined && preset.author_discord_id === auth.userDiscordId)
  );
}

/**
 * Answer a dye-signature collision on submit (FINDING-016 / PAPI-2 + PAPI-5).
 *
 * Before: the ENTIRE matching row — flagged text, `previous_values`,
 * `author_discord_id` — came back whatever its status, and a vote was
 * recorded on it, bypassing both the BUG-014 visibility gate and the
 * approved-only vote rule.
 *
 *  - approved duplicate → vote for it (the long-standing "your submission
 *    becomes a vote") and return it, audit snapshot stripped for
 *    non-privileged callers exactly as GET /:id does;
 *  - pending duplicate, caller is its owner or a moderator → return it (they
 *    could GET it), but no vote: votes are for approved presets only;
 *  - pending duplicate, anyone else → a bare 409 that names nothing. That the
 *    combination is taken is unavoidable (the partial UNIQUE index would
 *    reject the INSERT anyway); which preset holds it is not revealed.
 */
async function respondToDuplicate(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  auth: AuthContext,
  duplicate: CommunityPreset
): Promise<Response> {
  const isPrivileged =
    auth.isModerator ||
    (auth.userDiscordId !== undefined && duplicate.author_discord_id === auth.userDiscordId);

  if (duplicate.status === 'approved') {
    const voteResult = await addVote(c.env.DB, duplicate.id, auth.userDiscordId!);
    return c.json({
      success: true,
      duplicate: isPrivileged ? duplicate : stripAuditData(duplicate),
      vote_added: voteResult.success && !voteResult.already_voted,
    });
  }

  if (isPrivileged) {
    return c.json({ success: true, duplicate, vote_added: false });
  }

  return c.json(
    {
      success: false,
      error: ErrorCode.DUPLICATE_RESOURCE,
      message: 'This dye combination already exists',
    },
    409
  );
}

/**
 * The `{ id, name, author_name }` summary an edit's 409 may carry — only for a
 * colliding preset the caller could GET (FINDING-016). For a pending preset
 * belonging to someone else the 409 is sent bare.
 */
function duplicateSummaryFor(
  auth: AuthContext,
  duplicate: CommunityPreset | null
): { id: string; name: string; author_name: string | null } | undefined {
  if (!duplicate || !canSeePreset(auth, duplicate)) return undefined;
  return { id: duplicate.id, name: duplicate.name, author_name: duplicate.author_name };
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

  // FINDING-016: a preset the caller could not GET does not exist for them
  if (!canSeePreset(auth, preset)) {
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

  // (ban check: router-level requireNotBanned, see top of file)

  const auth = c.get('auth');
  const id = c.req.param('id');

  // Get preset to check ownership
  const preset = await getPresetById(c.env.DB, id);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  // FINDING-016: a preset the caller could not GET does not exist for them
  if (!canSeePreset(auth, preset)) {
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
    body.example_link === undefined &&
    body.category_id === undefined &&
    body.secondary_categories === undefined
  ) {
    return validationErrorResponse(c, 'No updates provided');
  }

  // Validate provided fields
  const validationError = await validateEditRequest(body, preset.category_id, c.env.DB);
  if (validationError) {
    return validationErrorResponse(c, validationError);
  }

  // If dyes are being changed, check for duplicates (excluding this preset)
  if (body.dyes) {
    const duplicate = await findDuplicatePresetExcluding(c.env.DB, body.dyes, id);
    if (duplicate) {
      // FINDING-016: describe the colliding preset only if the caller could GET it
      const summary = duplicateSummaryFor(auth, duplicate);
      return c.json(
        {
          success: false,
          error: ErrorCode.DUPLICATE_RESOURCE,
          message: 'This dye combination already exists',
          ...(summary && { duplicate: summary }),
        },
        409
      );
    }
  }

  // BUG-001 (2026-07-18 audit) / FINDING-004 (2026-08-29 security audit): a
  // status is a moderator's decision, and an owner edit must never move one.
  // Hidden presets cannot be edited at all; rejected and flagged presets keep
  // the status they were given. The single status an owner edit may write is
  // 'pending', and only because their own new text just tripped moderation on
  // a preset that was live (see `nextStatus` below).
  if (preset.status === 'hidden') {
    return forbiddenResponse(c, 'This preset cannot be edited');
  }

  // Determine if content moderation is needed (name or description changed)
  // PRESETS-BUG-003: Vote counts are preserved during edits - this is intentional
  // as users voted on the dye combination, not just the name/description.
  let previousValues: PresetPreviousValues | null | undefined;
  // Did the text *this* request supplied trip moderation? (A preset that is
  // merely still pending has not; see `notifiesModerators` below.)
  let flaggedByThisEdit = false;

  // FINDING-004: the two fields a moderator actually reads. Tags, dyes, the
  // category and the example link change nothing they judge, so an edit that
  // touches only those brings them nothing new however often it is repeated.
  const textChanged =
    (body.name !== undefined && body.name !== preset.name) ||
    (body.description !== undefined && body.description !== preset.description);

  if (body.name || body.description) {
    // FINDING-005: the Perspective call is the scarce resource — its default
    // quota is ~1 QPS — so the per-user cap has to sit in front of it. The
    // flagged-edit cap below cannot do that job: it runs *after* the call, and
    // only for edits that reach a moderator, so edits moderation clears and any
    // edit of an already-judged (rejected / flagged) preset used to spend a
    // Perspective call bounded only by the 100/min per-IP limiter. This cap
    // applies to every status, and the slot is charged here, at the point of
    // spend, rather than after a successful UPDATE — otherwise a user sitting
    // on the flagged-edit 429 could loop text edits and never be counted.
    const textEditCap = await checkDailyEventLimit(c.env.DB, auth.userDiscordId, 'text_edit');
    if (!textEditCap.allowed) {
      return c.json(
        {
          success: false,
          error: ErrorCode.RATE_LIMITED,
          message: `You've reached your daily limit of name and description edits (${DAILY_TEXT_EDIT_LIMIT} per day). Try again tomorrow.`,
          remaining: 0,
          reset_at: textEditCap.resetAt.toISOString(),
        },
        429
      );
    }
    try {
      await recordSubmissionEvent(c.env.DB, auth.userDiscordId, 'text_edit', id);
    } catch (err) {
      // Best-effort, exactly like the other event kinds: a failed quota row
      // must not fail the edit. Needs migration 0012 before rows of this kind
      // are accepted — until it is applied the cap simply never engages.
      c.get('logger')?.error('[FINDING-005] submission_events text_edit insert failed', err, {
        preset_id: id,
      });
    }

    // Run content moderation on new values
    const nameToCheck = body.name || preset.name;
    const descriptionToCheck = body.description || preset.description;

    const moderationResult = await moderateContent(
      nameToCheck,
      descriptionToCheck,
      c.env
    );

    // FINDING-005: `passed: false` now covers a third outcome —
    // `method: 'perspective_unavailable'`, meaning nobody judged this text. It
    // is handled here exactly like flagged content: the write-once revert
    // snapshot is taken, an approved preset drops to `pending`, and a moderator
    // is notified (subject to the flagged-edit cap below).
    if (!moderationResult.passed) {
      flaggedByThisEdit = true;
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
    }
    // PRESETS-CRITICAL-004: Do NOT clear previous_values when moderation passes.
    // previous_values holds the oldest clean snapshot (last-known-good for
    // moderator revert), not an append-only history — leaving previousValues
    // undefined here preserves whatever snapshot already exists.
  }

  // FINDING-004: the only status transition an owner edit may cause — the text
  // they just wrote tripped moderation on a live preset, so it leaves public
  // view. `undefined` means "do not write the status column at all", which is
  // what keeps a rejected or flagged preset exactly where the moderator left
  // it. (PRESETS-BUG-002's "edit to un-flag yourself" affordance *was* the
  // workflow bypass this closes: every edit of a non-approved preset used to
  // be written back as 'pending', so a rejected preset re-entered the queue
  // with its rejected text intact and a flagged one silently lost its flag.)
  const nextStatus: 'pending' | undefined =
    preset.status === 'approved' && flaggedByThisEdit ? 'pending' : undefined;
  const resultingStatus = nextStatus ?? preset.status;

  // FINDING-004: THE rule for putting an owner edit in front of a moderator,
  // in one place. They hear about it only when it gives them something new to
  // judge: text this edit flagged, or new text on a preset already waiting in
  // their queue. A rejected or flagged preset has already been judged and is
  // already out of public view, so editing one notifies nobody — resubmission,
  // if the product ever wants it, is a separate explicit action.
  const ownerMayQueue = preset.status === 'pending' || preset.status === 'approved';
  const notifiesModerators =
    ownerMayQueue && (flaggedByThisEdit || (preset.status === 'pending' && textChanged));

  // FINDING-008 + FINDING-004: every moderator notification fans out a
  // moderation embed and, when it fails, dead-letter rows — cap them per user
  // per day before persisting anything. Only edits that tripped moderation
  // used to be capped, so `PATCH {"tags":["a"]}` on the caller's own pending
  // preset sent one uncapped embed per request.
  if (notifiesModerators) {
    const cap = await checkDailyEventLimit(c.env.DB, auth.userDiscordId, 'flagged_edit');
    if (!cap.allowed) {
      return c.json(
        {
          success: false,
          error: ErrorCode.RATE_LIMITED,
          message: `You've reached your daily limit of edits that need moderator review (${DAILY_FLAGGED_EDIT_LIMIT} per day). Try again tomorrow.`,
          remaining: 0,
          reset_at: cap.resetAt.toISOString(),
        },
        429
      );
    }
  }

  // Update the preset
  let updatedPreset;
  try {
    updatedPreset = await updatePreset(
      c.env.DB,
      id,
      body,
      previousValues,
      nextStatus
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
      // FINDING-016: same visibility rule as the pre-check above
      const summary = duplicateSummaryFor(auth, duplicate);
      return c.json(
        {
          success: false,
          error: ErrorCode.DUPLICATE_RESOURCE,
          message: 'This dye combination already exists',
          ...(summary && { duplicate: summary }),
        },
        409
      );
    }
    throw error;
  }

  if (!updatedPreset) {
    return internalErrorResponse(c, 'Failed to update preset');
  }

  // FINDING-008 + FINDING-004: count this notification against the daily cap
  // (append-only). Same event kind as before, so no migration is needed — the
  // kind now means "an edit that reached a moderator", which is what the cap
  // was always protecting.
  if (notifiesModerators) {
    try {
      await recordSubmissionEvent(c.env.DB, auth.userDiscordId, 'flagged_edit', id);
    } catch (err) {
      console.error(`[FINDING-008] submission_events insert failed: preset=${id}`, err);
    }
  }

  // Notify Discord for moderation when this edit brought something new to judge
  // PRESETS-REF-002: Fire-and-forget notification - errors don't fail the request
  // but are logged with preset context for debugging
  if (notifiesModerators) {
    const editPayload: PresetNotificationPayload = {
      type: 'submission',
      preset: {
        ...updatedPreset,
        author_name: preset.author_name || 'Unknown User',
        author_discord_id: preset.author_discord_id,
        // Every branch of `notifiesModerators` leaves the preset pending: a
        // preset that was already pending stays there, and an approved one
        // whose new text was flagged has just been moved there.
        status: 'pending',
        // FINDING-004: a clean text edit on a preset that is merely still in
        // the queue has not tripped anything — claiming 'flagged' told
        // moderators every edit had failed the filter.
        moderation_status: flaggedByThisEdit ? 'flagged' : 'clean',
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

  // FINDING-004: 'pending' only when the preset really is queued for review.
  // It used to report 'pending' for a rejected or flagged preset as well,
  // telling the owner an edit had put it back in front of a moderator when
  // nothing of the sort happened. The published contract
  // (`PresetEditSuccessResponse.moderation_status?: 'approved' | 'pending'` in
  // @xivdyetools/types) admits only those two values, so a preset left in a
  // moderator's own status reports no `moderation_status` at all rather than a
  // value clients are typed not to expect — the field is optional, and
  // `preset.status` carries the truth for anyone who needs it.
  const reportedStatus: 'approved' | 'pending' | undefined =
    resultingStatus === 'approved' || resultingStatus === 'pending'
      ? resultingStatus
      : undefined;

  return c.json({
    success: true,
    preset: updatedPreset,
    ...(reportedStatus !== undefined && { moderation_status: reportedStatus }),
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
  if (!canSeePreset(auth, preset)) {
    return notFoundResponse(c, 'Preset');
  }

  const isPrivileged =
    auth.isModerator ||
    (auth.userDiscordId !== undefined && preset.author_discord_id === auth.userDiscordId);
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

  // (ban check: router-level requireNotBanned, see top of file)

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

  // Check for duplicate dye combinations (FINDING-016: see respondToDuplicate)
  const duplicate = await findDuplicatePreset(c.env.DB, body.dyes);
  if (duplicate) {
    return respondToDuplicate(c, auth, duplicate);
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
        // FINDING-016: same rules as the pre-check branch
        return respondToDuplicate(c, auth, existingPreset);
      }
    }
    // Re-throw if it's not a duplicate constraint error
    throw error;
  }

  // FINDING-008: append-only quota record — survives the author deleting the
  // preset, so the daily cap cannot be refilled from the outside. Best-effort:
  // a failed insert must not fail the submission that just landed.
  try {
    await recordSubmissionEvent(c.env.DB, auth.userDiscordId!, 'submission', preset.id);
  } catch (err) {
    console.error(`[FINDING-008] submission_events insert failed: preset=${preset.id}`, err);
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

  // (ban check: router-level requireNotBanned, see top of file)

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

  // FINDING-016: a preset the caller could not GET does not exist for them
  if (!canSeePreset(auth, preset)) {
    return notFoundResponse(c, 'Preset');
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

  // FINDING-008: each upload costs an image-worker decode, an R2 write and a
  // moderation embed — cap per user per day before reading the body
  const uploadCap = await checkDailyEventLimit(c.env.DB, auth.userDiscordId, 'preview_upload');
  if (!uploadCap.allowed) {
    return c.json(
      {
        success: false,
        error: ErrorCode.RATE_LIMITED,
        message: `You've reached your daily preview-image upload limit (${DAILY_PREVIEW_UPLOAD_LIMIT} per day). Try again tomorrow.`,
        remaining: 0,
        reset_at: uploadCap.resetAt.toISOString(),
      },
      429
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

  // FINDING-008: count this upload against the daily cap (append-only)
  try {
    await recordSubmissionEvent(c.env.DB, auth.userDiscordId, 'preview_upload', presetId);
  } catch (err) {
    console.error(`[FINDING-008] submission_events insert failed: preset=${presetId}`, err);
  }

  return c.json({ success: true, status: 'pending' });
});

/**
 * DELETE /:id/preview-image — the author removes their card picture.
 *
 * Author-only; a moderator removing an image uses the existing reject action,
 * which is an act of moderation and belongs in the moderation log.
 *
 * The preset's own `status` is deliberately untouched. Clearing the image
 * clears the only condition the picture contributes to the moderation queue
 * predicate, so a preset queued *solely* for its image leaves the queue here,
 * while one that is also `status = 'pending'` for flagged text correctly stays.
 * That is what "auto-pass assuming all other checks pass" means, and it needs
 * no state of its own.
 *
 * Content moderation is NOT re-run: doing so would let an author launder
 * flagged text by attaching and removing a picture.
 */
presetsRouter.delete('/:id/preview-image', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const userError = requireUserContext(c);
  if (userError) return userError;

  const auth = c.get('auth');
  const presetId = c.req.param('id');

  // Row-level read: CommunityPreset hides preview_image_key by design.
  const preset = await getPresetImageState(c.env.DB, presetId);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  // FINDING-016: a preset the caller could not GET does not exist for them
  if (!canSeePreset(auth, preset)) {
    return notFoundResponse(c, 'Preset');
  }

  if (preset.author_discord_id !== auth.userDiscordId) {
    return forbiddenResponse(c, 'Only the author can remove the preview image');
  }

  // Idempotent: nothing to remove is a success, not a 404. The client may be
  // retrying, and the end state it asked for already holds.
  const previousKey = preset.preview_image_key;

  // DB UPDATE before the R2 delete, as everywhere else in this file: a failed
  // delete orphans an invisible object, while the reverse leaves a row pointing
  // at a key that no longer exists.
  await c.env.DB.prepare(
    `UPDATE presets SET preview_image_key = NULL, preview_image_status = 'none', updated_at = ? WHERE id = ?`
  )
    .bind(new Date().toISOString(), presetId)
    .run();

  try {
    await deletePreviewImage(c.env, previousKey);
  } catch (err) {
    console.error(`[preview-image] R2 delete failed after author removal: id=${presetId}`, err);
  }

  return c.json({ success: true, preview_image_status: 'none' });
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

  const secondaryError = validateSecondaryCategories(
    body.secondary_categories,
    body.category_id,
    validCategories
  );
  if (secondaryError) return secondaryError;

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
 *
 * Async because category validation is DB-backed, exactly like validateSubmission.
 * `currentCategoryId` supplies the primary when the request does not change it —
 * otherwise adding a secondary equal to the unchanged primary would slip through.
 */
async function validateEditRequest(
  body: PresetEditRequest,
  currentCategoryId: string,
  db: D1Database
): Promise<string | null> {
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

  if (body.category_id !== undefined || body.secondary_categories !== undefined) {
    const validCategories = await getValidCategories(db);

    if (body.category_id !== undefined && !validCategories.includes(body.category_id)) {
      return 'Invalid category';
    }

    const effectivePrimary = body.category_id ?? currentCategoryId;
    const secondaryError = validateSecondaryCategories(
      body.secondary_categories,
      effectivePrimary,
      validCategories
    );
    if (secondaryError) return secondaryError;
  }

  return null;
}

// REFACTOR-017 (2026-07-18 audit): the Discord notification subsystem
// (payload types, retry/backoff, dead-letter writes) moved to
// services/notification-service.ts; the category cache moved to
// services/category-service.ts.
