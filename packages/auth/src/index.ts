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
  isJWTExpired,
  getJWTTimeToExpiry,
  type JWTPayload,
} from './jwt.js';

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
export { timingSafeEqual, timingSafeEqualBytes } from './timing.js';

// Discord verification
export {
  verifyDiscordRequest,
  unauthorizedResponse,
  badRequestResponse,
  type DiscordVerificationResult,
  type DiscordVerifyOptions,
} from './discord.js';
