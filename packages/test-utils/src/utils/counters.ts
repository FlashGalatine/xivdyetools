/**
 * ID generation utilities for test factories
 *
 * TEST-DESIGN-001: Uses random IDs to prevent race conditions in parallel test execution.
 *
 * @example
 * ```typescript
 * const id = randomStringId('preset'); // 'preset-a7x9k2m'
 * const numId = randomId();            // 438291057
 * ```
 */

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
 * Get a string ID with prefix
 * TEST-DESIGN-001: Delegates to randomStringId for parallel-safe execution
 * @param prefix - The ID prefix (e.g., 'preset', 'category')
 * @returns A string ID like 'preset-a7x9k2m'
 */
export function nextStringId(prefix: string): string {
  return randomStringId(prefix);
}
