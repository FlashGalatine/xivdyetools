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
import {
  validateCodeChallenge,
  validateRedirectUri,
  validateReturnPath,
  validateStateParam,
  MAX_RETURN_PATH_LENGTH,
  MAX_STATE_LENGTH,
} from '../utils/oauth-validation.js';

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
 * Build the frontend error-redirect used by GET callbacks.
 *
 * BUG-049: this always targeted `${FRONTEND_URL}/auth/callback`, discarding the
 * allowlisted origin that actually started the flow. A user on
 * `beta.xivdyetools.app` who cancels the consent screen was dumped on the
 * PRODUCTION site: their beta `sessionStorage` (PKCE verifier, CSRF nonce,
 * return path) is unreachable from there, and the beta app never learns the
 * login failed. Same for the 10-minute state expiry and the untrusted-redirect
 * branch.
 *
 * `origin` is the recovered target when the caller has trustworthy state — the
 * provider-error path DOES carry `state`, so it is recoverable there too. It is
 * only ever a `stateData.redirect_uri` that `validateRedirectUri` has already
 * accepted, so this cannot become an open redirect; `FRONTEND_URL` stays the
 * last-resort fallback.
 */
function frontendErrorRedirect(
  c: OAuthContext,
  config: OAuthFlowConfig,
  message: string,
  origin?: string
): Response {
  const base = origin ?? `${c.env.FRONTEND_URL}/auth/callback`;
  const redirectUrl = new URL(base);
  redirectUrl.searchParams.set('error', message);
  if (config.markProviderOnRedirect) {
    redirectUrl.searchParams.set('provider', config.provider);
  }
  return c.redirect(redirectUrl.toString());
}

/**
 * The error target recoverable from a signed state, or `undefined`.
 *
 * BUG-049: used on the provider-error branch, which runs before the state is
 * verified for the happy path but still receives it in the query. A state that
 * does not verify, or whose `redirect_uri` is not on the allowlist, yields
 * `undefined` and the caller falls back to `FRONTEND_URL` — so a forged state
 * can only ever send the user to production, never somewhere new.
 */
async function recoverErrorTarget(
  c: OAuthContext,
  state: string | undefined
): Promise<string | undefined> {
  if (!state) return undefined;
  try {
    const allowUnsigned = c.env.ENVIRONMENT === 'development';
    const stateData = await verifyState(state, c.env.JWT_SECRET, allowUnsigned);
    validateRedirectUri(stateData.redirect_uri, getAllowedRedirectOrigins(c.env));
    return stateData.redirect_uri;
  } catch {
    return undefined;
  }
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

    // BUG-018: single shared allowlist (env-filtered) for every flow step.
    // FINDING-012 / OAUTH-4: validateRedirectUri also pins the path to the SPA
    // callback route — origin-only matching let any path on a trusted origin
    // receive the ?code= bounce.
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

    // FINDING-012 / OAUTH-4: bound the client-chosen values that are embedded
    // in the signed state and echoed back to the SPA at the callback
    const finalReturnPath = return_path || '/';
    if (!validateReturnPath(finalReturnPath)) {
      return c.json(
        {
          error: 'Invalid return_path',
          message: `return_path must be a relative path of at most ${MAX_RETURN_PATH_LENGTH} characters`,
        },
        400
      );
    }

    if (state && !validateStateParam(state)) {
      return c.json(
        {
          error: 'Invalid state',
          message: `state must be at most ${MAX_STATE_LENGTH} printable ASCII characters`,
        },
        400
      );
    }

    // Generate state with only safe data (NO code_verifier!)
    const now = Math.floor(Date.now() / 1000);
    const stateData = {
      csrf: state || crypto.randomUUID(),
      // FINDING-012 / OAUTH-5: the POST callback binds the code_verifier to this
      // challenge when the SPA returns the signed state (utils/pkce-binding.ts)
      code_challenge,
      redirect_uri: finalRedirectUri,
      return_path: finalReturnPath,
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
      // BUG-049: `state` is present on this path, so the origin that started
      // the flow is recoverable — a beta user who cancels consent belongs back
      // on beta, where their sessionStorage lives.
      const target = await recoverErrorTarget(c, state);
      return frontendErrorRedirect(c, config, error_description || error, target);
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
      // No trustworthy state here by definition — FRONTEND_URL is the only
      // safe target.
      return frontendErrorRedirect(c, config, errorMsg);
    }

    // oauth-05: the state records which provider signed it
    // (`buildAuthorizeHandler` writes the marker) and `verifyPkceStateBinding`
    // enforces it on the POST leg — but the GET leg never checked. A Discord
    // state replayed at `GET /auth/xivauth/callback` was accepted here, and
    // the bounce carried `provider=xivauth` (from `config`, not the state), so
    // the SPA routed the exchange to the XIVAuth POST callback where it was
    // finally rejected as `Invalid state`. No privilege was gained; the cost
    // was a wasted round trip and a confusing failure instead of a fail-fast.
    if (stateData.provider && stateData.provider !== config.provider) {
      return frontendErrorRedirect(c, config, 'Invalid state');
    }

    // OAUTH-CRITICAL-002 / BUG-018: validate the redirect target against the
    // same shared allowlist used at authorize time — prevents open redirects
    // while keeping every allowlisted origin (incl. the transition domain)
    // consistent across both flow steps. FINDING-012: exact callback path too.
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(stateData.redirect_uri);
      validateRedirectUri(stateData.redirect_uri, getAllowedRedirectOrigins(c.env));
    } catch {
      // BUG-049 note: the state verified but its redirect_uri is not on the
      // allowlist, so there is nothing trustworthy to bounce to — FRONTEND_URL
      // is correct here, and is the fallback rather than the default.
      console.error('Blocked redirect to untrusted target:', stateData.redirect_uri);
      return frontendErrorRedirect(c, config, 'Untrusted redirect target');
    }

    // Redirect back to frontend with the auth code
    redirectUrl.searchParams.set('code', code);
    redirectUrl.searchParams.set('csrf', stateData.csrf);
    // FINDING-012 / OAUTH-5: hand the signed state back so the SPA can return
    // it to the POST callback, where the code_verifier is bound to the
    // code_challenge signed at authorize time (utils/pkce-binding.ts). It
    // carries nothing secret — csrf (already in this URL), the public
    // challenge, the redirect target and timestamps.
    redirectUrl.searchParams.set('state', state);
    if (config.markProviderOnRedirect) {
      redirectUrl.searchParams.set('provider', config.provider);
    }
    if (stateData.return_path && stateData.return_path !== '/') {
      redirectUrl.searchParams.set('return_path', stateData.return_path);
    }

    return c.redirect(redirectUrl.toString());
  };
}
