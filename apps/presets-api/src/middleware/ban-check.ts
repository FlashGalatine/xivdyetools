/**
 * Ban Check Middleware
 *
 * Checks if the authenticated user is banned from Preset Palettes.
 * Returns 403 Forbidden if the user is banned.
 *
 * This middleware should be applied to routes that require an unbanned user:
 * - POST /api/v1/presets (submit)
 * - PATCH /api/v1/presets/:id (edit)
 * - POST /api/v1/votes/:presetId (vote)
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types.js';
import type { AuthContext } from '@xivdyetools/types';
import { ErrorCode } from '../utils/api-response.js';

type Variables = {
  auth: AuthContext;
};

/**
 * Check if a Discord user is currently banned
 *
 * @param db - D1 database binding
 * @param discordId - Discord user ID to check
 * @returns True if user is banned, false otherwise
 */
async function isUserBanned(db: D1Database, discordId: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM banned_users WHERE discord_id = ? AND unbanned_at IS NULL LIMIT 1')
    .bind(discordId)
    .first();
  return result !== null;
}

/**
 * Middleware that blocks banned users from making requests
 *
 * Checks the authenticated user's Discord ID against the banned_users table.
 * If the user is banned, returns 403 Forbidden with an error message.
 *
 * Usage:
 * ```ts
 * import { requireNotBanned } from '../middleware/ban-check.js';
 *
 * app.post('/api/v1/presets', requireNotBanned, async (c) => {
 *   // Only unbanned users reach here
 * });
 * ```
 */
export async function requireNotBanned(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
): Promise<Response | void> {
  const auth = c.get('auth');

  // If not authenticated, let other middleware handle it
  if (!auth?.isAuthenticated) {
    return next();
  }

  // If no user ID, let other middleware handle it
  if (!auth.userDiscordId) {
    return next();
  }

  // Check if user is banned
  try {
    const banned = await isUserBanned(c.env.DB, auth.userDiscordId);

    if (banned) {
      return c.json(
        {
          success: false,
          error: ErrorCode.USER_BANNED,
          message: 'You have been banned from using Preset Palettes.',
        },
        403
      );
    }
  } catch (error) {
    // Log error but don't block the request if the check fails
    // This prevents the ban check from breaking the API if the table doesn't exist
    console.error('Ban check failed:', error);
  }

  return next();
}

/**
 * Check ban status without blocking (for informational purposes)
 *
 * This can be used to include ban status in responses without blocking the request.
 *
 * @param db - D1 database binding
 * @param discordId - Discord user ID to check
 * @returns True if user is banned
 */
export async function checkBanStatus(db: D1Database, discordId: string): Promise<boolean> {
  try {
    return await isUserBanned(db, discordId);
  } catch {
    return false;
  }
}

/**
 * Inline guard function to block banned users
 *
 * Use this in route handlers after authentication checks.
 * Returns a 403 Response if banned, or null to continue.
 *
 * Usage:
 * ```ts
 * import { requireNotBannedCheck } from '../middleware/ban-check.js';
 *
 * presetsRouter.post('/', async (c) => {
 *   const authError = requireAuth(c);
 *   if (authError) return authError;
 *
 *   const banError = await requireNotBannedCheck(c);
 *   if (banError) return banError;
 *
 *   // Only unbanned users reach here
 * });
 * ```
 *
 * @param c - Hono context
 * @returns Response if banned, null if allowed to continue
 */
export async function requireNotBannedCheck(
  c: Context<{ Bindings: Env; Variables: Variables }>
): Promise<Response | null> {
  const auth = c.get('auth');

  // If no user ID, nothing to check (let other guards handle it)
  if (!auth?.userDiscordId) {
    return null;
  }

  try {
    const banned = await isUserBanned(c.env.DB, auth.userDiscordId);

    if (banned) {
      return c.json(
        {
          success: false,
          error: ErrorCode.USER_BANNED,
          message: 'You have been banned from using Preset Palettes.',
        },
        403
      );
    }
  } catch (error) {
    // Log error but don't block the request if the check fails
    console.error('Ban check failed:', error);
  }

  return null;
}
