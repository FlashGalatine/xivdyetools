/**
 * Shared OAuth provider flow factories
 *
 * REFACTOR-008 (2026-07-18 audit): the Discord and XIVAuth handlers repeated
 * the same authorize and GET-callback pipeline with copy-paste variations —
 * drift between the copies produced BUG-018 (three divergent redirect-URI
 * allowlists) and REFACTOR-007 (divergent state-expiry semantics). The
 * pipeline is implemented once here; provider files supply a config object.
 * (The POST token-exchange handlers remain provider-specific — their user
 * mapping and persistence differ substantially.)
 */

import type { Context } from 'hono';
import type { Env } from '../types.js';
import { STATE_EXPIRY_SECONDS, getAllowedRedirectOrigins } from '../constants/oauth.js';
import { signState, verifyState } from '../utils/state-signing.js';
import { validateCodeChallenge, validateRedirectUri } from '../utils/oauth-validation.js';

/**
 * Per-provider configuration for the shared authorize/callback pipeline
 */
export interface OAuthFlowConfig {
  /** Provider marker stored in the signed state */
  provider: 'discord' | 'xivauth';
  /** Provider's authorization endpoint */
  authUrl: string;
  /** Space-separated scopes to request */
  scopes: string;
  /** OAuth client ID for this provider */
  clientId: (env: Env) => string;
  /** Worker-side callback path the provider redirects to (e.g. '/auth/callback') */
  workerCallbackPath: string;
  /** Whether frontend redirects carry a `provider=<name>` marker (XIVAuth does) */
  markProviderOnRedirect: boolean;
}

type OAuthContext = Context<{ Bindings: Env }>;

/**
 * Build the frontend error-redirect used by GET callbacks
 */
function frontendErrorRedirect(
  c: OAuthContext,
  config: OAuthFlowConfig,
  message: string
): Response {
  const redirectUrl = new URL(`${c.env.FRONTEND_URL}/auth/callback`);
  redirectUrl.searchParams.set('error', message);
  if (config.markProviderOnRedirect) {
    redirectUrl.searchParams.set('provider', config.provider);
  }
  return c.redirect(redirectUrl.toString());
}

/**
 * Shared authorize handler: validates PKCE params and the redirect URI,
 * signs the state, and redirects to the provider's consent screen.
 *
 * SECURITY NOTE: The code_verifier must NEVER be sent to this endpoint.
 * It stays on the client and is sent directly to the POST callback —
 * the core security guarantee of PKCE.
 */
export function buildAuthorizeHandler(config: OAuthFlowConfig) {
  return async (c: OAuthContext): Promise<Response> => {
    const { code_challenge, code_challenge_method, state, redirect_uri, return_path } =
      c.req.query();

    // Validate PKCE parameters
    if (!code_challenge) {
      return c.json(
        {
          error: 'Missing code_challenge',
          message: 'PKCE code_challenge is required for security',
        },
        400
      );
    }

    if (!validateCodeChallenge(code_challenge)) {
      return c.json(
        {
          error: 'Invalid code_challenge format',
          message: 'code_challenge must be a valid base64url-encoded value',
        },
        400
      );
    }

    if (code_challenge_method && code_challenge_method !== 'S256') {
      return c.json(
        {
          error: 'Invalid code_challenge_method',
          message: 'Only S256 is supported',
        },
        400
      );
    }

    // BUG-018: single shared allowlist (env-filtered) for every flow step
    const allowedOrigins = getAllowedRedirectOrigins(c.env);
    const finalRedirectUri = redirect_uri || `${c.env.FRONTEND_URL}/auth/callback`;

    try {
      validateRedirectUri(finalRedirectUri, allowedOrigins);
    } catch {
      return c.json(
        {
          error: 'Invalid redirect_uri',
          message: 'Redirect URI is not whitelisted',
        },
        400
      );
    }

    // Generate state with only safe data (NO code_verifier!)
    const now = Math.floor(Date.now() / 1000);
    const stateData = {
      csrf: state || crypto.randomUUID(),
      code_challenge, // Stored for logging/debugging only
      redirect_uri: finalRedirectUri,
      return_path: return_path || '/',
      provider: config.provider,
      iat: now,
      exp: now + STATE_EXPIRY_SECONDS, // 10 minute expiration
    };

    // SECURITY: Sign state to prevent tampering
    const encodedState = await signState(stateData, c.env.JWT_SECRET);

    // Build provider authorization URL
    const providerUrl = new URL(config.authUrl);
    providerUrl.searchParams.set('client_id', config.clientId(c.env));
    providerUrl.searchParams.set('redirect_uri', `${c.env.WORKER_URL}${config.workerCallbackPath}`);
    providerUrl.searchParams.set('response_type', 'code');
    providerUrl.searchParams.set('scope', config.scopes);
    providerUrl.searchParams.set('state', encodedState);
    providerUrl.searchParams.set('code_challenge', code_challenge);
    providerUrl.searchParams.set('code_challenge_method', 'S256');

    return c.redirect(providerUrl.toString());
  };
}

/**
 * Shared GET callback handler: the provider redirects here after consent.
 *
 * SECURITY: This endpoint does NOT exchange the code. It verifies the signed
 * state (signature + expiry, enforced inside verifyState — REFACTOR-007),
 * re-validates the redirect target against the shared allowlist (BUG-018),
 * and bounces the auth code to the frontend, which then calls the POST
 * callback with the code_verifier from sessionStorage.
 */
export function buildGetCallbackHandler(config: OAuthFlowConfig) {
  return async (c: OAuthContext): Promise<Response> => {
    const { code, state, error, error_description } = c.req.query();

    // Handle provider errors
    if (error) {
      return frontendErrorRedirect(c, config, error_description || error);
    }

    // Validate required parameters
    if (!code || !state) {
      return frontendErrorRedirect(c, config, 'Missing code or state parameter');
    }

    // SECURITY: Verify state signature + expiry to prevent tampering/replay
    // BUG-013: Only allow unsigned states in development
    let stateData;
    try {
      const allowUnsigned = c.env.ENVIRONMENT === 'development';
      stateData = await verifyState(state, c.env.JWT_SECRET, allowUnsigned);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid state';
      return frontendErrorRedirect(c, config, errorMsg);
    }

    // OAUTH-CRITICAL-002 / BUG-018: validate the redirect target against the
    // same shared allowlist used at authorize time — prevents open redirects
    // while keeping every allowlisted origin (incl. the transition domain)
    // consistent across both flow steps.
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(stateData.redirect_uri);
      validateRedirectUri(stateData.redirect_uri, getAllowedRedirectOrigins(c.env));
    } catch {
      console.error('Blocked redirect to untrusted origin:', stateData.redirect_uri);
      return frontendErrorRedirect(c, config, 'Untrusted redirect origin');
    }

    // Redirect back to frontend with the auth code
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('csrf', stateData.csrf);
    if (config.markProviderOnRedirect) {
      redirectUrl.searchParams.set('provider', config.provider);
    }
    if (stateData.return_path && stateData.return_path !== '/') {
      redirectUrl.searchParams.set('return_path', stateData.return_path);
    }

    return c.redirect(redirectUrl.toString());
  };
}
