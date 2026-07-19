/**
 * State Signing Utility
 * Provides HMAC-SHA256 signing for OAuth state parameters to prevent tampering
 *
 * Format: base64url(json).hmac_signature
 * - Lighter than full JWT (no header, simplified structure)
 * - Reuses crypto primitives from jwt-service.ts
 * - Supports transition period for backward compatibility
 */

// OAUTH-REF-003: Import base64UrlDecode from jwt-service to avoid duplication
import { base64UrlEncode, base64UrlDecode, signJwtData, verifyJwtData } from '../services/jwt-service.js';

/**
 * OAuth state data structure
 */
export interface StateData {
  csrf: string;
  code_challenge?: string;
  redirect_uri: string;
  return_path: string;
  provider?: string;
  iat: number;
  exp: number;
}

/**
 * Sign state data with HMAC-SHA256
 * Format: base64url(json).signature
 *
 * @param state - State data object to sign
 * @param secret - HMAC secret (typically JWT_SECRET)
 * @returns Signed state string
 */
export async function signState(state: StateData, secret: string): Promise<string> {
  const json = JSON.stringify(state);
  const encodedState = base64UrlEncode(json);
  const signature = await signJwtData(encodedState, secret);

  return `${encodedState}.${signature}`;
}

/**
 * Verify and decode signed state
 * Supports backward compatibility with unsigned states during transition
 *
 * @param signedState - Signed state string or legacy base64 state
 * @param secret - HMAC secret (typically JWT_SECRET)
 * @param allowUnsigned - Allow unsigned states (for transition period)
 * @returns Decoded state data
 * @throws Error if signature is invalid or state is malformed
 */
export async function verifyState(
  signedState: string,
  secret: string,
  allowUnsigned: boolean = false
): Promise<StateData> {
  const parts = signedState.split('.');

  // Check if this is a signed state (has signature)
  if (parts.length === 2) {
    const [encodedState, providedSignature] = parts;

    // FINDING-001: Use crypto.subtle.verify (constant-time) instead of string !=
    const isValid = await verifyJwtData(encodedState, providedSignature, secret);

    if (!isValid) {
      throw new Error('Invalid state signature');
    }

    // Signature verified - decode state
    const json = base64UrlDecode(encodedState);
    const state = JSON.parse(json) as StateData;

    // REFACTOR-007 (2026-07-18 audit): the replay-window invariant is enforced
    // here at the primitive, not by per-caller discipline — the two callbacks
    // had already diverged on missing-exp semantics. Signed states have always
    // carried exp, so requiring it cannot reject legitimate states.
    const now = Math.floor(Date.now() / 1000);
    if (!state.exp) {
      throw new Error('State missing expiration timestamp');
    }
    if (state.exp < now) {
      throw new Error('OAuth state expired. Please try logging in again.');
    }

    return state;
  }

  // No signature - check if unsigned states are allowed
  if (allowUnsigned && parts.length === 1) {
    // Legacy unsigned state (base64 only)
    let state: StateData;
    try {
      const json = atob(signedState);
      state = JSON.parse(json) as StateData;
    } catch {
      throw new Error('Invalid state format');
    }

    // Log warning in production
    console.warn('Accepted unsigned state (transition period):', {
      provider: state.provider,
      iat: state.iat,
    });

    // REFACTOR-007: legacy unsigned states may lack exp (stay lenient),
    // but one that carries a past exp is still rejected
    const now = Math.floor(Date.now() / 1000);
    if (state.exp && state.exp < now) {
      throw new Error('OAuth state expired. Please try logging in again.');
    }

    return state;
  }

  throw new Error('Invalid state format or signature required');
}

/**
 * Check if state is in signed format
 *
 * @param state - State string to check
 * @returns true if state appears to be signed (has signature component)
 */
export function isStateSigned(state: string): boolean {
  return state.split('.').length === 2;
}
