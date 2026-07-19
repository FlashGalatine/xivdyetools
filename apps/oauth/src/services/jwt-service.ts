/**
 * JWT Service
 * Mints JSON Web Tokens (HS256 via Web Crypto) and wraps the shared
 * verification primitives from @xivdyetools/auth.
 *
 * REFACTOR-001 (2026-07-18 audit): verification is now fully delegated to
 * @xivdyetools/auth — this worker only keeps token *creation* (which the
 * shared package intentionally does not provide) plus thin wrappers that
 * preserve this worker's throwing error contract. The hand-rolled verifier,
 * the legacy createJWT/createJWTFromPayload mint paths, and isJWTExpired
 * were deleted; revocation helpers moved into the shared package.
 */

import type { JWTPayload, Env, UserRow, AuthProvider, PrimaryCharacter } from '../types.js';
import {
  base64UrlEncode as base64UrlEncodeString,
  base64UrlEncodeBytes,
  base64UrlDecodeBytes,
} from '@xivdyetools/crypto';
import {
  verifyJWTSignatureOnly as sharedVerifyJWTSignatureOnly,
  decodeJWT as sharedDecodeJWT,
  isTokenRevoked as sharedIsTokenRevoked,
  revokeToken as sharedRevokeToken,
} from '@xivdyetools/auth';

// REFACTOR-001: Re-export from @xivdyetools/crypto for backwards compatibility
export { base64UrlDecode } from '@xivdyetools/crypto';

/**
 * Base64URL encode a string or ArrayBuffer
 * OAUTH-REF-002: Exported for reuse in state-signing.ts
 */
export function base64UrlEncode(data: string | ArrayBuffer): string {
  if (typeof data === 'string') {
    return base64UrlEncodeString(data);
  } else {
    // Handle ArrayBuffer
    return base64UrlEncodeBytes(new Uint8Array(data));
  }
}

/**
 * Import secret key for HMAC signing
 */
async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Sign data with HMAC-SHA256
 * OAUTH-REF-002: Exported for reuse in state-signing.ts
 */
export async function signJwtData(data: string, secret: string): Promise<string> {
  const key = await getSigningKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncode(signature);
}

/**
 * Verify HMAC-SHA256 signature using crypto.subtle.verify (constant-time).
 * Exported so state-signing.ts can use it instead of a non-constant-time string compare.
 */
export async function verifyJwtData(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const key = await getSigningKey(secret);
  const encoder = new TextEncoder();

  // Decode signature from base64url using shared crypto utility
  const sigBytes = base64UrlDecodeBytes(signature);

  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
}

/**
 * Sign an arbitrary payload as an HS256 JWT.
 * REFACTOR-001: the single mint primitive — used by createJWTForUser and the
 * refresh handler (replacing the former createJWTFromPayload duplicate).
 */
export async function signPayload(
  payload: JWTPayload,
  secret: string
): Promise<{ token: string; expires_at: number }> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signJwtData(signatureInput, secret);

  return {
    token: `${signatureInput}.${signature}`,
    expires_at: payload.exp,
  };
}

/**
 * Extra options for JWT creation from a database user
 */
export interface CreateJWTForUserOptions {
  auth_provider?: AuthProvider;
  primary_character?: PrimaryCharacter;
  global_name?: string | null;
  avatar?: string | null;
}

/**
 * Create a JWT for a database user (supports both Discord and XIVAuth)
 */
export async function createJWTForUser(
  user: UserRow,
  env: Env,
  options?: CreateJWTForUserOptions
): Promise<{ token: string; expires_at: number; jti: string }> {
  const now = Math.floor(Date.now() / 1000);
  const expirySeconds = parseInt(env.JWT_EXPIRY, 10) || 3600;
  const expiresAt = now + expirySeconds;

  // Generate unique token ID for revocation tracking
  const jti = crypto.randomUUID();

  const payload: JWTPayload = {
    // Standard claims
    sub: user.id, // Our internal user ID
    iat: now,
    exp: expiresAt,
    iss: env.WORKER_URL,
    jti,

    // BUG-021: anchor for the absolute session lifetime — refreshes carry
    // this forward unchanged so a chain can't outlive the maximum session age
    orig_iat: now,

    // User info
    username: user.username,
    global_name: options?.global_name ?? null,
    avatar: options?.avatar ?? null,

    // Multi-provider support
    auth_provider: options?.auth_provider ?? (user.auth_provider as AuthProvider),
    discord_id: user.discord_id ?? undefined,
    xivauth_id: user.xivauth_id ?? undefined,

    // XIVAuth-specific
    primary_character: options?.primary_character,
  };

  const { token, expires_at } = await signPayload(payload, env.JWT_SECRET);
  return { token, expires_at, jti };
}

/**
 * Verify and decode a JWT.
 * Returns the payload if valid, throws if invalid.
 *
 * REFACTOR-001: delegates to @xivdyetools/auth; this wrapper only preserves
 * the throwing contract this worker's handlers rely on.
 */
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload> {
  // Signature/alg/structure + sub/exp presence via the shared verifier
  const payload = await sharedVerifyJWTSignatureOnly(token, secret);
  if (!payload) {
    throw new Error('Invalid JWT');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('JWT has expired');
  }

  return payload as unknown as JWTPayload;
}

/**
 * Decode JWT without verification (for debugging/display)
 * WARNING: Do not trust the contents without calling verifyJWT
 */
export function decodeJWT(token: string): JWTPayload | null {
  return sharedDecodeJWT(token) as unknown as JWTPayload | null;
}

/**
 * Verify JWT signature ONLY (ignores expiration)
 * Used for token refresh where we allow recently expired tokens.
 *
 * REFACTOR-001: delegates to @xivdyetools/auth (which requires sub AND exp —
 * BUG-051: an exp-less token can no longer NaN-pass the refresh grace check).
 */
export async function verifyJWTSignatureOnly(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  const payload = await sharedVerifyJWTSignatureOnly(token, secret);
  return payload as unknown as JWTPayload | null;
}

/**
 * Get Discord avatar URL from user info
 */
export function getAvatarUrl(
  userId: string,
  avatarHash: string | null
): string | null {
  if (!avatarHash) return null;

  const format = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${format}`;
}

/**
 * Revocation helpers.
 * REFACTOR-001: implementation moved to @xivdyetools/auth; re-exported here
 * for existing callers (fail-open semantics unchanged).
 */
export const isTokenRevoked = sharedIsTokenRevoked;
export const revokeToken = sharedRevokeToken;

/**
 * Verify JWT with revocation check
 * Combines signature/expiry verification with blacklist check
 */
export async function verifyJWTWithRevocationCheck(
  token: string,
  secret: string,
  kv: KVNamespace | undefined
): Promise<JWTPayload> {
  // First, verify signature and expiration
  const payload = await verifyJWT(token, secret);

  // Then check revocation if KV is available and token has JTI
  if (payload.jti && kv) {
    const revoked = await isTokenRevoked(payload.jti, kv);
    if (revoked) {
      throw new Error('Token has been revoked');
    }
  }

  return payload;
}
