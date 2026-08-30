/**
 * FINDING-003 (2026-08-21 security audit) / FINDING-007 (2026-08-29): the KV
 * rate-limit backend cannot throttle a fast client (KV allows 1 write/s/key,
 * failed puts are swallowed, reads are eventually consistent). The bot's
 * primary backend is the native `[[ratelimits]]` binding; KV is only the
 * fallback for tests and local dev without bindings. When the fallback is
 * selected the worker must say so loudly — once per isolate — so a deployment
 * that lost its `RL_*` bindings is visible in the logs instead of silently
 * running with an ineffective limiter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  checkRateLimit,
  resetRateLimiterInstance,
  type DiscordRateLimitBindings,
} from './rate-limiter.js';

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
  } as unknown as KVNamespace;
}

function mockLogger(): ExtendedLogger & { warn: ReturnType<typeof vi.fn> } {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  } as unknown as ExtendedLogger & { warn: ReturnType<typeof vi.fn> };
}

describe('discord-worker rate limiter KV fallback warning (FINDING-003)', () => {
  beforeEach(() => {
    resetRateLimiterInstance();
  });

  it('warns once per isolate when no RL_* tier is bound', async () => {
    const logger = mockLogger();
    const kv = createMockKV();

    await checkRateLimit({ kv }, 'user-1', 'harmony', logger);
    await checkRateLimit({ kv }, 'user-1', 'harmony', logger);

    const fallbackWarnings = logger.warn.mock.calls.filter(([msg]) =>
      String(msg).includes('KV fallback'),
    );
    expect(fallbackWarnings).toHaveLength(1);
    expect(String(fallbackWarnings[0][0])).toContain('RL_*');
    // The counters really did go to KV.
    expect(kv.put).toHaveBeenCalled();
  });

  it('does not warn when a rate-limit binding is bound', async () => {
    const logger = mockLogger();
    const binding = { limit: vi.fn().mockResolvedValue({ success: true }) };

    await checkRateLimit(
      { bindings: { RL_15: binding } as unknown as DiscordRateLimitBindings, kv: createMockKV() },
      'user-1',
      'harmony',
      logger,
    );

    const fallbackWarnings = logger.warn.mock.calls.filter(([msg]) =>
      String(msg).includes('KV fallback'),
    );
    expect(fallbackWarnings).toHaveLength(0);
    expect(binding.limit).toHaveBeenCalledWith({ key: 'ratelimit:user:user-1:harmony' });
  });
});
