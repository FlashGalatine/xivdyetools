/**
 * Analytics Service
 *
 * Tracks command usage via Cloudflare Analytics Engine.
 * Analytics Engine provides automatic aggregation and querying without
 * the overhead of managing Redis or other databases.
 *
 * @see https://developers.cloudflare.com/analytics/analytics-engine/
 */

import type { Env } from '../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

/**
 * Data point structure for Analytics Engine
 */
export interface CommandEvent {
  commandName: string;
  userId: string;
  guildId?: string;
  success: boolean;
  errorType?: string;
  latencyMs?: number;
}

/**
 * Track a command execution in Analytics Engine
 *
 * Data points have:
 * - blobs (up to 20): string dimensions for filtering/grouping
 * - doubles (up to 20): numeric values for aggregation
 * - indexes (up to 1): for efficient querying
 *
 * @param env - Environment bindings
 * @param event - Command event to track
 * @param logger - Optional logger for structured logging
 */
export function trackCommand(
  env: Env,
  event: CommandEvent,
  logger?: ExtendedLogger
): void {
  if (!env.ANALYTICS) {
    // Analytics not configured, silently skip
    return;
  }

  try {
    env.ANALYTICS.writeDataPoint({
      // Use command name as index for efficient querying
      indexes: [event.commandName],
      // String dimensions
      blobs: [
        event.commandName,           // blob1: command name
        event.userId,                // blob2: user ID (for unique user counting)
        event.guildId || 'dm',       // blob3: guild ID or 'dm' for DMs
        event.success ? '1' : '0',   // blob4: success flag
        event.errorType || '',       // blob5: error type if failed
      ],
      // Numeric values
      doubles: [
        event.success ? 1 : 0,       // double1: success count (for aggregation)
        event.latencyMs || 0,        // double2: latency in ms
        1,                           // double3: total count (always 1)
      ],
    });
  } catch (error) {
    // Don't let analytics errors affect command execution
    if (logger) {
      logger.error('Analytics tracking error', error instanceof Error ? error : undefined);
    }
  }
}

/**
 * Query command statistics from Analytics Engine
 *
 * Note: Analytics Engine queries require the Analytics API token,
 * which is separate from the Worker. For now, we use KV-based
 * counters as a simpler alternative that works within the Worker.
 *
 * For full Analytics Engine queries, you'd need to:
 * 1. Set up an API token with Analytics:Read permission
 * 2. Query via: https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql
 */

// ============================================================================
// KV-based Simple Stats (fallback for in-worker querying)
// ============================================================================

const STATS_PREFIX = 'stats:';
const STATS_TTL = 30 * 24 * 60 * 60; // 30 days

/**
 * BUG-007: Separate prefix for per-user tracking keys.
 * Keeps user keys isolated from counter keys so kv.list() on STATS_PREFIX
 * isn't overwhelmed by potentially thousands of individual user entries.
 */
const USER_TRACK_PREFIX = 'usertrack:';

/**
 * Counter metadata structure for OPT-002 optimization
 * Stores count in metadata so KV list() can return counts without individual gets
 */
interface CounterMetadata {
  version: number;
  count: number; // OPT-002: Store count in metadata for fast list() queries
}

/**
 * Increment a counter in KV (for simple stats without Analytics API)
 *
 * DISCORD-BUG-001 FIX: KV doesn't support atomic increments, so concurrent calls
 * can cause lost increments. This implementation uses optimistic concurrency with
 * retries to reduce (but not eliminate) the race window.
 *
 * OPT-002: Stores count in both value and metadata so list() can retrieve
 * counts without individual get() calls.
 *
 * For truly atomic counters, consider using Durable Objects instead.
 * The Analytics Engine integration (trackCommand) provides accurate long-term stats.
 *
 * @param kv - KV namespace
 * @param key - Counter key (without prefix)
 * @param maxRetries - Maximum retry attempts for contention (default: 3)
 */
export async function incrementCounter(
  kv: KVNamespace,
  key: string,
  maxRetries: number = 3
): Promise<void> {
  const fullKey = `${STATS_PREFIX}${key}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Read current value with metadata
    const result = await kv.getWithMetadata<CounterMetadata>(fullKey);
    const current = parseInt(result.value || '0', 10);
    const currentVersion = result.metadata?.version ?? 0;

    // Calculate new value
    const newValue = current + 1;
    const newVersion = currentVersion + 1;

    // Write with new version and count in metadata (OPT-002)
    // Note: This isn't true CAS, but the version helps detect concurrent modifications
    // when debugging. For accurate stats, rely on Analytics Engine.
    await kv.put(fullKey, String(newValue), {
      expirationTtl: STATS_TTL,
      metadata: { version: newVersion, count: newValue },
    });

    // Read back to verify (simple optimistic check)
    // If another write happened between our read and write, the value might be different
    const verification = await kv.get(fullKey);
    const verifiedValue = parseInt(verification || '0', 10);

    // If our write succeeded (value is at least what we wrote), we're done
    // Note: Value could be higher if another concurrent increment also succeeded
    if (verifiedValue >= newValue) {
      return;
    }

    // If verification failed, small delay before retry to reduce contention
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }

  // If all retries failed, log but don't throw - analytics shouldn't break functionality
  // The write still happened, just might have lost an increment due to race condition
}

/**
 * Get a counter value from KV
 */
export async function getCounter(
  kv: KVNamespace,
  key: string
): Promise<number> {
  const fullKey = `${STATS_PREFIX}${key}`;
  return parseInt((await kv.get(fullKey)) || '0', 10);
}

/**
 * Track unique user with individual KV keys
 *
 * BUG-007 FIX: Previous implementation stored all user IDs in a single
 * comma-separated string, causing two issues:
 * 1. Race condition: concurrent read-modify-write could lose user IDs
 * 2. Unbounded growth: string grew ~18 bytes per unique user with no cap
 *
 * New approach uses one KV key per user per day (`usertrack:{date}:{userId}`).
 * - Atomic: a single `put` with no read-modify-write cycle
 * - Bounded: each key is a fixed ~1 byte value, auto-expires via TTL
 * - Read-first: avoids unnecessary writes (100k reads/day free vs 1k writes/day)
 */
export async function trackUniqueUser(
  kv: KVNamespace,
  userId: string
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const key = `${USER_TRACK_PREFIX}${today}:${userId}`;

  // Check first to conserve KV write quota (reads are 100x cheaper on free tier)
  const existing = await kv.get(key);
  if (existing !== null) return;

  await kv.put(key, '1', { expirationTtl: STATS_TTL });
}

/**
 * Track command for both Analytics Engine and KV-based stats
 */
export async function trackCommandWithKV(
  env: Env,
  event: CommandEvent
): Promise<void> {
  // Write to Analytics Engine (for long-term storage)
  trackCommand(env, event);

  // Also update KV counters for in-worker querying
  await Promise.all([
    incrementCounter(env.KV, 'total'),
    incrementCounter(env.KV, `cmd:${event.commandName}`),
    event.success
      ? incrementCounter(env.KV, 'success')
      : incrementCounter(env.KV, 'failure'),
    trackUniqueUser(env.KV, event.userId),
  ]);
}

/**
 * Get aggregated stats from KV
 *
 * OPT-002: Uses KV list() with metadata to get command breakdown in a single
 * operation instead of N+1 individual getCounter() calls. The count is stored
 * in metadata during incrementCounter() so list() returns everything needed.
 */
export async function getStats(kv: KVNamespace): Promise<{
  totalCommands: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  commandBreakdown: Record<string, number>;
  uniqueUsersToday: number;
}> {
  // Get today's unique users key
  const today = new Date().toISOString().split('T')[0];

  // OPT-002: Use single list() call to get all stats keys with metadata
  // This replaces 14+ individual getCounter() calls with one list operation
  const listResult = await kv.list<CounterMetadata>({ prefix: STATS_PREFIX });

  // Initialize counters
  let total = 0;
  let success = 0;
  let failure = 0;
  const commandBreakdown: Record<string, number> = {};

  // Process results from list
  for (const key of listResult.keys) {
    const keyName = key.name.replace(STATS_PREFIX, '');

    // Extract count from metadata if available (OPT-002 optimization)
    const count = key.metadata?.count ?? 0;

    if (keyName === 'total') {
      total = count;
    } else if (keyName === 'success') {
      success = count;
    } else if (keyName === 'failure') {
      failure = count;
    } else if (keyName.startsWith('cmd:')) {
      const cmdName = keyName.replace('cmd:', '');
      if (count > 0) {
        commandBreakdown[cmdName] = count;
      }
    }
  }

  // BUG-007: Count unique users from individual keys under USER_TRACK_PREFIX
  const userListResult = await kv.list({ prefix: `${USER_TRACK_PREFIX}${today}:` });
  const uniqueUsersToday = userListResult.keys.length;

  // Fallback: If metadata doesn't have counts (old data), fetch individually
  // This provides backward compatibility during migration
  if (total === 0 && listResult.keys.some((k) => k.name === `${STATS_PREFIX}total`)) {
    total = await getCounter(kv, 'total');
    success = await getCounter(kv, 'success');
    failure = await getCounter(kv, 'failure');
  }

  return {
    totalCommands: total,
    successCount: success,
    failureCount: failure,
    successRate: total > 0 ? (success / total) * 100 : 0,
    commandBreakdown,
    uniqueUsersToday,
  };
}
