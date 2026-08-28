/**
 * OAuth Validation Utilities
 * Security validation functions for OAuth flow parameters
 *
 * OAUTH-REF-002: Consolidated validation utilities shared across OAuth handlers
 * (Discord authorize, XIVAuth authorize, callbacks, etc.)
 */

import { REDIRECT_CALLBACK_PATH } from '../constants/oauth.js';

/**
 * FINDING-012 / OAUTH-4 (2026-08-21 security audit): server-side caps on the
 * two client-chosen values that are embedded in the signed state and echoed
 * back to the SPA. The web app sends a short tool path and a 64-hex-char CSRF
 * value, so these bounds are generous for every legitimate flow.
 */
export const MAX_RETURN_PATH_LENGTH = 256;
export const MAX_STATE_LENGTH = 256;

/** Visible ASCII only — no whitespace, no control characters, no non-ASCII. */
const VISIBLE_ASCII = /^[\x21-\x7E]+$/;

/**
 * Validate code_challenge format per RFC 7636
 * For S256 method, challenge is BASE64URL(SHA256(verifier)) = 43 characters
 * We allow 43-128 chars for flexibility, using base64url charset: [A-Za-z0-9\-_]
 *
 * OAUTH-REF-002: Extracted from duplicate validation in authorize handlers
 *
 * @param challenge - PKCE code challenge string
 * @returns true if valid, false otherwise
 */
export function validateCodeChallenge(challenge: string): boolean {
  const regex = /^[A-Za-z0-9\-_]{43,128}$/;
  return regex.test(challenge);
}

/**
 * Validate code_verifier format per RFC 7636
 * Must be 43-128 characters using only unreserved characters: [A-Za-z0-9-._~]
 *
 * @param verifier - PKCE code verifier string
 * @returns true if valid, false otherwise
 */
export function validateCodeVerifier(verifier: string): boolean {
  const regex = /^[A-Za-z0-9\-._~]{43,128}$/;
  return regex.test(verifier);
}

// REFACTOR-007 (2026-07-18 audit): validateStateExpiration was removed —
// expiry is now enforced inside verifyState (utils/state-signing.ts) so the
// replay-window invariant can't depend on caller discipline.

/**
 * Validate redirect URI against allowlist
 * Ensures redirect URI origin is in the list of permitted origins AND that the
 * path is exactly the SPA callback route (no query string, no fragment).
 *
 * FINDING-012 / OAUTH-4: origin-only matching let any path on an allowlisted
 * origin receive the `?code=` bounce. RFC 8252 §8.4 / OAuth 2.1 want an exact
 * match, so the path is pinned to REDIRECT_CALLBACK_PATH.
 *
 * @param uri - Redirect URI to validate
 * @param allowedOrigins - Array of permitted origin URLs
 * @throws Error if redirect URI is invalid or not allowed
 */
export function validateRedirectUri(uri: string, allowedOrigins: string[]): void {
  let parsedUri: URL;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error('Invalid redirect URI format');
  }

  const isAllowed = allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === parsedUri.origin;
    } catch {
      return false;
    }
  });

  if (!isAllowed) {
    throw new Error('Redirect URI not in allowlist');
  }

  if (
    parsedUri.pathname !== REDIRECT_CALLBACK_PATH ||
    parsedUri.search !== '' ||
    parsedUri.hash !== ''
  ) {
    throw new Error('Redirect URI path not allowed');
  }
}

/**
 * Validate the `return_path` the SPA asks to be sent back to after login.
 *
 * FINDING-012 / OAUTH-4: must be a relative path rooted at a single `/`
 * (never `//host`, never a scheme), visible ASCII only (no whitespace or
 * control characters, and no backslash — the WHATWG parser turns `\` into `/`),
 * and at most MAX_RETURN_PATH_LENGTH characters. The web app additionally
 * sanitises it client-side; this is the server-side bound.
 *
 * @param path - Candidate return path
 * @returns true if acceptable
 */
export function validateReturnPath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_RETURN_PATH_LENGTH) {
    return false;
  }
  if (path[0] !== '/' || path[1] === '/') {
    return false;
  }
  return VISIBLE_ASCII.test(path) && !path.includes('\\');
}

/**
 * Validate the client-supplied `state` (the SPA's CSRF value) before it is
 * embedded in the signed state and echoed back in the callback bounce.
 *
 * FINDING-012 / OAUTH-4: at most MAX_STATE_LENGTH visible-ASCII characters.
 *
 * @param state - Candidate state value
 * @returns true if acceptable
 */
export function validateStateParam(state: string): boolean {
  return state.length <= MAX_STATE_LENGTH && VISIBLE_ASCII.test(state);
}

/**
 * Validate that token response contains required scopes
 * Ensures the OAuth token has all necessary permissions
 *
 * @param tokenScope - Scope string from token response (space-separated)
 * @param requiredScopes - Array of required scope strings
 * @throws Error if required scopes are missing
 */
export function validateScopes(
  tokenScope: string | undefined,
  requiredScopes: string[]
): void {
  if (!tokenScope) {
    throw new Error('Token response missing scope field');
  }

  const scopes = tokenScope.split(' ');
  const missingScopes = requiredScopes.filter((req) => !scopes.includes(req));

  if (missingScopes.length > 0) {
    throw new Error(`Token missing required scopes: ${missingScopes.join(', ')}`);
  }
}
