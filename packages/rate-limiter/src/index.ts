/**
 * @xivdyetools/rate-limiter
 *
 * Shared rate limiting utilities for the xivdyetools ecosystem.
 *
 * Provides multiple backend implementations:
 * - MemoryRateLimiter: In-memory sliding window with LRU eviction
 * - KVRateLimiter: Cloudflare KV backend with optimistic concurrency
 *
 * @example
 * ```typescript
 * import { MemoryRateLimiter, getClientIp, getRateLimitHeaders } from '@xivdyetools/rate-limiter';
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

// Types
export type {
  RateLimitResult,
  RateLimitConfig,
  EndpointRateLimitConfig,
  RateLimiter,
  ExtendedRateLimiter,
  MemoryRateLimiterOptions,
  KVRateLimiterOptions,
  UpstashRateLimiterOptions,
  RateLimiterLogger,
} from './types.js';

// Backends
export { MemoryRateLimiter } from './backends/memory.js';
export { KVRateLimiter } from './backends/kv.js';
export { UpstashRateLimiter } from './backends/upstash.js';

// Utilities
export { getClientIp } from './ip.js';
export type { GetClientIpOptions } from './ip.js';
export { getRateLimitHeaders, formatRateLimitMessage } from './headers.js';

// Presets
export {
  OAUTH_LIMITS,
  getOAuthLimit,
  DISCORD_COMMAND_LIMITS,
  getDiscordCommandLimit,
  MODERATION_LIMITS,
  PUBLIC_API_LIMITS,
  UNIVERSALIS_PROXY_LIMITS,
} from './presets/configs.js';
