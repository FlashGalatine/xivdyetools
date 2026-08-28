/**
 * FINDING-003 (2026-08-21 security audit): the KV rate-limit backend cannot
 * throttle a fast client (KV allows 1 write/s/key, failed puts are swallowed,
 * reads are eventually consistent). discord-worker's primary backend is
 * Upstash (atomic INCR); KV is only a dev fallback. When the fallback is
 * selected the worker must say so loudly — once per isolate — so a production
 * deployment without Upstash credentials is visible in the logs instead of
 * silently running with an ineffective limiter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { checkRateLimit, resetRateLimiterInstance } from './rate-limiter.js';

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

  it('warns once per isolate when falling back to KV without Upstash', async () => {
    const logger = mockLogger();
    const kv = createMockKV();

    await checkRateLimit({ kv }, 'user-1', 'harmony', logger);
    await checkRateLimit({ kv }, 'user-1', 'harmony', logger);

    const fallbackWarnings = logger.warn.mock.calls.filter(([msg]) =>
      String(msg).includes('KV fallback'),
    );
    expect(fallbackWarnings).toHaveLength(1);
    expect(String(fallbackWarnings[0][0])).toContain('Upstash');
  });

  it('does not warn when Upstash credentials are configured', async () => {
    const logger = mockLogger();
    // Upstash backend construction does not hit the network; the check will
    // fail open against the unmocked fetch, which is fine for this assertion.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ result: 1 }), { status: 200 })),
    );
    try {
      await checkRateLimit(
        { upstashUrl: 'https://example.upstash.io', upstashToken: 'token', kv: createMockKV() },
        'user-1',
        'harmony',
        logger,
      );
    } finally {
      vi.unstubAllGlobals();
    }
    const fallbackWarnings = logger.warn.mock.calls.filter(([msg]) =>
      String(msg).includes('KV fallback'),
    );
    expect(fallbackWarnings).toHaveLength(0);
  });
});
