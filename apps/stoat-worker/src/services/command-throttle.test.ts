/**
 * Tests for services/command-throttle.ts
 *
 * FINDING-035 / STOAT-2 (2026-08-21 security audit): per-user sliding-window
 * throttle so one user cannot make the bot emit unbounded replies.
 */

import { describe, it, expect } from 'vitest';
import { CommandThrottle } from './command-throttle.js';

describe('CommandThrottle', () => {
  it('allows up to `limit` commands inside the window and rejects the next one', () => {
    const throttle = new CommandThrottle({ limit: 3, windowMs: 10_000 });
    const t0 = 1_000_000;
    expect(throttle.tryAcquire('user-a', t0)).toBe(true);
    expect(throttle.tryAcquire('user-a', t0 + 1)).toBe(true);
    expect(throttle.tryAcquire('user-a', t0 + 2)).toBe(true);
    expect(throttle.tryAcquire('user-a', t0 + 3)).toBe(false);
  });

  it('frees a slot once the oldest command leaves the window', () => {
    const throttle = new CommandThrottle({ limit: 2, windowMs: 10_000 });
    const t0 = 1_000_000;
    expect(throttle.tryAcquire('user-a', t0)).toBe(true);
    expect(throttle.tryAcquire('user-a', t0 + 5_000)).toBe(true);
    expect(throttle.tryAcquire('user-a', t0 + 9_999)).toBe(false);
    expect(throttle.tryAcquire('user-a', t0 + 10_000)).toBe(true);
  });

  it('tracks users independently', () => {
    const throttle = new CommandThrottle({ limit: 1, windowMs: 10_000 });
    const t0 = 1_000_000;
    expect(throttle.tryAcquire('user-a', t0)).toBe(true);
    expect(throttle.tryAcquire('user-a', t0 + 1)).toBe(false);
    expect(throttle.tryAcquire('user-b', t0 + 1)).toBe(true);
  });

  it('has sensible defaults (5 commands per 10 s)', () => {
    const throttle = new CommandThrottle();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(throttle.tryAcquire('u', t0 + i)).toBe(true);
    expect(throttle.tryAcquire('u', t0 + 5)).toBe(false);
    expect(throttle.tryAcquire('u', t0 + 10_000)).toBe(true);
  });

  it('forgets users whose window has fully elapsed (bounded memory)', () => {
    const throttle = new CommandThrottle({ limit: 1, windowMs: 1_000 });
    for (let i = 0; i < 100; i++) throttle.tryAcquire(`user-${i}`, 0);
    // A call well past every window prunes the stale entries
    throttle.tryAcquire('fresh', 60_000);
    expect(throttle.size).toBe(1);
  });
});
