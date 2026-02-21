/**
 * JWT Verification Utilities
 *
 * Provides JWT verification using HMAC-SHA256 (HS256) with the Web Crypto API.
 * Intentionally does NOT include JWT creation - that stays in the oauth service.
 *
 * Security features:
 * - Algorithm validation (rejects non-HS256 tokens)
 * - Expiration checking
 * - Timing-safe signature comparison
 *
 * @module jwt
 */

import {
  base64UrlDecode,
  base64UrlDecodeBytes,
} from '@xivdyetools/crypto';
import { createHmacKey } from './hmac.js';

/**
 * JWT payload structure
 *
 * Re-exported from @xivdyetools/types for convenience.
 * Consumers should import from here rather than directly from types.
 */
export interface JWTPayload {
  /** Subject - Discord user ID */
  sub: string;
  /** Issued at timestamp (seconds) */
  iat: number;
  /** Expiration timestamp (seconds) */
  exp: number;
  /** Token type: 'access' or 'refresh' */
  type: 'access' | 'refresh';
  /** Discord username */
  username?: string;
  /** Discord avatar hash */
  avatar?: string | null;
}

/**
 * JWT header structure
 */
interface JWTHeader {
  alg: string;
  typ: string;
}

/**
 * Decode a JWT without verifying the signature.
 *
 * WARNING: Only use this for debugging or when you'll verify separately.
 * For production use, always use `verifyJWT()`.
 *
 * @param token - The JWT string
 * @returns Decoded payload or null if malformed
 *
 * @example
 * ```typescript
 * const payload = decodeJWT(token);
 * console.log('Token expires:', new Date(payload.exp * 1000));
 * ```
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payloadJson = base64UrlDecode(parts[1]);
    return JSON.parse(payloadJson) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Verify a JWT and return the payload if valid.
 *
 * Performs full verification:
 * 1. Validates token structure (3 parts)
 * 2. Validates algorithm is HS256 (prevents confusion attacks)
 * 3. Verifies HMAC-SHA256 signature
 * 4. Checks expiration time
 *
 * @param token - The JWT string
 * @param secret - The HMAC secret used to sign the token
 * @returns Verified payload or null if invalid/expired
 *
 * @example
 * ```typescript
 * const payload = await verifyJWT(token, env.JWT_SECRET);
 * if (!payload) {
 *   return new Response('Unauthorized', { status: 401 });
 * }
 * ```
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode and validate header
    const headerJson = base64UrlDecode(headerB64);
    const header: JWTHeader = JSON.parse(headerJson) as JWTHeader;

    // SECURITY: Reject non-HS256 algorithms (prevents algorithm confusion attacks)
    if (header.alg !== 'HS256') {
      return null;
    }

    // SECURITY: Verify signature using crypto.subtle.verify() which is
    // inherently timing-safe (comparison happens in native crypto, not JS)
    const signatureInput = `${headerB64}.${payloadB64}`;
    const key = await createHmacKey(secret, 'verify');
    const encoder = new TextEncoder();
    const signatureBytes = base64UrlDecodeBytes(signatureB64);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(signatureInput)
    );

    if (!isValid) {
      return null;
    }

    // Decode payload
    const payloadJson = base64UrlDecode(payloadB64);
    const payload: JWTPayload = JSON.parse(payloadJson) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify JWT signature only, ignoring expiration.
 *
 * Used for refresh tokens where we want to verify authenticity
 * but allow some grace period past expiration.
 *
 * @param token - The JWT string
 * @param secret - The HMAC secret
 * @param maxAgeMs - Optional maximum age in milliseconds (from iat)
 * @returns Payload if signature valid, null otherwise
 *
 * @example
 * ```typescript
 * // Allow refresh tokens up to 7 days old
 * const payload = await verifyJWTSignatureOnly(
 *   refreshToken,
 *   env.JWT_SECRET,
 *   7 * 24 * 60 * 60 * 1000
 * );
 * ```
 */
export async function verifyJWTSignatureOnly(
  token: string,
  secret: string,
  maxAgeMs?: number
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode and validate header
    const headerJson = base64UrlDecode(headerB64);
    const header: JWTHeader = JSON.parse(headerJson) as JWTHeader;

    // SECURITY: Still reject non-HS256 algorithms
    if (header.alg !== 'HS256') {
      return null;
    }

    // SECURITY: Verify signature using crypto.subtle.verify() which is
    // inherently timing-safe (comparison happens in native crypto, not JS)
    const signatureInput = `${headerB64}.${payloadB64}`;
    const key = await createHmacKey(secret, 'verify');
    const encoder = new TextEncoder();
    const signatureBytes = base64UrlDecodeBytes(signatureB64);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(signatureInput)
    );

    if (!isValid) {
      return null;
    }

    // Decode payload
    const payloadJson = base64UrlDecode(payloadB64);
    const payload: JWTPayload = JSON.parse(payloadJson) as JWTPayload;

    // Check max age if specified
    if (maxAgeMs !== undefined && payload.iat) {
      const now = Date.now();
      const tokenAge = now - payload.iat * 1000;
      if (tokenAge > maxAgeMs) {
        return null;
      }
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT is expired without full verification.
 *
 * Useful for quick checks before making API calls.
 *
 * @param token - The JWT string
 * @returns true if token is expired or malformed
 */
export function isJWTExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }
  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}

/**
 * Get time until JWT expiration.
 *
 * @param token - The JWT string
 * @returns Seconds until expiration, or 0 if expired/invalid
 */
export function getJWTTimeToExpiry(token: string): number {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return 0;
  }
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}
