/**
 * XIVAuth OAuth Handler
 * Handles XIVAuth OAuth flow with PKCE for FFXIV community authentication
 */

import { Hono } from 'hono';
import { getLogger } from '@xivdyetools/worker-kit';
import { isValidSnowflake } from '@xivdyetools/types';
import type {
  Env,
  XIVAuthTokenResponse,
  XIVAuthUser,
  XIVAuthCharacterRegistration,
  AuthResponse,
} from '../types.js';
import { createJWTForUser } from '../services/jwt-service.js';
import { findOrCreateUser } from '../services/user-service.js';
import {
  REQUEST_TIMEOUT_MS,
  USER_INFO_TIMEOUT_MS,
  XIVAUTH_REQUIRED_SCOPES,
} from '../constants/oauth.js';
import { validateCodeVerifier, validateScopes } from '../utils/oauth-validation.js';
import { verifyPkceStateBinding } from '../utils/pkce-binding.js';
import {
  buildAuthorizeHandler,
  buildGetCallbackHandler,
  type OAuthFlowConfig,
} from './oauth-flow.js';

export const xivauthRouter = new Hono<{ Bindings: Env }>();

// XIVAuth OAuth endpoints
const XIVAUTH_AUTH_URL = 'https://xivauth.net/oauth/authorize';
const XIVAUTH_TOKEN_URL = 'https://xivauth.net/oauth/token';
const XIVAUTH_USER_URL = 'https://xivauth.net/api/v1/user';
const XIVAUTH_CHARACTERS_URL = 'https://xivauth.net/api/v1/characters';

// Scopes to request from XIVAuth
// - user: Basic user info (User ID, username)
// - user:social: Discord ID for moderation compatibility
// - character: FFXIV character info
// - refresh: Refresh token support
const XIVAUTH_FLOW_CONFIG: OAuthFlowConfig = {
  provider: 'xivauth',
  authUrl: XIVAUTH_AUTH_URL,
  scopes: 'user user:social character refresh',
  clientId: (env) => env.XIVAUTH_CLIENT_ID,
  workerCallbackPath: '/auth/xivauth/callback',
  markProviderOnRedirect: true,
};

/**
 * GET /auth/xivauth — initiate the flow
 * GET /auth/xivauth/callback — bounce the auth code to the frontend
 * REFACTOR-008: both use the shared pipeline in oauth-flow.ts
 */
xivauthRouter.get('/xivauth', buildAuthorizeHandler(XIVAUTH_FLOW_CONFIG));
xivauthRouter.get('/xivauth/callback', buildGetCallbackHandler(XIVAUTH_FLOW_CONFIG));

/**
 * POST /auth/xivauth/callback
 * Exchange authorization code for tokens (called by frontend with PKCE verifier)
 *
 * Body:
 * - code: Authorization code from XIVAuth
 * - code_verifier: PKCE verifier to prove ownership
 * - state: the signed state echoed by the GET callback — REQUIRED; the
 *   verifier is bound to the signed code_challenge (FINDING-012)
 *
 * FINDING-013 / OAUTH-7 (2026-08-21 security audit): everything this handler
 * logs goes through the request-scoped structured logger and carries no
 * identifiers — no XIVAuth id, linked Discord id, username, character name or
 * response key lists; upstream error bodies are development-only. The
 * request ID on every entry is the correlation handle.
 */
xivauthRouter.post('/xivauth/callback', async (c) => {
  const logger = getLogger(c);
  const isDevelopment = c.env.ENVIRONMENT === 'development';

  let body: { code: string; code_verifier: string; state?: unknown };

  try {
    body = await c.req.json();
  } catch {
    return c.json<AuthResponse>(
      {
        success: false,
        error: 'Invalid request body',
      },
      400
    );
  }

  const { code, code_verifier, state } = body;

  if (!code || !code_verifier) {
    return c.json<AuthResponse>(
      {
        success: false,
        error: 'Missing code or code_verifier',
      },
      400
    );
  }

  // SECURITY: Validate code_verifier format (RFC 7636)
  // Must be 43-128 characters using only unreserved characters: [A-Za-z0-9-._~]
  // This is defense in depth - XIVAuth also validates this
  if (!validateCodeVerifier(code_verifier)) {
    return c.json<AuthResponse>(
      {
        success: false,
        error: 'Invalid code_verifier format',
      },
      400
    );
  }

  // FINDING-012 / OAUTH-5: the SPA returns the signed state from the GET
  // bounce; bind the verifier to the challenge this worker signed at authorize
  // time BEFORE calling XIVAuth (same contract as callback.ts). REQUIRED —
  // without it there is nothing to bind to and the exchange does not reach
  // the provider.
  if (state === undefined || state === null || state === '') {
    return c.json<AuthResponse>(
      {
        success: false,
        error: 'Missing state',
      },
      400
    );
  }

  const binding = await verifyPkceStateBinding(state, code_verifier, 'xivauth', c.env.JWT_SECRET);
  if (!binding.ok) {
    return c.json<AuthResponse>(
      {
        success: false,
        error: binding.reason === 'pkce_mismatch' ? 'PKCE verification failed' : 'Invalid state',
      },
      400
    );
  }

  try {
    // Build token exchange parameters
    // client_secret is optional - XIVAuth supports public client mode with PKCE only
    const tokenParams: Record<string, string> = {
      client_id: c.env.XIVAUTH_CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${c.env.WORKER_URL}/auth/xivauth/callback`,
      code_verifier,
    };

    // Include client_secret only if configured (confidential client mode)
    if (c.env.XIVAUTH_CLIENT_SECRET) {
      tokenParams.client_secret = c.env.XIVAUTH_CLIENT_SECRET;
    }

    // Exchange code for tokens with PKCE verifier
    // Added 10 second timeout to prevent worker hang if XIVAuth API is slow
    const tokenResponse = await fetch(XIVAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), // 10 second timeout
    });

    if (!tokenResponse.ok) {
      // OAUTH-7: status only; the upstream body is development-only (as the
      // Discord path already did)
      logger?.error('XIVAuth token exchange failed', undefined, { status: tokenResponse.status });
      if (isDevelopment) {
        const errorBody = await tokenResponse.text().catch(() => '');
        logger?.debug('XIVAuth token exchange error body', {
          status: tokenResponse.status,
          body: errorBody,
        });
      }

      return c.json<AuthResponse>(
        {
          success: false,
          error: 'Failed to exchange authorization code',
        },
        401
      );
    }

    const tokens: XIVAuthTokenResponse = await tokenResponse.json();

    logger?.debug('XIVAuth token exchange successful', {
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
    });

    // SECURITY: Validate that we received the required scopes
    // This ensures the token has the permissions we need
    try {
      validateScopes(tokens.scope, XIVAUTH_REQUIRED_SCOPES);
    } catch (err) {
      logger?.error('XIVAuth token missing required scopes', undefined, {
        received: tokens.scope,
        required: XIVAUTH_REQUIRED_SCOPES,
        reason: err instanceof Error ? err.message : 'Unknown error',
      });
      return c.json<AuthResponse>(
        {
          success: false,
          error: 'Token missing required permissions',
        },
        401
      );
    }

    // Fetch user info from XIVAuth
    // IMPORTANT: Must include Accept header - XIVAuth Rails API requires it (responds with 406 otherwise)
    const userResponse = await fetch(XIVAUTH_USER_URL, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(USER_INFO_TIMEOUT_MS), // 5 second timeout
    });

    if (!userResponse.ok) {
      logger?.error('XIVAuth user info fetch failed', undefined, { status: userResponse.status });
      if (isDevelopment) {
        const errorBody = await userResponse.text().catch(() => '');
        logger?.debug('XIVAuth user info error body', {
          status: userResponse.status,
          body: errorBody,
        });
      }

      return c.json<AuthResponse>(
        {
          success: false,
          error: 'Failed to fetch user information',
        },
        401
      );
    }

    const xivauthUser: XIVAuthUser = await userResponse.json();

    // SECURITY: Validate that required user fields are present
    // This mirrors Discord callback validation (Low severity issue #9)
    if (!xivauthUser.id) {
      logger?.error('XIVAuth user response missing required fields');
      return c.json<AuthResponse>(
        {
          success: false,
          error: 'Invalid user data received',
        },
        401
      );
    }

    logger?.debug('XIVAuth user info received', {
      socialIdentitiesCount: xivauthUser.social_identities?.length ?? 0,
      mfaEnabled: !!xivauthUser.mfa_enabled,
      hasVerifiedCharacters: !!xivauthUser.verified_characters,
    });

    // Fetch characters separately (user endpoint doesn't include them)
    let characters: XIVAuthCharacterRegistration[] = [];
    try {
      const charactersResponse = await fetch(XIVAUTH_CHARACTERS_URL, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(USER_INFO_TIMEOUT_MS), // 5 second timeout
      });

      if (charactersResponse.ok) {
        // BUG-051: the response was assigned to `characters` BEFORE it was
        // known to be an array, so a 200 carrying any non-array body
        // (`{"data": []}`, `null`) made `characters.filter` throw inside this
        // try — and the catch below logged "not a fatal error" and continued
        // WITHOUT restoring `characters` to `[]`. The `characters.find(...)`
        // further down then threw a TypeError outside that catch, reached the
        // handler's outer catch, and the user got
        // `500 { error: 'Authentication failed' }` instead of the degraded
        // login with the `XIVAuth User <id>` fallback name this path exists
        // for. Parse into a local first; the catch then genuinely means
        // "continue without characters".
        const roster = await charactersResponse.json();
        characters = Array.isArray(roster) ? roster : [];
        if (!Array.isArray(roster)) {
          logger?.warn('XIVAuth character roster was not an array', {
            bodyType: roster === null ? 'null' : typeof roster,
          });
        }
        logger?.debug('XIVAuth characters fetched', {
          count: characters.length,
          verifiedCount: characters.filter((ch) => ch.verified).length,
        });
      } else {
        logger?.warn('Failed to fetch XIVAuth characters', { status: charactersResponse.status });
      }
    } catch (charErr) {
      logger?.warn('Error fetching XIVAuth characters', {
        error: charErr instanceof Error ? charErr.name : 'unknown',
      });
      // Continue without characters - not a fatal error
    }

    // Extract linked Discord ID from social_identities array (from user:social scope).
    // FINDING-013 / OAUTH-9: this value becomes the presets-api identity — only a
    // well-formed snowflake is trusted.
    const discordIdentity = xivauthUser.social_identities?.find(
      (identity) => identity.provider === 'discord'
    );
    let linkedDiscordId: string | null = null;
    if (discordIdentity) {
      if (isValidSnowflake(discordIdentity.external_id)) {
        linkedDiscordId = discordIdentity.external_id;
      } else {
        logger?.warn('Ignoring linked Discord identity with a malformed external_id');
      }
    }

    // FINDING-013 / OAUTH-8: only a VERIFIED character may become the display
    // identity (username / global_name — the preset author name downstream);
    // otherwise the opaque label is used (XIVAuth does not expose an account
    // name).
    //
    // FINDING-001 / FINDING-002 (2026-08-29 security audit): the roster is read
    // in memory to make exactly that choice and is then discarded. Nothing else
    // about it is stored (no `xivauth_characters` row) or minted (no
    // `primary_character` claim, no `primary_character` in the response) — an
    // unverified registration in particular is now dropped entirely.
    const verifiedCharacter = characters.find((ch) => ch.verified) ?? null;
    const displayName = verifiedCharacter?.name ?? null;
    const username = displayName ?? `XIVAuth User ${xivauthUser.id.slice(0, 8)}`;

    logger?.debug('Resolving XIVAuth user', {
      hasLinkedDiscord: linkedDiscordId !== null,
      characterCount: characters.length,
      hasVerifiedCharacter: verifiedCharacter !== null,
    });

    // Find or create user in database. Account-link events (including a
    // refused merge) are audit-logged by the service — without identifiers.
    const user = await findOrCreateUser(
      c.env.DB,
      {
        xivauth_id: xivauthUser.id,
        discord_id: linkedDiscordId,
        username,
        auth_provider: 'xivauth',
      },
      logger
    );

    // Create JWT with user info
    const { token, expires_at } = await createJWTForUser(user, c.env, {
      auth_provider: 'xivauth',
      global_name: displayName,
    });

    return c.json<AuthResponse>({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        global_name: displayName, // verified character name only
        avatar: null,
        avatar_url: null, // XIVAuth doesn't provide avatar URL
        auth_provider: 'xivauth',
      },
      expires_at,
    });
  } catch (err) {
    // The structured logger sanitises error objects (no stack in production)
    logger?.error('XIVAuth callback error', err);

    return c.json<AuthResponse>(
      {
        success: false,
        error: 'Authentication failed',
      },
      500
    );
  }
});
