/**
 * Headers Utility Tests
 */

import { describe, it, expect } from 'vitest';
import { getRateLimitHeaders, formatRateLimitMessage } from './headers.js';
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
    expect(headers['X-RateLimit-Reset']).toBe(
      String(Math.ceil(result.resetAt.getTime() / 1000))
    );
    expect(headers['Retry-After']).toBeUndefined();
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

describe('formatRateLimitMessage', () => {
  it('returns success message for allowed request', () => {
    const result: RateLimitResult = {
      allowed: true,
      remaining: 5,
      resetAt: new Date(),
      limit: 10,
    };

    const message = formatRateLimitMessage(result);

    expect(message).toContain('Rate limit OK');
    expect(message).toContain('5 requests remaining');
  });

  it('returns seconds message for short wait time', () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30_000),
      limit: 10,
      retryAfter: 30,
    };

    const message = formatRateLimitMessage(result);

    expect(message).toContain('Rate limit exceeded');
    expect(message).toContain('30 seconds');
  });

  it('returns minutes message for longer wait time', () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 120_000),
      limit: 10,
      retryAfter: 120,
    };

    const message = formatRateLimitMessage(result);

    expect(message).toContain('Rate limit exceeded');
    expect(message).toContain('2 minutes');
  });

  it('handles singular minute', () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 65_000),
      limit: 10,
      retryAfter: 65,
    };

    const message = formatRateLimitMessage(result);

    expect(message).toContain('2 minutes'); // ceil(65/60) = 2
  });
});
