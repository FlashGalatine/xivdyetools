/**
 * Token Refresh and User Info Handler
 */

import { Hono } from 'hono';
import type { Env, RefreshResponse, UserInfoResponse, JWTPayload } from '../types.js';
import {
  verifyJWT,
  getAvatarUrl,
  verifyJWTSignatureOnly,
  verifyJWTWithRevocationCheck,
  revokeToken,
  isTokenRevoked,
  // REFACTOR-001: single shared mint primitive (replaces createJWTFromPayload)
  signPayload,
} from '../services/jwt-service.js';
import { findUserById } from '../services/user-service.js';

export const tokenRouter = new Hono<{ Bindings: Env }>();

/**
 * BUG-021 (2026-07-18 audit): absolute session lifetime. A refresh chain is
 * anchored by orig_iat (carried unchanged across refreshes); once the chain
 * is older than this, the user must log in again.
 */
const MAX_SESSION_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * POST /auth/refresh
 * Refresh an existing JWT (must not be expired by more than 24 hours)
 *
 * Body:
 * - token: Current JWT (can be recently expired)
 */
tokenRouter.post('/refresh', async (c) => {
  let body: { token: string };

  try {
    body = await c.req.json();
  } catch {
    return c.json<RefreshResponse>(
      {
        success: false,
        error: 'Invalid request body',
      },
      400
    );
  }

  const { token } = body;

  if (!token) {
    return c.json<RefreshResponse>(
      {
        success: false,
        error: 'Missing token',
      },
      400
    );
  }

  try {
    // Try to verify the token (this will fail if expired)
    let payload: JWTPayload;

    try {
      payload = await verifyJWT(token, c.env.JWT_SECRET);
    } catch {
      // If verification failed (likely expired), verify signature and check grace period
      // SECURITY: We MUST verify the signature even for expired tokens
      // to prevent attackers from forging tokens with arbitrary user IDs
      const decoded = await verifyJWTSignatureOnly(token, c.env.JWT_SECRET);

      if (!decoded) {
        // Signature is invalid OR token is malformed
        return c.json<RefreshResponse>(
          {
            success: false,
            error: 'Invalid token',
          },
          401
        );
      }

      // Signature is valid - check grace period
      const now = Math.floor(Date.now() / 1000);
      const gracePeriod = 24 * 60 * 60; // 24 hours

      if (decoded.exp + gracePeriod < now) {
        return c.json<RefreshResponse>(
          {
            success: false,
            error: 'Token has expired and cannot be refreshed',
          },
          401
        );
      }

      // Signature verified, within grace period - use the payload
      payload = decoded;
    }

    // Check if the old token was revoked (if it has JTI)
    if (payload.jti && c.env.TOKEN_BLACKLIST) {
      const wasRevoked = await isTokenRevoked(payload.jti, c.env.TOKEN_BLACKLIST);
      if (wasRevoked) {
        return c.json<RefreshResponse>(
          {
            success: false,
            error: 'Token has been revoked',
          },
          401
        );
      }
    }

    const now = Math.floor(Date.now() / 1000);

    // BUG-021: enforce an absolute session lifetime. orig_iat anchors the
    // chain to the original login; tokens minted before orig_iat existed
    // fall back to their own iat.
    const origIat = payload.orig_iat ?? payload.iat;
    if (now - origIat > MAX_SESSION_SECONDS) {
      return c.json<RefreshResponse>(
        {
          success: false,
          error: 'Session expired, please log in again',
        },
        401
      );
    }

    // BUG-021: re-validate the user still exists — a deleted user's token
    // must not refresh indefinitely
    const user = await findUserById(c.env.DB, payload.sub);
    if (!user) {
      return c.json<RefreshResponse>(
        {
          success: false,
          error: 'Unknown user',
        },
        401
      );
    }

    // Create new JWT with same user info and new JTI
    const expirySeconds = parseInt(c.env.JWT_EXPIRY, 10) || 3600;
    const newExpiry = now + expirySeconds;
    const newJti = crypto.randomUUID();

    const newPayload: JWTPayload = {
      sub: payload.sub,
      iat: now,
      exp: newExpiry,
      iss: c.env.WORKER_URL,
      jti: newJti,
      orig_iat: origIat,
      username: payload.username,
      global_name: payload.global_name,
      avatar: payload.avatar,
      auth_provider: payload.auth_provider,
      discord_id: payload.discord_id,
      xivauth_id: payload.xivauth_id,
      primary_character: payload.primary_character,
    };

    const { token: newToken, expires_at } = await signPayload(newPayload, c.env.JWT_SECRET);

    // BUG-021: rotation must invalidate — best-effort revoke the old token so
    // old and new are not simultaneously valid until natural expiry
    if (payload.jti && c.env.TOKEN_BLACKLIST) {
      await revokeToken(payload.jti, payload.exp, c.env.TOKEN_BLACKLIST);
    }

    return c.json<RefreshResponse>({
      success: true,
      token: newToken,
      expires_at,
    });
  } catch (err) {
    console.error('Token refresh error:', err);

    return c.json<RefreshResponse>(
      {
        success: false,
        error: 'Failed to refresh token',
      },
      500
    );
  }
});

/**
 * GET /auth/me
 * Get current user info from JWT
 *
 * Headers:
 * - Authorization: Bearer <token>
 */
tokenRouter.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json<UserInfoResponse>(
      {
        success: false,
        error: 'Missing or invalid Authorization header',
      },
      401
    );
  }

  const token = authHeader.slice(7);

  try {
    // Use revocation-aware verification if KV is available
    const payload = await verifyJWTWithRevocationCheck(
      token,
      c.env.JWT_SECRET,
      c.env.TOKEN_BLACKLIST
    );

    return c.json<UserInfoResponse>({
      success: true,
      user: {
        id: payload.sub,
        username: payload.username,
        global_name: payload.global_name,
        avatar: payload.avatar,
        avatar_url: getAvatarUrl(payload.sub, payload.avatar),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';

    return c.json<UserInfoResponse>(
      {
        success: false,
        error: message,
      },
      401
    );
  }
});

/**
 * POST /auth/revoke
 * Logout - invalidate token by adding JTI to blacklist
 *
 * Headers:
 * - Authorization: Bearer <token>
 *
 * If KV namespace is configured, adds the token's JTI to the blacklist.
 * Token will be rejected by /auth/me and other endpoints until it expires naturally.
 */
tokenRouter.post('/revoke', async (c) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      {
        success: false,
        error: 'Missing or invalid Authorization header',
      },
      401
    );
  }

  const token = authHeader.slice(7);

  try {
    // Verify the token is valid (we need jti and exp from payload)
    const payload = await verifyJWTSignatureOnly(token, c.env.JWT_SECRET);

    if (!payload) {
      return c.json(
        {
          success: false,
          error: 'Invalid token',
        },
        401
      );
    }

    // Attempt to revoke if KV is available and token has JTI
    if (payload.jti && c.env.TOKEN_BLACKLIST) {
      const revoked = await revokeToken(
        payload.jti,
        payload.exp,
        c.env.TOKEN_BLACKLIST
      );

      if (revoked) {
        return c.json({
          success: true,
          message: 'Token revoked successfully',
          revoked: true,
        });
      }
    }

    // Fallback: KV not available or no JTI, client should still clear token
    return c.json({
      success: true,
      message: 'Token marked for revocation. Please clear client-side storage.',
      revoked: false,
      note: c.env.TOKEN_BLACKLIST
        ? 'Token lacks JTI claim (older token format)'
        : 'Token blacklist not configured',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Revocation failed';

    return c.json(
      {
        success: false,
        error: message,
      },
      500
    );
  }
});
