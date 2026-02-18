/**
 * ID generation utilities for test factories
 *
 * TEST-DESIGN-001: Uses random IDs to prevent race conditions in parallel test execution.
 * Sequential counters are kept for backward compatibility but random IDs are now the default.
 *
 * @example
 * ```typescript
 * // Recommended: Random IDs (safe for parallel tests)
 * const id = randomStringId('preset'); // 'preset-a7x9k2m'
 *
 * // Legacy: Sequential IDs (call resetCounters() in beforeEach for isolation)
 * const seqId = nextStringId('preset'); // 'preset-1'
 * ```
 */

// Counter storage (legacy, for backward compatibility)
const counters: Record<string, number> = {};

/**
 * Generate a random alphanumeric string
 * @param length - Length of the random string (default: 8)
 * @returns Random alphanumeric string
 */
function randomAlphanumeric(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a random numeric ID
 * TEST-DESIGN-001: Safe for parallel test execution
 * @returns A random positive integer
 */
export function randomId(): number {
  return Math.floor(Math.random() * 900000000) + 100000000; // 9-digit number
}

/**
 * Generate a random string ID with prefix
 * TEST-DESIGN-001: Safe for parallel test execution
 * @param prefix - The ID prefix (e.g., 'preset', 'category')
 * @returns A string ID like 'preset-a7x9k2m'
 */
export function randomStringId(prefix: string): string {
  return `${prefix}-${randomAlphanumeric(8)}`;
}

/**
 * Get the next value for a named counter (legacy)
 * @deprecated Use randomId() for parallel-safe ID generation
 * @param name - The counter name (e.g., 'preset', 'category')
 * @returns The next sequential value
 */
export function nextId(name: string): number {
  if (!(name in counters)) {
    counters[name] = 0;
  }
  counters[name]++;
  return counters[name];
}

/**
 * Get a string ID with prefix (legacy)
 * TEST-DESIGN-001: Now uses random IDs by default for parallel-safe execution
 * @param prefix - The ID prefix (e.g., 'preset', 'category')
 * @returns A string ID like 'preset-a7x9k2m'
 */
export function nextStringId(prefix: string): string {
  // TEST-DESIGN-001: Use random IDs by default for parallel test safety
  return randomStringId(prefix);
}

/**
 * Reset all counters to zero
 * Call this in beforeEach() for test isolation
 */
export function resetCounters(): void {
  for (const key in counters) {
    delete counters[key];
  }
}

/**
 * Reset a specific counter
 * @param name - The counter name to reset
 */
export function resetCounter(name: string): void {
  delete counters[name];
}

/**
 * Get the current value of a counter (without incrementing)
 * @param name - The counter name
 * @returns The current counter value, or 0 if not set
 */
export function getCounterValue(name: string): number {
  return counters[name] ?? 0;
}
