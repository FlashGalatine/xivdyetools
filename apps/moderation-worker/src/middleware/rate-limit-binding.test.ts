/**
 * Rate limiter backend selection (FINDING-003, 2026-08-21 security audit).
 *
 * When the native Workers Rate Limiting bindings (RL_COMMAND / RL_AUTOCOMPLETE)
 * are supplied, per-user limiting must use them; KV — which cannot throttle a
 * fast client — is only the fallback when they are absent.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createMockKV } from '@xivdyetools/test-utils';
import {
  checkRateLimit,
  incrementRateLimit,
  resetRateLimiterInstance,
  RATE_LIMIT_CONFIGS,
} from './rate-limit.js';

function fakeBinding(outcomes: boolean[]): RateLimit & { calls: string[] } {
  const calls: string[] = [];
  let i = 0;
  return {
    calls,
    limit: async ({ key }: { key: string }) => {
      calls.push(key);
      const success = outcomes[Math.min(i, outcomes.length - 1)];
      i++;
      return { success };
    },
  } as unknown as RateLimit & { calls: string[] };
}

describe('moderation-worker rate limiter backend selection', () => {
  let mockKV: ReturnType<typeof createMockKV> & KVNamespace<string>;

  beforeEach(() => {
    resetRateLimiterInstance();
    mockKV = createMockKV() as ReturnType<typeof createMockKV> & KVNamespace<string>;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the command binding for command interactions and denies when it says no', async () => {
    const command = fakeBinding([true, false]);
    const autocomplete = fakeBinding([true]);
    const bindings = { command, autocomplete };

    const first = await checkRateLimit(mockKV, 'user-1', 'command', RATE_LIMIT_CONFIGS.command, bindings);
    await incrementRateLimit(mockKV, 'user-1', 'command', 3, bindings);
    const second = await checkRateLimit(mockKV, 'user-1', 'command', RATE_LIMIT_CONFIGS.command, bindings);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.retryAfter).toBeGreaterThan(0);
    expect(command.calls).toEqual(['ratelimit:command:user-1', 'ratelimit:command:user-1']);
    expect(autocomplete.calls).toHaveLength(0);
    // KV is never written when the bindings are present
    expect(mockKV._store.size).toBe(0);
  });

  it('uses the autocomplete binding for autocomplete interactions', async () => {
    const command = fakeBinding([true]);
    const autocomplete = fakeBinding([true]);
    await checkRateLimit(mockKV, 'user-2', 'autocomplete', RATE_LIMIT_CONFIGS.autocomplete, {
      command,
      autocomplete,
    });
    expect(autocomplete.calls).toEqual(['ratelimit:autocomplete:user-2']);
    expect(command.calls).toHaveLength(0);
  });

  it('falls back to KV when no bindings are supplied', async () => {
    const result = await checkRateLimit(mockKV, 'user-3', 'command', RATE_LIMIT_CONFIGS.command);
    await incrementRateLimit(mockKV, 'user-3', 'command');
    expect(result.allowed).toBe(true);
    expect(mockKV._store.size).toBe(1);
  });
});
