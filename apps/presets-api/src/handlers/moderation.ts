/**
 * Moderation Handler
 * Routes for moderator actions
 */

import { Hono } from 'hono';
import type { Env, AuthContext, PresetStatus, PresetRow } from '../types.js';
import { requireModerator } from '../middleware/auth.js';
import {
  getPresetById,
  getPendingPresets,
  prepareStatusUpdate,
  prepareRevert,
  rowToPreset,
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

type Variables = {
  auth: AuthContext;
};

export const moderationRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

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

  const [updateResult] = await c.env.DB.batch<PresetRow>([
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

  const [revertResult] = await c.env.DB.batch<PresetRow>([
    prepareRevert(c.env.DB, presetId, preset.previous_values, now),
    c.env.DB
      .prepare(
        `INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, created_at)
         SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0`
      )
      .bind(logId, presetId, auth.userDiscordId!, 'revert', body.reason, now),
  ]);

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
  const notifications = await listFailedNotifications(c.env.DB, includeResolved);
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
    const resolved = await resolveFailedNotification(c.env.DB, id);
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
): 'approve' | 'reject' | 'flag' | 'unflag' {
  // Unflag: flagged -> approved
  if (oldStatus === 'flagged' && newStatus === 'approved') return 'unflag';
  // Standard status changes
  if (newStatus === 'approved') return 'approve';
  if (newStatus === 'rejected') return 'reject';
  if (newStatus === 'flagged') return 'flag';
  return 'approve'; // Default fallback (e.g., pending -> approved)
}
