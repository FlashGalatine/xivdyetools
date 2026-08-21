/**
 * Per-user command throttle — in-memory sliding window.
 *
 * FINDING-035 / STOAT-2 (2026-08-21 security audit): one `!xd info <substring>`
 * can make the bot emit up to four messages, and nothing bounded how often a
 * single user could trigger that. The bot is a single Node process, so an
 * in-memory window is enough (the Upstash backend stays a future option).
 *
 * @module command-throttle
 */

export interface CommandThrottleOptions {
  /** Commands allowed per user inside one window (default 5) */
  limit?: number;
  /** Window length in milliseconds (default 10 s) */
  windowMs?: number;
}

export class CommandThrottle {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();
  private lastPrune = 0;

  constructor(options: CommandThrottleOptions = {}) {
    this.limit = options.limit ?? 5;
    this.windowMs = options.windowMs ?? 10_000;
  }

  /** Number of users currently tracked (stale users are pruned lazily). */
  get size(): number {
    return this.hits.size;
  }

  /**
   * Record one command for `key` and report whether it is allowed.
   * Rejected calls do not consume a slot.
   */
  tryAcquire(key: string, now: number = Date.now()): boolean {
    this.pruneAll(now);
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Drop users with no hits inside the window — at most once per window. */
  private pruneAll(now: number): void {
    if (now - this.lastPrune < this.windowMs) return;
    this.lastPrune = now;
    const cutoff = now - this.windowMs;
    for (const [key, timestamps] of this.hits) {
      const live = timestamps.filter((t) => t > cutoff);
      if (live.length === 0) this.hits.delete(key);
      else this.hits.set(key, live);
    }
  }
}
