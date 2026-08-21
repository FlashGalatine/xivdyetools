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
  verifyBotSignature,
  type BotSignatureOptions,
} from './hmac.js';

// Timing-safe utilities
export { timingSafeEqual } from './timing.js';

// Discord verification
export {
  verifyDiscordRequest,
  unauthorizedResponse,
  badRequestResponse,
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
