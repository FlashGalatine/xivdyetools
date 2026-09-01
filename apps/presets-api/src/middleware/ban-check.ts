/**
 * Ban Check Middleware
 *
 * Checks if the authenticated user is banned from Preset Palettes.
 * Returns 403 Forbidden if the user is banned.
 *
 * FINDING-017 (2026-08-21 security audit): `requireNotBanned` is registered
 * once per router for every mutating method (see handlers/presets.ts and
 * handlers/votes.ts), so no write route can forget it; and a failed lookup
 * fails CLOSED (503) everywhere except local development.
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types.js';
import type { AuthContext } from '@xivdyetools/types';
import { ErrorCode } from '../utils/api-response.js';
import { getLogger } from '@xivdyetools/worker-kit';

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
  return result !== null && result !== undefined;
}

function bannedResponse(c: Context<{ Bindings: Env; Variables: Variables }>): Response {
  return c.json(
    {
      success: false,
      error: ErrorCode.USER_BANNED,
      message: 'You have been banned from using Preset Palettes.',
    },
    403
  );
}

/**
 * What a failed ban lookup means (FINDING-017 / PAPI-9).
 *
 * Before: `console.error` then carry on — a D1 incident (or a thrown query)
 * silently admitted banned users to every write path. Now the request fails
 * CLOSED with a 503 that does not mention bans at all. The single exception
 * is `ENVIRONMENT === 'development'`, where a fresh local D1 may not have
 * the `banned_users` table yet; that fails open with a loud warning. Anything
 * else — production, 'test', a typo, undefined — gets the secure default.
 *
 * @returns the 503 to send, or null to continue (development only)
 */
function banLookupFailure(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  error: unknown
): Response | null {
  const logger = getLogger(c);
  (logger ?? console).error('Ban check failed', error);

  if (c.env.ENVIRONMENT === 'development') {
    (logger ?? console).warn(
      '[ban-check] ban lookup failed — continuing WITHOUT a ban check because ENVIRONMENT is development ' +
        '(a fresh local D1 may lack banned_users: run `npm run db:migrate:local`). Every other environment fails closed.'
    );
    return null;
  }

  return c.json(
    {
      success: false,
      error: ErrorCode.SERVICE_UNAVAILABLE,
      message: 'Unable to verify account status right now. Please try again shortly.',
    },
    503
  );
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
    if (await isUserBanned(c.env.DB, auth.userDiscordId)) {
      return bannedResponse(c);
    }
  } catch (error) {
    // FINDING-017: fail closed (503) unless this is local development
    const failure = banLookupFailure(c, error);
    if (failure) return failure;
  }

  return next();
}
