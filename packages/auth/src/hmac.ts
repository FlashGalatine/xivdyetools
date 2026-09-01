/**
 * HMAC Signing Utilities
 *
 * Provides HMAC-SHA256 signing and verification using the Web Crypto API.
 * Used for JWT signing and bot request authentication.
 *
 * @module hmac
 */

import {
  base64UrlEncodeBytes,
  base64UrlDecodeBytes,
  bytesToHex,
  hexToBytes,
} from './encoding/index.js';

/**
 * Options for bot signature verification.
 *
 * The only consumer is `verifyBotSignatureV2` below — v1's `verifyBotSignature`
 * (5-minute `maxAgeMs` default) was removed in 2.0.0 (FINDING-015, 2026-08-29
 * security audit).
 */
export interface BotSignatureOptions {
  /** Maximum age of signature in milliseconds (default: `BOT_SIGNATURE_V2_MAX_AGE_MS`, 60 seconds) */
  maxAgeMs?: number;
  /** Allowed clock skew in milliseconds (default: 1 minute) */
  clockSkewMs?: number;
}

// ============================================================================
// CryptoKey Cache (OPT-002)
// ============================================================================

/**
 * Module-level cache for CryptoKeys.
 *
 * In Cloudflare Workers, module-level state persists across requests within
 * an isolate, making this safe and effective. Eliminates redundant
 * `crypto.subtle.importKey()` calls when the same secret is reused.
 *
 * Cache key format: `${secret}:${usage}` — bounded to 10 entries max
 * to prevent unbounded growth during key rotation.
 */
const cryptoKeyCache = new Map<string, CryptoKey>();
const CRYPTO_KEY_CACHE_MAX = 10;

/**
 * Get or create a cached CryptoKey for the given secret and usage.
 * Exported for use by jwt.ts — not part of the public package API.
 * @internal
 */
export async function getOrCreateHmacKey(
  secret: string,
  usage: 'sign' | 'verify' | 'both'
): Promise<CryptoKey> {
  const cacheKey = `${secret}:${usage}`;
  const cached = cryptoKeyCache.get(cacheKey);
  if (cached) {
    // BUG-005: Refresh LRU position on cache hit (delete + re-set moves to end of Map)
    cryptoKeyCache.delete(cacheKey);
    cryptoKeyCache.set(cacheKey, cached);
    return cached;
  }

  const key = await createHmacKey(secret, usage);

  // Evict least recently used entry if cache is full (first Map entry = oldest access)
  if (cryptoKeyCache.size >= CRYPTO_KEY_CACHE_MAX) {
    const firstKey = cryptoKeyCache.keys().next().value;
    if (firstKey !== undefined) {
      cryptoKeyCache.delete(firstKey);
    }
  }

  cryptoKeyCache.set(cacheKey, key);
  return key;
}

/**
 * Create an HMAC-SHA256 CryptoKey from a secret string.
 *
 * @param secret - The secret string to use as key material
 * @param usage - Key usage: 'sign', 'verify', or 'both'
 * @returns CryptoKey for HMAC operations
 *
 * @example
 * ```typescript
 * const key = await createHmacKey(process.env.JWT_SECRET, 'verify');
 * ```
 */
export async function createHmacKey(
  secret: string,
  usage: 'sign' | 'verify' | 'both' = 'both'
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  // FINDING-009: Enforce minimum key length for HMAC-SHA256 security
  if (keyData.length < 32) {
    throw new Error('HMAC secret must be at least 32 bytes (256 bits)');
  }

  const keyUsages: ('sign' | 'verify')[] =
    usage === 'both' ? ['sign', 'verify'] : [usage];

  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    keyUsages
  );
}

/**
 * Sign data with HMAC-SHA256 and return base64url-encoded signature.
 *
 * @param data - The data to sign
 * @param secret - The secret key
 * @returns Base64URL-encoded signature
 *
 * @example
 * ```typescript
 * const signature = await hmacSign('header.payload', jwtSecret);
 * ```
 */
export async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await getOrCreateHmacKey(secret, 'sign');
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

/**
 * Sign data with HMAC-SHA256 and return hex-encoded signature.
 *
 * @param data - The data to sign
 * @param secret - The secret key
 * @returns Hex-encoded signature
 *
 * @example
 * ```typescript
 * const signature = await hmacSignHex('timestamp:userId:userName', secret);
 * ```
 */
export async function hmacSignHex(
  data: string,
  secret: string
): Promise<string> {
  const key = await getOrCreateHmacKey(secret, 'sign');
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return bytesToHex(new Uint8Array(signature));
}

/**
 * Verify HMAC-SHA256 signature (base64url-encoded).
 *
 * @param data - The original data that was signed
 * @param signature - Base64URL-encoded signature to verify
 * @param secret - The secret key
 * @returns true if signature is valid
 */
export async function hmacVerify(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const key = await getOrCreateHmacKey(secret, 'verify');
    const encoder = new TextEncoder();
    const signatureBytes = base64UrlDecodeBytes(signature);

    // Use crypto.subtle.verify() which is inherently timing-safe
    return crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(data)
    );
  } catch {
    return false;
  }
}

/**
 * Verify HMAC-SHA256 signature (hex-encoded).
 *
 * @param data - The original data that was signed
 * @param signature - Hex-encoded signature to verify
 * @param secret - The secret key
 * @returns true if signature is valid
 */
export async function hmacVerifyHex(
  data: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const key = await getOrCreateHmacKey(secret, 'verify');
    const encoder = new TextEncoder();
    const signatureBytes = hexToBytes(signature);

    return crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(data)
    );
  } catch {
    return false;
  }
}

/**
 * Bot request signature v1 (`verifyBotSignature`) was removed here in 2.0.0
 * (FINDING-015, 2026-08-29 security audit). It signed
 * `${timestamp}:${userDiscordId}:${userName}` on a 5-minute freshness window
 * and bound nothing about the request itself — method, path and body could
 * all change underneath a valid signature — so a captured tuple could be
 * replayed against any route as that user. `presets-api` stopped accepting
 * it in 2.2.0 and both bots stopped sending it (`discord-worker` 5.1.0,
 * `moderation-worker` 1.6.0) before this export left the package, so the
 * removal costs nothing in-repo. An npm consumer still calling
 * `verifyBotSignature` (or signing a matching `X-Request-Signature` header)
 * must move to `createBotSignatureV2` / `verifyBotSignatureV2` below, which
 * bind method, path, a body hash, timestamp, nonce and identity instead of
 * three colon-joined fields — see CHANGELOG.md `[2.0.0]` for the concrete
 * migration.
 */

// ============================================================================
// Bot request signature v2 (FINDING-014, 2026-08-21 security audit)
// ============================================================================

/** Default freshness window for v2 signatures (60 s — v1 allowed 5 min). */
export const BOT_SIGNATURE_V2_MAX_AGE_MS = 60 * 1000;

/** Header carrying the v2 signature (v1's `X-Request-Signature` is gone — see above). */
export const BOT_SIGNATURE_V2_HEADER = 'X-Request-Signature-V2';
/** Header carrying the optional per-request nonce. */
export const BOT_SIGNATURE_NONCE_HEADER = 'X-Request-Nonce';

/**
 * Everything a v2 signature binds. `body` is the raw request body (string or
 * bytes; absent/empty for GET/DELETE); identity fields are optional for
 * system-level bot calls.
 */
export interface BotSignatureV2Request {
  method: string;
  /** URL path only (no origin, no query) */
  path: string;
  body?: string | Uint8Array | ArrayBuffer | null;
  /** Unix seconds as a string (the value sent in X-Request-Timestamp) */
  timestamp: string | undefined;
  /** Optional random nonce (sent in X-Request-Nonce); bound when present */
  nonce?: string;
  userDiscordId?: string;
  userName?: string;
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

function bodyBytes(body: BotSignatureV2Request['body']): Uint8Array {
  if (body === undefined || body === null) return new Uint8Array(0);
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  return new Uint8Array(body);
}

/**
 * Canonical string for v2: every field on its own line, length-prefixed, so
 * no choice of delimiter inside a field can collide with another field
 * (`(123,"a:b")` and `("123:a","b")` were the same v1 message).
 */
async function canonicalV2(req: BotSignatureV2Request): Promise<string> {
  const fields = [
    'v2',
    req.method.toUpperCase(),
    req.path,
    await sha256Hex(bodyBytes(req.body)),
    req.timestamp ?? '',
    req.nonce ?? '',
    req.userDiscordId ?? '',
    req.userName ?? '',
  ];
  return fields.map((f) => `${f.length}:${f}`).join('\n');
}

/**
 * Sign a bot → API request (v2). Returns a hex HMAC-SHA256.
 *
 * @example
 * ```typescript
 * const timestamp = String(Math.floor(Date.now() / 1000));
 * const nonce = crypto.randomUUID();
 * const sig = await createBotSignatureV2({ method, path, body, timestamp, nonce, userDiscordId, userName }, secret);
 * headers['X-Request-Signature-V2'] = sig; headers['X-Request-Nonce'] = nonce;
 * ```
 */
export async function createBotSignatureV2(
  req: BotSignatureV2Request,
  secret: string
): Promise<string> {
  return hmacSignHex(await canonicalV2(req), secret);
}

/**
 * Verify a v2 bot signature: freshness (default 60 s, 60 s future skew) and
 * the full request binding. Nonce replay protection is left to the caller
 * (store `nonce` for the window if you need strict single-use).
 */
export async function verifyBotSignatureV2(
  signature: string | undefined | null,
  req: BotSignatureV2Request,
  secret: string,
  options: BotSignatureOptions = {}
): Promise<boolean> {
  const { maxAgeMs = BOT_SIGNATURE_V2_MAX_AGE_MS, clockSkewMs = 60 * 1000 } = options;
  if (!signature || !req.timestamp) return false;

  const timestampNum = parseInt(req.timestamp, 10);
  if (!Number.isFinite(timestampNum)) return false;

  const now = Date.now();
  const signatureTime = timestampNum * 1000;
  if (now - signatureTime > maxAgeMs) return false;
  if (signatureTime > now + clockSkewMs) return false;

  return hmacVerifyHex(await canonicalV2(req), signature, secret);
}
