/**
 * FINDING-003 (2026-08-21 security audit) / FINDING-007 (2026-08-29): the KV
 * rate-limit backend cannot throttle a fast client (KV allows 1 write/s/key,
 * failed puts are swallowed, reads are eventually consistent). The bot's
 * primary backend is the native `[[ratelimits]]` binding; KV is only the
 * fallback for tests and local dev without bindings. When the fallback is
 * selected the worker must say so loudly — once per isolate — so a deployment
 * that lost its `RL_*` bindings is visible in the logs instead of silently
 * running with an ineffective limiter.
 *
 * The warning goes to the logger `checkRateLimit` is CALLED with (the
 * dispatcher passes the request logger), not to one held by the limiter
 * singleton — so these tests pass their own logger the way `src/index.ts`
 * does. `src/index.test.ts` covers the same warning through the real route.
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
    // pkg-worker-kit-test-utils-05: the key carries the tier (RL_15, 60s).
    expect(binding.limit).toHaveBeenCalledWith({
      key: 'ratelimit:user:user-1:harmony:t15_60',
    });
  });
});

/** One `[[ratelimits]]` binding stub that admits every request. */
function tierBinding() {
  return { limit: vi.fn().mockResolvedValue({ success: true }) };
}

/** All the partial-binding warnings this logger saw, in call order. */
function partialWarnings(logger: ReturnType<typeof mockLogger>) {
  return logger.warn.mock.calls.filter(([msg]) =>
    String(msg).includes('RL_* bindings are missing'),
  );
}

/**
 * FINDING-007 follow-up (whole-branch review of the 2026-08-29 audit): only
 * losing ALL six tiers falls back to KV and warns. Losing ONE — a dashboard
 * edit, a half-applied wrangler.toml — keeps the Cloudflare backend, and
 * worker-kit's `selectTier` then routes the orphaned commands to the next
 * LARGER tier: dropping `RL_5` quietly hands `/extractor image` 10/min. The
 * partial case must be as visible as the total one, once per isolate, on the
 * same request-logger path.
 */
describe('discord-worker rate limiter partial RL_* binding warning (FINDING-007)', () => {
  beforeEach(() => {
    resetRateLimiterInstance();
  });

  it('warns once per isolate naming the missing tier, and still serves the command', async () => {
    const logger = mockLogger();
    // Five of six bound — RL_5, `/extractor image`'s own tier, is missing.
    const bindings = {
      RL_10: tierBinding(),
      RL_15: tierBinding(),
      RL_20: tierBinding(),
      RL_30: tierBinding(),
      RL_70: tierBinding(),
    };
    const config = {
      bindings: bindings as unknown as DiscordRateLimitBindings,
      kv: createMockKV(),
    };

    const result = await checkRateLimit(config, 'user-1', 'extractor', logger, 'image');
    await checkRateLimit(config, 'user-1', 'extractor', logger, 'image');

    const warnings = partialWarnings(logger);
    expect(warnings).toHaveLength(1);
    expect(warnings[0][0]).toBe(
      'Rate limiter: some RL_* bindings are missing — affected commands use the next larger tier',
    );
    expect(warnings[0][1]).toEqual({ missing: ['RL_5'] });

    // …and the warning describes something real: the 5/min command was served
    // by the 10/min tier.
    expect(result.allowed).toBe(true);
    expect(bindings.RL_10.limit).toHaveBeenCalledWith({
      key: 'ratelimit:user:user-1:extractor:image:t10_60',
    });
  });

  it('names every missing tier, not just the first', async () => {
    const logger = mockLogger();
    const bindings = { RL_15: tierBinding(), RL_30: tierBinding() };

    await checkRateLimit(
      { bindings: bindings as unknown as DiscordRateLimitBindings, kv: createMockKV() },
      'user-1',
      'harmony',
      logger,
    );

    expect(partialWarnings(logger)[0][1]).toEqual({ missing: ['RL_5', 'RL_10', 'RL_20', 'RL_70'] });
  });

  it('does not warn when all six tiers are bound', async () => {
    const logger = mockLogger();
    const bindings = {
      RL_5: tierBinding(),
      RL_10: tierBinding(),
      RL_15: tierBinding(),
      RL_20: tierBinding(),
      RL_30: tierBinding(),
      RL_70: tierBinding(),
    };

    await checkRateLimit(
      { bindings: bindings as unknown as DiscordRateLimitBindings, kv: createMockKV() },
      'user-1',
      'extractor',
      logger,
      'image',
    );

    expect(partialWarnings(logger)).toHaveLength(0);
    expect(bindings.RL_5.limit).toHaveBeenCalledWith({
      key: 'ratelimit:user:user-1:extractor:image:t5_60',
    });
  });

  it('does not warn when NO tier is bound — that is the KV-fallback warning', async () => {
    const logger = mockLogger();

    await checkRateLimit({ kv: createMockKV() }, 'user-1', 'harmony', logger);

    expect(partialWarnings(logger)).toHaveLength(0);
    expect(
      logger.warn.mock.calls.filter(([msg]) => String(msg).includes('KV fallback')),
    ).toHaveLength(1);
  });
});
