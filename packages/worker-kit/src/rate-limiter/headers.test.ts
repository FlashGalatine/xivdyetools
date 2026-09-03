/**
 * Headers Utility Tests
 */

import { describe, it, expect } from 'vitest';
import { getRateLimitHeaders } from './headers.js';
import type { RateLimitResult } from './types.js';

describe('getRateLimitHeaders', () => {
  it('returns correct headers for allowed request', () => {
    const result: RateLimitResult = {
      allowed: true,
      remaining: 5,
      resetAt: new Date('2026-01-25T12:01:00Z'),
      limit: 10,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers['X-RateLimit-Limit']).toBe('10');
    expect(headers['X-RateLimit-Remaining']).toBe('5');
    // 2026-01-25T12:01:00Z is exactly 1769342460000 ms.
    expect(headers['X-RateLimit-Reset']).toBe('1769342460');
    expect(headers['Retry-After']).toBeUndefined();
  });

  // pkg-worker-kit-test-utils-14: the Reset assertion above used to recompute
  // the implementation's own `Math.ceil(...)` expression, on a timestamp whose
  // sub-second part is zero -- where ceil, floor and trunc all agree. Switching
  // headers.ts to floor kept the suite green. Pin the integer, on a resetAt
  // that actually distinguishes the rounding rule.
  it('rounds X-RateLimit-Reset UP to the next whole second', () => {
    const resetAt = new Date('2026-01-25T12:01:00.400Z'); // 1769342460400 ms
    const result: RateLimitResult = {
      allowed: true,
      remaining: 5,
      resetAt,
      limit: 10,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers['X-RateLimit-Reset']).toBe('1769342461');
    // The contract that rule exists for: never tell a client the window has
    // already reset while it is still in force.
    expect(Number(headers['X-RateLimit-Reset']) * 1000).toBeGreaterThanOrEqual(
      resetAt.getTime(),
    );
  });

  it('includes Retry-After for denied request', () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: new Date('2026-01-25T12:01:00Z'),
      limit: 10,
      retryAfter: 30,
    };

    const headers = getRateLimitHeaders(result);

    expect(headers['Retry-After']).toBe('30');
  });
});
