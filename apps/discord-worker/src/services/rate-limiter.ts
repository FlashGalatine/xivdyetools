/**
 * Rate Limiting Service
 *
 * Per-user, per-command limits for Discord commands.
 *
 * Backends (in priority order):
 * 1. Native Workers Rate Limiting bindings (`RL_5`…`RL_70`) — atomic,
 *    per-colo, no storage writes and no third-party processor
 * 2. Cloudflare KV — fallback when no tier is bound (tests / local dev)
 *
 * FINDING-007 (2026-08-29 security audit): the counters used to live in a
 * third-party Redis service, a processor the bot's privacy policy never
 * named. The bindings keep them inside Cloudflare for the 60-second window.
 *
 * @module services/rate-limiter
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import type { Translator } from '@xivdyetools/bot-logic/i18n';
import {
  CloudflareRateLimiter,
  KVRateLimiter,
  getDiscordCommandLimit,
  type CloudflareRateLimitTier,
  type RateLimitConfig,
  type RateLimiter,
} from '@xivdyetools/worker-kit/rate-limiter';
import type { Env } from '../types/env.js';

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

/** The worker's `[[ratelimits]]` bindings, one per distinct effective limit. */
export type DiscordRateLimitBindings = Pick<
  Env,
  'RL_5' | 'RL_10' | 'RL_15' | 'RL_20' | 'RL_30' | 'RL_70'
>;

/**
 * Configuration for rate limiter initialization
 */
export interface RateLimiterConfig {
  /** Native Workers Rate Limiting bindings (preferred backend) */
  bindings?: DiscordRateLimitBindings;
  /** Cloudflare KV namespace (fallback backend) */
  kv?: KVNamespace;
}

/**
 * Each binding's configured `simple.limit`, smallest first. Keep in step with
 * `wrangler.toml` — worker-kit routes a command to the smallest tier whose
 * limit can hold `maxRequests + burstAllowance`, so a wrong number here hands
 * out the wrong allowance rather than failing.
 */
const BINDING_TIERS: ReadonlyArray<{ name: keyof DiscordRateLimitBindings; limit: number }> = [
  { name: 'RL_5', limit: 5 },
  { name: 'RL_10', limit: 10 },
  { name: 'RL_15', limit: 15 },
  { name: 'RL_20', limit: 20 },
  { name: 'RL_30', limit: 30 },
  { name: 'RL_70', limit: 70 },
];

/**
 * Pull the rate-limit bindings off the worker env, so callers can pass
 * `{ bindings: rateLimitBindings(env), kv: env.KV }` without naming all six.
 */
export function rateLimitBindings(env: Env): DiscordRateLimitBindings {
  return {
    RL_5: env.RL_5,
    RL_10: env.RL_10,
    RL_15: env.RL_15,
    RL_20: env.RL_20,
    RL_30: env.RL_30,
    RL_70: env.RL_70,
  };
}

/**
 * Singleton rate limiter instance
 */
let limiterInstance: RateLimiter | null = null;
let configuredBackend: 'cloudflare' | 'kv' | null = null;
/** FINDING-003: the KV-fallback warning is emitted once per isolate */
let kvFallbackWarned = false;

/**
 * Get or create the rate limiter instance
 *
 * Priority: native `[[ratelimits]]` bindings > Cloudflare KV.
 *
 * The instance is a per-isolate singleton, so the logger it is built with is
 * the first request's. That only affects the limiter's own fail-open warning;
 * `checkRateLimit` reports `backendError` with the CURRENT request's logger.
 */
function getLimiter(config: RateLimiterConfig, logger?: ExtendedLogger): RateLimiter {
  if (limiterInstance && configuredBackend) {
    return limiterInstance;
  }

  // Prefer the native bindings — any subset works (the limiter falls back to
  // its largest tier), but both environments bind all six.
  const tiers: CloudflareRateLimitTier[] = [];
  for (const { name, limit } of BINDING_TIERS) {
    const binding = config.bindings?.[name];
    if (binding) tiers.push({ limit, periodSeconds: 60, binding });
  }
  if (tiers.length > 0) {
    limiterInstance = new CloudflareRateLimiter({ tiers, keyPrefix: KEY_PREFIX, logger });
    configuredBackend = 'cloudflare';
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
    'No rate limiter backend configured. Bind an RL_* rate-limit tier or provide a KV namespace.',
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
 * Tiers this worker defines on top of worker-kit's `DISCORD_COMMAND_LIMITS`,
 * consulted first.
 */
const LOCAL_COMMAND_LIMITS: Record<string, RateLimitConfig> = {
  // same tier as /about and /manual; moves into worker-kit's preset in Sprint 9 (FINDING-020)
  changelog: { maxRequests: 30, windowMs: 60_000 },
};

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
 * Counts against the native Workers rate-limit binding for the command's tier
 * when one is bound, falling back to Cloudflare KV otherwise.
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
 *   { bindings: rateLimitBindings(env), kv: env.KV },
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
  const limiter = getLimiter(config, logger);
  const limitConfig =
    (commandName ? LOCAL_COMMAND_LIMITS[commandName] : undefined) ??
    getDiscordCommandLimit(commandName ?? 'default', subcommand);

  // FINDING-003 (2026-08-21 audit): KV cannot throttle a fast client
  // (1 write/s/key, swallowed put failures, eventually-consistent reads) —
  // it is a dev fallback only. Say so once per isolate so a deployment that
  // lost its rate-limit bindings is visible in the logs.
  if (configuredBackend === 'kv' && !kvFallbackWarned) {
    kvFallbackWarned = true;
    // optional call: some callers/tests pass a partial logger without warn()
    logger?.warn?.(
      'Rate limiter using KV fallback: no RL_* binding bound — KV fallback cannot throttle fast clients',
      { backend: 'kv' },
    );
  }

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
  kvFallbackWarned = false;
}
