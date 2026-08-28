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
 * - Claim type validation + optional nbf / iss / aud enforcement
 *   (FINDING-015, 2026-08-21 security audit)
 *
 * @module jwt
 */

import { base64UrlDecode, base64UrlDecodeBytes } from './encoding/index.js';
import { getOrCreateHmacKey } from './hmac.js';

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
  /** Not-before timestamp (seconds) — enforced when present */
  nbf?: number;
  /**
   * Token type discriminator.
   * BUG-057 (2026-07-18 audit): optional — current issuers do not emit it.
   * When refresh JWTs are introduced, issuers must set it and verifiers must
   * pass `expectedType` to verifyJWT so refresh tokens can't be used as
   * access tokens.
   */
  type?: 'access' | 'refresh';
  /** JWT ID for revocation tracking */
  jti?: string;
  /** Issuer (worker URL) */
  iss?: string;
  /** Audience — enforced only when the verifier passes `audience` */
  aud?: string | string[];
  /** Original-issuance anchor carried across refreshes (absolute session age) */
  orig_iat?: number;
  /** Discord username */
  username?: string;
  /** Discord global display name */
  global_name?: string | null;
  /** Discord avatar hash */
  avatar?: string | null;
}

/**
 * Options for verifyJWT
 */
export interface VerifyJWTOptions {
  /**
   * BUG-057: When set, the token's `type` claim must equal this value.
   * Guards against token confusion (e.g. a refresh token presented as an
   * access token) once typed tokens exist.
   */
  expectedType?: 'access' | 'refresh';
  /**
   * FINDING-015: When set, the token's `iss` claim must equal this value (or
   * one of these values). A token without `iss` is rejected.
   */
  issuer?: string | string[];
  /**
   * FINDING-015: When set, the token's `aud` claim (string or array) must
   * contain this value. A token without `aud` is rejected.
   */
  audience?: string;
  /**
   * Allowed clock skew (seconds) applied to `exp` and `nbf`. Default 0 —
   * the issuers and verifiers in this ecosystem all run on Cloudflare's
   * synchronised clocks.
   */
  clockToleranceSeconds?: number;
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
 * Shared JWT signature verification helper (REFACTOR-003).
 *
 * Validates token structure, ensures HS256 algorithm, and verifies
 * HMAC-SHA256 signature. Used by both `verifyJWT()` and `verifyJWTSignatureOnly()`.
 *
 * @param token - The JWT string
 * @param secret - The HMAC secret
 * @returns Decoded payload if signature is valid, null otherwise
 */
async function verifyJWTSignature(token: string, secret: string): Promise<JWTPayload | null> {
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
  const key = await getOrCreateHmacKey(secret, 'verify');
  const encoder = new TextEncoder();
  const signatureBytes = base64UrlDecodeBytes(signatureB64);

  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    encoder.encode(signatureInput),
  );

  if (!isValid) {
    return null;
  }

  // Decode payload
  const payloadJson = base64UrlDecode(payloadB64);
  const payload: unknown = JSON.parse(payloadJson);
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  return payload as JWTPayload;
}

/** A finite, non-negative number — what every NumericDate claim must be. */
function isNumericDate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * FINDING-015: structural validation of the claims every verifier relies on.
 * A token is only as trustworthy as its claim types — `exp: "9999999999"`
 * compares as a string against a number and `sub: {}` is truthy — so both
 * verifiers reject anything that is not a finite numeric `exp`, a non-empty
 * string `sub`, and (when present) numeric `iat`/`nbf`.
 */
function hasWellTypedClaims(payload: JWTPayload): boolean {
  if (!isNumericDate(payload.exp)) return false;
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) return false;
  if (payload.iat !== undefined && !isNumericDate(payload.iat)) return false;
  if (payload.nbf !== undefined && !isNumericDate(payload.nbf)) return false;
  return true;
}

function issuerMatches(iss: unknown, expected: string | string[]): boolean {
  if (typeof iss !== 'string') return false;
  return Array.isArray(expected) ? expected.includes(iss) : iss === expected;
}

function audienceMatches(aud: unknown, expected: string): boolean {
  if (typeof aud === 'string') return aud === expected;
  if (Array.isArray(aud)) return aud.some((a) => a === expected);
  return false;
}

/**
 * Verify a JWT and return the payload if valid.
 *
 * Performs full verification:
 * 1. Validates token structure (3 parts)
 * 2. Validates algorithm is HS256 (prevents confusion attacks)
 * 3. Verifies HMAC-SHA256 signature
 * 4. Validates claim types (`exp` numeric, `sub` non-empty string, …)
 * 5. Checks expiration (`exp`) and not-before (`nbf`) against the clock
 * 6. Enforces `type`, `iss`, `aud` when the caller asks for them
 *
 * @param token - The JWT string
 * @param secret - The HMAC secret used to sign the token
 * @returns Verified payload or null if invalid/expired
 *
 * @example
 * ```typescript
 * const payload = await verifyJWT(token, env.JWT_SECRET, { issuer: env.JWT_ISSUER });
 * if (!payload) {
 *   return new Response('Unauthorized', { status: 401 });
 * }
 * ```
 */
export async function verifyJWT(
  token: string,
  secret: string,
  options?: VerifyJWTOptions,
): Promise<JWTPayload | null> {
  try {
    const payload = await verifyJWTSignature(token, secret);
    if (!payload) return null;

    // FINDING-003 / BUG-010 / FINDING-015: exp + sub must be present AND well typed
    if (!hasWellTypedClaims(payload)) {
      return null;
    }

    const skew = options?.clockToleranceSeconds ?? 0;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp + skew < now) {
      return null;
    }
    if (payload.nbf !== undefined && payload.nbf - skew > now) {
      return null;
    }

    // BUG-057: Enforce token-type discriminator when the caller expects one
    if (options?.expectedType && payload.type !== options.expectedType) {
      return null;
    }

    // FINDING-015: issuer / audience pinning
    if (options?.issuer !== undefined && !issuerMatches(payload.iss, options.issuer)) {
      return null;
    }
    if (options?.audience !== undefined && !audienceMatches(payload.aud, options.audience)) {
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
  maxAgeMs?: number,
): Promise<JWTPayload | null> {
  try {
    const payload = await verifyJWTSignature(token, secret);
    if (!payload) return null;

    // BUG-010: Require sub claim — tokens without subject identity are rejected
    // BUG-051: Require exp claim — matches verifyJWT so a mis-minted eternal
    // token can't slip through the refresh path (its absence made the grace
    // arithmetic NaN-pass downstream)
    // FINDING-015: and both must be well typed (a string exp would make the
    // downstream grace arithmetic silently compare strings)
    if (!hasWellTypedClaims(payload)) {
      return null;
    }

    // BUG-058: When the caller requests an age cap, a missing or non-numeric
    // iat must fail closed — previously it skipped the check entirely (and
    // iat: 0, the epoch, is falsy but valid)
    if (maxAgeMs !== undefined) {
      if (typeof payload.iat !== 'number') {
        return null;
      }
      const tokenAge = Date.now() - payload.iat * 1000;
      if (tokenAge > maxAgeMs) {
        return null;
      }
    }

    return payload;
  } catch {
    return null;
  }
}
