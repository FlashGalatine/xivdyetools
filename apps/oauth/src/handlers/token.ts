/**
 * Token Lifecycle Handler — GET /auth/me, POST /auth/revoke
 *
 * FINDING-003 (2026-08-29 security audit): `POST /auth/refresh` used to live
 * here and is gone. It had no client — the web app re-runs the sign-in flow
 * rather than refreshing — but it accepted a token on signature alone for
 * `REFRESH_GRACE_SECONDS` past `exp` and re-minted from the OLD token's
 * claims, so whoever held a copied token could keep the chain alive for the
 * 30-day `orig_iat` cap and survive the victim's logout (only the presented
 * `jti` was blacklisted; there is no per-user revocation epoch). Sessions now
 * end at `exp`. Do not reintroduce the endpoint without a still-valid-token
 * requirement, a re-read of the user row, and reuse detection.
 */

import { Hono } from 'hono';
import type { Env, UserInfoResponse } from '../types.js';
import {
  getAvatarUrl,
  verifyJWTSignatureOnly,
  verifyJWTWithRevocationCheck,
  revokeToken,
} from '../services/jwt-service.js';

export const tokenRouter = new Hono<{ Bindings: Env }>();

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
