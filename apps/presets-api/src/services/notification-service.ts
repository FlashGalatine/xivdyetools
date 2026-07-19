/**
 * Notification Service
 * Discord bot notification fan-out with retry/backoff, plus the
 * failed_notifications dead-letter queue (write and read paths).
 *
 * REFACTOR-017 (2026-07-18 audit): extracted from handlers/presets.ts so the
 * retry and dead-letter logic is testable without the router, and so the
 * dead-letter feature (previously split between presets.ts and moderation.ts)
 * has a single owner module.
 */

import type { Env } from '../types.js';

export interface PresetNotificationPayload {
  type: 'submission';
  preset: {
    id: string;
    name: string;
    description: string;
    category_id: string;
    dyes: number[];
    tags: string[];
    author_name: string;
    author_discord_id: string;
    status: 'pending' | 'approved' | 'rejected';
    moderation_status: 'clean' | 'flagged' | 'auto_approved';
    source: 'bot' | 'web' | 'none';
    created_at: string;
  };
}

/**
 * PRESETS-CRITICAL-003: Retry configuration for Discord notifications
 */
const NOTIFICATION_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 */
function getBackoffDelay(attempt: number): number {
  const delay = Math.min(
    NOTIFICATION_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
    NOTIFICATION_RETRY_CONFIG.maxDelayMs
  );
  // Add jitter (±25%) to prevent thundering herd
  return delay * (0.75 + Math.random() * 0.5);
}

/**
 * Notify the Discord worker about a new preset submission
 * Uses Cloudflare Service Binding for Worker-to-Worker communication (avoids error 1042)
 *
 * PRESETS-CRITICAL-003: Now includes retry with exponential backoff
 * Retries up to 3 times on transient failures
 */
export async function notifyDiscordBot(env: Env, payload: PresetNotificationPayload): Promise<void> {
  // Check if service binding is configured
  if (!env.DISCORD_WORKER || !env.INTERNAL_WEBHOOK_SECRET) {
    console.log('Discord worker binding not configured, skipping notification');
    return;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= NOTIFICATION_RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // Use service binding for direct Worker-to-Worker communication
      // The hostname is ignored - only the path matters
      const response = await env.DISCORD_WORKER.fetch(
        new Request('https://internal/webhooks/preset-submission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.INTERNAL_WEBHOOK_SECRET}`,
          },
          body: JSON.stringify(payload),
        })
      );

      if (response.ok) {
        if (attempt > 0) {
          console.log(`Discord notification succeeded on retry ${attempt}`);
        }
        return; // Success!
      }

      // Non-retryable errors (4xx client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Discord worker returned ${response.status}: ${await response.text()}`);
      }

      // Server error - will retry
      lastError = new Error(`Discord worker returned ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-network errors
      if (lastError.message.includes('returned 4')) {
        throw lastError;
      }
    }

    // If we have more retries, wait before trying again
    if (attempt < NOTIFICATION_RETRY_CONFIG.maxRetries) {
      const delay = getBackoffDelay(attempt);
      console.log(`Discord notification failed, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${NOTIFICATION_RETRY_CONFIG.maxRetries})`);
      await sleep(delay);
    }
  }

  // All retries exhausted
  throw lastError || new Error('Discord notification failed after all retries');
}

/**
 * BUG-015: Store failed notification in dead-letter table for later review.
 * Called from .catch() blocks when notifyDiscordBot() fails after all retries.
 * Insert is best-effort — failures here are logged but do not propagate.
 */
export async function storeFailedNotification(
  db: D1Database,
  payload: PresetNotificationPayload,
  error: unknown,
  retries: number = NOTIFICATION_RETRY_CONFIG.maxRetries
): Promise<void> {
  try {
    await db
      .prepare(
        'INSERT INTO failed_notifications (payload, error, attempts) VALUES (?, ?, ?)'
      )
      .bind(
        JSON.stringify(payload),
        error instanceof Error ? error.message : String(error),
        retries + 1
      )
      .run();
  } catch (insertErr) {
    // Best-effort — if the table doesn't exist yet or insert fails, log and move on
    console.error('[BUG-015] Failed to store notification in dead-letter table:', insertErr);
  }
}

/**
 * List failed notifications for moderator review (read path of the
 * dead-letter queue; see storeFailedNotification for the write path).
 * Returns an empty list if the table doesn't exist yet.
 */
export async function listFailedNotifications(
  db: D1Database,
  includeResolved: boolean
): Promise<Record<string, unknown>[]> {
  const query = includeResolved
    ? 'SELECT * FROM failed_notifications ORDER BY created_at DESC LIMIT 50'
    : 'SELECT * FROM failed_notifications WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 50';

  try {
    const result = await db.prepare(query).all<Record<string, unknown>>();
    return result.results || [];
  } catch {
    // Table may not exist yet if migration hasn't run
    return [];
  }
}

/**
 * Mark a failed notification as resolved.
 * Returns false when the row doesn't exist or was already resolved.
 */
export async function resolveFailedNotification(
  db: D1Database,
  id: string
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE failed_notifications SET resolved_at = datetime('now') WHERE id = ? AND resolved_at IS NULL"
    )
    .bind(id)
    .run();
  return result.meta.changes > 0;
}
