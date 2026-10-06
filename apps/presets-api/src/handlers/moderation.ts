/**
 * Moderation Handler
 * Routes for moderator actions
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, AuthContext, PresetStatus, PresetRow } from '../types.js';
import { requireModerator } from '../middleware/auth.js';
import {
  getPresetRowById,
  getPendingPresets,
  prepareStatusUpdate,
  prepareRevert,
  rowToPreset,
  findDuplicateBySignature,
  isDyeSignatureCollision,
  generateDyeSignature,
} from '../services/preset-service.js';
import {
  ErrorCode,
  invalidJsonResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
} from '../utils/api-response.js';
import { readJsonObject } from '../utils/request-body.js';
// PRESETS-REF-001 FIX: Import from centralized validation service
import {
  validateModerationStatus,
  validateModerationReason,
  validatePresetDyes,
} from '../services/validation-service.js';
import {
  listFailedNotifications,
  resolveFailedNotification,
} from '../services/notification-service.js';
import { pruneModerationRecords } from '../services/moderation-retention-service.js';
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

/** Every status a preset can be in — what a moderator may have been looking at. */
const REVIEWED_STATUSES: readonly PresetStatus[] = ['pending', 'approved', 'rejected', 'flagged', 'hidden'];

/**
 * FINDING-017 (2026-10-03 audit): the 409 for a status change that is not bound
 * to a review. `REVISION_REQUIRED` — the caller never said what it reviewed —
 * and `STALE_REVIEW` — what it reviewed is no longer what is stored — share one
 * shape so a client has one recovery: re-read `current` and review again.
 *
 * `current` is a fresh read, never the row the handler read earlier, so it is
 * what the next review must be bound to. A preset deleted in the meantime has
 * nothing to review: 404.
 */
async function reviewConflictResponse(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  presetId: string,
  code: 'REVISION_REQUIRED' | 'STALE_REVIEW'
): Promise<Response> {
  const fresh = await getPresetRowById(c.env.DB, presetId);
  if (!fresh) return notFoundResponse(c, 'Preset');

  return c.json(
    {
      success: false,
      error: ErrorCode.CONFLICT,
      code,
      message:
        code === 'REVISION_REQUIRED'
          ? 'expected_revision and expected_status are required — re-review the preset and retry'
          : 'The preset changed after it was reviewed — re-review the latest version',
      current: { status: fresh.status, content_revision: fresh.content_revision },
    },
    409
  );
}

/**
 * FINDING-017: read the revision and status the moderator reviewed from a
 * request body. `null` means "not bound to a review" — the caller answers
 * REVISION_REQUIRED. Shared by the status and revert routes so the two cannot
 * drift apart.
 */
function parseReviewBinding(body: {
  expected_revision?: unknown;
  expected_status?: unknown;
}): { revision: number; status: PresetStatus } | null {
  const revision = body.expected_revision;
  const status = body.expected_status;
  if (
    typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0 ||
    typeof status !== 'string' || !REVIEWED_STATUSES.includes(status as PresetStatus)
  ) {
    return null;
  }
  return { revision, status: status as PresetStatus };
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

  // Parse request body (BUG-064: `null` or a non-object is a 400, not a TypeError)
  const body = await readJsonObject<{
    status: PresetStatus;
    reason?: string;
    expected_revision?: unknown;
    expected_status?: unknown;
  }>(c);
  if (!body) {
    return invalidJsonResponse(c);
  }

  // PRESETS-REF-001 FIX: Use centralized validation
  const statusError = validateModerationStatus(body.status);
  if (statusError) {
    return validationErrorResponse(c, statusError);
  }

  // Get current preset
  const presetRow = await getPresetRowById(c.env.DB, presetId);
  if (!presetRow) {
    return notFoundResponse(c, 'Preset');
  }
  const preset = rowToPreset(presetRow, c.get('logger'));

  // FINDING-017: fail closed. The revision and status the moderator reviewed
  // must come from the caller — an old button, a stale embed or a client that
  // predates this contract sends neither, and binding the write to the row read
  // a moment ago would approve whatever text is there now.
  const binding = parseReviewBinding(body);
  if (!binding) {
    return reviewConflictResponse(c, presetId, 'REVISION_REQUIRED');
  }
  const expectedRevision = binding.revision;
  const reviewedStatus = binding.status;

  // BUG-020 (2026-07-18 audit): status update + audit log run in one atomic
  // batch, and the update is conditional on the status and revision this moderator observed
  // — a concurrent moderator's write makes the update match zero rows, so the
  // stale action is rejected as a 409 instead of mislabeling the audit trail
  // or logging an action that never happened.
  // FINDING-017: "observed" is the caller's expected pair, not this request's
  // own read, so the same zero-row path also rejects a stale review.
  const logId = crypto.randomUUID();
  const now = new Date().toISOString();
  const action = getActionFromStatusChange(reviewedStatus, body.status);

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
      prepareStatusUpdate(c.env.DB, presetId, body.status, reviewedStatus, expectedRevision, now),
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
    return reviewConflictResponse(c, presetId, 'STALE_REVIEW');
  }

  // FINDING-005: age-based retention rides the write path; never fails it.
  await pruneModerationRecords(c.env.DB, c.get('logger'));

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

  // Parse request body for reason (BUG-064: `null` or a non-object is a 400, not a TypeError)
  const body = await readJsonObject<{
    reason: string;
    expected_revision?: unknown;
    expected_status?: unknown;
  }>(c);
  if (!body) {
    return invalidJsonResponse(c);
  }

  // PRESETS-REF-001 FIX: Use centralized validation
  const reasonError = validateModerationReason(body.reason);
  if (reasonError) {
    return validationErrorResponse(c, reasonError);
  }

  // Get current preset
  const presetRow = await getPresetRowById(c.env.DB, presetId);
  if (!presetRow) {
    return notFoundResponse(c, 'Preset');
  }
  const preset = rowToPreset(presetRow, c.get('logger'));

  // FINDING-017: fail closed, exactly like the status route. A revert approves
  // the stored snapshot, so it must be bound to the revision and status the
  // moderator reviewed — never to this request's own read of the row.
  const binding = parseReviewBinding(body);
  if (!binding) {
    return reviewConflictResponse(c, presetId, 'REVISION_REQUIRED');
  }

  // Check if there are previous values to revert to
  if (!preset.previous_values || !presetRow.previous_values) {
    return validationErrorResponse(c, 'This preset has no previous values to revert to');
  }

  // BUG-010 follow-up (2026-10-04 deep-dive): a revert approves the snapshot's
  // dyes as-is, and that snapshot was written by an older edit — possibly
  // before submit/edit refused a repeated dye (or a legacy item ID, or a
  // count outside 3–6). Hold it to the same rule a new palette meets, so a
  // revert cannot re-approve one. Same 400 as "nothing to revert to": either
  // way the snapshot cannot be used, and the moderator's way forward is an
  // approve or reject through /status instead. Checked before the batch, so a
  // refused revert writes neither the preset nor the audit log.
  const snapshotDyeError = validatePresetDyes(preset.previous_values.dyes);
  if (snapshotDyeError) {
    return validationErrorResponse(
      c,
      `The previous values cannot be restored: ${snapshotDyeError}`
    );
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
      prepareRevert(c.env.DB, presetId, preset.previous_values, {
        contentRevision: binding.revision,
        status: binding.status,
        previousValuesRaw: presetRow.previous_values,
      }, now),
      c.env.DB
        .prepare(
          `INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, created_at)
           SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0`
        )
        .bind(logId, presetId, auth.userDiscordId!, 'revert', body.reason, now),
    ]);
  } catch (error) {
    if (!isDyeSignatureCollision(error)) throw error;
    // The collision is on the signature the revert would write, not the current one.
    return dyeSignatureConflictResponse(c, presetId, generateDyeSignature(preset.previous_values.dyes));
  }

  const revertedRow = revertResult.results?.[0];
  if (!revertedRow) {
    return reviewConflictResponse(c, presetId, 'STALE_REVIEW');
  }

  // FINDING-005: age-based retention rides the write path; never fails it.
  await pruneModerationRecords(c.env.DB, c.get('logger'));

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

  const auth = c.get('auth');
  const presetId = c.req.param('presetId');

  let body: { action?: unknown; preview_image_key?: unknown } | null;
  try {
    body = await c.req.json();
  } catch {
    return invalidJsonResponse(c);
  }

  if (body?.action !== 'approve' && body?.action !== 'reject') {
    return validationErrorResponse(c, "action must be 'approve' or 'reject'");
  }

  // The immutable object key identifies exactly the image the moderator saw.
  // Old notifications without a revision must never approve a replacement.
  const reviewedKey = body.preview_image_key;
  if (
    typeof reviewedKey !== 'string' || reviewedKey.length > 128 ||
    !reviewedKey.startsWith(`${presetId}/`) ||
    !/^[A-Za-z0-9-]+\/[A-Za-z0-9-]+\.webp$/.test(reviewedKey)
  ) {
    return validationErrorResponse(c, 'preview_image_key must identify the reviewed image');
  }

  const staleReview = (): Response => c.json({
    success: false,
    error: ErrorCode.CONFLICT,
    message: 'This preview image changed or was already moderated. Review the latest image notification.',
  }, 409);

  // Row-level read: CommunityPreset hides preview_image_key by design.
  const preset = await getPresetImageState(c.env.DB, presetId);
  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  const now = new Date().toISOString();

  // FINDING-020: the image decision and its audit row land in one batch, and
  // `changes()` gates the log on the conditional UPDATE applying — so a stale
  // review writes neither (mirrors the revert route above).
  const logImageAction = (action: 'image_approve' | 'image_reject'): D1PreparedStatement =>
    c.env.DB
      .prepare(
        `INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, created_at)
         SELECT ?, ?, ?, ?, NULL, ? WHERE changes() > 0`
      )
      .bind(crypto.randomUUID(), presetId, auth.userDiscordId!, action, now);

  if (body.action === 'approve') {
    const [result] = await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE presets SET preview_image_status = 'approved', updated_at = ?
         WHERE id = ? AND preview_image_key = ? AND preview_image_status = 'pending'`
      ).bind(now, presetId, reviewedKey),
      logImageAction('image_approve'),
    ]);
    if (result.meta.changes !== 1) return staleReview();
    // FINDING-005: age-based retention rides the write path; never fails it.
    await pruneModerationRecords(c.env.DB, c.get('logger'));
    return c.json({ success: true, preview_image_status: 'approved' });
  }

  // DB UPDATE before the R2 delete, deliberately (Task 4 ruling, same logic
  // applies here): if the UPDATE throws, leaving the delete undone just
  // orphans the object in R2 — invisible and cheap to clean up later. Delete
  // first would risk the opposite: a row still pointing at a key that no
  // longer exists, so the card serves a broken image. Never trade a broken
  // live image for a tidy bucket.
  const [result] = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE presets SET preview_image_key = NULL, preview_image_status = 'none', updated_at = ?
       WHERE id = ? AND preview_image_key = ? AND preview_image_status = 'pending'`
    ).bind(now, presetId, reviewedKey),
    logImageAction('image_reject'),
  ]);
  if (result.meta.changes !== 1) return staleReview();

  // FINDING-005: age-based retention rides the write path; never fails it.
  await pruneModerationRecords(c.env.DB, c.get('logger'));

  // The DB already reflects the rejection, so the moderator's action has
  // succeeded. An R2 hiccup here must not 500 a request whose state is already
  // correct — the orphaned object is the accepted failure mode by design.
  try {
    await deletePreviewImage(c.env, reviewedKey, c.get('logger'));
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

/**
 * GET /api/v1/moderation/:presetId
 * The preset as a moderator reviews it, at any status, with the revision a
 * status change must be bound to (FINDING-017).
 *
 * Registered after every single-segment GET above (`/pending`, `/stats`,
 * `/failed-notifications`) so the parameter never shadows them.
 */
moderationRouter.get('/:presetId', async (c) => {
  const modError = requireModerator(c);
  if (modError) return modError;

  const row = await getPresetRowById(c.env.DB, c.req.param('presetId'));
  if (!row) {
    return notFoundResponse(c, 'Preset');
  }

  return c.json({
    success: true,
    preset: {
      ...rowToPreset(row, c.get('logger')),
      // The filter verdict is not stored, only the status. A pending row may
      // have been queued by the filter, by a missing key, or by a plain
      // resubmission, so anything but 'flagged' is honestly 'unknown' — never
      // 'clean'. Consumers must not render this as a filter verdict.
      moderation_status: row.status === 'flagged' ? 'flagged' : 'unknown',
    },
    content_revision: row.content_revision,
  });
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
