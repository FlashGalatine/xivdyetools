/**
 * Moderation Handler
 * Routes for moderator actions
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, AuthContext, PresetStatus, PresetRow } from '../types.js';
import { requireModerator } from '../middleware/auth.js';
import {
  getPresetById,
  getPendingPresets,
  prepareStatusUpdate,
  prepareRevert,
  rowToPreset,
  findDuplicateBySignature,
  isDyeSignatureCollision,
} from '../services/preset-service.js';
import {
  ErrorCode,
  invalidJsonResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
} from '../utils/api-response.js';
// PRESETS-REF-001 FIX: Import from centralized validation service
import {
  validateModerationStatus,
  validateModerationReason,
} from '../services/validation-service.js';
import {
  listFailedNotifications,
  resolveFailedNotification,
} from '../services/notification-service.js';
import {
  deletePreviewImage,
  getPresetImageState,
} from '../services/preview-image-service.js';

type Variables = {
  auth: AuthContext;
};

export const moderationRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * BUG-041: the 409 a moderator gets when their transition would put two
 * presets on the same dye signature.
 *
 * The signature is read off the stored row rather than from the request,
 * because a status change carries no dye list — that is exactly why these two
 * routes had no recovery and answered an opaque 500 instead. Moderators may
 * see any status, so the colliding preset is named unconditionally.
 */
async function dyeSignatureConflictResponse(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  presetId: string,
  signature: string | undefined
): Promise<Response> {
  const other = signature
    ? await findDuplicateBySignature(c.env.DB, signature, presetId)
    : null;

  return c.json(
    {
      success: false,
      error: ErrorCode.DUPLICATE_RESOURCE,
      message: 'Another visible preset already uses this dye combination',
      ...(other && {
        duplicate: { id: other.id, name: other.name, status: other.status },
      }),
    },
    409
  );
}

/**
 * GET /api/v1/moderation/pending
 * List presets pending moderation
 */
moderationRouter.get('/pending', async (c) => {
  // Require moderator privileges
  const modError = requireModerator(c);
  if (modError) return modError;

  const presets = await getPendingPresets(c.env.DB, c.get('logger'));
  return c.json({ presets, total: presets.length });
});

/**
 * PATCH /api/v1/moderation/:presetId/status
 * Approve, reject, flag, or unflag a preset
 */
moderationRouter.patch('/:presetId/status', async (c) => {
  // Require moderator privileges
  const modError = requireModerator(c);
  if (modError) return modError;

  const auth = c.get('auth');
  const presetId = c.req.param('presetId');

  // Parse request body
  let body: { status: PresetStatus; reason?: string };
  try {
    body = await c.req.json();
  } catch {
    return invalidJsonResponse(c);
  }

  // PRESETS-REF-001 FIX: Use centralized validation
  const statusError = validateModerationStatus(body.status);
  if (statusError) {
    return validationErrorResponse(c, statusError);
  }

  // Get current preset
  const preset = await getPresetById(c.env.DB, presetId);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  // BUG-020 (2026-07-18 audit): status update + audit log run in one atomic
  // batch, and the update is conditional on the status this moderator observed
  // — a concurrent moderator's write makes the update match zero rows, so the
  // stale action is rejected as a 409 instead of mislabeling the audit trail
  // or logging an action that never happened.
  const logId = crypto.randomUUID();
  const now = new Date().toISOString();
  const action = getActionFromStatusChange(preset.status, body.status);

  // BUG-041: a transition INTO the partial unique index
  // (`flagged`/`rejected` → `approved`/`pending`) can collide with a preset
  // that took the same dye signature while this one sat outside the index.
  // The batch had no recovery, so the moderator got an opaque 500 and the
  // `moderation_log` row rolled back with it — the action left no trace at all.
  // The submit and edit paths have handled this since BUG-003; moderation now
  // answers the same 409, naming the preset in the way.
  let updateResult: D1Result<PresetRow>;
  try {
    [updateResult] = await c.env.DB.batch<PresetRow>([
      prepareStatusUpdate(c.env.DB, presetId, body.status, preset.status, now),
      // changes() sees the preceding UPDATE in this batch's transaction, so the
      // log row is only written when the status transition actually happened
      c.env.DB
        .prepare(
          `INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, created_at)
           SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0`
        )
        .bind(logId, presetId, auth.userDiscordId!, action, body.reason || null, now),
    ]);
  } catch (error) {
    if (!isDyeSignatureCollision(error)) throw error;
    return dyeSignatureConflictResponse(c, presetId, preset.dye_signature);
  }

  const updatedRow = updateResult.results?.[0];
  if (!updatedRow) {
    return c.json(
      {
        success: false,
        error: ErrorCode.DUPLICATE_RESOURCE,
        message: 'Preset status changed concurrently — reload and retry',
      },
      409
    );
  }

  return c.json({
    success: true,
    preset: rowToPreset(updatedRow, c.get('logger')),
  });
});

/**
 * PATCH /api/v1/moderation/:presetId/revert
 * Revert a preset to its previous values (when edit was flagged)
 */
moderationRouter.patch('/:presetId/revert', async (c) => {
  // Require moderator privileges
  const modError = requireModerator(c);
  if (modError) return modError;

  const auth = c.get('auth');
  const presetId = c.req.param('presetId');

  // Parse request body for reason
  let body: { reason: string };
  try {
    body = await c.req.json();
  } catch {
    return invalidJsonResponse(c);
  }

  // PRESETS-REF-001 FIX: Use centralized validation
  const reasonError = validateModerationReason(body.reason);
  if (reasonError) {
    return validationErrorResponse(c, reasonError);
  }

  // Get current preset
  const preset = await getPresetById(c.env.DB, presetId);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  // Check if there are previous values to revert to
  if (!preset.previous_values) {
    return validationErrorResponse(c, 'This preset has no previous values to revert to');
  }

  // BUG-020 (2026-07-18 audit): revert + audit log in one atomic batch — the
  // old ordering (revert first, log after) could lose the audit trail for a
  // revert that did happen. changes() gates the log on the revert applying.
  const logId = crypto.randomUUID();
  const now = new Date().toISOString();

  // BUG-041: `prepareRevert` sets `status = 'approved'` unconditionally, so it
  // has the identical exposure to the status route above — reverting a preset
  // back into the index can collide with whatever took its signature meanwhile.
  let revertResult: D1Result<PresetRow>;
  try {
    [revertResult] = await c.env.DB.batch<PresetRow>([
      prepareRevert(c.env.DB, presetId, preset.previous_values, now),
      c.env.DB
        .prepare(
          `INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, created_at)
           SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0`
        )
        .bind(logId, presetId, auth.userDiscordId!, 'revert', body.reason, now),
    ]);
  } catch (error) {
    if (!isDyeSignatureCollision(error)) throw error;
    return dyeSignatureConflictResponse(c, presetId, preset.dye_signature);
  }

  const revertedRow = revertResult.results?.[0];
  if (!revertedRow) {
    return internalErrorResponse(c, 'Failed to revert preset');
  }

  return c.json({
    success: true,
    preset: rowToPreset(revertedRow, c.get('logger')),
    message: 'Preset reverted to previous values',
  });
});

/**
 * PATCH /:presetId/preview-image — approve or reject an uploaded image.
 *
 * Rejection clears the image only. The preset keeps its own status: a bad
 * picture is not a bad palette.
 */
moderationRouter.patch('/:presetId/preview-image', async (c) => {
  const modError = requireModerator(c);
  if (modError) return modError;

  const presetId = c.req.param('presetId');

  let body: { action?: string };
  try {
    body = await c.req.json();
  } catch {
    return invalidJsonResponse(c);
  }

  if (body.action !== 'approve' && body.action !== 'reject') {
    return validationErrorResponse(c, "action must be 'approve' or 'reject'");
  }

  // Row-level read: CommunityPreset hides preview_image_key by design.
  const preset = await getPresetImageState(c.env.DB, presetId);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  const now = new Date().toISOString();

  if (body.action === 'approve') {
    await c.env.DB.prepare(
      `UPDATE presets SET preview_image_status = 'approved', updated_at = ? WHERE id = ?`
    )
      .bind(now, presetId)
      .run();
    return c.json({ success: true, preview_image_status: 'approved' });
  }

  // Capture the key before the UPDATE clears it — deletePreviewImage below
  // needs the pre-update value.
  const previousKey = preset.preview_image_key;

  // DB UPDATE before the R2 delete, deliberately (Task 4 ruling, same logic
  // applies here): if the UPDATE throws, leaving the delete undone just
  // orphans the object in R2 — invisible and cheap to clean up later. Delete
  // first would risk the opposite: a row still pointing at a key that no
  // longer exists, so the card serves a broken image. Never trade a broken
  // live image for a tidy bucket.
  await c.env.DB.prepare(
    `UPDATE presets SET preview_image_key = NULL, preview_image_status = 'none', updated_at = ? WHERE id = ?`
  )
    .bind(now, presetId)
    .run();

  // The DB already reflects the rejection, so the moderator's action has
  // succeeded. An R2 hiccup here must not 500 a request whose state is already
  // correct — the orphaned object is the accepted failure mode by design.
  try {
    await deletePreviewImage(c.env, previousKey, c.get('logger'));
  } catch (err) {
    c.get('logger')?.error('[preview-image] R2 delete failed after rejection', err, { presetId });
  }

  return c.json({ success: true, preview_image_status: 'none' });
});

/**
 * GET /api/v1/moderation/:presetId/history
 * Get moderation history for a preset
 */
moderationRouter.get('/:presetId/history', async (c) => {
  // Require moderator privileges
  const modError = requireModerator(c);
  if (modError) return modError;

  const presetId = c.req.param('presetId');

  const query = `
    SELECT id, preset_id, moderator_discord_id, action, reason, created_at
    FROM moderation_log
    WHERE preset_id = ?
    ORDER BY created_at DESC
  `;

  const result = await c.env.DB.prepare(query).bind(presetId).all();
  return c.json({ history: result.results || [] });
});

/**
 * GET /api/v1/moderation/stats
 * Get moderation statistics
 */
moderationRouter.get('/stats', async (c) => {
  // Require moderator privileges
  const modError = requireModerator(c);
  if (modError) return modError;

  // BUG-050 (2026-07-18 audit): rows are written with JS ISO timestamps
  // ("...T...Z"); the cutoff must use the same format — datetime('now') renders
  // with a space separator and TEXT comparison is lexicographic, which
  // over-counted the boundary day.
  const query = `
    SELECT
      (SELECT COUNT(*) FROM presets WHERE status = 'pending') as pending,
      (SELECT COUNT(*) FROM presets WHERE status = 'approved') as approved,
      (SELECT COUNT(*) FROM presets WHERE status = 'rejected') as rejected,
      (SELECT COUNT(*) FROM presets WHERE status = 'flagged') as flagged,
      (SELECT COUNT(*) FROM moderation_log WHERE created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')) as actions_last_week
  `;

  const stats = await c.env.DB.prepare(query).first();
  return c.json({ stats });
});

// ============================================
// FAILED NOTIFICATIONS (BUG-015)
// ============================================

/**
 * GET /api/v1/moderation/failed-notifications
 * List unresolved failed Discord notifications
 */
moderationRouter.get('/failed-notifications', async (c) => {
  const modError = requireModerator(c);
  if (modError) return modError;

  const includeResolved = c.req.query('include_resolved') === 'true';

  // REFACTOR-017: dead-letter read path lives in notification-service
  // FINDING-017: the read also prunes rows past their retention window
  const notifications = await listFailedNotifications(c.env.DB, includeResolved, c.get('logger'));
  return c.json({ notifications, total: notifications.length });
});

/**
 * PATCH /api/v1/moderation/failed-notifications/:id/resolve
 * Mark a failed notification as resolved
 */
moderationRouter.patch('/failed-notifications/:id/resolve', async (c) => {
  const modError = requireModerator(c);
  if (modError) return modError;

  const id = c.req.param('id');

  try {
    const resolved = await resolveFailedNotification(c.env.DB, id, c.get('logger'));
    if (!resolved) {
      return notFoundResponse(c, 'Failed notification');
    }

    return c.json({ success: true });
  } catch {
    return internalErrorResponse(c, 'Failed to resolve notification');
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getActionFromStatusChange(
  oldStatus: PresetStatus,
  newStatus: PresetStatus
): 'approve' | 'reject' | 'flag' | 'unflag' | 'requeue' {
  // Unflag: flagged -> approved
  if (oldStatus === 'flagged' && newStatus === 'approved') return 'unflag';
  // Standard status changes
  if (newStatus === 'approved') return 'approve';
  if (newStatus === 'rejected') return 'reject';
  if (newStatus === 'flagged') return 'flag';
  // presets-api-02: `pending` is the ONLY value that can reach here — the four
  // branches above cover every other member of `validStatuses`. The old
  // fallback returned 'approve', so the audit trail recorded an approval for
  // an action that pulled a preset OUT of public view, and `/moderation/stats`
  // and `/:id/history` repeated it. `moderation_log.action` is a bare TEXT
  // column with no CHECK, so widening the vocabulary needs no migration —
  // only the comment in `schema.sql` that documents it.
  return 'requeue';
}
