/**
 * RequestCoalescer - Prevents duplicate in-flight requests
 *
 * When multiple requests come in for the same resource simultaneously,
 * this ensures only one actual upstream request is made. Other requests
 * wait for and share the result of the first request.
 *
 * Note: This works within a single isolate instance. Cross-isolate deduplication
 * is handled by the Cache API and KV layers.
 */

/**
 * PROXY-CRITICAL-001: Use timestamp-based entries for proper cleanup
 * This prevents memory leaks if promises hang or take too long
 */
interface InFlightEntry {
  promise: Promise<unknown>;
  createdAt: number;
}

/**
 * In-flight request tracking map
 * This lives at module scope and persists for the lifetime of the isolate
 */
const inFlightRequests = new Map<string, InFlightEntry>();

/**
 * Maximum time to keep a request in the in-flight map (safety timeout)
 */
const MAX_IN_FLIGHT_TIME_MS = 60000; // 60 seconds

/**
 * Base cleanup interval (target: every ~10 seconds)
 * OPT-003: Using jitter to prevent thundering herd across isolates
 */
const BASE_CLEANUP_INTERVAL_MS = 10000; // 10 seconds

/**
 * Jitter factor: ±20% variation around base interval
 * This spreads cleanup across 8-12 second window to prevent synchronized spikes
 */
const CLEANUP_JITTER_FACTOR = 0.2;

/**
 * Generate next cleanup interval with random jitter
 * Returns value between BASE * (1 - JITTER) and BASE * (1 + JITTER)
 */
function getNextCleanupInterval(): number {
  const jitter = (Math.random() - 0.5) * 2 * CLEANUP_JITTER_FACTOR;
  return BASE_CLEANUP_INTERVAL_MS * (1 + jitter);
}

/**
 * Last cleanup timestamp to avoid excessive sweeps
 */
let lastCleanupTime = 0;

/**
 * Next cleanup interval (randomized per OPT-003)
 */
let nextCleanupInterval = getNextCleanupInterval();

/**
 * Cleanup stale entries from the in-flight map
 * This is called periodically to ensure memory doesn't grow unboundedly
 * OPT-003: Uses jittered interval to prevent thundering herd
 */
function cleanupStaleEntries(): void {
  const now = Date.now();

  // Don't cleanup too frequently (jittered interval)
  if (now - lastCleanupTime < nextCleanupInterval) {
    return;
  }
  lastCleanupTime = now;
  nextCleanupInterval = getNextCleanupInterval(); // Randomize for next cleanup

  // Remove entries older than MAX_IN_FLIGHT_TIME_MS
  for (const [key, entry] of inFlightRequests) {
    if (now - entry.createdAt > MAX_IN_FLIGHT_TIME_MS) {
      inFlightRequests.delete(key);
    }
  }
}

/**
 * RequestCoalescer handles request deduplication within an isolate
 */
export class RequestCoalescer {
  private ctx: ExecutionContext;

  constructor(ctx: ExecutionContext) {
    this.ctx = ctx;
  }

  /**
   * Execute a fetch function with request coalescing
   *
   * If an identical request is already in flight, returns its result.
   * Otherwise, executes the fetch function and shares the result with
   * any concurrent requests for the same key.
   *
   * PROXY-BUG-001 FIX: Uses deferred promise pattern to prevent race conditions.
   * The entry is stored in the map SYNCHRONOUSLY before any async work begins,
   * ensuring concurrent calls will always see the in-flight request.
   *
   * @param key - Unique identifier for the request (usually the cache key)
   * @param fetchFn - Function that performs the actual fetch
   * @returns The fetch result (may be shared with other concurrent requests)
   */
  async coalesce<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    // Run periodic cleanup to prevent memory leaks
    cleanupStaleEntries();

    // PROXY-BUG-001 FIX: Check for existing in-flight request FIRST (synchronous)
    const existing = inFlightRequests.get(key);
    if (existing) {
      // Wait for the existing promise - it will either resolve or reject
      return existing.promise as Promise<T>;
    }

    // PROXY-BUG-001 FIX: Create a deferred promise and store it SYNCHRONOUSLY
    // This ensures the entry exists before any async operations
    let resolvePromise: (value: T) => void;
    let rejectPromise: (error: unknown) => void;

    const promise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    // Suppress unhandled rejection on the deferred promise — the error is
    // re-thrown from coalesce() so callers already receive it, but the
    // deferred promise itself has no listener when there are no concurrent waiters.
    promise.catch(() => {});

    // Store entry immediately (synchronous operation)
    inFlightRequests.set(key, {
      promise,
      createdAt: Date.now(),
    });

    // Now execute the actual fetch and wire up the deferred promise
    try {
      const result = await fetchFn();

      // Schedule cleanup with a small delay for rapid sequential requests
      this.ctx.waitUntil(
        (async (): Promise<void> => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          inFlightRequests.delete(key);
        })()
      );

      resolvePromise!(result);
      return result;
    } catch (error) {
      // Clean up immediately on error so retries can proceed
      inFlightRequests.delete(key);
      rejectPromise!(error);
      throw error;
    }
  }

  /**
   * Check if a request is currently in flight
   */
  isInFlight(key: string): boolean {
    return inFlightRequests.has(key);
  }

  /**
   * Get the current number of in-flight requests (for debugging)
   */
  getInFlightCount(): number {
    return inFlightRequests.size;
  }
}
