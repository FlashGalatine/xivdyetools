/**
 * Tests for Rate Limiter Service
 *
 * Covers the native `[[ratelimits]]` binding path (FINDING-007) and the KV
 * fallback that runs when no `RL_*` tier is bound.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTranslator } from '@xivdyetools/bot-logic/i18n';
import {
  checkRateLimit,
  rateLimitBindings,
  resolveRateLimitScope,
  formatRateLimitMessage,
  resetRateLimiterInstance,
  type DiscordRateLimitBindings,
  type RateLimitResult,
  type RateLimiterConfig,
} from './rate-limiter.js';
import type { Env } from '../types/env.js';

// Create mock KV namespace with getWithMetadata support for KVRateLimiter
function createMockKV() {
  const store = new Map<string, { value: string; metadata: Record<string, unknown> | null }>();

  return {
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    getWithMetadata: vi.fn(async (key: string) => {
      const entry = store.get(key);
      return { value: entry?.value ?? null, metadata: entry?.metadata ?? null };
    }),
    put: vi.fn(
      async (
        key: string,
        value: string,
        options?: { metadata?: Record<string, unknown>; expirationTtl?: number },
      ) => {
        store.set(key, { value, metadata: options?.metadata ?? null });
      },
    ),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store,
    _clear: () => store.clear(),
  } as unknown as KVNamespace & {
    _store: Map<string, { value: string; metadata: Record<string, unknown> | null }>;
    _clear: () => void;
  };
}

/** Tier names in the order they are declared in wrangler.toml. */
const TIER_NAMES = ['RL_5', 'RL_10', 'RL_15', 'RL_20', 'RL_30', 'RL_70'] as const;

type FakeBindings = Record<(typeof TIER_NAMES)[number], { limit: ReturnType<typeof vi.fn> }>;

/** All six `[[ratelimits]]` tiers bound, each admitting the request by default. */
function createMockBindings(success = true): FakeBindings {
  return Object.fromEntries(
    TIER_NAMES.map((name) => [name, { limit: vi.fn().mockResolvedValue({ success }) }]),
  ) as FakeBindings;
}

describe('rate-limiter.ts', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let config: RateLimiterConfig;
  const mockUserId = 'user-123';

  beforeEach(() => {
    resetRateLimiterInstance();
    mockKV = createMockKV();
    // Backend-selection tests aside, these exercise the KV fallback (no
    // `RL_*` binding bound) because its counters are observable.
    config = { kv: mockKV };
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow first request and update the counter', async () => {
      const result = await checkRateLimit(config, mockUserId, 'harmony');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(14); // harmony has limit of 15, so 14 remaining
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should use command-specific limits', async () => {
      // extractor image (Photon path) has a limit of 5
      let result = await checkRateLimit(config, mockUserId, 'extractor', undefined, 'image');
      expect(result.remaining).toBe(4); // 5 - 1 = 4

      // extractor color falls back to the command entry (15)
      resetRateLimiterInstance();
      mockKV._clear();
      result = await checkRateLimit(config, mockUserId, 'extractor', undefined, 'color');
      expect(result.remaining).toBe(14); // 15 - 1 = 14

      // dye has a limit of 20
      resetRateLimiterInstance();
      mockKV._clear();
      result = await checkRateLimit(config, mockUserId, 'dye');
      expect(result.remaining).toBe(19); // 20 - 1 = 19

      // about has a limit of 30
      resetRateLimiterInstance();
      mockKV._clear();
      result = await checkRateLimit(config, mockUserId, 'about');
      expect(result.remaining).toBe(29); // 30 - 1 = 29
    });

    it('should use default limit for unknown commands', async () => {
      // Default limit is 15
      const result = await checkRateLimit(config, mockUserId, 'unknown_command');
      expect(result.remaining).toBe(14); // 15 - 1 = 14
    });

    it('should use global limit when no command name provided', async () => {
      const result = await checkRateLimit(config, mockUserId);
      expect(result.remaining).toBe(14); // Default 15 - 1 = 14
    });

    it('should increment counter on subsequent requests', async () => {
      await checkRateLimit(config, mockUserId, 'harmony');
      await checkRateLimit(config, mockUserId, 'harmony');
      const result = await checkRateLimit(config, mockUserId, 'harmony');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(12); // 15 - 3 = 12
    });

    it('should rate limit when count exceeds limit', async () => {
      // Make 15 requests (harmony limit)
      for (let i = 0; i < 15; i++) {
        await checkRateLimit(config, mockUserId, 'harmony');
      }

      // 16th request should be rate limited
      const result = await checkRateLimit(config, mockUserId, 'harmony');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reset after window expires', async () => {
      // Make requests until rate limited
      for (let i = 0; i < 16; i++) {
        await checkRateLimit(config, mockUserId, 'extractor', undefined, 'image');
      }

      // Advance time by 61 seconds (window is 60 seconds)
      vi.advanceTimersByTime(61 * 1000);

      const result = await checkRateLimit(config, mockUserId, 'extractor', undefined, 'image');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Fresh window: 5 - 1 = 4
    });

    it('should track different commands separately', async () => {
      // Exhaust the extractor:image limit (5 requests)
      for (let i = 0; i < 5; i++) {
        await checkRateLimit(config, mockUserId, 'extractor', undefined, 'image');
      }

      const imageResult = await checkRateLimit(config, mockUserId, 'extractor', undefined, 'image');
      expect(imageResult.allowed).toBe(false);

      // the sibling color subcommand has its own (15/min) bucket
      const colorResult = await checkRateLimit(config, mockUserId, 'extractor', undefined, 'color');
      expect(colorResult.allowed).toBe(true);

      // harmony should still be allowed (but shares singleton, so need new instance)
      resetRateLimiterInstance();
      const harmonyResult = await checkRateLimit(config, mockUserId, 'harmony');
      expect(harmonyResult.allowed).toBe(true);
    });

    it('should fail open on KV errors', async () => {
      mockKV.get = vi.fn().mockRejectedValue(new Error('KV unavailable'));

      const result = await checkRateLimit(config, mockUserId, 'harmony');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(15); // Default limit
    });

    it('should log error on KV failure when logger is provided', async () => {
      mockKV.get = vi.fn().mockRejectedValue(new Error('KV unavailable'));
      const mockLogger = { error: vi.fn() };

      const result = await checkRateLimit(config, mockUserId, 'harmony', mockLogger as never);

      expect(result.allowed).toBe(true);
      expect(result.backendError).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith('Rate limit check failed', expect.any(Error));
    });

    it('should include correct resetAt timestamp', async () => {
      const now = Date.now();
      const result = await checkRateLimit(config, mockUserId, 'harmony');

      // Reset should be 60 seconds from window start
      expect(result.resetAt).toBe(now + 60 * 1000);
    });

    it('should throw if no backend configured', async () => {
      const emptyConfig: RateLimiterConfig = {};

      await expect(checkRateLimit(emptyConfig, mockUserId, 'harmony')).rejects.toThrow(
        'No rate limiter backend configured',
      );
    });
  });

  /**
   * FINDING-007 (2026-08-29 security audit): the counters used to live in a
   * third-party Redis the privacy policy never named. They now live in the
   * native Workers rate-limiting bindings, one `[[ratelimits]]` tier per
   * distinct effective limit, and worker-kit routes each command to the
   * smallest tier that can hold it.
   */
  describe('native [[ratelimits]] bindings', () => {
    it.each([
      { command: 'budget', subcommand: undefined, tier: 'RL_10', key: 'budget' },
      // RL_20 is the only tier no other row covers — without these two, a
      // wrangler.toml that dropped it would still pass this table.
      { command: 'dye', subcommand: undefined, tier: 'RL_20', key: 'dye' },
      { command: 'preferences', subcommand: undefined, tier: 'RL_20', key: 'preferences' },
      { command: 'about', subcommand: undefined, tier: 'RL_30', key: 'about' },
      { command: 'manual', subcommand: undefined, tier: 'RL_30', key: 'manual' },
      // FINDING-020: worker-kit has no `changelog` tier yet — the local
      // override keeps it with its /about and /manual siblings.
      { command: 'changelog', subcommand: undefined, tier: 'RL_30', key: 'changelog' },
      { command: 'autocomplete', subcommand: undefined, tier: 'RL_70', key: 'autocomplete' },
      { command: 'extractor', subcommand: 'image', tier: 'RL_5', key: 'extractor:image' },
      { command: 'no_such_command', subcommand: undefined, tier: 'RL_15', key: 'no_such_command' },
    ] as const)('routes /$command to $tier', async ({ command, subcommand, tier, key: scope }) => {
      // pkg-worker-kit-test-utils-05: worker-kit's binding key now carries
      // the tier's (limit, period), so two tiers pointed at one binding
      // cannot share a counter. Every discord-worker tier is 60s, and the
      // tier's limit is its name: RL_10 -> 10.
      const key = `ratelimit:user:${mockUserId}:${scope}:t${tier.slice(3)}_60`;
      const bindings = createMockBindings();
      const result = await checkRateLimit(
        { bindings: bindings as unknown as DiscordRateLimitBindings, kv: mockKV },
        mockUserId,
        command,
        undefined,
        subcommand,
      );

      expect(result.allowed).toBe(true);
      expect(bindings[tier].limit).toHaveBeenCalledWith({ key });
      for (const name of TIER_NAMES) {
        if (name !== tier) expect(bindings[name].limit).not.toHaveBeenCalled();
      }
      // The bindings replace KV entirely — no counter writes.
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('denies the request when the binding rejects it', async () => {
      const bindings = createMockBindings(false);

      const result = await checkRateLimit(
        { bindings: bindings as unknown as DiscordRateLimitBindings, kv: mockKV },
        mockUserId,
        'budget',
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('uses the bindings even when only some tiers are bound', async () => {
      const bindings = createMockBindings();
      // Only the 30/min tier bound: /budget (10/min) has no tier that fits
      // below it, so worker-kit falls back to the largest bound tier.
      const result = await checkRateLimit(
        { bindings: { RL_30: bindings.RL_30 } as unknown as DiscordRateLimitBindings, kv: mockKV },
        mockUserId,
        'budget',
      );

      expect(result.allowed).toBe(true);
      expect(bindings.RL_30.limit).toHaveBeenCalledWith({
        key: 'ratelimit:user:user-123:budget:t30_60',
      });
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('rateLimitBindings carries exactly the six RL_* tiers off the env', async () => {
      const bindings = createMockBindings();
      const env = {
        KV: mockKV,
        DISCORD_TOKEN: 'secret', // pragma: allowlist secret
        ...bindings,
      } as unknown as Env;

      // Exactly the six tiers, nothing else off the env.
      expect(rateLimitBindings(env)).toEqual({
        RL_5: bindings.RL_5,
        RL_10: bindings.RL_10,
        RL_15: bindings.RL_15,
        RL_20: bindings.RL_20,
        RL_30: bindings.RL_30,
        RL_70: bindings.RL_70,
      });

      // …and the result really drives the limiter: a helper that dropped
      // RL_5 would push the Photon path up to the next tier.
      await checkRateLimit(
        { bindings: rateLimitBindings(env), kv: env.KV },
        mockUserId,
        'extractor',
        undefined,
        'image',
      );
      expect(bindings.RL_5.limit).toHaveBeenCalledWith({
        key: 'ratelimit:user:user-123:extractor:image:t5_60',
      });
    });
  });

  describe('formatRateLimitMessage', () => {
    it('should format message using retryAfter', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 30000,
        retryAfter: 30,
      };

      const message = formatRateLimitMessage(result, createTranslator('en'));

      expect(message).toBe(
        "You're using this command too quickly! Please wait **30 seconds** before trying again.",
      );
    });

    it('renders in the translator locale (F-04)', () => {
      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 1000,
        retryAfter: 1,
      };

      expect(formatRateLimitMessage(result, createTranslator('ja'))).toContain('**1秒**');
      expect(formatRateLimitMessage(result, createTranslator('de'))).toContain('**1 Sekunde**');
      expect(formatRateLimitMessage(result, createTranslator('en'))).toContain('**1 second**');
    });

    it('should calculate retryAfter from resetAt if not provided', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      const result: RateLimitResult = {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 45000, // 45 seconds from now
      };

      const message = formatRateLimitMessage(result, createTranslator('en'));

      expect(message).toContain('45 seconds');
    });
  });
});

describe('resolveRateLimitScope', () => {
  it('canonicalises the /a11y alias onto /accessibility so both share a bucket', () => {
    expect(resolveRateLimitScope('a11y')).toEqual({
      command: 'accessibility',
      subcommand: undefined,
    });
    expect(resolveRateLimitScope('accessibility')).toEqual({
      command: 'accessibility',
      subcommand: undefined,
    });
  });

  it('carries the extractor subcommand so image and color tier separately', () => {
    expect(resolveRateLimitScope('extractor', 'image')).toEqual({
      command: 'extractor',
      subcommand: 'image',
    });
    expect(resolveRateLimitScope('extractor', 'color')).toEqual({
      command: 'extractor',
      subcommand: 'color',
    });
  });

  it('drops the subcommand for commands without scoped limits', () => {
    expect(resolveRateLimitScope('preset', 'submit')).toEqual({
      command: 'preset',
      subcommand: undefined,
    });
  });

  it('a11y and accessibility share one KV bucket', async () => {
    resetRateLimiterInstance();
    const config: RateLimiterConfig = { kv: createMockKV() };
    const a = resolveRateLimitScope('a11y');
    const b = resolveRateLimitScope('accessibility');
    await checkRateLimit(config, 'user-alias', a.command, undefined, a.subcommand);
    const result = await checkRateLimit(config, 'user-alias', b.command, undefined, b.subcommand);
    // accessibility is 10/min: two calls across the alias pair → 8 remaining
    expect(result.remaining).toBe(8);
  });
});
