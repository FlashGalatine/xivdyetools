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
} from '@xivdyetools/crypto';

/**
 * Options for bot signature verification
 */
export interface BotSignatureOptions {
  /** Maximum age of signature in milliseconds (default: 5 minutes) */
  maxAgeMs?: number;
  /** Allowed clock skew in milliseconds (default: 1 minute) */
  clockSkewMs?: number;
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
  const key = await createHmacKey(secret, 'sign');
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
  const key = await createHmacKey(secret, 'sign');
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
    const key = await createHmacKey(secret, 'verify');
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
    const key = await createHmacKey(secret, 'verify');
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
 * Verify a bot request signature.
 *
 * Bot signatures use the format: `${timestamp}:${userDiscordId}:${userName}`
 * Signatures are hex-encoded HMAC-SHA256.
 *
 * @param signature - Hex-encoded signature
 * @param timestamp - Unix timestamp string (seconds)
 * @param userDiscordId - Discord user ID
 * @param userName - Discord username
 * @param secret - The signing secret
 * @param options - Verification options
 * @returns true if signature is valid and not expired
 *
 * @example
 * ```typescript
 * const isValid = await verifyBotSignature(
 *   request.headers.get('X-Signature'),
 *   request.headers.get('X-Timestamp'),
 *   request.headers.get('X-User-Id'),
 *   request.headers.get('X-User-Name'),
 *   env.BOT_SIGNING_SECRET
 * );
 * ```
 */
export async function verifyBotSignature(
  signature: string | undefined,
  timestamp: string | undefined,
  userDiscordId: string | undefined,
  userName: string | undefined,
  secret: string,
  options: BotSignatureOptions = {}
): Promise<boolean> {
  const { maxAgeMs = 5 * 60 * 1000, clockSkewMs = 60 * 1000 } = options;

  // Validate required fields (signature and timestamp are required;
  // userDiscordId and userName are optional for system-level bot requests)
  if (!signature || !timestamp) {
    return false;
  }

  // Validate timestamp format
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return false;
  }

  // Check timestamp age (with clock skew tolerance)
  const now = Date.now();
  const signatureTime = timestampNum * 1000; // Convert to milliseconds
  const age = now - signatureTime;

  // Reject if too old
  if (age > maxAgeMs) {
    return false;
  }

  // Reject if too far in the future (clock skew protection)
  if (signatureTime > now + clockSkewMs) {
    return false;
  }

  // Verify the signature
  const message = `${timestamp}:${userDiscordId ?? ''}:${userName ?? ''}`;
  return hmacVerifyHex(message, signature, secret);
}
