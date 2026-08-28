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
export const VALID_CODE_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM_test12345678';
