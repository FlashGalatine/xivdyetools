/**
 * Cloudflare Workers Rate Limiting binding backend
 *
 * FINDING-003 (2026-08-21 security audit): the KV backend cannot throttle a
 * fast client — KV allows one write per second per key, the read-modify-write
 * `increment()` swallows the resulting 429s, and reads are eventually
 * consistent, so a single client sending >1 req/s never reaches a 60 s
 * threshold. Workers' native Rate Limiting binding (GA 2025-09-19) counts
 * atomically in-process per colo with no storage writes, which is exactly the
 * primitive a per-client abuse limiter needs.
 *
 * Binding model: each `[[ratelimits]]` entry in wrangler config is ONE fixed
 * `{ limit, period }` (period 10 or 60 s). This backend therefore takes a set
 * of *tiers* — one binding per distinct effective limit — and routes each
 * `RateLimitConfig` to the smallest tier that can hold
 * `maxRequests + burstAllowance` (falling back to the largest tier). A worker
 * with a single limit configures a single tier.
 *
 * @example wrangler.toml
 * ```toml
 * [[ratelimits]]
 * name = "RL_60"
 * namespace_id = "1001"           # unique per account
 * simple = { limit = 65, period = 60 }
 * ```
 *
 * @example
 * ```typescript
 * const limiter = new CloudflareRateLimiter({
 *   tiers: [{ limit: 65, binding: env.RL_60 }],
 *   keyPrefix: 'api:ip:',
 * });
 * const result = await limiter.check(getClientIp(request), { maxRequests: 60, windowMs: 60_000, burstAllowance: 5 });
 * ```
 *
 * Semantics that differ from the storage-backed limiters (documented, not bugs):
 * - `remaining` is not exposed by the binding: it reports `limit - 1` while
 *   allowed (an "at least one more" indicator) and `0` when denied.
 * - `checkOnly()` CONSUMES a slot (there is no read-only peek) and
 *   `increment()` is a no-op, so the two-phase middleware pattern still counts
 *   exactly once per request.
 * - `reset()` / `resetAll()` are no-ops — counters live inside the runtime.
 * - Counters are per-colo, not global: a distributed attacker gets
 *   `limit × colos`, the same trade the WAF rate-limiting product makes.
 *
 * @module backends/cloudflare
 */

import type {
  ExtendedRateLimiter,
  RateLimitConfig,
  RateLimitResult,
  RateLimiterLogger,
} from '../types.js';

/**
 * Structural type for the Workers Rate Limiting binding
 * (`RateLimit` in @cloudflare/workers-types). Kept structural so the package
 * stays usable without the global types and tests can pass a fake.
 */
export interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** One `[[ratelimits]]` binding and the limit it was configured with. */
export interface CloudflareRateLimitTier {
  /** The `simple.limit` configured for this binding in wrangler config */
  limit: number;
  /** The `simple.period` configured for this binding (10 or 60). @default 60 */
  periodSeconds?: 10 | 60;
  /** The binding (`env.<name>`) */
  binding: RateLimitBinding;
}

/** Options for {@link CloudflareRateLimiter}. */
export interface CloudflareRateLimiterOptions {
  /** One entry per distinct limit the worker needs; at least one. */
  tiers: CloudflareRateLimitTier[];
  /**
   * Prefix prepended to every binding key. Use it to namespace limiters that
   * share a binding (e.g. `'api:ip:'`).
   * @default ''
   */
  keyPrefix?: string;
  /** Optional logger for fail-open events. */
  logger?: RateLimiterLogger;
}

/**
 * Rate limiter backed by the native Workers Rate Limiting binding.
 *
 * Implements {@link ExtendedRateLimiter} so it is a drop-in replacement for
 * {@link KVRateLimiter} in both the one-shot (`check`) and two-phase
 * (`checkOnly` / `increment`) call styles.
 */
/** A tier with its defaults resolved. */
interface ResolvedTier {
  limit: number;
  periodSeconds: number;
  binding: RateLimitBinding;
}

export class CloudflareRateLimiter implements ExtendedRateLimiter {
  private readonly tiers: ResolvedTier[];
  private readonly keyPrefix: string;
  private readonly logger?: RateLimiterLogger;

  constructor(options: CloudflareRateLimiterOptions) {
    if (!options.tiers || options.tiers.length === 0) {
      throw new Error('CloudflareRateLimiter requires at least one tier');
    }
    this.tiers = options.tiers
      .map((t) => ({ limit: t.limit, periodSeconds: t.periodSeconds ?? 60, binding: t.binding }))
      .sort((a, b) => a.limit - b.limit);
    this.keyPrefix = options.keyPrefix ?? '';
    this.logger = options.logger;
  }

  /**
   * Pick the smallest tier whose configured limit can hold the effective
   * limit (`maxRequests + burstAllowance`); the largest tier if none can.
   */
  private selectTier(config: RateLimitConfig): ResolvedTier {
    const effective = config.maxRequests + (config.burstAllowance ?? 0);
    return this.tiers.find((t) => t.limit >= effective) ?? this.tiers[this.tiers.length - 1];
  }

  /** End of the current fixed period for a tier (what `resetAt` reports). */
  private static periodEnd(periodSeconds: number, now: number): Date {
    const periodMs = periodSeconds * 1000;
    return new Date(Math.floor(now / periodMs) * periodMs + periodMs);
  }

  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const tier = this.selectTier(config);
    const now = Date.now();
    const resetAt = CloudflareRateLimiter.periodEnd(tier.periodSeconds, now);
    // Tier-scoped so one client cannot share a bucket across two configs that
    // happen to map to different bindings with the same key
    const bindingKey = `${this.keyPrefix}${key}`;

    try {
      const { success } = await tier.binding.limit({ key: bindingKey });
      if (success) {
        return {
          allowed: true,
          remaining: Math.max(0, tier.limit - 1),
          resetAt,
          limit: tier.limit,
        };
      }
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit: tier.limit,
        retryAfter: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
      };
    } catch (error) {
      if (config.failOpen !== false) {
        this.logger?.warn('Rate limiter fail-open: rate-limit binding error, allowing request', {
          key: bindingKey,
          tierLimit: tier.limit,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          allowed: true,
          remaining: tier.limit,
          resetAt,
          limit: tier.limit,
          backendError: true,
        };
      }
      throw error;
    }
  }

  /**
   * The binding has no read-only query, so this consumes a slot exactly like
   * {@link check}. Pair it with the no-op {@link increment} in two-phase callers.
   */
  async checkOnly(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    return this.check(key, config);
  }

  /** No-op — the slot was consumed by {@link checkOnly}. */
  async increment(_key: string, _config: RateLimitConfig): Promise<void> {
    // intentionally empty
  }

  /** No-op — counters live inside the Workers runtime and cannot be reset. */
  async reset(_key: string): Promise<void> {
    // intentionally empty
  }

  /** No-op — see {@link reset}. */
  async resetAll(): Promise<void> {
    // intentionally empty
  }
}
