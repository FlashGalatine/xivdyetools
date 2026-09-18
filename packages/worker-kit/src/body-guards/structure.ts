/**
 * Recursive JSON structure validation: nesting depth and prototype-pollution
 * keys.
 *
 * SEC-003. Lifted verbatim from the two identical copies in `apps/oauth` and
 * `apps/presets-api` (REFACTOR-009, docs/audits/2026-09-16-deep-dive) — the
 * two were byte-for-byte the same function, so there was no "stricter one" to
 * choose between: depth rule, key list, messages and traversal order are all
 * carried over unchanged.
 *
 * @module
 */

/**
 * Keys that must never appear as an own property of a parsed request body.
 *
 * `__proto__` is the direct pollution vector; `constructor` and `prototype`
 * are rejected as well because a two-step walk (`constructor.prototype`)
 * reaches the same place.
 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'] as const;

/**
 * Walk a parsed JSON value, rejecting excessive nesting and prototype
 * pollution keys.
 *
 * The depth budget is inclusive: a value sitting at `depth === maxDepth` is
 * accepted and one at `maxDepth + 1` is not, matching both consumers.
 *
 * @param obj - Parsed JSON value (the result of `JSON.parse`, never raw text)
 * @param maxDepth - Deepest nesting level accepted
 * @param depth - Current recursion level; callers pass `0`
 * @returns An error message, or `null` when the structure is acceptable
 */
export function validateStructure(obj: unknown, maxDepth: number, depth: number): string | null {
  if (depth > maxDepth) {
    return `JSON nesting exceeds maximum depth of ${maxDepth}`;
  }

  if (typeof obj !== 'object' || obj === null) {
    return null;
  }

  for (const key of DANGEROUS_KEYS) {
    if (Object.hasOwn(obj, key)) {
      return 'Invalid JSON structure';
    }
  }

  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const value of values) {
    const error = validateStructure(value, maxDepth, depth + 1);
    if (error) return error;
  }

  return null;
}
