/**
 * @xivdyetools/types - API Response Types
 *
 * Generic API response wrappers and caching types.
 *
 * @module api/response
 */

/**
 * Successful API response
 */
export interface APISuccessResponse<T> {
  /** Operation succeeded */
  success: true;

  /** Response data */
  data: T;

  /** Response timestamp (ms since epoch) */
  timestamp: number;
}

/**
 * Failed API response
 */
export interface APIErrorResponse {
  /** Operation failed */
  success: false;

  /** Error message describing the failure */
  error: string;

  /** Response timestamp (ms since epoch) */
  timestamp: number;
}

/**
 * Generic API response wrapper
 *
 * Provides a consistent structure for all API responses.
 * Uses discriminated union for type-safe handling:
 * ```typescript
 * if (response.success) {
 *   // TypeScript knows: data exists and is of type T
 *   console.log(response.data);
 * } else {
 *   // TypeScript knows: error exists
 *   console.error(response.error);
 * }
 * ```
 */
export type APIResponse<T> = APISuccessResponse<T> | APIErrorResponse;

/**
 * Cached data wrapper with TTL and integrity checking
 *
 * Used for storing data with expiration and optional
 * integrity verification.
 */
export interface CachedData<T> {
  /** The cached data */
  data: T;

  /** When data was cached (ms since epoch) */
  timestamp: number;

  /** Time-to-live in milliseconds */
  ttl: number;

  /** Cache version for invalidation */
  version?: string;

  /** Optional checksum for corruption detection */
  checksum?: string;
}
