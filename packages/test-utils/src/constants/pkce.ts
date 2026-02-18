/**
 * PKCE (Proof Key for Code Exchange) test constants
 *
 * Provides RFC 7636 compliant test values for OAuth PKCE flow testing.
 *
 * Note: These are format-valid test values but are NOT cryptographically
 * linked (the challenge is not the SHA256 hash of the verifier).
 * Use them for format validation testing, not crypto verification testing.
 *
 * @example
 * ```typescript
 * import { VALID_CODE_VERIFIER, VALID_CODE_CHALLENGE } from '@xivdyetools/test-utils/constants';
 *
 * const params = new URLSearchParams({
 *   code_verifier: VALID_CODE_VERIFIER,
 *   code_challenge: VALID_CODE_CHALLENGE,
 *   code_challenge_method: 'S256',
 * });
 * ```
 */

/**
 * Valid PKCE code_verifier for testing
 *
 * Per RFC 7636:
 * - 43-128 characters
 * - Unreserved URI characters: [A-Za-z0-9-._~]
 */
export const VALID_CODE_VERIFIER =
  'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk~test123456789012345';

/**
 * Valid PKCE code_challenge for testing
 *
 * Per RFC 7636:
 * - BASE64URL(SHA256(verifier)) = 43 characters for S256 method
 * - Unreserved URI characters: [A-Za-z0-9-._~]
 *
 * Note: This is a format-valid challenge but is NOT the actual
 * SHA256 hash of VALID_CODE_VERIFIER.
 */
export const VALID_CODE_CHALLENGE =
  'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM_test12345678';

/**
 * Invalid code_verifier (too short - less than 43 chars)
 */
export const INVALID_SHORT_VERIFIER = 'tooshort';

/**
 * Invalid code_verifier (contains invalid characters)
 */
export const INVALID_CHARS_VERIFIER =
  'invalid@verifier#with$special%chars&that!are*not+allowed';

/**
 * Invalid code_challenge (too short)
 */
export const INVALID_SHORT_CHALLENGE = 'tooshort';

/**
 * Minimum length for code_verifier (RFC 7636)
 */
export const MIN_VERIFIER_LENGTH = 43;

/**
 * Maximum length for code_verifier (RFC 7636)
 */
export const MAX_VERIFIER_LENGTH = 128;

/**
 * Expected length for S256 code_challenge
 */
export const S256_CHALLENGE_LENGTH = 43;

/**
 * Regex pattern for valid code_verifier characters (RFC 7636)
 */
export const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]+$/;

/**
 * Validates a code_verifier format
 *
 * @param verifier - The code_verifier to validate
 * @returns True if format is valid
 */
export function isValidVerifierFormat(verifier: string): boolean {
  if (verifier.length < MIN_VERIFIER_LENGTH) return false;
  if (verifier.length > MAX_VERIFIER_LENGTH) return false;
  return VERIFIER_PATTERN.test(verifier);
}

/**
 * Validates a code_challenge format
 *
 * @param challenge - The code_challenge to validate
 * @returns True if format is valid
 */
export function isValidChallengeFormat(challenge: string): boolean {
  // S256 challenges should be exactly 43 characters (base64url encoded SHA256)
  if (challenge.length < S256_CHALLENGE_LENGTH) return false;
  return VERIFIER_PATTERN.test(challenge);
}

/**
 * Generates a cryptographically valid code_challenge from a verifier
 *
 * @param verifier - The code_verifier
 * @returns Base64URL encoded SHA256 hash
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  // Base64URL encode
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
