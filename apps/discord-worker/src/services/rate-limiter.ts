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
import type { Translator } from '@xivdyetools/bot-logic/i18n';
import {
  UpstashRateLimiter,
  KVRateLimiter,
  getDiscordCommandLimit,
  type RateLimiter,
} from '@xivdyetools/worker-kit/rate-limiter';

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

  throw new Error(
    'No rate limiter backend configured. Provide either Upstash credentials or KV namespace.',
  );
}

/**
 * Command aliases: Discord has no alias mechanism, so `/a11y` is a second
 * registration of `/accessibility`. Both must draw from ONE rate-limit
 * bucket, or the alias silently doubles a user's allowance.
 */
const COMMAND_ALIASES: Readonly<Record<string, string>> = {
  a11y: 'accessibility',
};

/**
 * Commands whose subcommands are tiered separately in
 * `DISCORD_COMMAND_LIMITS` (`command:subcommand` keys). Anything else drops
 * the subcommand so all its subcommands share the command bucket.
 */
const SUBCOMMAND_SCOPED = new Set<string>(['extractor']);

/**
 * Resolve the (command, subcommand) pair a rate-limit check should be keyed on:
 * aliases canonicalised, subcommand kept only where a scoped tier exists.
 */
export function resolveRateLimitScope(
  commandName: string,
  subcommand?: string,
): { command: string; subcommand: string | undefined } {
  const command = COMMAND_ALIASES[commandName] ?? commandName;
  return {
    command,
    subcommand: SUBCOMMAND_SCOPED.has(command) ? subcommand : undefined,
  };
}

/**
 * Check if a user is rate limited for a specific command
 *
 * Uses Upstash Redis for atomic operations (no race conditions) when available,
 * falling back to Cloudflare KV if Upstash is not configured.
 *
 * @param config - Rate limiter backend configuration
 * @param userId - Discord user ID
 * @param commandName - Optional (canonical) command name for command-specific limits
 * @param logger - Optional logger for structured logging
 * @param subcommand - Optional subcommand; only honoured where a `command:subcommand` tier exists
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
  logger?: ExtendedLogger,
  subcommand?: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(config);
  const limitConfig = getDiscordCommandLimit(commandName ?? 'default', subcommand);

  // Build compound key for user:command rate limiting. A subcommand that has
  // its own tier (e.g. extractor:image) gets its own bucket so it cannot
  // borrow allowance from the cheaper sibling.
  const scope = subcommand && commandName ? `${commandName}:${subcommand}` : commandName;
  const key = scope ? `${userId}:${scope}` : `${userId}:global`;

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
 * Format a rate limit error message for the user in their locale
 * (2026-08-20 i18n audit, F-04 — this was the most-seen untranslated string
 * in the bot, and it hand-rolled an English plural).
 */
export function formatRateLimitMessage(result: RateLimitResult, t: Translator): string {
  const seconds = result.retryAfter ?? Math.ceil((result.resetAt - Date.now()) / 1000);
  return t.tc('errors.rateLimited', seconds, { seconds });
}

/**
 * Reset the rate limiter for testing
 */
export function resetRateLimiterInstance(): void {
  limiterInstance = null;
  configuredBackend = null;
}
