/**
 * KVRateLimiter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KVRateLimiter } from './kv.js';
import type { RateLimitConfig, RateLimiterLogger } from '../types.js';

/**
 * Create a mock logger for testing
 */
function createMockLogger(): RateLimiterLogger & {
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    warn: vi.fn() as unknown as RateLimiterLogger['warn'] & ReturnType<typeof vi.fn>,
    error: vi.fn() as unknown as RateLimiterLogger['error'] & ReturnType<typeof vi.fn>,
  };
}

/**
 * Mock KVNamespace for testing
 */
function createMockKV(): KVNamespace {
  const store = new Map<string, { value: string; metadata?: unknown }>();

  return {
    get: vi.fn(async (key: string) => {
      return store.get(key)?.value ?? null;
    }),
    getWithMetadata: vi.fn(async (key: string) => {
      const entry = store.get(key);
      return {
        value: entry?.value ?? null,
        metadata: entry?.metadata ?? null,
      };
    }),
    put: vi.fn(
      async (
        key: string,
        value: string,
        options?: { expirationTtl?: number; metadata?: unknown }
      ) => {
        store.set(key, { value, metadata: options?.metadata });
      }
    ),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: { prefix?: string }) => {
      const keys: { name: string }[] = [];
      store.forEach((_, key) => {
        if (!options?.prefix || key.startsWith(options.prefix)) {
          keys.push({ name: key });
        }
      });
      return { keys, list_complete: true, cursor: '' };
    }),
  } as unknown as KVNamespace;
}

describe('KVRateLimiter', () => {
  let mockKV: KVNamespace;
  let limiter: KVRateLimiter;
  const defaultConfig: RateLimitConfig = {
    maxRequests: 5,
    windowMs: 60_000,
  };

  beforeEach(() => {
    mockKV = createMockKV();
    limiter = new KVRateLimiter({ kv: mockKV });
    vi.useFakeTimers();
  });

  describe('check()', () => {
    it('allows requests under the limit', async () => {
      const result = await limiter.check('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
    });

    it('denies requests over the limit', async () => {
      // Make 5 requests (the limit)
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
      }

      // 6th request should be denied
      const result = await limiter.check('user1', defaultConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('tracks different keys independently', async () => {
      // Fill up user1's limit
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
      }

      // user2 should still have full allowance
      const result = await limiter.check('user2', defaultConfig);

      expect(result.allowed).toBe(true);
    });
  });

  describe('checkOnly()', () => {
    it('does not increment the counter', async () => {
      // Check multiple times with checkOnly
      await limiter.checkOnly('user1', defaultConfig);
      await limiter.checkOnly('user1', defaultConfig);
      await limiter.checkOnly('user1', defaultConfig);

      // All should be allowed since we didn't increment
      const result = await limiter.checkOnly('user1', defaultConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // BUG-004: checkOnly reports without consuming
    });
  });

  describe('increment()', () => {
    it('increments the counter', async () => {
      // Increment without checking first
      await limiter.increment('user1', defaultConfig);
      await limiter.increment('user1', defaultConfig);

      // Check should show 2 requests made
      const result = await limiter.checkOnly('user1', defaultConfig);
      expect(result.remaining).toBe(3); // 5 - 2 = 3 (BUG-004: no extra -1)
    });
  });

  describe('fail-open behavior', () => {
    it('allows request on KV error when failOpen is true', async () => {
      // Make KV throw an error
      vi.mocked(mockKV.get).mockRejectedValueOnce(new Error('KV error'));

      const result = await limiter.checkOnly('user1', {
        ...defaultConfig,
        failOpen: true,
      });

      expect(result.allowed).toBe(true);
      expect(result.backendError).toBe(true);
    });

    it('allows request on KV error by default', async () => {
      vi.mocked(mockKV.get).mockRejectedValueOnce(new Error('KV error'));

      const result = await limiter.checkOnly('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.backendError).toBe(true);
    });

    it('FINDING-012: falls back to console.warn (redacted) when no logger is supplied, so fail-open is never silent', async () => {
      // Before this sprint, `this.logger?.warn(...)` alone meant a limiter
      // built without a logger (every consumer, until Sprints 2/4 of the
      // 2026-08-29 audit) fell open on a KV error with NO signal anywhere —
      // docs/architecture/security-trade-offs.md accepts fail-open only on
      // the condition that fail-open events are logged and alertable.
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(mockKV.get).mockRejectedValueOnce(new Error('KV error'));

      const result = await limiter.checkOnly('user1', defaultConfig);

      expect(result.backendError).toBe(true);
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const [message, context] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>];
      expect(message).toBe('Rate limiter fail-open: KV read error, allowing request');
      expect(context.key).toBeUndefined();
      expect(context.kvKey).toBeUndefined();
      expect(context.keyScope).toBe('ratelimit');
      consoleSpy.mockRestore();
    });

    it('throws on KV error when failOpen is false', async () => {
      vi.mocked(mockKV.get).mockRejectedValueOnce(new Error('KV error'));

      await expect(
        limiter.checkOnly('user1', { ...defaultConfig, failOpen: false })
      ).rejects.toThrow('KV error');
    });
  });

  describe('burst allowance', () => {
    it('allows burst requests beyond base limit', async () => {
      const configWithBurst: RateLimitConfig = {
        maxRequests: 5,
        windowMs: 60_000,
        burstAllowance: 3,
      };

      // Make 8 requests (5 base + 3 burst)
      for (let i = 0; i < 8; i++) {
        const result = await limiter.check('user1', configWithBurst);
        expect(result.allowed).toBe(true);
      }

      // 9th request should be denied
      const result = await limiter.check('user1', configWithBurst);
      expect(result.allowed).toBe(false);
    });
  });

  describe('reset()', () => {
    it('resets rate limit for a specific key', async () => {
      // Fill up limit
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
      }

      // Reset
      await limiter.reset('user1');

      // Should be allowed again
      const result = await limiter.check('user1', defaultConfig);
      expect(result.allowed).toBe(true);
    });
  });

  describe('resetAll()', () => {
    it('resets all rate limits', async () => {
      // Fill up limits
      for (let i = 0; i < 5; i++) {
        await limiter.check('user1', defaultConfig);
        await limiter.check('user2', defaultConfig);
      }

      // Reset all
      await limiter.resetAll();

      // Both should be allowed again
      const result1 = await limiter.check('user1', defaultConfig);
      const result2 = await limiter.check('user2', defaultConfig);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('key prefix', () => {
    it('uses custom key prefix', async () => {
      const customLimiter = new KVRateLimiter({
        kv: mockKV,
        keyPrefix: 'custom:',
      });

      await customLimiter.check('user1', defaultConfig);

      // Verify the key prefix was used
      expect(mockKV.get).toHaveBeenCalledWith(
        expect.stringContaining('custom:user1|')
      );
    });
  });

  describe('logger integration', () => {
    it('logs warning on fail-open event', async () => {
      const mockLogger = createMockLogger();
      const loggedLimiter = new KVRateLimiter({
        kv: mockKV,
        logger: mockLogger,
      });

      // Make KV throw an error
      vi.mocked(mockKV.get).mockRejectedValueOnce(new Error('KV unavailable'));

      const result = await loggedLimiter.checkOnly('user1', defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.backendError).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      const [message, context] = mockLogger.warn.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(message).toBe('Rate limiter fail-open: KV read error, allowing request');
      // 2026-08-29 FINDING-010: neither the raw key nor the derived kvKey
      // (which embeds it) may appear — only the scope. A test that just
      // checked `warn` fired would still pass if this redaction were
      // reverted, so assert on the absence of the value, not merely the
      // presence of a warning.
      expect(context.key).toBeUndefined();
      expect(context.kvKey).toBeUndefined();
      expect(context.keyScope).toBe('ratelimit'); // default keyPrefix, trimmed
      expect(context.operation).toBe('checkOnly');
      expect(context.error).toBe('KV unavailable');
    });

    it('logs error on increment failure after retries', async () => {
      const mockLogger = createMockLogger();
      const loggedLimiter = new KVRateLimiter({
        kv: mockKV,
        logger: mockLogger,
        maxRetries: 2, // Reduce retries for faster test
      });

      // Make KV operations fail (BUG-022/OPT-002: increment reads via get)
      vi.mocked(mockKV.get).mockRejectedValue(new Error('KV write failed'));

      await loggedLimiter.increment('user1', defaultConfig);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      const [message, err, context] = mockLogger.error.mock.calls[0] as [
        string,
        unknown,
        Record<string, unknown>,
      ];
      expect(message).toBe('Rate limiter KV increment failed after retries');
      expect(err).toBeInstanceOf(Error);
      // 2026-08-29 FINDING-010: same property as the checkOnly test above.
      expect(context.key).toBeUndefined();
      expect(context.kvKey).toBeUndefined();
      expect(context.keyScope).toBe('ratelimit');
      expect(context.attempts).toBe(2);
      expect(context.maxRetries).toBe(2);
    });

    it('falls back to console.error (redacted) when no logger is provided', async () => {
      // 2026-08-29 FINDING-012: this fallback already existed before this
      // sprint (it is the in-repo precedent the fail-open console.warn
      // fallbacks were modeled on) — this test locks in that the FINDING-010
      // redaction also reaches it, since it shares `errorContext` with the
      // structured-logger branch above.
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(mockKV.get).mockRejectedValue(new Error('KV write failed'));

      await limiter.increment('user1', defaultConfig);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const [message, context] = consoleSpy.mock.calls[0] as [string, Record<string, unknown>];
      expect(message).toBe('Rate limit increment error after retries');
      expect(context.key).toBeUndefined();
      expect(context.kvKey).toBeUndefined();
      expect(context.keyScope).toBe('ratelimit');
      expect(JSON.stringify(context)).not.toContain('user1');
      consoleSpy.mockRestore();
    });
  });

  // pkg-worker-kit-test-utils-07: nothing in this file crossed a fixed-window
  // boundary, so BUG-064 -- check() capturing `now` ONCE so that checkOnly()
  // and increment() address the same buildKey(key, now, windowMs) -- was
  // unfalsifiable. Deleting the shared `now` and letting each half re-read
  // Date.now() lets a request read window N and write window N+1: the request
  // goes uncounted in the window that authorised it.
  describe('fixed-window boundary (BUG-064)', () => {
    it('reads and writes the same window key when the clock crosses a boundary mid-call', async () => {
      vi.useFakeTimers();
      try {
        const windowMs = 60_000;
        // 1 ms before the start of window 100.
        vi.setSystemTime(windowMs * 100 - 1);

        const getKeys: string[] = [];
        const putKeys: string[] = [];
        let stepped = false;

        const kv = {
          get: vi.fn(async (k: string) => {
            getKeys.push(k);
            if (!stepped) {
              stepped = true;
              // Real KV latency lands on exactly this await. Step the clock
              // across the boundary here, between checkOnly and increment.
              vi.setSystemTime(windowMs * 100 + 1);
            }
            return null;
          }),
          getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
          put: vi.fn(async (k: string) => {
            putKeys.push(k);
          }),
          delete: vi.fn(async () => undefined),
          list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
        } as unknown as KVNamespace;

        const limiter = new KVRateLimiter({ kv });
        await limiter.check('user1', { maxRequests: 5, windowMs });

        // The read landed in window 99 ...
        expect(getKeys[0]).toMatch(/\|99$/);
        // ... and so must the write. Without the shared clock this is `|100`,
        // so the request is charged to a window the check never consulted.
        expect(putKeys).toHaveLength(1);
        expect(putKeys[0]).toBe(getKeys[0]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

/**
 * A KV mock that pages `list()` like the real one: `pageSize` keys per call,
 * a cursor to continue, `list_complete` only on the last page.
 */
function createPagingKV(names: string[], pageSize: number) {
  const store = new Set(names);
  const listCalls: Array<{ prefix?: string; cursor?: string }> = [];
  const kv = {
    list: vi.fn(async (options?: { prefix?: string; cursor?: string }) => {
      listCalls.push({ prefix: options?.prefix, cursor: options?.cursor });
      const matching = [...store]
        .filter((k) => !options?.prefix || k.startsWith(options.prefix))
        .sort();
      // Like real KV, the cursor is key-based, so deleting while paging is safe.
      const after = options?.cursor ? matching.filter((k) => k > options.cursor!) : matching;
      const keys = after.slice(0, pageSize).map((name) => ({ name }));
      return after.length <= pageSize
        ? { keys, list_complete: true, cacheStatus: null }
        : { keys, list_complete: false, cursor: keys[keys.length - 1].name, cacheStatus: null };
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as KVNamespace;
  return { kv, store, listCalls };
}

describe('KVRateLimiter reset paging (BUG-151)', () => {
  const names = Array.from({ length: 5 }, (_, i) => `ratelimit:a|${i}`);

  it('resetAll deletes every key across list pages', async () => {
    const { kv, store, listCalls } = createPagingKV([...names, 'other:x|1'], 2);
    await new KVRateLimiter({ kv }).resetAll();
    expect([...store]).toEqual(['other:x|1']);
    expect(listCalls.length).toBeGreaterThan(1);
    expect(listCalls[1].cursor).toBe('ratelimit:a|1');
  });

  it("reset(key) deletes all of that client's keys and none of another client's", async () => {
    const { kv, store } = createPagingKV([...names, 'ratelimit:b|1', 'ratelimit:b|2'], 2);
    await new KVRateLimiter({ kv }).reset('a');
    expect([...store].sort()).toEqual(['ratelimit:b|1', 'ratelimit:b|2']);
  });

  it('deletes in chunks of at most 50 concurrent calls', async () => {
    const many = Array.from({ length: 120 }, (_, i) => `ratelimit:c|${String(i).padStart(3, '0')}`);
    const { kv, store } = createPagingKV(many, 1000);
    let inFlight = 0;
    let peak = 0;
    (kv.delete as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (key: string) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      store.delete(key);
      inFlight--;
    });
    await new KVRateLimiter({ kv }).resetAll();
    expect(store.size).toBe(0);
    expect(peak).toBeLessThanOrEqual(50);
    expect(peak).toBeGreaterThan(1);
  });

  it('stops on a non-complete page with no cursor', async () => {
    const kv = {
      list: vi.fn(async () => ({ keys: [], list_complete: false })),
      delete: vi.fn(),
    } as unknown as KVNamespace;
    await new KVRateLimiter({ kv }).resetAll();
    expect(kv.list).toHaveBeenCalledTimes(1);
  });

  it('stops when the cursor repeats', async () => {
    const kv = {
      list: vi.fn(async () => ({
        keys: [{ name: 'ratelimit:z|1' }],
        list_complete: false,
        cursor: 'same',
      })),
      delete: vi.fn(async () => {}),
    } as unknown as KVNamespace;
    await new KVRateLimiter({ kv }).resetAll();
    expect((kv.list as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('stops on a cursor cycle longer than one (A, B, A)', async () => {
    const cursors = ['A', 'B', 'A', 'B', 'A'];
    let i = 0;
    const kv = {
      list: vi.fn(async () => ({
        keys: [{ name: `ratelimit:z|${i}` }],
        list_complete: false,
        cursor: cursors[i++] ?? 'A',
      })),
      delete: vi.fn(async () => {}),
    } as unknown as KVNamespace;
    await new KVRateLimiter({ kv }).resetAll();
    expect((kv.list as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(3);
  }, 2000);

  it('still propagates a KV error', async () => {
    const kv = {
      list: vi.fn(async () => {
        throw new Error('kv down');
      }),
    } as unknown as KVNamespace;
    await expect(new KVRateLimiter({ kv }).reset('a')).rejects.toThrow('kv down');
  });
});
