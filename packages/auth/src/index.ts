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

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see the package CLAUDE.md.
//
// The four encoding functions and the `/encoding`-subpath doc comment below
// are a special case: they DO have live production consumers, but only via
// the `@xivdyetools/auth/encoding` subpath import (e.g.
// `apps/moderation-worker/src/handlers/modals/ban-reason.ts`) — nothing
// imports them from this root barrel, so knip still reports the re-export
// specifiers here as unused and they are tagged `@public` too.

// JWT utilities
export {
  verifyJWT,
  verifyJWTSignatureOnly,
  decodeJWT,
  /** @public */
  type JWTPayload,
  /** @public */
  type VerifyJWTOptions,
} from './jwt.js';

// Revocation utilities (KV-backed jti blacklist)
export {
  isTokenRevoked,
  revokeToken,
  /** @public */
  REFRESH_GRACE_SECONDS,
  /** @public */
  type RevocationStore,
  /** @public */
  type RevokeTokenOptions,
} from './revocation.js';

// HMAC utilities
export {
  /** @public */
  createHmacKey,
  hmacSign,
  hmacSignHex,
  hmacVerify,
  /** @public */
  hmacVerifyHex,
  // FINDING-014 (2026-08-21 audit): request-bound bot signature v2 — the
  // only bot signature scheme since v1's `verifyBotSignature` was removed
  // (FINDING-015, 2026-08-29 audit, 2.0.0)
  createBotSignatureV2,
  verifyBotSignatureV2,
  /** @public */
  BOT_SIGNATURE_V2_MAX_AGE_MS,
  BOT_SIGNATURE_V2_HEADER,
  BOT_SIGNATURE_NONCE_HEADER,
  /** @public */
  type BotSignatureOptions,
  /** @public */
  type BotSignatureV2Request,
} from './hmac.js';

// Timing-safe utilities
export { timingSafeEqual } from './timing.js';

// Discord verification
export {
  verifyDiscordRequest,
  unauthorizedResponse,
  badRequestResponse,
  /** @public */
  DEFAULT_DISCORD_MAX_TIMESTAMP_AGE_SECONDS,
  /** @public */
  type DiscordVerificationResult,
  /** @public */
  type DiscordVerifyOptions,
} from './discord.js';

// Encoding primitives (Base64URL RFC 4648 + hex)
// Absorbed from @xivdyetools/crypto — also available via '@xivdyetools/auth/encoding'.
// Live consumers (moderation-worker, oauth) import via that subpath, not this
// barrel, so these four are @public here even though the underlying
// implementations are very much in production use.
export {
  base64UrlEncode,
  base64UrlEncodeBytes,
  /** @public */
  base64UrlDecode,
  /** @public */
  base64UrlDecodeBytes,
  /** @public */
  hexToBytes,
  /** @public */
  bytesToHex,
} from './encoding/index.js';
