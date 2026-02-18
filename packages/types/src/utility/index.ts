/**
 * @xivdyetools/types - Utility Types
 *
 * Generic utility types for common patterns.
 *
 * @module utility
 */

import type { AppError } from '../error/app-error.js';

/**
 * Generic result type for operations that might fail
 *
 * Use this for functions that can return either a value or an error,
 * avoiding exceptions for expected failure cases.
 *
 * @example
 * ```typescript
 * function parseColor(hex: string): Result<RGB> {
 *   if (!isValidHex(hex)) {
 *     return { ok: false, error: new AppError('INVALID_HEX', 'Invalid hex color') };
 *   }
 *   return { ok: true, value: hexToRgb(hex) };
 * }
 *
 * const result = parseColor('#ff0000');
 * if (result.ok) {
 *   console.log(result.value); // RGB object
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Async result type
 *
 * Promise wrapper around Result for async operations.
 */
export type AsyncResult<T, E = AppError> = Promise<Result<T, E>>;

/**
 * Nullable type
 *
 * Value that can be T or null.
 */
export type Nullable<T> = T | null;

/**
 * Optional type
 *
 * Value that can be T or undefined.
 */
export type Optional<T> = T | undefined;

/**
 * Type guard for checking if a Result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/**
 * Type guard for checking if a Result is an error
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}
