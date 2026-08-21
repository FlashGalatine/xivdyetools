/**
 * Votes Handler
 * Routes for voting on presets
 */

import { Hono } from 'hono';
import type { Env, AuthContext, VoteResponse } from '../types.js';
import { requireAuth, requireUserContext } from '../middleware/auth.js';
import { requireNotBanned } from '../middleware/ban-check.js';
import { notFoundResponse } from '../utils/api-response.js';

type Variables = {
  auth: AuthContext;
};

export const votesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

// FINDING-017 (PAPI-9): the ban check covers every mutating route on this
// router — DELETE (remove vote) previously had none. Registered once, here,
// so a future route cannot forget it. Unauthenticated requests pass through
// (nothing to check) and get their 401 from the handler as before.
votesRouter.on(['POST', 'DELETE'], '*', requireNotBanned);

/**
 * FINDING-016 (PAPI-5 / PAPI-11): votes are for APPROVED presets only. The
 * gate query carries the status predicate, so a pending / rejected / flagged /
 * hidden preset is indistinguishable from a nonexistent one (404) — the same
 * answer GET /presets/:id gives the unprivileged, and no vote lands on a row
 * that is not public.
 */
const APPROVED_PRESET_GATE = "SELECT id FROM presets WHERE id = ? AND status = 'approved'";

/**
 * Add a vote to a preset
 * Used internally and exposed via API
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING to atomically handle duplicates,
 * eliminating the TOCTOU race condition where two concurrent requests
 * could both pass the "already voted" check.
 */
export async function addVote(
  db: D1Database,
  presetId: string,
  userDiscordId: string
): Promise<VoteResponse> {
  const now = new Date().toISOString();

  try {
    // BUG-019 (2026-07-18 audit): insert + counter update run in one atomic
    // batch so a partial failure can never leave a vote row whose increment
    // didn't land. The counter is recomputed from the votes table instead of
    // incremented, which also self-heals any drift accumulated previously.
    // The PRIMARY KEY (preset_id, user_discord_id) still prevents duplicates
    // via ON CONFLICT DO NOTHING.
    const [insertResult, updateResult] = await db.batch([
      db
        .prepare(
          'INSERT INTO votes (preset_id, user_discord_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
        )
        .bind(presetId, userDiscordId, now),
      db
        .prepare(
          `UPDATE presets
           SET vote_count = (SELECT COUNT(*) FROM votes WHERE preset_id = ?), updated_at = ?
           WHERE id = ? RETURNING vote_count`
        )
        .bind(presetId, now, presetId),
    ]);

    const newCount =
      (updateResult.results as { vote_count: number }[] | undefined)?.[0]?.vote_count ?? 0;

    // changes = 0 on the insert means the user had already voted
    if (insertResult.meta.changes === 0) {
      return {
        success: true,
        already_voted: true,
        new_vote_count: newCount,
      };
    }

    return {
      success: true,
      new_vote_count: newCount,
    };
  } catch (error) {
    console.error('Failed to add vote:', error);
    return {
      success: false,
      error: 'Failed to add vote',
    };
  }
}

/**
 * Remove a vote from a preset
 *
 * Uses DELETE with changes check to avoid race conditions and reduce queries.
 */
export async function removeVote(
  db: D1Database,
  presetId: string,
  userDiscordId: string
): Promise<VoteResponse> {
  const now = new Date().toISOString();

  try {
    // BUG-019 (2026-07-18 audit): delete + counter update in one atomic batch,
    // recomputing the counter from the votes table (see addVote)
    const [deleteResult, updateResult] = await db.batch([
      db
        .prepare('DELETE FROM votes WHERE preset_id = ? AND user_discord_id = ?')
        .bind(presetId, userDiscordId),
      db
        .prepare(
          `UPDATE presets
           SET vote_count = (SELECT COUNT(*) FROM votes WHERE preset_id = ?), updated_at = ?
           WHERE id = ? RETURNING vote_count`
        )
        .bind(presetId, now, presetId),
    ]);

    const newCount =
      (updateResult.results as { vote_count: number }[] | undefined)?.[0]?.vote_count ?? 0;

    // changes = 0 on the delete means no vote existed to remove
    if (deleteResult.meta.changes === 0) {
      return {
        success: true,
        already_voted: false,
        new_vote_count: newCount,
      };
    }

    return {
      success: true,
      new_vote_count: newCount,
    };
  } catch (error) {
    console.error('Failed to remove vote:', error);
    return {
      success: false,
      error: 'Failed to remove vote',
    };
  }
}

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/v1/votes/:presetId
 * Add a vote to a preset
 */
votesRouter.post('/:presetId', async (c) => {
  // Require authentication
  const authError = requireAuth(c);
  if (authError) return authError;

  // Require user context
  const userError = requireUserContext(c);
  if (userError) return userError;

  // (ban check: router-level requireNotBanned, see top of file)

  const auth = c.get('auth');
  const presetId = c.req.param('presetId');

  // Check preset exists AND is approved (FINDING-016)
  const preset = await c.env.DB.prepare(APPROVED_PRESET_GATE).bind(presetId).first();

  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  const result = await addVote(c.env.DB, presetId, auth.userDiscordId!);

  if (!result.success) {
    return c.json(result, 500);
  }

  if (result.already_voted) {
    return c.json(result, 409); // Conflict
  }

  return c.json(result);
});

/**
 * DELETE /api/v1/votes/:presetId
 * Remove a vote from a preset
 */
votesRouter.delete('/:presetId', async (c) => {
  // Require authentication
  const authError = requireAuth(c);
  if (authError) return authError;

  // Require user context
  const userError = requireUserContext(c);
  if (userError) return userError;

  const auth = c.get('auth');
  const presetId = c.req.param('presetId');

  // Check preset exists AND is approved (FINDING-016) — same gate as POST, so
  // the vote routes never confirm the existence of a non-public preset
  const preset = await c.env.DB.prepare(APPROVED_PRESET_GATE).bind(presetId).first();

  if (!preset) {
    return notFoundResponse(c, 'Preset');
  }

  const result = await removeVote(c.env.DB, presetId, auth.userDiscordId!);
  return c.json(result);
});

/**
 * GET /api/v1/votes/:presetId/check
 * Check if current user has voted for a preset
 */
votesRouter.get('/:presetId/check', async (c) => {
  // Require authentication
  const authError = requireAuth(c);
  if (authError) return authError;

  // Require user context
  const userError = requireUserContext(c);
  if (userError) return userError;

  const auth = c.get('auth');
  const presetId = c.req.param('presetId');

  const vote = await c.env.DB.prepare(
    'SELECT 1 FROM votes WHERE preset_id = ? AND user_discord_id = ?'
  )
    .bind(presetId, auth.userDiscordId!)
    .first();

  return c.json({ has_voted: !!vote });
});
