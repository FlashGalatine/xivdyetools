/**
 * Discord Request Signature Verification
 *
 * REFACTOR-003: Now re-exports from @xivdyetools/auth shared package.
 *
 * @see https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization
 */

// Re-export everything from the shared auth package
export {
  verifyDiscordRequest,
  unauthorizedResponse,
  badRequestResponse,
  timingSafeEqual,
  type DiscordVerificationResult,
  type DiscordVerifyOptions,
} from '@xivdyetools/auth';

// For backwards compatibility, also export VerificationResult as an alias
export type { DiscordVerificationResult as VerificationResult } from '@xivdyetools/auth';
