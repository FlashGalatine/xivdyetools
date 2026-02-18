/**
 * Rate Limiting Service
 *
 * Implements sliding window rate limiting for Discord commands.
 * Supports per-user and per-command limits.
 *
 * Backends (in priority order):
 * 1. Upstash Redis - atomic operations, no race conditions (preferred)
 * 2. Cloudflare KV - fallback if Upstash not configured
 *
 * @module services/rate-limiter
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  UpstashRateLimiter,
  KVRateLimiter,
  getDiscordCommandLimit,
  type RateLimiter,
} from '@xivdyetools/rate-limiter';

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests remaining in the window */
  remaining: number;
  /** Timestamp when the rate limit resets (ms since epoch) */
  resetAt: number;
  /** Seconds until the rate limit resets (only present when rate limited) */
  retryAfter?: number;
  /** Flag indicating backend error occurred (request was allowed due to fail-open policy) */
  backendError?: boolean;
}

/** Key prefix for rate limit data */
const KEY_PREFIX = 'ratelimit:user:';

/**
 * Configuration for rate limiter initialization
 */
export interface RateLimiterConfig {
  /** Upstash Redis REST URL (preferred backend) */
  upstashUrl?: string;
  /** Upstash Redis REST token */
  upstashToken?: string;
  /** Cloudflare KV namespace (fallback backend) */
  kv?: KVNamespace;
}

/**
 * Singleton rate limiter instance
 */
let limiterInstance: RateLimiter | null = null;
let configuredBackend: 'upstash' | 'kv' | null = null;

/**
 * Get or create the rate limiter instance
 *
 * Priority: Upstash Redis > Cloudflare KV
 */
function getLimiter(config: RateLimiterConfig): RateLimiter {
  if (limiterInstance && configuredBackend) {
    return limiterInstance;
  }

  // Prefer Upstash if both URL and token are provided
  if (config.upstashUrl && config.upstashToken) {
    limiterInstance = new UpstashRateLimiter({
      url: config.upstashUrl,
      token: config.upstashToken,
      keyPrefix: KEY_PREFIX,
    });
    configuredBackend = 'upstash';
    return limiterInstance;
  }

  // Fallback to KV
  if (config.kv) {
    limiterInstance = new KVRateLimiter({
      kv: config.kv,
      keyPrefix: KEY_PREFIX,
    });
    configuredBackend = 'kv';
    return limiterInstance;
  }

  throw new Error('No rate limiter backend configured. Provide either Upstash credentials or KV namespace.');
}

/**
 * Check if a user is rate limited for a specific command
 *
 * Uses Upstash Redis for atomic operations (no race conditions) when available,
 * falling back to Cloudflare KV if Upstash is not configured.
 *
 * @param config - Rate limiter backend configuration
 * @param userId - Discord user ID
 * @param commandName - Optional command name for command-specific limits
 * @param logger - Optional logger for structured logging
 * @returns Rate limit check result
 *
 * @example
 * ```typescript
 * const result = await checkRateLimit(
 *   {
 *     upstashUrl: env.UPSTASH_REDIS_REST_URL,
 *     upstashToken: env.UPSTASH_REDIS_REST_TOKEN,
 *     kv: env.KV, // fallback
 *   },
 *   userId,
 *   'harmony'
 * );
 * if (!result.allowed) {
 *   return ephemeralResponse(`Rate limited. Try again in ${result.retryAfter}s`);
 * }
 * ```
 */
export async function checkRateLimit(
  config: RateLimiterConfig,
  userId: string,
  commandName?: string,
  logger?: ExtendedLogger
): Promise<RateLimitResult> {
  const limiter = getLimiter(config);
  const limitConfig = getDiscordCommandLimit(commandName ?? 'default');

  // Build compound key for user:command rate limiting
  const key = commandName ? `${userId}:${commandName}` : `${userId}:global`;

  try {
    const result = await limiter.check(key, limitConfig);

    // Log if there was a backend error (fail-open occurred)
    if (result.backendError && logger) {
      logger.error('Rate limit check failed', new Error(`${configuredBackend} backend error`));
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetAt: result.resetAt.getTime(),
      retryAfter: result.retryAfter,
      backendError: result.backendError,
    };
  } catch (error) {
    // This shouldn't happen since both backends fail open by default
    // But just in case, log and allow
    if (logger) {
      logger.error('Rate limit check failed', error instanceof Error ? error : undefined);
    }
    return {
      allowed: true,
      remaining: limitConfig.maxRequests,
      resetAt: Date.now() + limitConfig.windowMs,
      backendError: true,
    };
  }
}

/**
 * Format a rate limit error message for the user
 */
export function formatRateLimitMessage(result: RateLimitResult): string {
  const seconds = result.retryAfter ?? Math.ceil((result.resetAt - Date.now()) / 1000);
  return `You're using this command too quickly! Please wait **${seconds} second${seconds !== 1 ? 's' : ''}** before trying again.`;
}

/**
 * Get the currently configured backend type
 * @returns 'upstash', 'kv', or null if not initialized
 */
export function getConfiguredBackend(): 'upstash' | 'kv' | null {
  return configuredBackend;
}

/**
 * Reset the rate limiter for testing
 */
export function resetRateLimiterInstance(): void {
  limiterInstance = null;
  configuredBackend = null;
}
