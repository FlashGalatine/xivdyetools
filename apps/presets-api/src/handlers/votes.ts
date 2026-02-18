/**
 * Votes Handler
 * Routes for voting on presets
 */

import { Hono } from 'hono';
import type { Env, AuthContext, VoteResponse } from '../types.js';
import { requireAuth, requireUserContext } from '../middleware/auth.js';
import { requireNotBannedCheck } from '../middleware/ban-check.js';
import { notFoundResponse } from '../utils/api-response.js';

type Variables = {
  auth: AuthContext;
};

export const votesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

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
    // Atomically attempt to insert vote - ON CONFLICT prevents duplicates
    // The PRIMARY KEY (preset_id, user_discord_id) ensures uniqueness
    const insertResult = await db
      .prepare(
        'INSERT INTO votes (preset_id, user_discord_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
      )
      .bind(presetId, userDiscordId, now)
      .run();

    // Check if insert actually added a row (changes = 0 means duplicate)
    if (insertResult.meta.changes === 0) {
      // Already voted - get current count
      const preset = await db
        .prepare('SELECT vote_count FROM presets WHERE id = ?')
        .bind(presetId)
        .first<{ vote_count: number }>();

      return {
        success: true,
        already_voted: true,
        new_vote_count: preset?.vote_count || 0,
      };
    }

    // Vote was inserted - increment count and get new total
    const updateResult = await db
      .prepare(
        'UPDATE presets SET vote_count = vote_count + 1, updated_at = ? WHERE id = ? RETURNING vote_count'
      )
      .bind(now, presetId)
      .first<{ vote_count: number }>();

    return {
      success: true,
      new_vote_count: updateResult?.vote_count || 1,
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
    // Atomically attempt to delete the vote
    const deleteResult = await db
      .prepare('DELETE FROM votes WHERE preset_id = ? AND user_discord_id = ?')
      .bind(presetId, userDiscordId)
      .run();

    // Check if delete actually removed a row (changes = 0 means no vote existed)
    if (deleteResult.meta.changes === 0) {
      // No vote to remove - get current count
      const preset = await db
        .prepare('SELECT vote_count FROM presets WHERE id = ?')
        .bind(presetId)
        .first<{ vote_count: number }>();

      return {
        success: true,
        already_voted: false,
        new_vote_count: preset?.vote_count || 0,
      };
    }

    // Vote was deleted - decrement count and get new total
    const updateResult = await db
      .prepare(
        'UPDATE presets SET vote_count = MAX(0, vote_count - 1), updated_at = ? WHERE id = ? RETURNING vote_count'
      )
      .bind(now, presetId)
      .first<{ vote_count: number }>();

    return {
      success: true,
      new_vote_count: updateResult?.vote_count || 0,
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

  // Check if user is banned
  const banError = await requireNotBannedCheck(c);
  if (banError) return banError;

  const auth = c.get('auth');
  const presetId = c.req.param('presetId');

  // Check preset exists
  const preset = await c.env.DB.prepare('SELECT id FROM presets WHERE id = ?')
    .bind(presetId)
    .first();

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

  // Check preset exists
  const preset = await c.env.DB.prepare('SELECT id FROM presets WHERE id = ?')
    .bind(presetId)
    .first();

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
