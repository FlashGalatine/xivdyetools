/**
 * JWT creation helpers for testing
 *
 * Provides functions to create valid and expired JWTs for testing
 * authentication flows.
 *
 * @example
 * ```typescript
 * // Create a valid JWT
 * const jwt = await createTestJWT('your-secret', {
 *   sub: 'user-123',
 *   username: 'TestUser',
 *   global_name: 'Test User',
 * });
 *
 * // Create an expired JWT for testing expiration handling
 * const expiredJwt = await createExpiredJWT('your-secret');
 *
 * // Use in request headers
 * const response = await fetch('/api/protected', {
 *   headers: { Authorization: `Bearer ${jwt}` },
 * });
 * ```
 */

import { base64UrlEncode, base64UrlEncodeBytes } from '../utils/crypto.js';

/**
 * JWT payload for test tokens
 */
export interface TestJWTPayload {
  /** Subject (user ID) */
  sub: string;
  /** Username */
  username: string;
  /** Display name (optional) */
  global_name?: string | null;
  /** Avatar hash (optional) */
  avatar?: string | null;
}

/**
 * Full JWT payload including standard claims
 */
export interface FullJWTPayload extends TestJWTPayload {
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
  /** Issuer */
  iss: string;
}

/**
 * Creates a valid JWT for testing
 *
 * @param secret - The JWT signing secret
 * @param payload - The JWT payload (sub, username, etc.)
 * @param expiresInSeconds - How long until the token expires (default: 3600 = 1 hour)
 * @param issuer - The token issuer (default: 'xivdyetools-oauth-worker')
 * @returns A signed JWT string
 */
export async function createTestJWT(
  secret: string,
  payload: TestJWTPayload,
  expiresInSeconds = 3600,
  issuer = 'xivdyetools-oauth-worker'
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: FullJWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    iss: issuer,
  };

  const encoder = new TextEncoder();

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));

  // Use base64UrlEncodeBytes for binary signature data to avoid UTF-8 encoding issues
  const encodedSignature = base64UrlEncodeBytes(new Uint8Array(signature));

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Creates an expired JWT for testing expiration handling
 *
 * @param secret - The JWT signing secret
 * @param payload - Optional custom payload (defaults provided)
 * @returns A signed but expired JWT string
 */
export async function createExpiredJWT(
  secret: string,
  payload: TestJWTPayload = { sub: '123', username: 'test' }
): Promise<string> {
  // Create token that expired 1 hour ago
  return createTestJWT(secret, payload, -3600);
}

/**
 * Creates a JWT with a specific expiration time
 *
 * @param secret - The JWT signing secret
 * @param payload - The JWT payload
 * @param expTimestamp - The expiration Unix timestamp
 * @returns A signed JWT string
 */
export async function createJWTWithExpiration(
  secret: string,
  payload: TestJWTPayload,
  expTimestamp: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = expTimestamp - now;
  return createTestJWT(secret, payload, expiresInSeconds);
}
