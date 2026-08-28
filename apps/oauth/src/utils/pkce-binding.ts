/**
 * PKCE binding of the POST token exchange to the worker-signed state
 *
 * FINDING-012 / OAUTH-5 (2026-08-21 security audit): the worker received the
 * `code_challenge` at authorize time and stored it in the signed state, then
 * accepted any RFC 7636-shaped `code_verifier` at the POST callback and simply
 * forwarded it — PKCE enforcement was delegated entirely to Discord / XIVAuth.
 * If either provider treats PKCE as optional for a client that also presents
 * a client secret, a captured authorization code alone would have sufficed.
 *
 * The GET callback now echoes the signed state in its bounce to the SPA; when
 * the SPA returns it alongside `code` + `code_verifier`, the worker verifies
 * the state's signature/expiry/provider and requires
 * `base64url(SHA-256(code_verifier)) === state.code_challenge` BEFORE calling
 * the provider, so PKCE holds regardless of provider behaviour.
 */

import { base64UrlEncodeBytes } from '@xivdyetools/auth/encoding';
import { verifyState, type StateData } from './state-signing.js';

export type PkceBindingResult =
  | { ok: true; state: StateData }
  | { ok: false; reason: 'invalid_state' | 'pkce_mismatch' };

/** A signed state is ~400 chars; anything near the body limit is not one. */
const MAX_SIGNED_STATE_LENGTH = 4096;

/**
 * S256 code challenge for a verifier (RFC 7636 §4.2):
 * BASE64URL(SHA256(ASCII(code_verifier))), unpadded.
 */
export async function computeS256Challenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64UrlEncodeBytes(new Uint8Array(digest));
}

/**
 * Verify that `codeVerifier` is the one whose challenge this worker signed
 * into `signedState` for `expectedProvider`.
 *
 * Never throws for client-controlled input — returns a discriminated result so
 * the handler can answer "Invalid state" vs "PKCE verification failed".
 *
 * @param signedState - Raw `state` from the POST body (unknown: client-controlled)
 * @param codeVerifier - Format-validated PKCE verifier from the POST body
 * @param expectedProvider - The provider whose callback is being exchanged
 * @param secret - JWT_SECRET (the state-signing key)
 */
export async function verifyPkceStateBinding(
  signedState: unknown,
  codeVerifier: string,
  expectedProvider: 'discord' | 'xivauth',
  secret: string
): Promise<PkceBindingResult> {
  if (
    typeof signedState !== 'string' ||
    signedState.length === 0 ||
    signedState.length > MAX_SIGNED_STATE_LENGTH
  ) {
    return { ok: false, reason: 'invalid_state' };
  }

  let state: StateData;
  try {
    // Signed states only — an unsigned legacy state has no integrity to bind to
    state = await verifyState(signedState, secret, false);
  } catch {
    return { ok: false, reason: 'invalid_state' };
  }

  // A state minted for the other provider's flow is not this exchange's state
  if (state.provider !== expectedProvider || typeof state.code_challenge !== 'string') {
    return { ok: false, reason: 'invalid_state' };
  }

  const expectedChallenge = await computeS256Challenge(codeVerifier);
  if (expectedChallenge !== state.code_challenge) {
    return { ok: false, reason: 'pkce_mismatch' };
  }

  return { ok: true, state };
}
