/**
 * Authentication Middleware
 * Handles bot authentication (BOT_API_SECRET) and web authentication (JWT)
 *
 * REFACTOR-003: Now uses @xivdyetools/auth for JWT and bot signature verification
 */

import type { Context, Next } from 'hono';
import type { Env, AuthContext } from '../types.js';
import {
  verifyJWT as sharedVerifyJWT,
  verifyBotSignature,
  verifyBotSignatureV2,
  BOT_SIGNATURE_V2_HEADER,
  BOT_SIGNATURE_NONCE_HEADER,
  isTokenRevoked,
} from '@xivdyetools/auth';

type Variables = {
  auth: AuthContext;
};

// ============================================
// JWT VERIFICATION (Web Auth)
// ============================================

/**
 * Extended JWT payload for this application
 * Includes the identity/display fields the oauth worker mints beyond the base JWTPayload
 */
interface ExtendedJWTPayload {
  /**
   * Subject — the oauth worker's INTERNAL user UUID (`users.id`), NOT the
   * Discord snowflake. Only used as the identity fallback for accounts that
   * have no Discord ID (XIVAuth-only logins). See resolveJWTUserId().
   */
  sub: string;
  iat: number;
  exp: number;
  iss?: string;
  type?: 'access' | 'refresh';
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
  /** Discord snowflake (present for Discord logins and Discord-linked XIVAuth accounts) */
  discord_id?: string;
  auth_provider?: 'discord' | 'xivauth';
}

/**
 * Resolve the acting user's identity from a verified JWT.
 *
 * `author_discord_id`, `votes.user_discord_id`, `moderation_log.moderator_discord_id`,
 * `banned_users.discord_id` and `MODERATOR_IDS` are all keyed by the Discord
 * snowflake — that is the identity the bot path (discord-worker /
 * moderation-worker via `X-User-Discord-ID`) supplies. The oauth worker puts
 * its internal user UUID in `sub` and the snowflake in `discord_id`, so a
 * web session must resolve to the SAME snowflake or the same person becomes
 * two different authors (one per client), can't edit bot-submitted presets
 * from the web (and vice versa), never appears banned, and is never a
 * moderator via the web.
 *
 * Falls back to `sub` only when the token carries no usable `discord_id`
 * (XIVAuth-only accounts, which have no snowflake to share with the bot).
 */
export function resolveJWTUserId(payload: Pick<ExtendedJWTPayload, 'sub' | 'discord_id'>): string {
  const discordId = payload.discord_id;
  if (typeof discordId === 'string' && discordId.length > 0) {
    return discordId;
  }
  return payload.sub;
}

/**
 * Verify JWT and return extended payload
 * REFACTOR-003: Uses @xivdyetools/auth for core verification
 *
 * FINDING-002 / FINDING-015 (2026-08-21 security audit):
 * - When the oauth worker's `TOKEN_BLACKLIST` KV is bound, a token whose
 *   `jti` has been revoked (logout, rotation) is rejected here too — before
 *   this, revocation only affected `/auth/me` + `/auth/refresh` on the oauth
 *   worker and a logged-out token kept full API access until `exp`.
 *   `isTokenRevoked` is fail-open on KV errors (documented in the oauth
 *   README); the binding being absent (dev/tests) skips the check.
 * - When `JWT_ISSUER` is configured, `iss` must match it, so tokens minted by
 *   any other issuer sharing the secret (e.g. a preview env) are refused.
 */
async function verifyJWT(token: string, env: Env): Promise<ExtendedJWTPayload | null> {
  if (!env.JWT_SECRET) return null;

  // Use shared JWT verification which handles:
  // - Algorithm validation (HS256 only)
  // - Signature verification
  // - Claim typing, expiration, optional issuer pinning
  const payload = await sharedVerifyJWT(token, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER || undefined,
  });

  if (!payload) return null;

  if (payload.jti && env.TOKEN_BLACKLIST) {
    const revoked = await isTokenRevoked(payload.jti, env.TOKEN_BLACKLIST);
    if (revoked) return null;
  }

  // The shared JWTPayload type only declares the base claims; the oauth
  // worker's extra claims (discord_id, auth_provider) ride along and are
  // exposed through ExtendedJWTPayload's optional fields.
  return payload;
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

/**
 * BUG-053 (2026-07-18 audit): constant-time string comparison for the bot API
 * secret. Comparing SHA-256 digests keeps the comparison fixed-length and
 * fixed-time regardless of where the strings first differ, matching the
 * constant-time treatment already used for HMAC/JWT verification elsewhere.
 */
async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i] ^ ub[i];
  return diff === 0;
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
    // BUG-053: constant-time comparison (timing side-channel hardening)
    if (c.env.BOT_API_SECRET && (await timingSafeEqualStr(token, c.env.BOT_API_SECRET))) {
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
        const signatureV2 = c.req.header(BOT_SIGNATURE_V2_HEADER);
        const timestamp = c.req.header('X-Request-Timestamp');

        let isValidSignature: boolean;
        if (signatureV2 !== undefined) {
          // FINDING-014 (2026-08-21 audit): v2 binds method + path + body hash +
          // timestamp + nonce + identity with a 60 s window. When the header is
          // present it MUST verify — never fall back to v1, or a captured v1
          // tuple could be replayed against any route by dropping the v2 header.
          // Body read via Hono's cache so downstream c.req.json() still works.
          const body = ['GET', 'HEAD'].includes(c.req.method) ? undefined : await c.req.arrayBuffer();
          isValidSignature = await verifyBotSignatureV2(
            signatureV2,
            {
              method: c.req.method,
              path: new URL(c.req.url).pathname,
              body,
              timestamp,
              nonce: c.req.header(BOT_SIGNATURE_NONCE_HEADER),
              userDiscordId,
              userName,
            },
            c.env.BOT_SIGNING_SECRET
          );
        } else {
          // v1 (timestamp:userId:userName) — kept for rollover; both bots send v2
          // as of 2026-08-21 and v1 is slated for removal once they are deployed.
          // REFACTOR-003: Uses @xivdyetools/auth for bot signature verification
          isValidSignature = await verifyBotSignature(
            signature,
            timestamp,
            userDiscordId,
            userName,
            c.env.BOT_SIGNING_SECRET
          );
        }

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
      const jwtPayload = await verifyJWT(token, c.env);

      if (jwtPayload) {
        // Use display name if available, fallback to username
        const displayName = jwtPayload.global_name || jwtPayload.username;
        // Discord snowflake when the token has one, internal UUID otherwise —
        // must match what the bot path puts in X-User-Discord-ID
        const userId = resolveJWTUserId(jwtPayload);

        auth = {
          isAuthenticated: true,
          isModerator: checkModerator(userId, c.env.MODERATOR_IDS),
          userDiscordId: userId,
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
