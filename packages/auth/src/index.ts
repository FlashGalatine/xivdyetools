/**
 * @xivdyetools/auth
 *
 * Shared authentication utilities for the xivdyetools ecosystem.
 *
 * @example
 * ```typescript
 * import { verifyJWT, verifyDiscordRequest, timingSafeEqual } from '@xivdyetools/auth';
 *
 * // Verify JWT
 * const payload = await verifyJWT(token, env.JWT_SECRET);
 *
 * // Verify Discord request
 * const result = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
 *
 * // Timing-safe comparison
 * const isValid = await timingSafeEqual(provided, expected);
 * ```
 *
 * @module @xivdyetools/auth
 */

// JWT utilities
export {
  verifyJWT,
  verifyJWTSignatureOnly,
  decodeJWT,
  type JWTPayload,
  type VerifyJWTOptions,
} from './jwt.js';

// Revocation utilities (KV-backed jti blacklist)
export {
  isTokenRevoked,
  revokeToken,
  REFRESH_GRACE_SECONDS,
  type RevocationStore,
  type RevokeTokenOptions,
} from './revocation.js';

// HMAC utilities
export {
  createHmacKey,
  hmacSign,
  hmacSignHex,
  hmacVerify,
  hmacVerifyHex,
  // FINDING-014 (2026-08-21 audit): request-bound bot signature v2 — the
  // only bot signature scheme since v1's `verifyBotSignature` was removed
  // (FINDING-015, 2026-08-29 audit, 2.0.0)
  createBotSignatureV2,
  verifyBotSignatureV2,
  BOT_SIGNATURE_V2_MAX_AGE_MS,
  BOT_SIGNATURE_V2_HEADER,
  BOT_SIGNATURE_NONCE_HEADER,
  type BotSignatureOptions,
  type BotSignatureV2Request,
} from './hmac.js';

// Timing-safe utilities
export { timingSafeEqual } from './timing.js';

// Discord verification
export {
  verifyDiscordRequest,
  unauthorizedResponse,
  badRequestResponse,
  DEFAULT_DISCORD_MAX_TIMESTAMP_AGE_SECONDS,
  type DiscordVerificationResult,
  type DiscordVerifyOptions,
} from './discord.js';

// Encoding primitives (Base64URL RFC 4648 + hex)
// Absorbed from @xivdyetools/crypto — also available via '@xivdyetools/auth/encoding'
export {
  base64UrlEncode,
  base64UrlEncodeBytes,
  base64UrlDecode,
  base64UrlDecodeBytes,
  hexToBytes,
  bytesToHex,
} from './encoding/index.js';
