/**
 * @xivdyetools/worker-kit/rate-limiter
 *
 * Shared rate limiting utilities for the xivdyetools ecosystem.
 *
 * Provides multiple backend implementations:
 * - MemoryRateLimiter: In-memory sliding window with LRU eviction
 * - KVRateLimiter: Cloudflare KV backend with optimistic concurrency
 *
 * @example
 * ```typescript
 * import { MemoryRateLimiter, getClientIp, getRateLimitHeaders } from '@xivdyetools/worker-kit/rate-limiter';
 *
 * const limiter = new MemoryRateLimiter();
 *
 * export default {
 *   async fetch(request: Request) {
 *     const ip = getClientIp(request);
 *     const result = await limiter.check(ip, {
 *       maxRequests: 100,
 *       windowMs: 60_000,
 *     });
 *
 *     if (!result.allowed) {
 *       return new Response('Too Many Requests', {
 *         status: 429,
 *         headers: getRateLimitHeaders(result),
 *       });
 *     }
 *
 *     return new Response('OK', {
 *       headers: getRateLimitHeaders(result),
 *     });
 *   },
 * };
 * ```
 *
 * @packageDocumentation
 */

// A `@public` JSDoc tag on a specifier below means: published API, deliberately
// kept even though no workspace in this monorepo imports it. The root
// `knip.jsonc` gate (`pnpm run lint:dead`, part of `lint`) reports every
// untagged barrel export that nothing consumes, so a new export must either
// gain a consumer or be tagged on purpose — see root CLAUDE.md's Tooling →
// knip bullet and this repo's root `knip.jsonc`.

// Types
export type {
  RateLimitResult,
  RateLimitConfig,
  RateLimiter,
  ExtendedRateLimiter,
  /** @public */
  MemoryRateLimiterOptions,
  /** @public */
  KVRateLimiterOptions,
  /** @public */
  UpstashRateLimiterOptions,
  /** @public */
  RateLimiterLogger,
} from './types.js';

// Backends
export { MemoryRateLimiter } from './backends/memory.js';
export { KVRateLimiter } from './backends/kv.js';
export {
  /** @public — documented rate-limiter backend, see README */ UpstashRateLimiter,
} from './backends/upstash.js';
// FINDING-003 (2026-08-21 security audit): native Workers Rate Limiting binding —
// the recommended per-client abuse limiter (KV cannot throttle a fast client)
export {
  CloudflareRateLimiter,
  /** @public */
  type CloudflareRateLimiterOptions,
  type CloudflareRateLimitTier,
  type RateLimitBinding,
} from './backends/cloudflare.js';

// Utilities
export { getClientIp } from './ip.js';
export type { /** @public */ GetClientIpOptions } from './ip.js';
export { getRateLimitHeaders } from './headers.js';

// Presets
export {
  /** @public */
  OAUTH_LIMITS,
  getOAuthLimit,
  /** @public */
  DISCORD_COMMAND_LIMITS,
  getDiscordCommandLimit,
  /** @public */
  MODERATION_LIMITS,
  getModerationLimit,
  PUBLIC_API_LIMITS,
} from './presets/configs.js';
