/**
 * Tests for Rate Limiter Service
 *
 * Tests both KV fallback and new config-based interface.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTranslator } from '@xivdyetools/bot-logic/i18n';
import {
  checkRateLimit,
  resolveRateLimitScope,
  formatRateLimitMessage,
  resetRateLimiterInstance,
  type RateLimitResult,
  type RateLimiterConfig,
} from './rate-limiter.js';

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

describe('rate-limiter.ts', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let config: RateLimiterConfig;
  const mockUserId = 'user-123';

  beforeEach(() => {
    resetRateLimiterInstance();
    mockKV = createMockKV();
    // Use KV backend for tests (Upstash would require mocking the fetch layer)
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
