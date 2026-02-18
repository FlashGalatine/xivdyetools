/**
 * Authentication Middleware
 * Handles bot authentication (BOT_API_SECRET) and web authentication (JWT)
 *
 * REFACTOR-003: Now uses @xivdyetools/auth for JWT and bot signature verification
 */

import type { Context, Next } from 'hono';
import type { Env, AuthContext } from '../types.js';
import { verifyJWT as sharedVerifyJWT, verifyBotSignature } from '@xivdyetools/auth';

type Variables = {
  auth: AuthContext;
};

// ============================================
// JWT VERIFICATION (Web Auth)
// ============================================

/**
 * Extended JWT payload for this application
 * Includes Discord-specific fields beyond the base JWTPayload
 */
interface ExtendedJWTPayload {
  sub: string; // Discord user ID
  iat: number;
  exp: number;
  iss?: string;
  type?: 'access' | 'refresh';
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
}

/**
 * Verify JWT and return extended payload
 * REFACTOR-003: Uses @xivdyetools/auth for core verification
 */
async function verifyJWT(token: string, secret: string): Promise<ExtendedJWTPayload | null> {
  // Use shared JWT verification which handles:
  // - Algorithm validation (HS256 only)
  // - Signature verification
  // - Expiration checking
  const payload = await sharedVerifyJWT(token, secret);

  if (!payload) return null;

  // Cast to extended type - the JSON payload may have additional fields
  return payload as unknown as ExtendedJWTPayload;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a user ID is in the moderator list
 * Handles various formats: comma-separated, space-separated, newline-separated
 */
function checkModerator(userDiscordId: string | undefined, moderatorIds: string): boolean {
  if (!userDiscordId || !moderatorIds) return false;
  // Split on any combination of whitespace and/or commas for maximum flexibility
  // This handles: "123,456", "123, 456", "123 456", "123\n456", etc.
  const ids = moderatorIds
    .split(/[\s,]+/)
    .filter(Boolean); // Remove empty strings from split
  return ids.includes(userDiscordId);
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Extract and validate authentication from request headers
 * Supports two authentication methods:
 * 1. Bot Auth: Bearer token = BOT_API_SECRET with X-User-Discord-ID header
 * 2. Web Auth: Bearer token = JWT from OAuth worker
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header('Authorization');
  const userDiscordId = c.req.header('X-User-Discord-ID');
  const userName = c.req.header('X-User-Discord-Name');

  // Default: unauthenticated
  let auth: AuthContext = {
    isAuthenticated: false,
    isModerator: false,
    authSource: 'none',
  };

  // Check for Bearer token authentication
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // Method 1: Bot authentication (BOT_API_SECRET)
    if (token === c.env.BOT_API_SECRET) {
      // SECURITY: Require HMAC signature for bot authentication in production
      // This prevents header spoofing attacks where an attacker with the API secret
      // could set arbitrary X-User-Discord-ID headers to impersonate users
      const isDevOrTest = c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === 'test';

      if (!c.env.BOT_SIGNING_SECRET) {
        if (isDevOrTest) {
          // Allow unsigned bot auth in development/test for easier testing
          // In production, BOT_SIGNING_SECRET must be configured
          auth = {
            isAuthenticated: true,
            isModerator: checkModerator(userDiscordId, c.env.MODERATOR_IDS),
            userDiscordId: userDiscordId || undefined,
            userName: userName || undefined,
            authSource: 'bot',
          };
        } else {
          // CRITICAL: BOT_SIGNING_SECRET not configured in production - reject bot auth
          console.error('Bot auth: BOT_SIGNING_SECRET not configured - rejecting authentication');
          // Don't authenticate - let the request proceed as unauthenticated
        }
      } else {
        const signature = c.req.header('X-Request-Signature');
        const timestamp = c.req.header('X-Request-Timestamp');

        // REFACTOR-003: Uses @xivdyetools/auth for bot signature verification
        const isValidSignature = await verifyBotSignature(
          signature,
          timestamp,
          userDiscordId,
          userName,
          c.env.BOT_SIGNING_SECRET
        );

        if (!isValidSignature) {
          // Log failed signature attempts (but don't reveal details)
          console.warn('Bot auth: Invalid or missing request signature', {
            hasSignature: !!signature,
            hasTimestamp: !!timestamp,
            path: c.req.path,
          });
          // Don't authenticate - let the request proceed as unauthenticated
          // The route handler will return 401 if auth is required
        } else {
          auth = {
            isAuthenticated: true,
            isModerator: checkModerator(userDiscordId, c.env.MODERATOR_IDS),
            userDiscordId: userDiscordId || undefined,
            userName: userName || undefined,
            authSource: 'bot',
          };
        }
      }
    }
    // Method 2: Web authentication (JWT)
    else if (c.env.JWT_SECRET) {
      const jwtPayload = await verifyJWT(token, c.env.JWT_SECRET);

      if (jwtPayload) {
        // Use display name if available, fallback to username
        const displayName = jwtPayload.global_name || jwtPayload.username;

        auth = {
          isAuthenticated: true,
          isModerator: checkModerator(jwtPayload.sub, c.env.MODERATOR_IDS),
          userDiscordId: jwtPayload.sub,
          userName: displayName,
          authSource: 'web',
        };
      }
    }
  }

  // Set auth context for downstream handlers
  c.set('auth', auth);

  await next();
}

/**
 * Require authentication for protected routes
 * Use as middleware on specific routes
 */
export function requireAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>
): Response | null {
  const auth = c.get('auth');

  if (!auth.isAuthenticated) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Valid authentication required',
      },
      401
    );
  }

  return null;
}

/**
 * Require moderator privileges
 * Use as middleware on moderation routes
 */
export function requireModerator(
  c: Context<{ Bindings: Env; Variables: Variables }>
): Response | null {
  const auth = c.get('auth');

  if (!auth.isAuthenticated) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Valid authentication required',
      },
      401
    );
  }

  if (!auth.isModerator) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'Moderator privileges required',
      },
      403
    );
  }

  return null;
}

/**
 * Require user Discord ID in auth context
 * For endpoints that need to know who is making the request
 * Works for both bot auth (from header) and web auth (from JWT)
 */
export function requireUserContext(
  c: Context<{ Bindings: Env; Variables: Variables }>
): Response | null {
  const auth = c.get('auth');

  if (!auth.userDiscordId) {
    return c.json(
      {
        error: 'Bad Request',
        message: 'User context required (login or provide X-User-Discord-ID header)',
      },
      400
    );
  }

  return null;
}
